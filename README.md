# Marginalia

> *The notes in the margins are where the thinking lives.*

**A napkin that remembers.**

Marginalia is a locally-hosted research workbench for PhD researchers, SoTL scholars, and anyone working against cognitive throughput culture. It captures the itch wherever it fires — a sleep-deprived airport connection, a margin note at 2am, a voice memo between periods — and makes it interrogable later, connectable to everything else you are building.

It also sends prompts to multiple LLMs simultaneously, synthesizes and compares their responses, captures and verifies references, maps connections between ideas, and stores everything in a portable, version-controlled project folder that you own and control.

**Your paper process is primary. Marginalia is the capture and connection layer around it.**

---

## Why Marginalia Exists

The most generative moments in research rarely happen at a desk. They happen at the edge of capacity — sleep-deprived, in transit, between tasks, in the residual arousal state after physical exertion. Yerkes and Dodson (1908) identified the mechanism a century ago. Rominger et al. (2026) confirmed it holds for creative ideation specifically. The itch that won't go away is not a distraction from research. It is research, looking for somewhere to land.

Every existing AI research tool makes the same epistemological assumption: that the model's output is a reasonable starting point for knowledge. Marginalia makes the opposite assumption. LLM output is a prompt for inquiry, not a conclusion. The researcher's situated judgment — shaped by close reading, annotation, and the kind of thinking that happens in margins, on napkins, and between periods — is the epistemological centre.

This is not a philosophical preference. It is neurologically grounded. Paper reading facilitates deeper linguistic and narrative-structural integration than screen reading (Umejima et al., 2026). Handwritten notes produce stronger memory consolidation than typed notes (Mueller & Oppenheimer, 2014; Umejima et al., 2021). The paper process does cognitive work that the digital process cannot replicate. Marginalia's OCR ingestion phase exists to capture the output of that superior process and make it interrogable — not to replace it.

Marginalia is built to enforce that assumption structurally. You cannot skip the verification pipeline. The idea map is generated from your annotations, not from model output. The paper-primary principle is not a feature you can turn off — it is the architecture.

This is also why Marginalia is local-first. Your research data does not leave your machine except as API calls. Your annotations, your argument connections, your verification judgments belong to you.

---

## The Origin

Marginalia was designed in a conversation that opened by accident, continued through a transit delay, and deepened because of sleep deprivation. The most generative connections in that conversation surfaced when the researcher was too tired to be cautious and too curious to stop. The tool is designed to create the conditions for productive accidents — not to eliminate them.

That is not incidental to what Marginalia became. It is the first evidence that the design philosophy works.

---

## What Marginalia Does

- **Multi-model synthesis** — send a prompt to Google Gemini, Azure OpenAI, Anthropic Claude, and local models simultaneously. See discrete responses side by side. A synthesis pass identifies consensus, divergence, contradictions, unique contributions, and gaps.
- **Reference pipeline** — flag any response as a potential reference. Track it through four stages: surfaced → located → verified | rejected. Log whether you have the physical book, the PDF, or library access.
- **Idea map** — a force-directed visual graph of your references, themes, and sessions — generated from your annotations and argument connections, not from model output.
- **Reference as prompt seed** — launch new synthesis sessions directly from verified references, pre-populated with your own annotation and argument connection.
- **Reflection ingestion** — upload your human reflection on a source: voice memo, handwritten notes, typed thoughts. OCR and transcription handled locally.
- **Audio/video ingestion** — transcribe voice memos and lecture recordings locally via Whisper.
- **PhD dashboard integration** — serve your existing thread tracker alongside the workbench.
- **Writing tracker** — connect published pieces to the research sessions and references that informed them.
- **Zotero export** — push verified references as BibTeX or APA 7.
- **Upgrade reminders** — the interface tells you when model strings need checking.

---

## Typical Use Case — The Deep Read Flow

This is the canonical workflow Marginalia is designed around. Each step feeds the next. A new idea at any point starts a fresh flow rather than branching the current one.

**Step 1 — Enter source details**
Create a reference record before you read. Title, authors, year, source type, holding status. Status: `located`. This is your intention to engage with the source — the record exists before the thinking begins.

**Step 2 — Converse with LLMs**
Before the deep read, send a preparation prompt: *what should I know before reading this, what debates does it enter, what should I be looking for?* The models orient your attention. You decide what to carry into the reading. Status: session linked to reference.

**Step 3 — Upload your human reflection**
After reading — voice memo recorded while reading, photograph of handwritten margin notes, typed post-read thoughts. This is your reflection, not the source. The paper stays primary. The tool captures what fired in you while you read.

**Step 4 — Check capture**
Review the OCR or transcription output. Correct anything the extraction missed. Edit before it becomes your permanent annotation. This step is deliberate — the tool does not assume its extraction was accurate. You confirm it.

**Step 5 — Check for connections**
Open the idea map. What does this source touch in your existing library? Add manual edges where you see connections the map hasn't drawn yet. Note what's missing. This is where the iceberg grows.

---

**A new idea starts a new flow.**
No branching. No nested sessions. If something fires during Step 4 that has nothing to do with the current source — open a new prompt, start fresh. The tool doesn't try to be clever about provenance. You decide what connects to what.

**Save & Take a Break** — one button, always visible in the navigation bar.
Commits everything to your private backup repository. Hit it when you put the book down.

---

## PDF Naming Convention

Store PDFs in a dedicated folder outside the Marginalia repo (`~/Documents/Research/PDFs/`). Use a consistent naming convention that travels across your entire workflow:

```
[AuthorLastname]_[Year]_[ShortTitle].pdf
```

Examples: `Battiste_2013_DecolonizingEducation.pdf` · `Mueller_2014_PenMightier.pdf`

The shorthand `Battiste_2013` in a margin note, an annotation, a Marginalia reference record, and an LLM prompt all refer to exactly the same thing. "Cool paper 23" means nothing six months later.

---

## What Marginalia Does Not Do

- Replace close reading
- Verify citations for you — that is your job, by design
- Send your research data to a cloud service
- Treat LLM output as authoritative

---

## Quick Start

### Requirements
- Python 3.10+
- [Ollama](https://ollama.ai) (for local models)
- [Tailscale](https://tailscale.com) (optional, for multi-device access)
- API keys for cloud models (see Configuration)

### Install

```bash
git clone https://github.com/idarknightrex/marginalia
cd marginalia
pip install -r requirements.txt
cp .env.example .env
# Add your API keys to .env
python app.py
# Open browser: http://localhost:5000
```

### Local models (optional but recommended)

```bash
ollama pull llama3.1:8b
ollama pull deepseek-r1:7b
```

---

## Configuration

Copy `.env.example` to `.env` and add your keys:

```
GOOGLE_API_KEY=your_key_here
AZURE_OPENAI_KEY=your_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
ANTHROPIC_API_KEY=your_key_here   # optional
```

Cloud models are optional. Marginalia runs on local models alone if you prefer to keep all data on your machine.

---

## Multi-Device Setup

Marginalia is designed to run on a always-on home server (Mac Mini or equivalent) and be accessed from any device via browser. See [SETUP.md](SETUP.md) for Tailscale configuration and the full infrastructure recovery sequence.

---

## Design Philosophy

Marginalia was built around seven principles:

1. **Local-first** — your data stays on your machine
2. **Portable** — the entire project is a folder
3. **Sync-safe** — GitHub-first, bootstrap on a new machine in minutes
4. **Research-grade** — timestamped logs, verification flags, Zotero export
5. **Expandable** — modular ingestion, keyboard today, OCR/audio tomorrow
6. **Free-tier friendly** — built around institutional and free API access
7. **Paper-primary** — the analogue process is primary; Marginalia is the capture layer

The verification pipeline and idea map encode a specific epistemological stance: LLM output is a starting point for inquiry, not a conclusion. The researcher's judgment is the centre. The tool is designed to make it easy to be rigorous and inconvenient to be lazy.

---

## Roadmap

- [x] Phase 1 — Multi-model prompt engine with synthesis
- [x] Phase 2 — Reference capture with verification pipeline
- [x] Phase 3 — Zotero export
- [ ] Phase 4 — OCR ingestion
- [ ] Phase 5 — Audio/video ingestion
- [ ] Phase 6 — Reference as prompt seed
- [ ] Phase 7 — Idea map
- [ ] Phase 8 — PhD dashboard integration
- [ ] Phase 9 — Writing tracker
- [ ] Phase 10 — Theme switcher

---

## Origin

Marginalia began as a question in a research conversation: *how hard would it be to write a script that sends a prompt to multiple LLMs and compares the responses?* The conversation that followed — across a transatlantic flight, on very little sleep — produced the architecture, the philosophy, and the name.

The thread opened by accident. The insight it generated is partly a function of that accident. This is not despite the lo-fi, associative, paper-primary approach the tool is built around. It is because of it.

---

## Support

Marginalia is free, open-source, and always will be.

If it earns a place in your research practice, a Ko-fi contribution keeps
independent, local-first tooling alive. No pressure, no gate — just honest
support for honest software.

[☕ Support on Ko-fi](https://ko-fi.com/llmarginalia)

*Ideas don't have a calendar. Neither does gratitude.*

---

## Contributing

Marginalia is designed for researchers, by a researcher. Contributions from the SoTL, qualitative methods, and educational developer communities are especially welcome.

If you use Marginalia in your research, please cite the accompanying paper (forthcoming, *Teaching & Learning Inquiry*, 2027).

---

## License

MIT License — use it, fork it, build on it.

---

## Citation

Boora, R. (2027). Marginalia: A paper-primary research workbench for SoTL scholars. *Teaching & Learning Inquiry*. [DOI forthcoming]

