"""
synthesizer.py — Shoonya NER Training Data Generator

Generates labeled training data for the NER (token classification) model.
Each sample is a realistic code snippet with injected dummy secrets,
annotated with (start, end, label) entity spans.

Output: training_data.jsonl  — one JSON object per line.
"""

import json
import random
import string
import base64
import re
from pathlib import Path

# ─────────────────────────────────────────────────────────────
# 1. Secret generators
# ─────────────────────────────────────────────────────────────

def rand_chars(chars, n):
    return "".join(random.choices(chars, k=n))

ALPHA_NUM = string.ascii_letters + string.digits
HEX = string.hexdigits[:16]

def gen_openai_key():
    return "sk-" + rand_chars(ALPHA_NUM, 48)

def gen_anthropic_key():
    return "sk-ant-" + rand_chars(ALPHA_NUM, 95)

def gen_aws_access_key():
    return "AKIA" + rand_chars(string.ascii_uppercase + string.digits, 16)

def gen_aws_secret():
    return rand_chars(ALPHA_NUM + "/+", 40)

def gen_stripe_live():
    return "sk_live_" + rand_chars(ALPHA_NUM, 32)

def gen_stripe_test():
    return "sk_test_" + rand_chars(ALPHA_NUM, 32)

def gen_google_api():
    return "AIza" + rand_chars(ALPHA_NUM + "-_", 35)

def gen_github_pat():
    return "ghp_" + rand_chars(ALPHA_NUM, 36)

def gen_jwt():
    header = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(b'{"sub":"1234567890","name":"JohnDoe","iat":1516239022}').rstrip(b"=").decode()
    signature = rand_chars(ALPHA_NUM + "-_", 43)
    return f"{header}.{payload}.{signature}"

def gen_bearer_token():
    return rand_chars(ALPHA_NUM + "-_.", 64)

def gen_private_key():
    return "-----BEGIN RSA PRIVATE KEY-----\n" + rand_chars(ALPHA_NUM + "/+=\n", 100) + "\n-----END RSA PRIVATE KEY-----"

def gen_password():
    return rand_chars(ALPHA_NUM + "!@#$%^&*", random.randint(12, 24))

def gen_sendgrid_key():
    return "SG." + rand_chars(ALPHA_NUM + "-_", 22) + "." + rand_chars(ALPHA_NUM + "-_", 43)

def gen_twilio_sid():
    return "AC" + rand_chars(HEX, 32)

def gen_slack_token():
    return "xoxb-" + rand_chars(string.digits, 9) + "-" + rand_chars(string.digits, 12) + "-" + rand_chars(ALPHA_NUM, 24)

SECRET_GENERATORS = {
    "OPENAI_KEY":    gen_openai_key,
    "ANTHROPIC_KEY": gen_anthropic_key,
    "AWS_ACCESS_KEY": gen_aws_access_key,
    "AWS_SECRET":    gen_aws_secret,
    "STRIPE_LIVE":   gen_stripe_live,
    "STRIPE_TEST":   gen_stripe_test,
    "GOOGLE_API":    gen_google_api,
    "GITHUB_PAT":    gen_github_pat,
    "JWT":           gen_jwt,
    "BEARER_TOKEN":  gen_bearer_token,
    "PRIVATE_KEY":   gen_private_key,
    "PASSWORD":      gen_password,
    "SENDGRID_KEY":  gen_sendgrid_key,
    "TWILIO_SID":    gen_twilio_sid,
    "SLACK_TOKEN":   gen_slack_token,
}

# ─────────────────────────────────────────────────────────────
# 2. Code snippet templates
#    Use {{SECRET}} as the injection placeholder.
# ─────────────────────────────────────────────────────────────

JS_TEMPLATES = [
    'const apiKey = "{{SECRET}}";',
    'const API_KEY = `{{SECRET}}`;',
    "const config = { key: '{{SECRET}}', timeout: 3000 };",
    "process.env.OPENAI_KEY = '{{SECRET}}';",
    "Authorization: `Bearer {{SECRET}}`",
    "const client = new OpenAI({ apiKey: '{{SECRET}}' });",
    "module.exports = { secret: '{{SECRET}}' };",
    "fetch('/api', { headers: { 'x-api-key': '{{SECRET}}' } });",
    "const token = '{{SECRET}}'; // TODO: move to env",
    "let password = '{{SECRET}}';",
    "const privateKey = `{{SECRET}}`;",
    "localStorage.setItem('auth', '{{SECRET}}');",
]

PY_TEMPLATES = [
    'API_KEY = "{{SECRET}}"',
    'secret = "{{SECRET}}"',
    "client = OpenAI(api_key='{{SECRET}}')",
    'os.environ["OPENAI_KEY"] = "{{SECRET}}"',
    'config = {"password": "{{SECRET}}", "host": "localhost"}',
    "headers = {'Authorization': 'Bearer {{SECRET}}'}",
    'password = "{{SECRET}}"  # temp',
    "stripe.api_key = '{{SECRET}}'",
    "PRIVATE_KEY = '''{{SECRET}}'''",
    'r = requests.get(url, headers={"x-token": "{{SECRET}}"})',
]

BASH_TEMPLATES = [
    "export API_KEY={{SECRET}}",
    "export OPENAI_KEY='{{SECRET}}'",
    'AWS_ACCESS_KEY_ID="{{SECRET}}"',
    'AWS_SECRET_ACCESS_KEY="{{SECRET}}"',
    "TOKEN={{SECRET}} node server.js",
    "curl -H 'Authorization: Bearer {{SECRET}}' https://api.example.com",
    "echo {{SECRET}} | docker login --password-stdin",
]

JSON_TEMPLATES = [
    '{{"api_key": "{{SECRET}}", "model": "gpt-4"}}',
    '{{"secret": "{{SECRET}}", "version": "1.0"}}',
    '{{"credentials": {{"token": "{{SECRET}}"}}}}',
    '{{"password": "{{SECRET}}", "username": "admin"}}',
]

ALL_TEMPLATES = JS_TEMPLATES + PY_TEMPLATES + BASH_TEMPLATES + JSON_TEMPLATES

# ─────────────────────────────────────────────────────────────
# 3. Benign snippets (no secrets — negative samples)
# ─────────────────────────────────────────────────────────────

BENIGN_SNIPPETS = [
    "const x = Math.random().toString(36).substr(2, 9);",
    "const uuid = '550e8400-e29b-41d4-a716-446655440000';",
    "const hash = crypto.createHash('sha256').update(data).digest('hex');",
    "console.log('Hello, world!');",
    "const user = { name: 'Alice', age: 30 };",
    "function add(a, b) { return a + b; }",
    "import React from 'react';",
    "SELECT * FROM users WHERE id = 1;",
    "const base64 = Buffer.from('hello').toString('base64');",
    "const url = 'https://api.example.com/v1/users';",
    "if (process.env.NODE_ENV === 'production') { ... }",
    "const PORT = process.env.PORT || 3000;",
    "module.exports = { version: '1.0.0' };",
    "npm install --save express",
    "git commit -m 'feat: add login page'",
]

# ─────────────────────────────────────────────────────────────
# 4. Sample builder
# ─────────────────────────────────────────────────────────────

def make_positive_sample(label: str, generator) -> dict:
    """Returns a labeled sample with one injected secret."""
    secret = generator()
    template = random.choice(ALL_TEMPLATES)
    text = template.replace("{{SECRET}}", secret)
    start = text.find(secret)
    end = start + len(secret)
    return {
        "text": text,
        "entities": [[start, end, label]],
        "has_secret": True,
    }

def make_negative_sample() -> dict:
    """Returns a benign code snippet with no entities."""
    return {
        "text": random.choice(BENIGN_SNIPPETS),
        "entities": [],
        "has_secret": False,
    }

# ─────────────────────────────────────────────────────────────
# 5. Dataset generation
# ─────────────────────────────────────────────────────────────

def generate_dataset(n_positives: int = 3000, neg_ratio: float = 0.4) -> list:
    samples = []

    # Positive samples — evenly distributed across secret types
    labels = list(SECRET_GENERATORS.keys())
    per_label = n_positives // len(labels)
    for label, gen in SECRET_GENERATORS.items():
        for _ in range(per_label):
            samples.append(make_positive_sample(label, gen))

    # Negative samples
    n_neg = int(n_positives * neg_ratio)
    for _ in range(n_neg):
        samples.append(make_negative_sample())

    random.shuffle(samples)
    return samples

def validate_sample(sample: dict) -> bool:
    """Check that entity spans are correct."""
    text = sample["text"]
    for start, end, label in sample["entities"]:
        if start < 0 or end > len(text) or start >= end:
            return False
        # The secret should actually be at the claimed span
        # (basic sanity check — span should be non-trivial)
        if end - start < 8:
            return False
    return True

def save_dataset(samples: list, output_path: Path):
    valid = [s for s in samples if validate_sample(s)]
    invalid_count = len(samples) - len(valid)
    print(f"Total samples  : {len(samples)}")
    print(f"Valid samples  : {len(valid)}")
    print(f"Invalid/skipped: {invalid_count}")

    with open(output_path, "w", encoding="utf-8") as f:
        for sample in valid:
            f.write(json.dumps(sample, ensure_ascii=False) + "\n")

    print(f"Saved to: {output_path}")

# ─────────────────────────────────────────────────────────────
# 6. Stats report
# ─────────────────────────────────────────────────────────────

def print_stats(samples: list):
    from collections import Counter
    label_counts = Counter()
    for s in samples:
        for _, _, label in s["entities"]:
            label_counts[label] += 1
    label_counts["BENIGN"] = sum(1 for s in samples if not s["has_secret"])

    print("\n── Label Distribution ─────────────────────")
    for label, count in sorted(label_counts.items()):
        print(f"  {label:<20} {count}")
    print("────────────────────────────────────────────\n")

# ─────────────────────────────────────────────────────────────
# 7. Entry point
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Shoonya NER Training Data Synthesizer")
    parser.add_argument("--n", type=int, default=3000, help="Number of positive samples (default: 3000)")
    parser.add_argument("--neg-ratio", type=float, default=0.4, help="Ratio of negative to positive samples (default: 0.4)")
    parser.add_argument("--out", type=str, default="training_data.jsonl", help="Output file path")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    random.seed(args.seed)
    print(f"Generating {args.n} positive + ~{int(args.n * args.neg_ratio)} negative samples...")
    dataset = generate_dataset(n_positives=args.n, neg_ratio=args.neg_ratio)
    print_stats(dataset)
    save_dataset(dataset, Path(args.out))
