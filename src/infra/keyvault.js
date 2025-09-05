// F4-B: Azure Key Vault integration with Managed Identity
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');
const { logger } = require('../utils/logger');

// Key Vault configuration
const KEY_VAULT_URL = 'https://workninjas-keys.vault.azure.net/';

class KeyVaultService {
  constructor() {
    this.client = null;
    this.credential = null;
    this.isInitialized = false;
    this.secretCache = new Map();
  }

  /**
   * Initialize Key Vault client with Managed Identity
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Use DefaultAzureCredential for Managed Identity in Container Apps
      this.credential = new DefaultAzureCredential();
      this.client = new SecretClient(KEY_VAULT_URL, this.credential);
      
      // Test connection by attempting to get a secret
      logger.info('Key Vault client initialized with Managed Identity', {
        vaultUrl: KEY_VAULT_URL,
        credentialType: 'ManagedIdentity'
      });

      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize Key Vault client', {
        error: error.message,
        vaultUrl: KEY_VAULT_URL
      });
      throw error;
    }
  }

  /**
   * Get secret from Key Vault with caching (for performance)
   * @param {string} secretName - Name of the secret
   * @returns {Promise<string>} Secret value
   */
  async getSecret(secretName) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Check cache first (with 5-minute TTL)
    const cacheKey = secretName;
    const cached = this.secretCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300000) {
      logger.debug('Retrieved secret from cache', { secretName });
      return cached.value;
    }

    try {
      logger.debug('Fetching secret from Key Vault', { secretName, vaultUrl: KEY_VAULT_URL });
      
      const secretBundle = await this.client.getSecret(secretName);
      const secretValue = secretBundle.value;

      // Cache the secret
      this.secretCache.set(cacheKey, {
        value: secretValue,
        timestamp: Date.now()
      });

      logger.info('Successfully retrieved secret from Key Vault', { 
        secretName,
        vaultUrl: KEY_VAULT_URL 
      });

      return secretValue;
    } catch (error) {
      logger.error('Failed to retrieve secret from Key Vault', {
        secretName,
        error: error.message,
        code: error.code,
        vaultUrl: KEY_VAULT_URL
      });
      throw error;
    }
  }

  /**
   * Clear secret cache (for testing or security)
   */
  clearCache() {
    this.secretCache.clear();
    logger.info('Key Vault secret cache cleared');
  }
}

// Singleton instance
let kvInstance = null;

function getKeyVault() {
  if (!kvInstance) {
    kvInstance = new KeyVaultService();
  }
  return kvInstance;
}

module.exports = {
  KeyVaultService,
  getKeyVault
};