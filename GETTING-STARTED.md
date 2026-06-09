# Marginalia — Getting Started Guide
**Version:** 0.8.3
**Time required:** 30–60 minutes (most of it waiting for model downloads)
**Technical level required:** None — if you can install an app on your Mac, you can do this

---

## Before You Begin — The Pack List

Everything below is free or pay-as-you-go. Gather all accounts before starting.

---

### Accounts to Create First

**1. Google AI Studio (Gemini API key)**
- Go to: https://aistudio.google.com
- Sign in with your existing Google account
- Click **Get API Key** → **Create API Key**
- Copy the key and paste it somewhere safe (Notes app, password manager)
- ✅ Free tier — no credit card required

**2. OpenAI (GPT-4o API key)**
- Go to: https://platform.openai.com/api-keys
- Create an account and add a small credit ($5 goes a long way at research volumes)
- Click **Create new secret key**
- Copy the key — you will not be able to see it again
- 💳 Pay-as-you-go — GPT-4o pricing is per token, not per month

**3. Perplexity (API key)**
- Go to: https://www.perplexity.ai/settings/api
- Create a free Perplexity account if you don't have one
- Click **Generate** under API Keys
- Copy the key
- 💳 Pay-as-you-go — very low cost at research volumes
- ✅ Perplexity is web-aware — it can find recent papers and current information

**4. Anthropic (Claude Haiku API key)**
- Go to: https://console.anthropic.com
- Create an account and add a credit card
- Go to **API Keys** → **Create Key**
- Copy the key
- 💳 Pay-as-you-go — Claude Haiku is the cheapest tier ($0.80/M input tokens)
- Session costs are displayed in real time in the Marginalia status bar

**5. GitHub (free account for sync and backup)**
- Go to: https://github.com
- Create a free account
- ✅ Free

---

### Software to Download

| Software | What it does | Download link | Cost |
|---|---|---|---|
| **Python 3.12** | Runs Marginalia | https://www.python.org/downloads/ | Free |
| **Ollama** | Runs local AI models on your machine | https://ollama.ai/download | Free |
| **Git** | Version control and backup | https://git-scm.com/downloads | Free |
| **VS Code** | Text editor (optional but recommended) | https://code.visualstudio.com | Free |

> **Python version:** Download **Python 3.12** specifically — not 3.9 (end of life),
> not 3.13. On the downloads page, look for the 3.12.x release below the featured download.
>
> After installing on Mac, run the **Install Certificates** command in the Python folder.
> Double-click it. A terminal window will open and close. This prevents a common network error.

---

## Part 1 — Install the Downloads

### Step 1 — Install Python 3.12

1. Open the Python 3.12 installer
2. Follow all prompts — defaults are fine
3. Open the **Python 3.12** folder in Applications
4. Double-click **Install Certificates.command**
5. ✅ Done

**Check:** Open Terminal, type `python3 --version` — you should see `Python 3.12.x`

---

### Step 2 — Install Git

1. Open the Git installer, follow prompts
2. ✅ Done

**Check:** In Terminal, type `git --version`

> **Mac shortcut:** Git may already be installed. Run the check first.

---

### Step 3 — Install Ollama

1. Open the Ollama installer, drag to Applications
2. Open Ollama — a small llama icon appears in your menu bar
3. ✅ Done

**Check:** In Terminal, type `ollama --version`

---

## Part 2 — Get Marginalia

### Step 4 — Download and place the project

**Option A — From a zip archive (recommended for first setup):**
1. Unzip `marginalia-v083-final.zip`
2. Rename the folder to `marginalia`
3. Move it to `~/Developer/` (create that folder if it doesn't exist)

**Option B — Clone from GitHub:**
```bash
mkdir -p ~/Developer
cd ~/Developer
git clone https://github.com/idarknightrex/marginalia.git
cd marginalia
```

✅ Your working folder is `~/Developer/marginalia/`

---

## Part 3 — Enter Your API Keys

### Step 5 — Open setup.env

This is the only file you need to edit. It lives in your marginalia folder and is
clearly labelled — no hidden files, no dot files, no hunting around.

Open it in any text editor:
```bash
open -e ~/Developer/marginalia/setup.env
```

Or in VS Code:
```bash
code ~/Developer/marginalia/setup.env
```

You will see this:

```
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
OPENAI_API_KEY=
PERPLEXITY_API_KEY=
OLLAMA_HOST=http://127.0.0.1:11434
MARGINALIA_PORT=5000
```

Paste each key after the `=` sign on the right line. Leave any keys you don't have
yet blank — those model chips will show an error when used but won't break anything.

Save and close.

> **Security:** setup.env is listed in .gitignore — it will never be pushed to GitHub.
> Your keys stay on your machine. Marginalia's Flask backend holds keys in memory;
> your browser never sees them.

✅ Keys configured.

---

## Part 4 — Download Local AI Models

These run entirely on your machine — no internet needed once downloaded.
Ollama must be running (llama icon in menu bar) before these commands work.

### Step 6 — Pull models

**If your Ollama models folder is on an external drive (Mac Mini with Vault SSD):**
```bash
export OLLAMA_MODELS=/Volumes/Vault/Marginalia/ollama/models
```
Run this first, then run the pull commands below in the same terminal window.

**Pull DeepSeek R1 8B (reasoning model — ~5.2GB):**
```bash
ollama pull deepseek-r1:8b
```

**Pull Gemma 4 (multimodal — ~9.6GB):**
```bash
ollama pull gemma4
```

Wait for the `$` prompt after each before starting the next.

> **On 16GB systems:** DeepSeek R1 is the default active local model.
> Gemma 4 starts inactive in the UI — activate it by clicking the chip,
> which will automatically deactivate DeepSeek. Running both simultaneously
> on 16GB will cause timeouts.

**Verify both downloaded:**
```bash
OLLAMA_MODELS=/Volumes/Vault/Marginalia/ollama/models ollama list
```
You should see `deepseek-r1:8b` and `gemma4:latest` in the list.

✅ Local models ready.

---

## Part 5 — Launch Marginalia

### Step 7 — First launch (Mac)

Find **bootstrap.command** in your marginalia folder.

**First time only — unblock the script:**
1. Right-click bootstrap.command
2. Select **Open**
3. Click **Open** in the security prompt

After this, double-click normally every time.

The first launch installs Python dependencies (1–2 minutes). Marginalia opens
automatically in your browser when ready.

> If your browser doesn't open, go to: `http://localhost:5000`
> If port 5000 is taken, Marginalia picks the next available port —
> check the terminal window to see which one.

✅ Marginalia is running.

---

## Part 6 — Verify Everything Works

When Marginalia loads, you should see six model chips at the top:
- **Gemini 2.5 Flash** (blue) — requires GOOGLE_API_KEY
- **Claude Haiku** (orange) — requires ANTHROPIC_API_KEY
- **GPT-4o** (green) — requires OPENAI_API_KEY
- **Perplexity** (blue) — requires PERPLEXITY_API_KEY
- **DeepSeek R1** (green) — local, no key needed
- **Gemma 4** (amber) — local, starts inactive

Type a short test prompt and click **Send to Active Models**. Chips with valid
keys will respond. Chips with missing keys will show a clear error — add the key
to setup.env and restart.

---

## Part 7 — Backup and Sync

### Step 8 — Create your private research repository on GitHub

1. Go to https://github.com → **+** → **New repository**
2. Name it `marginalia-research` (or anything you prefer)
3. Set to **Private**
4. ⚠️ Leave all boxes unchecked — empty repository
5. Click **Create repository**
6. Copy the repository URL

### Step 9 — Connect and push

```bash
cd ~/Developer/marginalia
git init
git remote add origin https://github.com/idarknightrex/marginalia.git
git remote add backup [paste your private repo URL here]
git add -A
git commit -m "v0.8.3 initial setup"
git push -u backup main
```

After every session, use the **↑ Save & Take a Break** button in Marginalia.
It commits and pushes everything automatically.

---

## Importing References

Marginalia accepts references from any format — no conversion needed.

### From the Ingest tab (files and paste):
- **Drop a file** — drag and drop a `.csv`, `.bib`, or `.ris` file
- **BibTeX** — paste from Zotero, Google Scholar, any library export
- **RIS** — paste from university databases (U of S, PubMed, JSTOR)
- **CSV** — use the `tools/seed_template.csv` format, or any CSV with recognisable headers
- **DOI list** — paste one DOI per line, metadata fetched from crossref.org automatically
- **Plain text** — paste a messy reference list, DeepSeek R1 parses it locally

### From the References tab (single DOI):
- Paste a DOI into the **Quick DOI Import** field
- Preview the metadata before confirming
- Click **Add to References**

### Manual entry:
- Click **+ Add** on the References tab
- Fill in the form

All routes write to the same canonical markdown files. One format in, always.

---

## Quick Reference — Key Files

| File | What it is | Where it lives |
|---|---|---|
| `bootstrap.command` | Launch Marginalia | `~/Developer/marginalia/` |
| `setup.env` | Your API keys | `~/Developer/marginalia/` |
| `settings.json` | Model and workflow preferences | `~/Developer/marginalia/` |
| `canonical/references/` | Your reference library | `~/Developer/marginalia/` |
| `canonical/sessions/` | Your research sessions | `~/Developer/marginalia/` |
| `CHANGELOG.md` | Version history | `~/Developer/marginalia/` |

---

## Quick Reference — Where to Get API Keys

| Key | Where | Cost |
|---|---|---|
| `GOOGLE_API_KEY` | aistudio.google.com → Get API Key | Free |
| `OPENAI_API_KEY` | platform.openai.com/api-keys | Pay-as-you-go |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | Pay-as-you-go |

---

## Troubleshooting

**Model chip shows an error**
→ Check setup.env — the key for that model is either missing or has a typo.
Restart Marginalia after editing setup.env.

**`ollama list` shows no models**
→ If models are on an external drive, set the environment variable first:
`export OLLAMA_MODELS=/Volumes/Vault/Marginalia/ollama/models`
Then run `ollama list` in the same terminal session.

**DeepSeek or Gemma times out**
→ Normal on first load after restart — the model is loading into RAM.
On 16GB systems, don't run both local models simultaneously.
Timeout is set to 300 seconds. Give it time.

**Port already in use**
→ Check the terminal window — Marginalia will have chosen the next available port.
Update your bookmark accordingly. You can also set a fixed port in setup.env:
`MARGINALIA_PORT=5001`

**bootstrap.command says "unidentified developer"**
→ Right-click → Open → Open. You only need to do this once.

**Python version errors on launch**
→ You may have Python 3.9 in your .venv. Rebuild it:
```bash
cd ~/Developer/marginalia
rm -rf .venv
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Something else**
→ The terminal window that opens on launch contains the full error message.
Copy it and open an issue at github.com/idarknightrex/marginalia

---

## PDF Organisation

Store PDFs outside the Marginalia project folder — never inside it.

**Recommended location:** `~/Documents/Research/PDFs/`

**Naming convention:**
```
AuthorLastname_Year_ShortTitle.pdf
```
Examples: `Battiste_2013_DecolonizingEducation.pdf` · `Mueller_2014_PenMightier.pdf`

The shorthand `Battiste_2013` in a margin note, in a Marginalia annotation, in an
LLM prompt — all refer to exactly one thing, permanently.

When adding a reference in Marginalia, paste the filename into the
**Holding location** field to link the physical file to the record.

---

## The Save & Take a Break Button

Always visible in the navigation bar. One click commits and pushes everything
to your private backup. Use it every time you put the book down.
