// F4-B Production Database Service - Supabase Integration
const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');

// Supabase configuration from roofr portal project
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cvjpaaxpckyawrowlouu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2anBhYXhwY2t5YXdyb3dsb3V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MzgzNTIsImV4cCI6MjA3MTIxNDM1Mn0.a1nQ5_rFt_uSaaq8PV4coVnwrEn8bpptSpGgO0wgN18';

class DatabaseService {
  constructor() {
    this.supabase = null;
    this.isConnected = false;
    this.initializeConnection();
  }

  /**
   * Initialize Supabase connection
   */
  initializeConnection() {
    try {
      // Use service key if available, otherwise use anon key
      const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
      
      if (!apiKey) {
        throw new Error('SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY is required');
      }

      this.supabase = createClient(SUPABASE_URL, apiKey, {
        auth: {
          persistSession: false,
        },
        global: {
          headers: {
            'x-application-name': 'f4b-portal-api'
          }
        }
      });

      this.isConnected = true;
      logger.info('F4-B Database service initialized with Supabase', {
        supabaseUrl: SUPABASE_URL,
        keyType: SUPABASE_SERVICE_KEY ? 'service' : 'anon'
      });
      
    } catch (error) {
      logger.error('Failed to initialize F4-B database service', { 
        error: error.message,
        supabaseUrl: SUPABASE_URL 
      });
      throw error;
    }
  }

  /**
   * Find active API key by public ID and environment
   * @param {string} publicId - The prefix_public_id from the token
   * @param {'live'|'stg'} tokenEnv - Token environment
   * @returns {Promise<object|null>} API key record or null
   */
  async findActiveKeyByPublicId(publicId, tokenEnv) {
    try {
      if (!this.isConnected) {
        throw new Error('Database service not connected');
      }

      logger.debug('Looking up API key by public ID', { 
        publicId, 
        tokenEnv,
        table: 'api_keys'
      });

      // Query the api_keys table for active keys using Supabase
      const { data, error } = await this.supabase
        .from('api_keys')
        .select('id, client_id, hash, hash_version, hash_salt_id, token_env, scopes, created_at, last_used_at')
        .eq('prefix_public_id', publicId)
        .eq('token_env', tokenEnv)
        .eq('status', 'active')
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .single(); // Expect exactly one result

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - API key not found or inactive
          logger.debug('API key not found or inactive', { 
            publicId, 
            tokenEnv,
            error: 'not_found' 
          });
          return null;
        }
        
        // Other database errors
        logger.error('Supabase error during API key lookup', { 
          publicId, 
          tokenEnv, 
          error: error.message,
          code: error.code
        });
        throw error;
      }

      if (!data) {
        logger.debug('API key query returned empty result', { publicId, tokenEnv });
        return null;
      }

      logger.debug('API key found in Supabase', {
        keyId: data.id,
        publicId,
        tokenEnv,
        clientId: data.client_id
      });

      return data;

    } catch (error) {
      logger.error('Failed to find API key by public ID', { 
        publicId, 
        tokenEnv, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Update last_used_at with throttling (max once per minute)
   * @param {string} keyId - API key ID
   */
  async updateLastUsed(keyId) {
    try {
      if (!this.isConnected) {
        logger.warn('Cannot update last_used_at - database not connected', { keyId });
        return;
      }

      const now = new Date().toISOString();
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

      // Use Supabase RPC or update with filter for throttling
      const { error } = await this.supabase
        .from('api_keys')
        .update({ 
          last_used_at: now,
          usage_count: this.supabase.raw('COALESCE(usage_count, 0) + 1')
        })
        .eq('id', keyId)
        .or(`last_used_at.is.null,last_used_at.lt.${oneMinuteAgo}`);

      if (error) {
        logger.warn('Failed to update last_used_at in Supabase:', {
          error: error.message,
          keyId
        });
        return;
      }

      logger.debug('Updated last_used_at timestamp in Supabase', { keyId });

    } catch (error) {
      // Non-critical operation - log but don't throw
      logger.warn('Error updating last_used_at:', {
        error: error.message,
        keyId
      });
    }
  }

  /**
   * Get client tenant information by client_id
   * @param {string} clientId - Client ID from API key
   * @returns {Promise<object|null>} Client record with tenant info
   */
  async getClientTenant(clientId) {
    const query = `
      SELECT 
        c.id as client_id,
        c.tenant_id,
        c.name as client_name,
        c.status,
        t.name as tenant_name,
        t.status as tenant_status
      FROM clients c
      JOIN tenants t ON c.tenant_id = t.id
      WHERE c.id = $1 AND c.status = 'active' AND t.status = 'active'
      LIMIT 1
    `;

    try {
      const result = await this.pool.query(query, [clientId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('Database query error in getClientTenant:', {
        error: error.message,
        clientId
      });
      throw error;
    }
  }

  /**
   * Close database connections
   */
  async close() {
    try {
      // Supabase client doesn't have an explicit close method
      this.isConnected = false;
      logger.info('Database service connection closed');
    } catch (error) {
      logger.error('Error closing database connection', { error: error.message });
    }
  }
}

// Singleton instance
let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseService();
  }
  return dbInstance;
}

module.exports = {
  DatabaseService,
  getDatabase
};