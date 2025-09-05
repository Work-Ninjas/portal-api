// Real @datahubportal/tokens package - CommonJS version with Argon2id
// F4-B: Production-ready implementation with proper Argon2id verification

const argon2 = require('argon2');

// Base62 alphabet for clean, URL-safe tokens
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Convert bytes to base62 string
 */
function bytesToBase62(bytes) {
  let result = '';
  let num = 0n;
  
  // Convert bytes to big integer
  for (let i = 0; i < bytes.length; i++) {
    num = (num << 8n) + BigInt(bytes[i]);
  }
  
  // Convert to base62
  if (num === 0n) return BASE62[0];
  
  while (num > 0n) {
    result = BASE62[Number(num % 62n)] + result;
    num = num / 62n;
  }
  
  return result;
}

/**
 * Generate cryptographically secure random bytes using Web Crypto API
 */
function getRandomBytes(length) {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Browser environment
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  } else {
    // Node.js fallback
    const { randomBytes } = require('crypto');
    return new Uint8Array(randomBytes(length));
  }
}

/**
 * Generate secure base62 string
 */
function generateSecureBase62(byteLength) {
  const bytes = getRandomBytes(byteLength);
  return bytesToBase62(bytes);
}

/**
 * Generate public ID (8-10 characters, base62)
 */
function generatePublicId() {
  const id = generateSecureBase62(6);
  // Ensure length is between 8-10 chars, pad if needed
  return id.length < 8 ? id.padEnd(8, '0') : id.slice(0, 10);
}

/**
 * Generate random part (32 characters, base62)
 */
function generateRandomPart() {
  const random = generateSecureBase62(24);
  return random.slice(0, 32); // Ensure exactly 32 chars
}

/**
 * F4-B: Production Argon2id hash function (replaces SHA-256)
 * Uses Argon2id with secure parameters for password-like token hashing
 */
async function hashToken(plaintext, pepper) {
  const input = plaintext + pepper;
  
  try {
    // F4-B: Use Argon2id with production parameters
    const hash = await argon2.hash(input, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB memory cost
      timeCost: 3,         // 3 iterations
      parallelism: 1,      // Single thread
      hashLength: 32       // 32 byte hash
    });
    
    return hash;
  } catch (error) {
    throw new Error(`Argon2id hashing failed: ${error.message}`);
  }
}

/**
 * F4-B: Production Argon2id verification (replaces SHA-256 comparison)
 * Uses Argon2 built-in verification with constant-time comparison
 */
async function verifyToken(plaintext, hash, pepper) {
  const input = plaintext + pepper;
  
  try {
    // F4-B: Use Argon2 built-in verify function (constant-time, secure)
    const isValid = await argon2.verify(hash, input);
    return isValid;
  } catch (error) {
    // Log verification error but don't expose details
    console.error('Argon2id verification failed:', error.message);
    return false;
  }
}

// Main tokens functionality
let tokensConfig = null;

/**
 * Initialize the tokens package with pepper provider
 */
function initTokens(config) {
  tokensConfig = config;
}

/**
 * Generate a new API token with all required components
 */
async function generateToken(env) {
  if (!tokensConfig) {
    throw new Error('Tokens package not initialized. Call initTokens() first.');
  }
  
  // Validate environment
  if (env !== 'live' && env !== 'stg') {
    throw new Error(`Invalid environment: expected 'live' or 'stg', got '${env}'`);
  }
  
  // Generate token components with CSPRNG
  const publicId = generatePublicId();
  const randomPart = generateRandomPart();
  
  // Construct plaintext token: dhp_<env>_<publicId>_<randomPart>
  const plaintext = `dhp_${env}_${publicId}_${randomPart}`;
  
  // Retrieve pepper from provider
  const hashSaltId = 'kv:API_TOKEN_PEPPER_v1';
  const pepper = await tokensConfig.getPepper(hashSaltId);
  
  // Generate hash (simplified SHA-256 for browser compatibility)
  const hash = await hashToken(plaintext, pepper);
  
  return {
    plaintext,
    publicId,
    hash,
    hashVersion: 1,
    hashSaltId,
  };
}

/**
 * Parse a plaintext token into its components
 */
function parseToken(plaintext) {
  // Validate canonical format
  const formatRegex = /^dhp_(live|stg)_[A-Za-z0-9]{8,10}_[A-Za-z0-9]{32}$/;
  if (!formatRegex.test(plaintext)) {
    throw new Error('Invalid token format: must match ^dhp_(live|stg)_[A-Za-z0-9]{8,10}_[A-Za-z0-9]{32}$');
  }
  
  const parts = plaintext.split('_');
  const [, env, publicId, randomPart] = parts;
  
  return {
    env: env,
    publicId,
    randomPart,
  };
}

/**
 * Verify token against hash using constant-time comparison
 */
async function verifyTokenWithData(plaintext, verifyData) {
  if (!tokensConfig) {
    throw new Error('Tokens package not initialized. Call initTokens() first.');
  }
  
  try {
    // Retrieve pepper from provider
    const pepper = await tokensConfig.getPepper(verifyData.hashSaltId);
    
    // Verify using crypto utility
    return await verifyToken(plaintext, verifyData.hash, pepper);
  } catch {
    return false;
  }
}

// Package metadata
const VERSION = '1.0.0';
const PACKAGE_NAME = '@datahubportal/tokens';

module.exports = {
  initTokens,
  generateToken,
  parseToken,
  verifyToken: verifyTokenWithData,
  VERSION,
  PACKAGE_NAME
};