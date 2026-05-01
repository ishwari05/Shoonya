/**
 * Shoonya Test Example
 * Use this to test the detection engine
 */

import { processCode } from './engine/index.js';

const testCode = `
// Test code with various secrets
const config = {
  openai_key: "sk-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  aws_access: "AKIAIOSFODNN7EXAMPLE",
  db_password: "mySecretPassword123!",
  google_api: "AIzaSyDaGmWKa4JsXZ-HjGw63ISU2Nvj7fVWJ4"
};

console.log('Configuration loaded');
`;

console.log('🔍 Testing Shoonya Detection Engine\n');

const result = processCode(testCode);

console.log('📊 Results:');
console.log(`   Secrets found: ${result.secretsFound.length}`);
console.log(`   Processing time: ${result.metadata.processingTime}ms`);
console.log(`   Risk level: ${result.secretsFound.length > 2 ? 'HIGH' : 'MEDIUM'}\n`);

if (result.secretsFound.length > 0) {
  console.log('🚨 Detected secrets:');
  result.secretsFound.forEach((secret, i) => {
    console.log(`${i + 1}. ${secret.type}`);
    console.log(`   Value: ${secret.value.substring(0, 30)}...`);
    console.log(`   Position: ${secret.index}\n`);
  });
}

console.log('✅ Test completed!');
