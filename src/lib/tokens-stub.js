// Stub implementation of @datahubportal/tokens for local testing
// This mimics the actual package interface for F4-B integration testing

const crypto = require('crypto');

let _pepper = null;
let _options = {};

/**
 * Initialize the tokens package with pepper and options
 * @param {Object} config - Configuration object
 * @param {Function} config.getPepper - Function that returns the pepper
 * @param {Object} config.argon2Options - Optional Argon2 configuration
 */
function initTokens(config) {
  _options = config;
  console.log('F4-B Tokens package initialized (STUB)');
}

/**
 * Parse a token string into its components
 * @param {string} token - The token to parse (e.g., "dhp_live_abc123_randompart")
 * @returns {Object} - { env: 'live'|'stg', publicId: 'abc123', randomPart: 'randompart' }
 */
function parseToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }

  // Expected format: dhp_{env}_{publicId}_{randomPart}
  const parts = token.split('_');
  if (parts.length !== 4 || parts[0] !== 'dhp') {
    throw new Error('Invalid token format. Expected: dhp_{env}_{publicId}_{randomPart}');
  }

  const [prefix, env, publicId, randomPart] = parts;
  
  if (!['live', 'stg'].includes(env)) {
    throw new Error('Invalid token environment. Must be "live" or "stg"');
  }

  if (!publicId || !randomPart) {
    throw new Error('Token missing required components');
  }

  return {
    env,
    publicId,
    randomPart
  };
}

/**
 * Verify a token against stored hash data
 * @param {string} token - The full token to verify
 * @param {Object} hashData - Hash data from database
 * @param {string} hashData.hash - The stored Argon2 hash
 * @param {string} hashData.hashVersion - Hash version (e.g., 'v1')
 * @param {string} hashData.hashSaltId - Salt identifier
 * @returns {Promise<boolean>} - True if token is valid
 */
async function verifyToken(token, hashData) {
  try {
    // In a real implementation, this would:
    // 1. Get the pepper using _options.getPepper()
    // 2. Reconstruct the hash input from token + pepper + salt
    // 3. Use Argon2 to verify against the stored hash
    
    // For stub testing, we'll do a simple comparison
    // This allows us to test the flow with predictable results
    
    if (!_options.getPepper) {
      throw new Error('Tokens package not initialized - missing getPepper');
    }

    const pepper = await _options.getPepper();
    if (!pepper) {
      throw new Error('Failed to retrieve pepper for token verification');
    }

    // Stub verification: for testing, accept tokens that follow correct format
    const parsed = parseToken(token);
    
    // In real implementation, this would be Argon2 verification
    // For stub: simple validation that we have all required components
    const isValid = !!(
      hashData.hash &&
      hashData.hashVersion &&
      hashData.hashSaltId &&
      parsed.publicId &&
      parsed.randomPart
    );

    console.log('F4-B Token verification (STUB)', {
      publicId: parsed.publicId,
      env: parsed.env,
      hashVersion: hashData.hashVersion,
      verified: isValid
    });

    return isValid;
    
  } catch (error) {
    console.error('F4-B Token verification failed (STUB)', error.message);
    return false;
  }
}

/**
 * Generate a test token for local development
 * @param {string} env - Environment ('live' or 'stg')
 * @param {string} publicId - Public identifier
 * @returns {string} - Generated token
 */
function generateTestToken(env = 'live', publicId = 'test123') {
  const randomPart = crypto.randomBytes(8).toString('hex');
  return `dhp_${env}_${publicId}_${randomPart}`;
}

module.exports = {
  initTokens,
  parseToken,
  verifyToken,
  generateTestToken
};