// Stub database service for local F4-B testing
// This simulates the PostgreSQL database operations for testing

const { logger } = require('../utils/logger');

class DatabaseStub {
  constructor() {
    this.apiKeys = new Map();
    // Pre-populate with a test API key for local testing
    this.addTestApiKey();
  }

  addTestApiKey() {
    // Test API key data that matches our stub token format
    const testKey = {
      id: 'api_key_001',
      prefix_public_id: 'test123',
      token_env: 'live',
      client_id: 'client_f4b_test',
      hash: 'stub_hash_for_testing',
      hash_version: 'v1',
      hash_salt_id: 'stub_salt_001',
      status: 'active',
      scopes: ['contacts:read', 'jobs:read'],
      created_at: new Date().toISOString(),
      last_used_at: null
    };

    const key = `${testKey.prefix_public_id}_${testKey.token_env}`;
    this.apiKeys.set(key, testKey);
    
    console.log('F4-B Test API key added:', {
      publicId: testKey.prefix_public_id,
      tokenEnv: testKey.token_env,
      clientId: testKey.client_id
    });

    // Add the real API key provided by the other dev
    const realKey = {
      id: 'api_key_real_001',
      prefix_public_id: 'CiFGIgv0',
      token_env: 'live',
      client_id: 'client_real_f4b',
      hash: 'real_hash_for_testing',
      hash_version: 'v1',
      hash_salt_id: 'real_salt_001',
      status: 'active',
      scopes: ['contacts:read', 'jobs:read'],
      created_at: new Date().toISOString(),
      last_used_at: null
    };

    const realKeyId = `${realKey.prefix_public_id}_${realKey.token_env}`;
    this.apiKeys.set(realKeyId, realKey);
    
    console.log('F4-B Real API key added:', {
      publicId: realKey.prefix_public_id,
      tokenEnv: realKey.token_env,
      clientId: realKey.client_id
    });
  }

  async findActiveKeyByPublicId(publicId, tokenEnv) {
    try {
      const key = `${publicId}_${tokenEnv}`;
      const apiKey = this.apiKeys.get(key);
      
      if (!apiKey || apiKey.status !== 'active') {
        logger.debug('API key not found or inactive (STUB)', { publicId, tokenEnv });
        return null;
      }

      logger.debug('API key found in stub database', {
        keyId: apiKey.id,
        publicId,
        tokenEnv,
        clientId: apiKey.client_id
      });

      return {
        id: apiKey.id,
        client_id: apiKey.client_id,
        hash: apiKey.hash,
        hash_version: apiKey.hash_version,
        hash_salt_id: apiKey.hash_salt_id,
        token_env: apiKey.token_env,
        scopes: apiKey.scopes,
        status: apiKey.status
      };
      
    } catch (error) {
      logger.error('Database stub error', { error: error.message, publicId, tokenEnv });
      throw error;
    }
  }

  async updateLastUsed(keyId) {
    try {
      // Find the API key by ID
      for (const [key, apiKey] of this.apiKeys.entries()) {
        if (apiKey.id === keyId) {
          apiKey.last_used_at = new Date().toISOString();
          logger.debug('Updated last_used_at (STUB)', { keyId });
          return;
        }
      }
      
      logger.warn('API key not found for last_used_at update (STUB)', { keyId });
    } catch (error) {
      logger.error('Failed to update last_used_at (STUB)', { keyId, error: error.message });
    }
  }

  // Add a new API key for testing
  addApiKey(publicId, tokenEnv, clientId, hashData = {}) {
    const keyData = {
      id: `api_key_${Date.now()}`,
      prefix_public_id: publicId,
      token_env: tokenEnv,
      client_id: clientId,
      hash: hashData.hash || 'stub_hash',
      hash_version: hashData.hashVersion || 'v1',
      hash_salt_id: hashData.hashSaltId || 'stub_salt',
      status: 'active',
      scopes: ['contacts:read', 'jobs:read'],
      created_at: new Date().toISOString(),
      last_used_at: null
    };

    const key = `${publicId}_${tokenEnv}`;
    this.apiKeys.set(key, keyData);
    
    console.log('F4-B API key added for testing:', {
      publicId,
      tokenEnv,
      clientId,
      keyId: keyData.id
    });

    return keyData;
  }

  // List all API keys (for debugging)
  listApiKeys() {
    const keys = [];
    for (const [key, apiKey] of this.apiKeys.entries()) {
      keys.push({
        publicId: apiKey.prefix_public_id,
        tokenEnv: apiKey.token_env,
        clientId: apiKey.client_id,
        status: apiKey.status,
        id: apiKey.id
      });
    }
    return keys;
  }

  async close() {
    // Nothing to close in stub
    logger.info('Database stub closed');
  }
}

let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseStub();
    logger.info('F4-B Database stub initialized');
  }
  return dbInstance;
}

module.exports = {
  getDatabase,
  DatabaseStub
};