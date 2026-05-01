/**
 * Shoonya Detection Engine
 * Main orchestrator for secret detection pipeline
 */

import { scanWithRegex } from './scanner.js';
import { scanWithEntropy } from './entropy.js';
import { redactCode } from './redactor.js';

// Inputs longer than this (chars) are split into chunks to avoid blocking
const CHUNK_THRESHOLD = 20_000;
// How many lines per chunk when in chunked mode
const LINES_PER_CHUNK = 500;

function removeDuplicates(detections) {
  if (!Array.isArray(detections)) { return []; }

  // Sort ascending by index. Ties: named types before HIGH_ENTROPY_SECRET so
  // specific pattern labels always win over the entropy catch-all when they overlap.
  const sorted = [...detections].sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    const aIsEntropy = a.type === 'HIGH_ENTROPY_SECRET' ? 1 : 0;
    const bIsEntropy = b.type === 'HIGH_ENTROPY_SECRET' ? 1 : 0;
    return aIsEntropy - bIsEntropy; // named types come first
  });

  const kept = [];

  for (const detection of sorted) {
    const start = detection.index;
    const end = detection.index + detection.value.length;

    // Reject if it overlaps ANY already-kept detection.
    // Exception: if the kept detection is HIGH_ENTROPY_SECRET and this one is
    // a named type, replace the entropy hit with the more specific label.
    const overlapIndex = kept.findIndex(k => {
      const kStart = k.index;
      const kEnd = k.index + k.value.length;
      return start < kEnd && end > kStart;
    });

    if (overlapIndex === -1) {
      // No overlap — keep this detection
      kept.push(detection);
    } else if (
      kept[overlapIndex].type === 'HIGH_ENTROPY_SECRET' &&
      detection.type !== 'HIGH_ENTROPY_SECRET'
    ) {
      // Replace a generic entropy hit with a more specific named detection
      kept[overlapIndex] = detection;
    }
    // Otherwise: overlaps a kept named detection → discard this one
  }

  return kept;
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

/**
 * Scans a large string by splitting it into line-based chunks, scanning each
 * independently, then re-mapping detection indices back to the full string.
 * This keeps the background worker responsive on huge pastes (e.g. .env files).
 */
function chunkAndProcess(rawCode) {
  const lines = rawCode.split('\n');
  const allDetections = [];

  let charOffset = 0;
  for (let i = 0; i < lines.length; i += LINES_PER_CHUNK) {
    const chunkLines = lines.slice(i, i + LINES_PER_CHUNK);
    // +1 per line accounts for the \n delimiter that was removed by split()
    const chunkText = chunkLines.join('\n');

    const regexHits = scanWithRegex(chunkText);
    const entropyHits = scanWithEntropy(chunkText);

    // Re-map each detection's index to full-string coordinates
    for (const d of [...regexHits, ...entropyHits]) {
      allDetections.push({ ...d, index: d.index + charOffset });
    }

    // Advance offset: chunk text length + 1 for the joining \n
    charOffset += chunkText.length + 1;
  }

  return allDetections;
}

export function processCode(rawCode) {
  if (!isValidInput(rawCode)) {
    return { secretsFound: [], redactedCode: '', mapping: {}, metadata: { totalLength: 0, processingTime: 0, scanCount: 0 } };
  }

  const startTime = performance.now();
  const isLargeInput = rawCode.length > CHUNK_THRESHOLD;

  try {
    let mergedResults;
    let regexCount = 0;
    let entropyCount = 0;

    if (isLargeInput) {
      // Chunked path: scan in 500-line windows, merge across chunks
      const allDetections = chunkAndProcess(rawCode);
      mergedResults = sortByIndex(removeDuplicates(allDetections));
      // In chunked mode we don't have separate regex/entropy counts — approximate
      regexCount = mergedResults.filter(d => d.type !== 'HIGH_ENTROPY_SECRET').length;
      entropyCount = mergedResults.filter(d => d.type === 'HIGH_ENTROPY_SECRET').length;
    } else {
      // Single-shot path: unchanged behaviour for small inputs
      const regexResults = scanWithRegex(rawCode);
      const entropyResults = scanWithEntropy(rawCode);
      mergedResults = mergeResults(regexResults, entropyResults);
      regexCount = regexResults.length;
      entropyCount = entropyResults.length;
    }

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
        regexMatches: regexCount,
        entropyMatches: entropyCount,
        processingMode: isLargeInput ? 'chunked' : 'single'
      }
    };

  } catch (error) {
    console.error('Shoonya processing error:', error);
    return { secretsFound: [], redactedCode: rawCode, mapping: {}, metadata: { totalLength: rawCode.length, processingTime: 0, scanCount: 0, error: error.message } };
  }
}

// 3. ADD 'export' HERE
export function quickScan(rawCode) {
  return processCode(rawCode).secretsFound;
}

// 4. ADD 'export' HERE
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

// Keep this for browser compatibility
if (typeof window !== 'undefined') {
  window.processCode = processCode;
}