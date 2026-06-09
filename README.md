# Marginalia

> *The notes in the margins are where the thinking lives.*

**A napkin that remembers.**

Marginalia is a locally-hosted research workbench for PhD researchers, SoTL scholars,
and anyone working against cognitive throughput culture. It captures the itch wherever
it fires — a sleep-deprived airport connection, a margin note at 2am, a voice memo
between periods — and makes it interrogable later, connectable to everything else you
are building.

It sends prompts to multiple AI models simultaneously, synthesizes and compares their
responses, captures and verifies references, and stores everything in portable,
version-controlled flat files that you own and control.

**Your paper process is primary. Marginalia is the capture and connection layer around it.**

---

## Why Marginalia Exists

The most generative moments in research rarely happen at a desk. They happen at the
edge of capacity — sleep-deprived, in transit, between tasks, in the residual arousal
state after physical exertion. The itch that won't go away is not a distraction from
research. It is research, looking for somewhere to land.

Every existing AI research tool makes the same epistemological assumption: that the
model's output is a reasonable starting point for knowledge. Marginalia makes the
opposite assumption. LLM output is a prompt for inquiry, not a conclusion. The
researcher's situated judgment — shaped by close reading, annotation, and the kind
of thinking that happens in margins, on napkins, and between periods — is the
epistemological centre.

This is also why Marginalia is local-first. Your research data does not leave your
machine except as API calls. Your annotations, your argument connections, your
verification judgments belong to you.

---

## Current Version: 0.8.4

### Models
Six model chips in the UI — mix and match per session:

| Chip | Model | Type | Key needed |
|---|---|---|---|
| Gemini 2.5 Flash | gemini-2.5-flash | Cloud | GOOGLE_API_KEY |
| Claude Haiku | claude-haiku-4-5 | Cloud | ANTHROPIC_API_KEY |
| GPT-4o | gpt-4o | Cloud | OPENAI_API_KEY |
| Perplexity | llama-3.1-sonar-large-128k-online | Cloud / web-aware | PERPLEXITY_API_KEY |
| DeepSeek R1 | deepseek-r1:8b | Local (Ollama) | None |
| Gemma 4 | gemma4:latest | Local (Ollama) | None |

On 16GB systems, run one local model at a time. The UI enforces this with a chip
mutex — clicking a local chip auto-deactivates the other.

### Synthesis engine
After every multi-model prompt, all responses are sent to DeepSeek R1 locally for
a meta-pass. The synthesis panel identifies consensus, divergence, unique contributions,
and gaps. Stays on machine — no cloud call.

### Reference import
All formats accepted, all routes to the same canonical markdown output:
- File drop: `.csv`, `.bib`, `.ris`
- Paste: BibTeX, RIS, CSV, DOI list, plain text (parsed by local AI)
- DOI quick lookup with preview on the References tab
- Manual entry panel

### Setup
One file: `setup.env` in the repo root. Open it, paste your keys, save.
No hidden files, no dot files, no terminal magic required.

---

## What Marginalia Does

- **Multi-model synthesis** — send a prompt to Gemini, Claude, GPT-4o, Perplexity,
  DeepSeek R1, and Gemma 4 simultaneously. Discrete responses side by side.
  Local synthesis pass identifies consensus, divergence, gaps.
- **Reference pipeline** — track sources through four stages: surfaced → located →
  verified | rejected. Import from any format.
- **Canonical flat files** — everything stored as human-readable markdown.
  No database lock-in. Your research is readable without Marginalia.
- **Save & Break** — one button commits and pushes everything to your private
  GitHub backup.
- **Idea map** — force-directed SVG graph of references, themes, sessions (Phase 2)
- **Ingest / OCR** — photo, PDF, audio, typed notes (Phase 4, Gemma 4 as primary engine)

---

## What Marginalia Does Not Do

- Replace close reading
- Verify citations for you — that is your job, by design
- Send your research data to a cloud service
- Treat LLM output as authoritative

---

## Architecture

- **Flask** (Python) — API key vault, backend routing, canonical file writer
- **SQLite** — runtime state only; canonical markdown files are the source of truth
- **Ollama** — local model runner; models stored on external SSD if configured
- **utils/paths.py** — single source of truth for all filesystem paths
- **setup.env** — visible API key file, gitignored
- **Four-layer backup:** internal drive → Vault rsync → iCloud/OneDrive → GitHub

---

## File Structure

```
~/Developer/marginalia/
├── app.py                  ← Flask backend
├── setup.env               ← Your API keys (gitignored)
├── settings.json           ← Model and workflow preferences
├── bootstrap.command       ← Launch script (Mac)
├── bootstrap.sh            ← Launch script (Linux)
├── bootstrap.bat           ← Launch script (Windows)
├── requirements.txt        ← Python dependencies
├── templates/
│   └── index.html          ← Frontend (all JS inline)
├── utils/
│   ├── paths.py            ← Filesystem path constants
│   └── git_preflight.py    ← Safe commit helper
├── canonical/              ← Your research data (gitignored in public repo)
│   ├── references/         ← One markdown file per reference
│   └── sessions/           ← One markdown file per prompt session
├── tools/
│   └── seed_template.csv   ← CSV import template
└── assets/
    └── marginalia-logo.svg
```

---

## PDF Naming Convention

Store PDFs in `~/Documents/Research/PDFs/` — never inside the Marginalia project folder.

```
AuthorLastname_Year_ShortTitle.pdf
```

Examples: `Battiste_2013_DecolonizingEducation.pdf` · `Mueller_2014_PenMightier.pdf`

The shorthand `Battiste_2013` in a margin note, an annotation, and an LLM prompt
all refer to exactly one thing, permanently.

---

## Getting Started

See **GETTING-STARTED.md** for the full setup guide.

Short version:
1. Install Python 3.12, Ollama, Git
2. Unzip or clone into `~/Developer/marginalia/`
3. Open `setup.env`, paste your API keys
4. Double-click `bootstrap.command`
5. Pull local models: `ollama pull deepseek-r1:8b` and `ollama pull gemma4`

---

## Ko-fi

https://ko-fi.com/llmarginalia

MIT licensed. No gates, no unlock states, no localStorage flags. If Marginalia
is useful to your research, a coffee is appreciated but never required.

---

*Ideas don't have a calendar. Neither does gratitude.*
