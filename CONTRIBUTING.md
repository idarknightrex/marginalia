# Contributing to Marginalia

*Largely local. Slow down.*

Marginalia is a local-first PhD research workbench built against extractive AI and software brain. It is open source because the ideas behind it belong to the research community, not to any platform. Contributions of any size — code, bug reports, documentation, testing, ideas overheard in a hallway — are welcome.

---

## What this project is

Marginalia is built on a specific set of commitments:

- **Extrusive, not extractive** — the instrument pushes knowledge outward from the researcher, it does not pull documents in and process them
- **Intentional friction** — slugs typed by hand, status cycled manually, Save & Break as a deliberate gesture. These are epistemological commitments, not UX oversights
- **Largely local** — the researcher's canonical record lives on their hardware, answerable to no platform, no export order, no change in terms of service
- **60/40** — if the instrument produces more AI text than researcher text, the balance is wrong
- **The boulder never crests** — the work is always incomplete in some meaningful sense. The instrument does not pretend otherwise

A contribution that understands these commitments is more useful than a technically perfect one that doesn't. Please read the [Seeds document](marginalia-seeds.md) before proposing large changes — it holds the design reasoning behind decisions that might otherwise look arbitrary.

---

## What kinds of contributions land

**Very likely:**
- Bug fixes with a clear reproduction case
- Documentation improvements
- Accessibility improvements that don't remove intentional friction
- Support for additional OpenAI-compatible model endpoints (see seeds — note the difficult-to-test flag)
- Improvements to the setup experience for non-Mac platforms
- Translations of the UI

**Needs discussion first:**
- New tabs or major UI features — open an issue before building
- Changes to the canonical file schema — these affect every existing researcher's data
- New synthesis modes — need to fit the epistemological frame, not just add options
- Any feature that touches the 60/40 balance

**Will not land:**
- Telemetry, analytics, or any form of silent data collection
- Features that remove intentional friction (auto-slug, auto-status, one-click everything)
- Changes that move canonical data off the researcher's machine by default
- Extractive patterns — if it makes Marginalia more like Pinpoint, it's the wrong direction

If you're unsure, open an issue and ask. A conversation before a PR saves everyone time.

---

## How to report a bug

**Via GitHub Issues (preferred):**
Open an issue using the Bug Report template. The app's error reporting button (where available) will pre-fill the template for you. Include:
- What you were doing when it happened
- What you expected vs what occurred
- Marginalia version (shown in the bottom-right corner)
- Your OS and Ollama version if relevant
- Any error text from `/tmp/marginalia.log`

No canonical data, no prompts, no references — just the error context.

**Via email:**
If you don't have a GitHub account or prefer not to use it, email bug reports to the maintainer. Reports received by email are triaged and entered as GitHub issues (with your permission). You will be credited as the reporter, or listed as Anonymous if you prefer — see the contribution credit section below.

---

## How to propose a feature

Open a GitHub Issue using the Feature Request template. Describe what you're trying to do, not just what you want built. The why matters more than the what here — Marginalia's design decisions are driven by research epistemology, not feature count.

Ideas that arrive by email are welcome too and get the same treatment as bug reports — triaged, entered as issues, credited to you or to Anonymous.

---

## Contribution credit

Everyone who contributes — code, bug reports, testing, ideas, documentation, a well-timed question — is listed in [CONTRIBUTORS.md](CONTRIBUTORS.md).

**Named or anonymous: your choice, not ours.**

Anonymous contribution is in the tradition of the original author of this software, inspired by MASH. In a Christmas episode (S9E10) Charles provided a great gift to the local orphans, but is then frustrated when his generous, but inappropriate gift is used to support the children with basic needs. He feels that his tradition was violated, but when Klinger, the company clerk, finds out that Charles is not feeling that his gift was appreciated, he pays back the anonymous gesture with a meal and a simple gift — on the promise that the source remains anonymous.

It is not the size of the gift that matters, but the spirit with which it is given. People great and small, known and unknown, working to help their community is what is celebrated.

If you want to be listed by name, you will be. If you want to be listed as Anonymous, you will be. If you want only the nature of your contribution noted and nothing else, that is honored. The work is in the record regardless. The name is yours to give or withhold.

To set your preference: note it in your issue, your PR, or your email. If you say nothing, we will ask before listing you.

---

## Pull requests

1. Fork the repo and create a branch from `main`
2. Make your changes — full builds only, no partial deploys
3. Test against a real Marginalia instance if at all possible
4. Open a PR with a clear description of what changed and why
5. Reference any related issues (`fixes #42`)

PRs are reviewed by the maintainer. Response time may vary — this project is maintained alongside a PhD program, a teaching load, and a hockey bench. Patience is appreciated and reciprocated.

---

## A note on the canonical files

The `canonical/` folder is gitignored from the public repo. It contains the researcher's actual data — references, sessions, notes, writing. **Never commit canonical data.** If you are testing against real canonical files, make sure your `.gitignore` is intact before pushing.

---

## Contact

GitHub Issues: [github.com/idarknightrex/marginalia/issues](https://github.com/idarknightrex/marginalia/issues)
Email: available on request — open an issue and ask, or find it in the repo's GitHub profile

---

*The boulder never crests.*
