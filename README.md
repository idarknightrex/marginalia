# Marginalia

A local-first, privacy-first, multi-model research workbench.

Marginalia is a thinking tool for researchers — not an answer machine. It fires the same prompt against a council of models drawn from distinct training cultures and geographic provenances, producing a topology of responses the researcher can move inside rather than a negotiated middle ground to accept. The researcher remains the epistemological centre. The library is the intelligence.

**Current version:** v1.6.17  
**License:** MIT  
**Platform:** macOS (Apple Silicon), runs headless via launchd  
**Stack:** Flask · SQLite · Ollama · flat markdown canonical files

---

## Philosophy

Marginalia is margin notes. Not a CLI, not an answer machine, not a replacement for paper-based research — the digital equivalent of the annotation in the margin of a text, except the margin can respond, pressure-test, and connect across your whole library.

The paper-based research paradigm is the origin, not something being replaced. Marginalia extends it into a space where the margin has memory, annotations connect to each other, and a council of models with genuinely different epistemic provenances can read what you've written in other margins. The boulder rolls through the same territory the pen traced.

A single model is an answer machine. Two models provide a balance. Three or more models is a topology — a space of ideas the researcher can move inside, pull against, and mark with the trace of their own judgment. If you don't end a work window with a few dangling threads, something is missing. Productive incompletion is the point, not a failure state.

Intentional friction in the UI (manual slugs, hand-cycled status, Save & Break as deliberate gesture) is epistemological commitment made visible.

---

## Infrastructure

- **Solaris** — Mac Mini M4 16GB, headless server, Tailscale-accessible
- **Local models via Ollama:** DeepSeek R1 (reasoning), Qwen 2.5 (Asia/Global South), Mistral (Europe), Gemma 4 (Western/multimodal), Llama 3.1 (Global), Command R7B (Canadian)
- **Cloud APIs:** Gemini 3.6 Flash, Anthropic (optional), Cohere (optional)
- **Canonical data:** flat markdown files, human-readable without the tool

---

## Repositories

### Code (this repo)
**Primary:** `github.com/idarknightrex/marginalia`

MIT licensed, public. Git hosting sovereignty is on the radar — GitHub is the current pragmatic choice for discoverability. Self-hosted Forgejo on Solaris is the fallback if GitHub terms change materially.

### Canonical research data (private)
`github.com/idarknightrex/marginalia-canonical`

Session files, reference library, seeds, and notes. Not included in the public repo. Pushed separately on every deploy. Flat markdown files — readable without the tool, migratable without git archaeology.

### RSIF spec
`github.com/idarknightrex/rsif-spec`

Research Session Interchange Format — a plain-text format for archiving and porting research sessions between tools.

---

## Setup

### Prerequisites
```bash
pip3 install flask bibtexparser google-generativeai
```

Ollama must be installed and running. Pull the council models:
```bash
ollama pull deepseek-r1:8b
ollama pull qwen2.5:14b
ollama pull mistral:7b
ollama pull gemma4:latest
ollama pull llama3.1:8b
ollama pull command-r7b:latest
```

### Configuration
Copy `setup.env.example` to `setup.env` and fill in API keys. At minimum, the tool runs fully local with no API keys — cloud models simply won't activate.

### Running
```bash
python3 app.py
```

Or via launchd for headless autostart on Solaris. See `com.marginalia.server.plist`.

---

## Deploy pattern

```bash
scp ~/Downloads/[ZIP] rajboora@100.126.14.57:/tmp/ && ssh -t rajboora@100.126.14.57 \
'set -e; ZIP=[ZIP]; SRC=/tmp/mu/marginalia_build; DEST=~/Developer/marginalia; \
cp $DEST/setup.env ~/setup.env.bak; \
cd /tmp && unzip -o $ZIP -d mu; \
cp $SRC/app.py $DEST/app.py; \
cp $SRC/templates/index.html $DEST/templates/index.html; \
cp $SRC/static/app.js $DEST/static/app.js; \
cp $SRC/static/app.css $DEST/static/app.css; \
cp ~/setup.env.bak $DEST/setup.env; \
sudo launchctl kickstart -k gui/$(id -u rajboora)/com.marginalia.server; \
sleep 2; \
cd $DEST && git add -A && git commit -m "[message]" && git push origin main && echo "deployed"'
```

---

## Support

Ko-fi: `ko-fi.com/llmarginalia`  
Personal site: `boora.ca`
