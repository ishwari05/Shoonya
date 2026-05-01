import torch
from pathlib import Path
from transformers import DistilBertTokenizerFast, DistilBertForTokenClassification

# Label scheme 
LABELS = ["O", "B-SECRET", "I-SECRET"]
LABEL2ID = {l: i for i, l in enumerate(LABELS)}
ID2LABEL = {i: l for i, l in enumerate(LABELS)}

def export_onnx(model, tokenizer, output_dir: Path, max_len: int, device):
    """Export the trained PyTorch model to ONNX format."""
    print("\nExporting to ONNX...")

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

if __name__ == "__main__":
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    output_dir = Path("ml/output")
    tokenizer = DistilBertTokenizerFast.from_pretrained(output_dir / "best_model")
    model = DistilBertForTokenClassification.from_pretrained(
        output_dir / "best_model",
        id2label=ID2LABEL,
        label2id=LABEL2ID,
    ).to(device)
    export_onnx(model, tokenizer, output_dir, 128, device)
