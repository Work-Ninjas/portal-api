// F4-B Tenant Admin Routes - Server-side token generation
// No browser crypto - all token generation server-side with @datahubportal/tokens

const express = require('express');
const { initTokens, generateToken } = require('@datahubportal/tokens');
const { getDatabase } = require('../services/database');
const { logger } = require('../utils/logger');
const { problem } = require('../middleware/bearerAuth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Generate trace ID helper
function generateTraceId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Middleware to extract session/tenant context from portal session
function requirePortalSession(req, res, next) {
  const traceId = req.headers['x-request-id'] || generateTraceId();
  req.traceId = traceId;
  
  // F4-B: Extract client_id and user_id from portal session
  const sessionClientId = req.headers['x-client-id']; // From portal session
  const sessionUserId = req.headers['x-user-id']; // From portal session
  
  if (!sessionClientId || !sessionUserId) {
    return problem(res, 401, 'unauthorized', 'Portal session required (missing client_id or user_id)', traceId);
  }
  
  req.context = {
    client_id: sessionClientId,
    actor_user_id: sessionUserId, // Real user ID from portal session
    traceId
  };
  
  next();
}

// POST /tenant/v1/api-keys - Create new API key (server-side generation)
router.post('/api-keys', requirePortalSession, async (req, res) => {
  const { client_id, actor_user_id, traceId } = req.context;
  const { label, expires_at } = req.body;
  
  try {
    // F4-B: Server-side token generation with @datahubportal/tokens
    const env = process.env.TOKEN_ENV === 'live' ? 'live' : 'stg';
    logger.info('F4-B: Generating token server-side', { env, client_id, traceId });
    
    // Initialize tokens package before generating
    await initTokens({
      getPepper: async (saltId) => {
        // Development pepper - use environment variable in production
        return process.env.API_TOKEN_PEPPER_v1 || 'development-pepper-for-testing-only';
      }
    });
    
    const { plaintext, publicId, hash, hashVersion, hashSaltId } = await generateToken(env);
    
    // F4-B: NO logs with plaintext - only publicId for debug
    logger.info('F4-B: Token generated successfully', { 
      prefix_public_id: publicId, 
      env, 
      client_id, 
      traceId 
    });
    
    // Insert with hash-only RPC
    const db = getDatabase();
    const { data, error } = await db.supabase.rpc('api_create_api_key', {
      p_client_id: client_id,
      p_label: label || 'Generated API Key',
      p_actor_user_id: actor_user_id,
      p_expires_at: expires_at || null,
      p_prefix_public_id: publicId,
      p_hash: hash,
      p_hash_version: hashVersion,
      p_hash_salt_id: hashSaltId,
      p_scopes: ['read'],
      p_token_env: env
    });
    
    if (error) {
      logger.error('F4-B: Database error creating API key', { error: error.message, traceId });
      return problem(res, 500, 'internal_error', 'Failed to create API key', traceId);
    }
    
    // F4-B: Return plaintext ONLY ONCE
    const response = {
      id: data.id,
      label: data.label,
      prefix_public_id: publicId,
      status: 'active',
      token_env: env,
      api_key_plaintext: plaintext // ONLY returned once!
    };
    
    logger.info('F4-B: API key created successfully', {
      id: data.id,
      prefix_public_id: publicId,
      client_id,
      env,
      traceId
    });
    
    res.status(201).json(response);
    
  } catch (error) {
    logger.error('F4-B: Failed to create API key', {
      error: error.message,
      client_id,
      traceId
    });
    
    // F4-B: 503 if Key Vault fails (no fallback)
    if (error.message.includes('Key Vault') || error.message.includes('pepper')) {
      return problem(res, 503, 'service_unavailable', 'Token generation service unavailable', traceId);
    }
    
    return problem(res, 500, 'internal_error', 'Failed to create API key', traceId);
  }
});

// POST /tenant/v1/api-keys/{keyId}/rotate - Rotate API key
router.post('/api-keys/:keyId/rotate', requirePortalSession, async (req, res) => {
  const { client_id, actor_user_id, traceId } = req.context;
  const { keyId } = req.params;
  
  // B) Log puntual para diagnosticar 404
  logger.info('rotate_check', {
    path_id: keyId,
    derived_client_id: client_id,
    token_env: process.env.TOKEN_ENV || 'not_set',
    traceId
  });
  
  try {
    // F4-B: Server-side token generation
    const env = process.env.TOKEN_ENV === 'live' ? 'live' : 'stg';
    logger.info('F4-B: Rotating token server-side', { keyId, env, client_id, traceId });
    
    // Initialize tokens package before generating
    await initTokens({
      getPepper: async (saltId) => {
        // Development pepper - use environment variable in production
        return process.env.API_TOKEN_PEPPER_v1 || 'development-pepper-for-testing-only';
      }
    });
    
    const { plaintext, publicId, hash, hashVersion, hashSaltId } = await generateToken(env);
    
    logger.info('F4-B: New token generated for rotation', { 
      keyId,
      prefix_public_id: publicId, 
      env, 
      client_id, 
      traceId 
    });
    
    // F4-B: Direct Supabase update + manual audit (RPC has wrong column name)
    const db = getDatabase();
    
    logger.info('F4-B: Starting database update for rotation', { 
      keyId, 
      client_id, 
      newPublicId: publicId,
      traceId 
    });
    
    // F4-B: DEBUG - Test if record exists with SELECT first
    const { data: testData, error: testError } = await db.supabase
      .from('api_keys')
      .select('*')
      .match({ 
        id: keyId,
        client_id: client_id,
        status: 'active',
        token_env: env
      });
    
    logger.info('F4-B: DEBUG - SELECT test result', { 
      hasError: !!testError,
      errorMessage: testError?.message,
      dataLength: testData?.length || 0,
      testData: testData,
      keyId,
      traceId 
    });
    
    // F4-B: Log all query parameters for debugging
    logger.info('F4-B: Rotation query parameters', {
      keyId: keyId,
      keyIdType: typeof keyId,
      client_id: client_id,
      clientIdType: typeof client_id,
      status: 'active',
      env: env,
      traceId
    });
    
    // Update the API key - use match() for better debugging
    const updateData = {
      prefix_public_id: publicId,
      token_env: env,
      hash: hash,
      hash_version: hashVersion,
      hash_salt_id: hashSaltId,
      updated_at: new Date().toISOString()
    };
    
    // Use match() with token_env filter for RLS policy compliance
    const { data, error } = await db.supabase
      .from('api_keys')
      .update(updateData)
      .match({ 
        id: keyId,
        client_id: client_id,
        status: 'active',
        token_env: env
      })
      .select('*');
    
    logger.info('F4-B: Database update result', { 
      hasError: !!error,
      errorMessage: error?.message,
      dataLength: data?.length || 0,
      data: data,
      keyId,
      traceId 
    });
    
    // Handle the result manually  
    const updatedKey = data && data.length > 0 ? data[0] : null;
    
    // Manual audit logging (since RPC uses wrong column name api_key_id instead of resource_id)
    if (!error && updatedKey) {
      try {
        await db.supabase
          .from('api_key_audit')
          .insert({
            client_id: client_id,
            event_type: 'api_key_rotated',
            event_category: 'lifecycle',
            severity: 'warning',
            actor_user_id: actor_user_id,
            resource_type: 'api_key',
            resource_id: keyId,
            details: {
              old_key_id: keyId,
              reason: 'user_initiated',
              timestamp: new Date().toISOString(),
              source: 'portal',
              new_prefix_public_id: publicId,
              token_env: env,
              hash_version: hashVersion
            }
          });
      } catch (auditError) {
        logger.warn('F4-B: Audit logging failed for key rotation', { 
          keyId, 
          error: auditError.message 
        });
      }
    }
    
    if (error) {
      logger.error('F4-B: Database error rotating API key', { 
        keyId, 
        error: error.message, 
        traceId 
      });
      return problem(res, 500, 'internal_error', 'Failed to rotate API key', traceId);
    }
    
    if (!updatedKey) {
      logger.warn('rotate_not_found', {
        path_id: keyId,
        derived_client_id: client_id,
        reason: 'no_row_for_id+client',
        traceId
      });
      return problem(res, 404, 'not_found', 'API key not found', traceId);
    }
    
    // F4-B: Return new plaintext ONLY ONCE
    const response = {
      id: updatedKey.id,
      label: updatedKey.label,
      prefix_public_id: publicId,
      status: 'active',
      token_env: env,
      api_key_plaintext: plaintext // ONLY returned once!
    };
    
    logger.info('F4-B: API key rotated successfully', {
      id: updatedKey.id,
      keyId,
      prefix_public_id: publicId,
      client_id,
      env,
      traceId
    });
    
    res.json(response);
    
  } catch (error) {
    logger.error('F4-B: Failed to rotate API key', {
      keyId,
      error: error.message,
      client_id,
      traceId
    });
    
    // F4-B: 503 if Key Vault fails
    if (error.message.includes('Key Vault') || error.message.includes('pepper')) {
      return problem(res, 503, 'service_unavailable', 'Token generation service unavailable', traceId);
    }
    
    return problem(res, 500, 'internal_error', 'Failed to rotate API key', traceId);
  }
});

// POST /tenant/v1/api-keys/{keyId}/revoke - Revoke API key
router.post('/api-keys/:keyId/revoke', requirePortalSession, async (req, res) => {
  const { client_id, actor_user_id, traceId } = req.context;
  const { keyId } = req.params;
  
  try {
    const db = getDatabase();
    const { data, error } = await db.supabase.rpc('api_revoke_api_key', {
      p_client_id: client_id,
      p_key_id: keyId,
      p_actor_user_id: actor_user_id
    });
    
    if (error) {
      logger.error('F4-B: Database error revoking API key', { 
        keyId, 
        error: error.message, 
        traceId 
      });
      return problem(res, 500, 'internal_error', 'Failed to revoke API key', traceId);
    }
    
    if (!data) {
      return problem(res, 404, 'not_found', 'API key not found', traceId);
    }
    
    logger.info('F4-B: API key revoked successfully', {
      id: data.id,
      keyId,
      client_id,
      traceId
    });
    
    res.json({
      id: data.id,
      status: 'revoked',
      revoked_at: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('F4-B: Failed to revoke API key', {
      keyId,
      error: error.message,
      client_id,
      traceId
    });
    
    return problem(res, 500, 'internal_error', 'Failed to revoke API key', traceId);
  }
});

// GET /tenant/v1/api-keys - List API keys (paginated)
router.get('/api-keys', requirePortalSession, async (req, res) => {
  const { client_id, traceId } = req.context;
  const limit = Math.min(parseInt(req.query.limit) || 25, 100);
  const offset = parseInt(req.query.offset) || 0;
  
  try {
    const db = getDatabase();
    const { data, error } = await db.supabase.rpc('api_list_api_keys', {
      p_client_id: client_id,
      p_limit: limit,
      p_offset: offset
    });
    
    if (error) {
      logger.error('F4-B: Database error listing API keys', { 
        error: error.message, 
        traceId 
      });
      return problem(res, 500, 'internal_error', 'Failed to list API keys', traceId);
    }
    
    // F4-B: Handle RPC response format - data could be an array or object with data property
    let apiKeys = [];
    if (Array.isArray(data)) {
      apiKeys = data;
    } else if (data && Array.isArray(data.data)) {
      apiKeys = data.data;
    } else if (data) {
      // Single key or unexpected format
      apiKeys = [data];
    }
    
    // F4-B: Return paginated list without secrets/hashes
    const mappedKeys = apiKeys.map(key => ({
      id: key.id,
      label: key.label,
      prefix_public_id: key.prefix_public_id,
      status: key.status,
      token_env: key.token_env,
      created_at: key.created_at,
      last_used_at: key.last_used_at,
      expires_at: key.expires_at
    }));
    
    const total = mappedKeys.length;
    const hasMore = (offset + limit) < total;
    
    logger.info('F4-B: API keys listed successfully', {
      count: mappedKeys.length,
      client_id,
      limit,
      offset,
      traceId
    });
    
    res.json({
      data: mappedKeys,
      total: mappedKeys.length,
      limit,
      offset,
      has_more: hasMore
    });
    
  } catch (error) {
    logger.error('F4-B: Failed to list API keys', {
      error: error.message,
      client_id,
      traceId
    });
    
    return problem(res, 500, 'internal_error', 'Failed to list API keys', traceId);
  }
});

module.exports = router;