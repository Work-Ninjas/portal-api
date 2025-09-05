// F4-B Local Testing Script
// This script generates test tokens and provides cURL commands for testing

const { generateTestToken } = require('./src/lib/tokens-stub');
const { getDatabase } = require('./src/services/database-stub');

console.log('\n🔧 F4-B Local Testing Setup');
console.log('═══════════════════════════════════════════════════════════');

// Generate test tokens
const testTokenLive = generateTestToken('live', 'test123');
const testTokenStg = generateTestToken('stg', 'test123');

console.log('\n📋 Test API Keys Generated:');
console.log('───────────────────────────────────────────────────────────');
console.log(`LIVE Token:    ${testTokenLive}`);
console.log(`STAGING Token: ${testTokenStg}`);

// Show database setup
const db = getDatabase();
const apiKeys = db.listApiKeys();

console.log('\n💾 Database Setup (Stub):');
console.log('───────────────────────────────────────────────────────────');
apiKeys.forEach(key => {
  console.log(`Client ID: ${key.clientId} | Public ID: ${key.publicId} | Env: ${key.tokenEnv}`);
});

console.log('\n🚀 Start the F4-B API locally:');
console.log('───────────────────────────────────────────────────────────');
console.log('cd /d/portal-api && node src/index.js');

console.log('\n🧪 Test Commands:');
console.log('───────────────────────────────────────────────────────────');

console.log('\n1. Health Check (No Auth Required):');
console.log(`curl -X GET http://localhost:3000/v1/health`);

console.log('\n2. Test Authentication - LIVE Token:');
console.log(`curl -X GET http://localhost:3000/v1/contacts \\`);
console.log(`  -H "Authorization: Bearer ${testTokenLive}" \\`);
console.log(`  -H "Content-Type: application/json"`);

console.log('\n3. Test Authentication - STAGING Token (should fail on LIVE env):');
console.log(`curl -X GET http://localhost:3000/v1/contacts \\`);
console.log(`  -H "Authorization: Bearer ${testTokenStg}" \\`);
console.log(`  -H "Content-Type: application/json"`);

console.log('\n4. Test Invalid Token:');
console.log(`curl -X GET http://localhost:3000/v1/contacts \\`);
console.log(`  -H "Authorization: Bearer invalid_token" \\`);
console.log(`  -H "Content-Type: application/json"`);

console.log('\n5. Test Missing Authorization:');
console.log(`curl -X GET http://localhost:3000/v1/contacts \\`);
console.log(`  -H "Content-Type: application/json"`);

console.log('\n📊 Expected Results:');
console.log('───────────────────────────────────────────────────────────');
console.log('✅ Health check: status=healthy, authMode=strict, mockMode=false');
console.log('✅ LIVE token: 200 OK with tenant-aware contact data');
console.log('❌ STAGING token: 401 wrong_environment_token');
console.log('❌ Invalid token: 401 invalid_token_format');
console.log('❌ Missing auth: 401 missing_token');

console.log('\n🔗 Integration with Real API Key:');
console.log('───────────────────────────────────────────────────────────');
console.log('When you provide a real API key from the other dev:');
console.log('1. Add it to the database stub: db.addApiKey(publicId, env, clientId)');
console.log('2. Use the real token format in curl commands');
console.log('3. Verify all F4-B acceptance criteria are met');

console.log('\n═══════════════════════════════════════════════════════════\n');

// Add test API key for any real token the user provides
if (process.argv.length > 2) {
  const realToken = process.argv[2];
  try {
    const { parseToken } = require('./src/lib/tokens-stub');
    const parsed = parseToken(realToken);
    
    console.log(`🔑 Adding Real API Key to Database Stub:`);
    console.log(`   Token Environment: ${parsed.env}`);
    console.log(`   Public ID: ${parsed.publicId}`);
    
    const realKeyData = db.addApiKey(parsed.publicId, parsed.env, 'client_real_test');
    
    console.log(`✅ Real API key added with ID: ${realKeyData.id}`);
    console.log(`\n🧪 Test with Real Token:`);
    console.log(`curl -X GET http://localhost:3000/v1/contacts \\`);
    console.log(`  -H "Authorization: Bearer ${realToken}" \\`);
    console.log(`  -H "Content-Type: application/json"`);
    
  } catch (error) {
    console.error(`❌ Failed to parse real token: ${error.message}`);
  }
}