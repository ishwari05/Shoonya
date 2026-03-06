# 🛡️ CodeShield

**Stop leaking secrets to AI chatbots.** (v2.0.0)

CodeShield is a Chrome extension that silently watches what you type into AI tools like ChatGPT, Claude, and Gemini — and automatically redacts API keys, passwords, and tokens before they ever leave your browser.

No servers. No signups. No nonsense. It all runs locally.

---

## What It Does

- **Detects secrets in real-time** as you type or paste
- **Auto-redacts** them with safe placeholders like `[OPENAI_API_KEY_1]`
- **Restores** the original text after the AI responds
- **Works silently** — you'll barely notice it's there until it saves you
- **Handles large inputs efficiently** with chunked scanning
- **Smart false-positive guards** to ignore UUIDs and Base64 data URIs
- **Accurate singular redactions** without duplicate text bugs

---

## Detected Secret Types

| Type | Pattern |
|---|---|
| AWS Access Key | `AKIA...` |
| AWS Secret Key | 40-char alphanumeric strings |
| OpenAI API Key | `sk-...` |
| Stripe Keys | `sk_live_...` / `sk_test_...` |
| Google API Key | `AIza...` |
| JWT Tokens | `eyJ...` |
| Bearer Tokens | `Authorization: Bearer ...` |
| Private Keys | `-----BEGIN PRIVATE KEY-----` |
| Passwords | `password=`, `pwd:` assignments |
| High Entropy Strings | Unknown secrets detected by entropy analysis |

---

## Supported Sites

Works automatically on:

- ChatGPT (`chatgpt.com`)
- Claude (`claude.ai`)
- Gemini (`gemini.google.com`)
- GitHub (`github.com`)

It'll scan any site you visit — but the badge only lights up on supported AI platforms.

---

## Installation

> No Chrome Web Store yet. Load it manually in under 60 seconds.

1. Open Chrome → go to `chrome://extensions/`
2. Toggle **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this repo
5. Done. The shield icon appears in your toolbar.

---

## Quick Test

Paste this into ChatGPT and watch CodeShield catch it:

```
OPENAI_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
password=super_secret_password_123
```

You should see a warning banner and the text auto-redacted.

---

## Project Structure

```
CodeShield/
├── extension/
│   ├── manifest.json       # Extension config (MV3)
│   ├── background.js       # Service worker — orchestrates everything
│   ├── content.js          # Injected into pages — watches your input
│   ├── popup.html/js/css   # The little UI when you click the icon
│   ├── options.html/js/css # Settings page
│   ├── content.css         # Warning banner styles
│   └── engine/
│       ├── index.js        # Main pipeline orchestrator
│       ├── scanner.js      # Regex-based secret detection
│       ├── entropy.js      # Entropy-based unknown secret detection
│       └── redactor.js     # Replaces secrets with placeholders
```

---

## Privacy

- **Zero network requests.** Your code never leaves your machine.
- **No analytics.** No telemetry. No accounts.
- **Open source.** Read every line yourself.

---

## License

MIT

---

*Built because pasting an API key into ChatGPT should feel terrifying. Now it doesn't have to.*
