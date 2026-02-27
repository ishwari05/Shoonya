/**
 * CodeShield Detection Engine
 * Main orchestrator for secret detection pipeline
 */

import { scanWithRegex } from './scanner.js';
import { scanWithEntropy } from './entropy.js';
import { redactCode } from './redactor.js'; 

function removeDuplicates(detections) {
  if (!Array.isArray(detections)) { return []; }
  const seen = new Set();
  const unique = [];
  for (const detection of detections) {
    const key = `${detection.type}-${detection.index}-${detection.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(detection);
    }
  }
  return unique;
}

function sortByIndex(detections) {
  if (!Array.isArray(detections)) { return []; }
  return detections.sort((a, b) => a.index - b.index);
}

function mergeResults(regexResults, entropyResults) {
  const allResults = [
    ...(Array.isArray(regexResults) ? regexResults : []),
    ...(Array.isArray(entropyResults) ? entropyResults : [])
  ];
  return sortByIndex(removeDuplicates(allResults));
}

function isValidInput(rawCode) {
  return typeof rawCode === 'string' && rawCode.length > 0;
}

export function processCode(rawCode) {
  if (!isValidInput(rawCode)) {
    return { secretsFound: [], redactedCode: '', mapping: {}, metadata: { totalLength: 0, processingTime: 0, scanCount: 0 } };
  }

  const startTime = performance.now();
  
  try {
    const regexResults = scanWithRegex(rawCode);
    const entropyResults = scanWithEntropy(rawCode);
    const mergedResults = mergeResults(regexResults, entropyResults);
    
    // Execute your redaction engine
    const { redactedCode, mapping } = redactCode(rawCode, mergedResults);
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    return {
      secretsFound: mergedResults,
      redactedCode: redactedCode, 
      mapping: mapping,          
      metadata: {
        totalLength: rawCode.length,
        processingTime: Math.round(processingTime * 100) / 100,
        scanCount: mergedResults.length,
        regexMatches: regexResults.length,
        entropyMatches: entropyResults.length
      }
    };
    
  } catch (error) {
    console.error('CodeShield processing error:', error);
    return { secretsFound: [], redactedCode: rawCode, mapping: {}, metadata: { totalLength: rawCode.length, processingTime: 0, scanCount: 0, error: error.message } };
  }
}

export function quickScan(rawCode) {
  return processCode(rawCode).secretsFound;
}

export function getCodeStats(rawCode) {
  if (!isValidInput(rawCode)) {
    return { lineCount: 0, characterCount: 0, wordCount: 0, estimatedRisk: 'none' };
  }
  const lines = rawCode.split('\n');
  const words = rawCode.split(/\s+/).filter(word => word.length > 0);
  const secrets = quickScan(rawCode);
  let risk = 'none';
  
  if (secrets.length > 0) {
    const highRiskTypes = ['AWS_ACCESS_KEY', 'AWS_SECRET_KEY', 'OPENAI_API_KEY', 'PRIVATE_KEY'];
    const hasHighRisk = secrets.some(secret => highRiskTypes.includes(secret.type));
    risk = hasHighRisk ? 'high' : (secrets.length > 3 ? 'medium' : 'low');
  }
  
  return { lineCount: lines.length, characterCount: rawCode.length, wordCount: words.length, estimatedRisk: risk, secretCount: secrets.length };
}