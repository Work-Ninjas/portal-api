// F4-B Tenant Admin Routes - Server-side token generation with proper environment scoping
// Implements consistent client_id + token_env scoping across all operations

const express = require('express');
const { initTokens, generateToken } = require('@datahubportal/tokens');
const { getDatabase } = require('../services/database');
const { logger } = require('../utils/logger');
const { problem } = require('../middleware/bearerAuth');
const { v4: uuidv4 } = require('uuid');

// Server-side environment scoping - always filter by this environment
const REQUIRED_ENV = process.env.TOKEN_ENV === 'live' ? 'live' : 'stg';

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
  
  if (!sessionClientId) {
    logger.warn('F4-B: Missing client_id in portal session', { traceId });
    return problem(res, 401, 'unauthorized', 'Portal session required (missing client_id or user_id)', traceId);
  }
  
  // Validate UUID format for client_id
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionClientId)) {
    logger.warn('F4-B: Invalid client_id format', { client_id: sessionClientId, traceId });
    return problem(res, 400, 'invalid_client_id', 'Invalid client_id format', traceId);
  }
  
  // Store context for use in route handlers
  req.context = {
    client_id: sessionClientId,
    actor_user_id: sessionUserId || 'anonymous', // Handle optional user_id
    traceId: traceId
  };
  
  logger.info('F4-B: Portal session validated', { 
    client_id: sessionClientId,
    env: REQUIRED_ENV,
    traceId 
  });
  
  next();
}

// POST /tenant/v1/api-keys - Create new API key
router.post('/api-keys', requirePortalSession, async (req, res) => {
  const { client_id, actor_user_id, traceId } = req.context;
  const { label } = req.body;
  
  // Validate label
  if (!label || typeof label !== 'string' || label.trim().length === 0) {
    return problem(res, 400, 'invalid_label', 'Label is required and must be non-empty', traceId);
  }
  
  if (label.length > 100) {
    return problem(res, 400, 'label_too_long', 'Label must be 100 characters or less', traceId);
  }
  
  logger.info('create_api_key_request', {
    client_id: client_id,
    label: label.trim(),
    env: REQUIRED_ENV,
    traceId
  });
  
  try {
    const db = getDatabase();
    
    // Initialize tokens package and generate new token
    await initTokens({
      getPepper: async (saltId) => {
        return process.env.API_TOKEN_PEPPER_v1 || 'development-pepper-for-testing-only';
      }
    });
    
    const { plaintext, publicId, hash, hashVersion, hashSaltId } = await generateToken(REQUIRED_ENV);
    
    logger.info('F4-B: New API key token generated', { 
      client_id, 
      env: REQUIRED_ENV, 
      prefix_public_id: publicId, 
      traceId 
    });
    
    // Create the API key
    const newKeyId = uuidv4();
    const { data: newKey, error: insertError } = await db.supabase
      .from('api_keys')
      .insert({
        id: newKeyId,
        client_id: client_id,
        label: label.trim(),
        prefix_public_id: publicId,
        token_env: REQUIRED_ENV,
        hash: hash,
        hash_version: hashVersion,
        hash_salt_id: hashSaltId,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select('id, label, prefix_public_id, token_env, status, created_at')
      .single();
    
    if (insertError) {
      logger.error('F4-B: Failed to create API key', { 
        error: insertError.message,
        client_id,
        traceId 
      });
      return problem(res, 500, 'internal_error', 'Failed to create API key', traceId);
    }
    
    logger.info('F4-B: API key created successfully', { 
      keyId: newKey.id,
      client_id,
      env: REQUIRED_ENV,
      label: newKey.label,
      traceId 
    });
    
    // Return the new API key with plaintext token
    res.status(201).json({
      id: newKey.id,
      label: newKey.label,
      prefix_public_id: newKey.prefix_public_id,
      token_env: newKey.token_env,
      status: newKey.status,
      api_key_plaintext: plaintext,
      created_at: newKey.created_at
    });
    
  } catch (error) {
    logger.error('F4-B: Create API key failed', { 
      client_id, 
      label,
      error: error.message, 
      traceId 
    });
    return problem(res, 500, 'internal_error', 'Failed to create API key', traceId);
  }
});

// POST /tenant/v1/api-keys/{keyId}/rotate - Rotate API key
router.post('/api-keys/:keyId/rotate', requirePortalSession, async (req, res) => {
  const { client_id, actor_user_id, traceId } = req.context;
  const { keyId } = req.params;
  
  logger.info('rotate_check', {
    path_id: keyId,
    derived_client_id: client_id,
    token_env: REQUIRED_ENV,
    traceId
  });
  
  try {
    const db = getDatabase();
    
    // 1) Verify the current key exists and belongs to the correct environment
    const { data: currentKey, error: selectError } = await db.supabase
      .from('api_keys')
      .select('id, status, token_env, label')
      .match({ 
        id: keyId,
        client_id: client_id,
        token_env: REQUIRED_ENV
      })
      .single();
    
    if (selectError || !currentKey) {
      logger.warn('rotate_not_found', {
        path_id: keyId,
        derived_client_id: client_id,
        reason: 'no_row_for_id+client+env',
        traceId
      });
      return problem(res, 404, 'not_found', 'API key not found', traceId);
    }
    
    if (currentKey.status !== 'active') {
      logger.warn('rotate_not_active', {
        path_id: keyId,
        status: currentKey.status,
        traceId
      });
      return problem(res, 409, 'not_active', 'API key is not active', traceId);
    }
    
    // 2) Initialize tokens package and generate new token
    await initTokens({
      getPepper: async (saltId) => {
        return process.env.API_TOKEN_PEPPER_v1 || 'development-pepper-for-testing-only';
      }
    });
    
    const { plaintext, publicId, hash, hashVersion, hashSaltId } = await generateToken(REQUIRED_ENV);
    
    logger.info('F4-B: New token generated for rotation', { 
      keyId, 
      env: REQUIRED_ENV, 
      client_id, 
      prefix_public_id: publicId, 
      traceId 
    });
    
    // 3) Create new key and revoke old key
    const newKeyId = uuidv4();
    
    // Create new active key
    const { data: newKey, error: insertError } = await db.supabase
      .from('api_keys')
      .insert({
        id: newKeyId,
        client_id: client_id,
        label: currentKey.label || 'Rotated Key',
        prefix_public_id: publicId,
        token_env: REQUIRED_ENV,
        hash: hash,
        hash_version: hashVersion,
        hash_salt_id: hashSaltId,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select('id, prefix_public_id, token_env, created_at')
      .single();
    
    if (insertError) {
      logger.error('F4-B: Failed to create new API key', { 
        error: insertError.message,
        keyId,
        traceId 
      });
      return problem(res, 500, 'internal_error', 'Failed to create new API key', traceId);
    }
    
    // Revoke the old key
    const { error: revokeError } = await db.supabase
      .from('api_keys')
      .update({ 
        status: 'revoked',
        revoked_at: new Date().toISOString()
      })
      .match({ 
        id: keyId,
        client_id: client_id,
        token_env: REQUIRED_ENV
      });
    
    if (revokeError) {
      logger.error('F4-B: Failed to revoke old API key', { 
        error: revokeError.message,
        keyId,
        traceId 
      });
      // Continue anyway - new key was created successfully
    }
    
    logger.info('F4-B: API key rotated successfully', { 
      oldKeyId: keyId,
      newKeyId: newKey.id,
      client_id,
      env: REQUIRED_ENV,
      traceId 
    });
    
    // Return the new API key with plaintext token
    res.status(201).json({
      id: newKey.id,
      prefix_public_id: newKey.prefix_public_id,
      token_env: newKey.token_env,
      api_key_plaintext: plaintext,
      created_at: newKey.created_at,
      revoked_key_id: keyId
    });
    
  } catch (error) {
    logger.error('F4-B: Rotation failed', { 
      keyId, 
      client_id, 
      error: error.message, 
      traceId 
    });
    return problem(res, 500, 'internal_error', 'Token rotation failed', traceId);
  }
});

// GET /tenant/v1/api-keys - List API keys (paginated)
router.get('/api-keys', requirePortalSession, async (req, res) => {
  const { client_id, traceId } = req.context;
  const limit = Math.min(parseInt(req.query.limit) || 25, 100);
  const offset = parseInt(req.query.offset) || 0;
  
  try {
    const db = getDatabase();
    
    // Direct query with proper environment scoping
    const { data, error } = await db.supabase
      .from('api_keys')
      .select('id, client_id, label, prefix_public_id, status, token_env, created_at, last_used_at, expires_at')
      .match({ 
        client_id: client_id,
        token_env: REQUIRED_ENV
      })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      logger.error('F4-B: Database error listing API keys', { 
        error: error.message, 
        traceId 
      });
      return problem(res, 500, 'internal_error', 'Failed to list API keys', traceId);
    }
    
    // Direct query returns data array directly
    const apiKeys = data || [];
    
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
    
    // Get total count for pagination
    const { count, error: countError } = await db.supabase
      .from('api_keys')
      .select('*', { count: 'exact', head: true })
      .match({ 
        client_id: client_id,
        token_env: REQUIRED_ENV
      });
    
    const total = countError ? 0 : count;
    
    logger.info('F4-B: API keys listed successfully', { 
      client_id, 
      count: mappedKeys.length, 
      limit, 
      offset,
      env: REQUIRED_ENV,
      traceId 
    });
    
    res.json({
      data: mappedKeys,
      total: total,
      limit: limit,
      offset: offset,
      has_more: offset + limit < total
    });
    
  } catch (error) {
    logger.error('F4-B: List keys failed', { 
      client_id, 
      error: error.message, 
      traceId 
    });
    return problem(res, 500, 'internal_error', 'Failed to list API keys', traceId);
  }
});

// GET /tenant/v1/env - Get current environment
router.get('/env', requirePortalSession, async (req, res) => {
  const { traceId } = req.context;
  
  res.json({
    environment: REQUIRED_ENV.toUpperCase(),
    token_prefix: REQUIRED_ENV === 'live' ? 'dhp_live_' : 'dhp_stg_'
  });
  
  logger.info('F4-B: Environment info requested', { 
    env: REQUIRED_ENV, 
    traceId 
  });
});

module.exports = router;