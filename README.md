# OpenClaw Unraid Template with Ollama Support

A self-contained Unraid Docker template for OpenClaw with automatic Ollama (local LLM) configuration.

## ✨ Features

- **Zero manual setup** — Template auto-downloads and runs the startup script
- **Automatic Ollama configuration** — Just set the URL and API key
- **Preserves customizations** — User settings survive container restarts
- **Multiple model support** — Add models by changing env vars

---

## 🚀 Quick Start

### 1. Create Your GitHub Repository

1. Create a new repo (e.g., `your-username/openclaw-unraid-ollama`)
2. Upload these files:
   - `openclaw-template.xml`
   - `startup-config.js`

3. **Update the template** — Edit `openclaw-template.xml` and replace `YOUR_USERNAME` with your GitHub username:
   ```xml
   <PostArgs>sh -c "SCRIPT_URL=${STARTUP_SCRIPT_URL:-https://raw.githubusercontent.com/YOUR_USERNAME/openclaw-unraid-ollama/main/startup-config.js}; ...
   ```

### 2. Add Template Repository in Unraid

1. Go to **Docker** → **Add Container** → **Template Repositories**
2. Add your repository URL: `https://github.com/YOUR_USERNAME/openclaw-unraid-ollama`
3. Click **Save**

### 3. Install OpenClaw

1. Go to **Apps** → Search for "OpenClaw"
2. Fill in the required settings:

| Setting | Value | Example |
|---------|-------|---------|
| **Gateway Token** | Any secret value | `my-secret-token-123` |
| **Ollama Base URL** | Ollama URL with `/v1` suffix | `http://172.17.0.1:11434/v1` |
| **Ollama API Key** | Any value to enable | `ollama-local` |
| **Ollama Model** | Model name (optional) | `qwen2.5-coder:32b` |

3. Click **Apply** — Done! 🎉

---

## 🔧 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Container Starts                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PostArgs downloads startup-config.js from GitHub           │
│  (Uses Node.js https module - guaranteed available)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  startup-config.js executes:                                 │
│  ├── Load existing config (preserves user customizations)   │
│  ├── Apply required gateway settings                        │
│  ├── If OLLAMA_BASE_URL + OLLAMA_API_KEY set:              │
│  │   ├── Configure Ollama provider                          │
│  │   ├── Set api: "openai-completions" (critical!)         │
│  │   └── Add model definition + set as default             │
│  └── Save merged configuration                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  OpenClaw starts with all settings configured               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Ollama URL Reference

| Your Setup | Ollama Base URL |
|------------|-----------------|
| Ollama on same Unraid (bridge network) | `http://172.17.0.1:11434/v1` |
| Ollama with explicit Unraid IP | `http://192.168.1.X:11434/v1` |
| Ollama on custom Docker network | `http://ollama:11434/v1` |
| Ollama on different server | `http://OTHER_IP:11434/v1` |

**Important**: The `/v1` suffix is required for OpenAI API compatibility.

---

## 🤖 Recommended Models

| Model | VRAM | Best For |
|-------|------|----------|
| `qwen2.5-coder:7b` | 8GB | Light coding tasks |
| `qwen2.5-coder:32b` | 20GB | **Recommended** - great balance |
| `llama3.3:70b` | 40GB | General purpose |
| `deepseek-r1:32b` | 20GB | Reasoning tasks |

Pull models in your Ollama container first:
```bash
docker exec -it ollama ollama pull qwen2.5-coder:32b
```

---

## ⚙️ Ollama Container Settings

Ensure your Ollama container has these environment variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| `OLLAMA_HOST` | `0.0.0.0` | Allow external connections |
| `OLLAMA_CONTEXT_LENGTH` | `16384` | Context window size |
| `OLLAMA_FLASH_ATTENTION` | `1` | Faster, less VRAM |

---

## 🔍 Troubleshooting

### "Empty responses from Ollama"
The script automatically sets `api: "openai-completions"`. If you manually edited the config, ensure it's not set to `"openai-responses"` (which causes silent failures).

### "Cannot connect to Ollama"
1. Verify Ollama is running: `curl http://YOUR_URL/api/tags`
2. Check Ollama has `OLLAMA_HOST=0.0.0.0`
3. Try your Unraid IP instead of `172.17.0.1`

### "Model not found"
Pull the model first in Ollama:
```bash
docker exec -it ollama ollama pull MODEL_NAME
```

### View startup logs
```bash
docker logs openclaw 2>&1 | head -50
```

---

## 🧪 Local Testing

You can test the startup script locally:

```bash
# Test without Ollama
TEST_CONFIG_DIR=/tmp/test1 node startup-config.js

# Test with Ollama
TEST_CONFIG_DIR=/tmp/test2 \
OLLAMA_BASE_URL="http://172.17.0.1:11434/v1" \
OLLAMA_API_KEY="ollama-local" \
OLLAMA_MODEL="qwen2.5-coder:32b" \
node startup-config.js

# View generated config
cat /tmp/test2/openclaw.json
```

---

## 📁 Repository Structure

```
├── openclaw-template.xml     # Unraid Docker template
├── startup-config.js         # Auto-downloaded startup script
└── README.md                 # This file
```

---

## 🔄 Updating

To update the startup script:
1. Edit `startup-config.js` in your repo
2. Commit and push
3. Restart the OpenClaw container — it downloads the latest script on each start

---

## 📝 Advanced: Custom Script URL

If you want to use a different script location, set the `Startup Script URL` advanced setting to your custom URL.

---

## 🙏 Credits

- [OpenClaw](https://github.com/openclaw/openclaw) - The AI gateway
- [Hegghammer's Ollama Guide](https://gist.github.com/Hegghammer/86d2070c0be8b3c62083d6653ad27c23) - Configuration reference
- Original Unraid template by [jdhill777](https://github.com/jdhill777/openclaw-unraid)
