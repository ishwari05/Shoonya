import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType
import os

def shrink_model():
    input_model_path = "extension/engine/models/shoonya_ner.onnx"
    output_model_path = "extension/engine/models/shoonya_ner_quantized.onnx"

    print(f"Loading 253MB model: {input_model_path}...")
    
    # Compress the model weights from 32-bit floating point down to 8-bit integers
    quantize_dynamic(
        model_input=input_model_path,
        model_output=output_model_path,
        weight_type=QuantType.QUInt8
    )
    
    # Check new size
    old_size = os.path.getsize(input_model_path) / (1024 * 1024)
    new_size = os.path.getsize(output_model_path) / (1024 * 1024)
    
    print(f"✅ Success! Shrunk from {old_size:.1f} MB down to {new_size:.1f} MB.")
    print("Replacing old model with the compressed version...")
    
    # Replace the huge model with the tiny one
    os.remove(input_model_path)
    os.rename(output_model_path, input_model_path)
    print("Done! Model is now GitHub-ready.")

if __name__ == "__main__":
    shrink_model()
