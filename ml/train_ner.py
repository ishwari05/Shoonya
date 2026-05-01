"""
train_ner.py — Shoonya NER Model Trainer

Fine-tunes DistilBERT for token classification (NER) on the synthesized
training data. Exports the final model as ONNX for in-browser inference.

Usage:
  python ml/train_ner.py --data ml/training_data.jsonl --epochs 5
  python ml/train_ner.py --data ml/training_data.jsonl --export-onnx
"""

import json
import argparse
import re
from pathlib import Path
from collections import Counter

import torch
from torch.utils.data import Dataset, DataLoader
from transformers import (
    DistilBertTokenizerFast,
    DistilBertForTokenClassification,
    get_linear_schedule_with_warmup,
)
from torch.optim import AdamW
from sklearn.model_selection import train_test_split

# ─────────────────────────────────────────────────────────────
# Label scheme
# ─────────────────────────────────────────────────────────────

LABELS = ["O", "B-SECRET", "I-SECRET"]
LABEL2ID = {l: i for i, l in enumerate(LABELS)}
ID2LABEL = {i: l for i, l in enumerate(LABELS)}

# ─────────────────────────────────────────────────────────────
# 1. Dataset
# ─────────────────────────────────────────────────────────────

class NERDataset(Dataset):
    """
    Converts raw JSONL samples → tokenized input + BIO token labels.
    Handles sub-word alignment: the first sub-token of each word gets
    the label; continuation sub-tokens get -100 (ignored by loss).
    """

    def __init__(self, samples, tokenizer, max_len=128):
        self.tokenizer = tokenizer
        self.max_len = max_len
        self.items = []

        for sample in samples:
            encoding = self._encode(sample)
            if encoding:
                self.items.append(encoding)

    def _encode(self, sample):
        text = sample["text"]
        entities = sample["entities"]   # list of [start, end, label]

        # Build a char-level label array
        char_labels = ["O"] * len(text)
        for start, end, _ in entities:
            if start >= len(text) or end > len(text):
                return None
            char_labels[start] = "B-SECRET"
            for i in range(start + 1, end):
                char_labels[i] = "I-SECRET"

        # Tokenize with offset mapping
        enc = self.tokenizer(
            text,
            truncation=True,
            max_length=self.max_len,
            return_offsets_mapping=True,
            padding="max_length",
        )

        token_labels = []
        for (tok_start, tok_end) in enc["offset_mapping"]:
            if tok_start == tok_end:
                # Special token ([CLS], [SEP], [PAD])
                token_labels.append(-100)
            else:
                # Use the label of the first character of this token
                token_labels.append(LABEL2ID[char_labels[tok_start]])

        return {
            "input_ids":      torch.tensor(enc["input_ids"],      dtype=torch.long),
            "attention_mask": torch.tensor(enc["attention_mask"], dtype=torch.long),
            "labels":         torch.tensor(token_labels,          dtype=torch.long),
        }

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        return self.items[idx]

# ─────────────────────────────────────────────────────────────
# 2. Training loop
# ─────────────────────────────────────────────────────────────

def compute_metrics(preds, labels):
    """Token-level precision/recall/F1 for SECRET class."""
    tp = fp = fn = 0
    for p, l in zip(preds, labels):
        if l == -100:
            continue
        if l in (LABEL2ID["B-SECRET"], LABEL2ID["I-SECRET"]):
            if p == l:
                tp += 1
            else:
                fn += 1
        else:
            if p in (LABEL2ID["B-SECRET"], LABEL2ID["I-SECRET"]):
                fp += 1
    precision = tp / (tp + fp + 1e-8)
    recall    = tp / (tp + fn + 1e-8)
    f1        = 2 * precision * recall / (precision + recall + 1e-8)
    return {"precision": precision, "recall": recall, "f1": f1}

def train(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # ── Load data ──────────────────────────────────────────
    samples = []
    with open(args.data, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                samples.append(json.loads(line))
    print(f"Loaded {len(samples)} samples from {args.data}")

    train_samples, val_samples = train_test_split(samples, test_size=0.1, random_state=42)
    print(f"Train: {len(train_samples)}  |  Val: {len(val_samples)}")

    # ── Tokenizer & Model ───────────────────────────────────
    tokenizer = DistilBertTokenizerFast.from_pretrained("distilbert-base-uncased")
    model = DistilBertForTokenClassification.from_pretrained(
        "distilbert-base-uncased",
        num_labels=len(LABELS),
        id2label=ID2LABEL,
        label2id=LABEL2ID,
    ).to(device)

    train_dataset = NERDataset(train_samples, tokenizer, max_len=args.max_len)
    val_dataset   = NERDataset(val_samples,   tokenizer, max_len=args.max_len)

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True)
    val_loader   = DataLoader(val_dataset,   batch_size=args.batch_size)

    # ── Optimizer & Scheduler ───────────────────────────────
    optimizer = AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    total_steps = len(train_loader) * args.epochs
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=int(0.1 * total_steps),
        num_training_steps=total_steps,
    )

    # ── Training epochs ─────────────────────────────────────
    best_f1 = 0.0
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, args.epochs + 1):
        # Train
        model.train()
        total_loss = 0
        for batch in train_loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            outputs = model(**batch)
            loss = outputs.loss
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad()
            total_loss += loss.item()

        avg_loss = total_loss / len(train_loader)

        # Validate
        model.eval()
        all_preds, all_labels = [], []
        with torch.no_grad():
            for batch in val_loader:
                batch = {k: v.to(device) for k, v in batch.items()}
                outputs = model(**batch)
                logits = outputs.logits
                preds = torch.argmax(logits, dim=-1).cpu().numpy()
                labels = batch["labels"].cpu().numpy()
                for pred_row, label_row in zip(preds, labels):
                    all_preds.extend(pred_row.tolist())
                    all_labels.extend(label_row.tolist())

        metrics = compute_metrics(all_preds, all_labels)
        print(
            f"Epoch {epoch}/{args.epochs}  |  "
            f"loss={avg_loss:.4f}  |  "
            f"P={metrics['precision']:.3f}  R={metrics['recall']:.3f}  F1={metrics['f1']:.3f}"
        )

        if metrics["f1"] > best_f1:
            best_f1 = metrics["f1"]
            model.save_pretrained(output_dir / "best_model")
            tokenizer.save_pretrained(output_dir / "best_model")
            print(f"  ✅ New best F1={best_f1:.3f} — model saved.")

    print(f"\nTraining complete. Best F1: {best_f1:.3f}")
    print(f"Model saved to: {output_dir / 'best_model'}")

    if args.export_onnx:
        export_onnx(model, tokenizer, output_dir, args.max_len, device)

# ─────────────────────────────────────────────────────────────
# 3. ONNX export
# ─────────────────────────────────────────────────────────────

def export_onnx(model, tokenizer, output_dir: Path, max_len: int, device):
    """Export the trained PyTorch model to ONNX format."""
    print("\nExporting to ONNX...")

    # Load best model for export
    model = DistilBertForTokenClassification.from_pretrained(
        output_dir / "best_model",
        id2label=ID2LABEL,
        label2id=LABEL2ID,
    ).to(device)
    model.eval()

    dummy_text = "const apiKey = 'sk-test123';"
    dummy_enc = tokenizer(
        dummy_text,
        return_tensors="pt",
        max_length=max_len,
        padding="max_length",
        truncation=True,
    )
    dummy_input_ids      = dummy_enc["input_ids"].to(device)
    dummy_attention_mask = dummy_enc["attention_mask"].to(device)

    onnx_path = output_dir / "shoonya_ner.onnx"

    torch.onnx.export(
        model,
        (dummy_input_ids, dummy_attention_mask),
        str(onnx_path),
        input_names=["input_ids", "attention_mask"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids":      {0: "batch", 1: "seq"},
            "attention_mask": {0: "batch", 1: "seq"},
            "logits":         {0: "batch", 1: "seq"},
        },
        opset_version=14,
        do_constant_folding=True,
    )

    print(f"✅ ONNX model saved to: {onnx_path}")
    size_mb = onnx_path.stat().st_size / (1024 * 1024)
    print(f"   Model size: {size_mb:.1f} MB")

# ─────────────────────────────────────────────────────────────
# 4. Entry point
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Shoonya NER Trainer")
    parser.add_argument("--data",        type=str, default="ml/training_data.jsonl")
    parser.add_argument("--epochs",      type=int, default=5)
    parser.add_argument("--batch-size",  type=int, default=32)
    parser.add_argument("--lr",          type=float, default=5e-5)
    parser.add_argument("--max-len",     type=int, default=128)
    parser.add_argument("--output",      type=str, default="ml/output")
    parser.add_argument("--export-onnx", action="store_true", help="Export ONNX after training")
    args = parser.parse_args()
    train(args)
