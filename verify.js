import { processCode } from './engine/index.js';

const myCode = 'const api_key = "sk-1234567890abcdef1234567890abcdef1234567890abcdef";';
const result = processCode(myCode);

console.log("--- TEST RESULTS ---");
console.log("Secrets Found:", result.secretsFound.length);
console.log("Redacted Text:", result.redactedCode);
console.log("Mapping:", result.mapping);