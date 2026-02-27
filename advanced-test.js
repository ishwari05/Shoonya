import { processCode } from './engine/index.js';

const semanticInput = `
// 1. Hard-coded Credentials (Regex/Entropy)
const AWS_SECRET = "AKIAIM7V4J7EXAMPLE12345";
const DB_PASS = "P@ssw0rd123!";

// 2. Semantic/Contextual Info (The "Meaning")
// "The master password for the production server is 'BlueElephant42'"
// "My private phone number is +1-555-0199"

console.log("System initialized.");
`;

console.log("--- ADVANCED SEMANTIC TEST ---");
const result = processCode(semanticInput);

console.log(`Secrets Found: ${result.secretsFound.length}`);
console.log(`Redacted Text:\n${result.redactedCode}`);
console.log("Mapping:", result.mapping);