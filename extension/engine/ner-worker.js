/**
 * ner-worker.js — Shoonya ONNX NER Web Worker
 *
 * Runs inside a Web Worker so inference never blocks the browser tab.
 * Loaded once from background.js on service worker startup.
 *
 * Message API:
 *   IN  → { id, text }
 *   OUT → { id, result: { hasSecret, secrets: [{text, label, confidence, start, end}] } }
 *         { id, error: string }
 */

importScripts("https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js");

// ─────────────────────────────────────────────────────────────
// Label scheme (must match train_ner.py)
// ─────────────────────────────────────────────────────────────
const LABELS = ["O", "B-SECRET", "I-SECRET"];
const B_IDX = 1; // LABEL2ID["B-SECRET"]
const I_IDX = 2; // LABEL2ID["I-SECRET"]

// ─────────────────────────────────────────────────────────────
// Model & tokenizer state
// ─────────────────────────────────────────────────────────────
let session = null;
let vocab = null;
const MAX_LEN = 128;

// ─────────────────────────────────────────────────────────────
// Minimal WordPiece tokenizer
// ─────────────────────────────────────────────────────────────

function loadVocab(vocabObj) {
    vocab = vocabObj; // token → id
}

function tokenize(text) {
    // Returns { inputIds, attentionMask, offsets }
    const CLS = vocab["[CLS]"] ?? 101;
    const SEP = vocab["[SEP]"] ?? 102;
    const PAD = vocab["[PAD]"] ?? 0;
    const UNK = vocab["[UNK]"] ?? 100;

    const inputIds = [CLS];
    const offsets = [[-1, -1]]; // CLS has no char offset

    const lower = text.toLowerCase();
    let i = 0;

    while (i < lower.length && inputIds.length < MAX_LEN - 1) {
        // Skip whitespace
        if (/\s/.test(lower[i])) { i++; continue; }

        // Find word boundary
        let j = i;
        while (j < lower.length && !/\s/.test(lower[j])) j++;

        const word = lower.slice(i, j);
        const charStart = i;

        // WordPiece segmentation
        let start = 0;
        let isFirst = true;
        while (start < word.length && inputIds.length < MAX_LEN - 1) {
            let end = word.length;
            let found = false;
            while (end > start) {
                const sub = (isFirst ? "" : "##") + word.slice(start, end);
                if (vocab[sub] !== undefined) {
                    inputIds.push(vocab[sub]);
                    offsets.push([charStart + start, charStart + end]);
                    start = end;
                    isFirst = false;
                    found = true;
                    break;
                }
                end--;
            }
            if (!found) {
                inputIds.push(UNK);
                offsets.push([charStart + start, charStart + start + 1]);
                start++;
                isFirst = false;
            }
        }
        i = j;
    }

    inputIds.push(SEP);
    offsets.push([-1, -1]);

    // Pad
    while (inputIds.length < MAX_LEN) {
        inputIds.push(PAD);
        offsets.push([-1, -1]);
    }

    const attentionMask = inputIds.map(id => id !== PAD ? 1 : 0);

    return {
        inputIds: BigInt64Array.from(inputIds.map(BigInt)),
        attentionMask: BigInt64Array.from(attentionMask.map(BigInt)),
        offsets,
    };
}

// ─────────────────────────────────────────────────────────────
// Softmax helper
// ─────────────────────────────────────────────────────────────
function softmax(arr) {
    const max = Math.max(...arr);
    const exps = arr.map(x => Math.exp(x - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(x => x / sum);
}

// ─────────────────────────────────────────────────────────────
// Run inference
// ─────────────────────────────────────────────────────────────
async function runNER(text) {
    if (!session || !vocab) throw new Error("Model not loaded");

    const { inputIds, attentionMask, offsets } = tokenize(text);

    const feeds = {
        input_ids: new ort.Tensor("int64", inputIds, [1, MAX_LEN]),
        attention_mask: new ort.Tensor("int64", attentionMask, [1, MAX_LEN]),
    };

    const output = await session.run(feeds);
    const logits = output.logits.data; // Float32Array  [1, MAX_LEN, 3]

    // Decode token-level predictions → character-level secret spans
    const secrets = [];
    let spanStart = -1;
    let spanEnd = -1;
    let spanConfs = [];

    const numTokens = MAX_LEN;
    const numLabels = LABELS.length;

    for (let t = 0; t < numTokens; t++) {
        const slice = logits.slice(t * numLabels, (t + 1) * numLabels);
        const probs = softmax(Array.from(slice));
        const predIdx = probs.indexOf(Math.max(...probs));
        const conf = probs[predIdx];

        const [charStart, charEnd] = offsets[t];
        if (charStart === -1) continue; // special token

        if (predIdx === B_IDX) {
            // Flush previous span
            if (spanStart !== -1) {
                secrets.push({
                    text: text.slice(spanStart, spanEnd),
                    label: "SECRET",
                    confidence: spanConfs.reduce((a, b) => a + b, 0) / spanConfs.length,
                    start: spanStart,
                    end: spanEnd,
                });
            }
            spanStart = charStart;
            spanEnd = charEnd;
            spanConfs = [conf];
        } else if (predIdx === I_IDX && spanStart !== -1) {
            spanEnd = charEnd;
            spanConfs.push(conf);
        } else {
            if (spanStart !== -1) {
                secrets.push({
                    text: text.slice(spanStart, spanEnd),
                    label: "SECRET",
                    confidence: spanConfs.reduce((a, b) => a + b, 0) / spanConfs.length,
                    start: spanStart,
                    end: spanEnd,
                });
            }
            spanStart = -1;
            spanConfs = [];
        }
    }

    // Flush last span
    if (spanStart !== -1) {
        secrets.push({
            text: text.slice(spanStart, spanEnd),
            label: "SECRET",
            confidence: spanConfs.reduce((a, b) => a + b, 0) / spanConfs.length,
            start: spanStart,
            end: spanEnd,
        });
    }

    return {
        hasSecret: secrets.length > 0,
        secrets,
    };
}

// ─────────────────────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────────────────────
async function init(modelUrl, vocabUrl) {
    ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";
    session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
    });

    const vocabRes = await fetch(vocabUrl);
    const vocabData = await vocabRes.json();
    loadVocab(vocabData);

    postMessage({ type: "ready" });
}

// ─────────────────────────────────────────────────────────────
// Message handler
// ─────────────────────────────────────────────────────────────
self.onmessage = async (event) => {
    const { type, id, text, modelUrl, vocabUrl } = event.data;

    if (type === "init") {
        try {
            await init(modelUrl, vocabUrl);
        } catch (err) {
            postMessage({ type: "error", error: err.message });
        }
        return;
    }

    if (type === "infer") {
        try {
            const result = await runNER(text);
            postMessage({ type: "result", id, result });
        } catch (err) {
            postMessage({ type: "error", id, error: err.message });
        }
    }
};
