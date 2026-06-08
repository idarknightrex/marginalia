# Marginalia — Getting Started Guide
**Version:** 0.1  
**Time required:** 45–90 minutes (most of it waiting for downloads)  
**Technical level required:** None — if you can install an app on your Mac, you can do this

---

## Before You Begin — The Pack List

Everything below is free. Gather all accounts and downloads before you start the
installation steps. Having everything ready makes the setup much smoother.

---

### Accounts to Create First

**1. Google AI Studio (Gemini API key)**
- Go to: https://aistudio.google.com
- Sign in with your existing Google account
- Click **"Get API Key"** in the left sidebar
- Click **"Create API Key"**
- Copy the key and paste it somewhere safe (Notes app, password manager)
- ✅ Free tier — no credit card required

**2. Microsoft Azure for Students (GPT-4o API key)**
- Go to: https://portal.azure.com
- Sign in with your **university email** (.macewan.ca or .usask.ca)
- Search for **"Azure OpenAI"** in the top search bar
- Follow the access request form — approval typically takes 1–3 business days
- Once approved, you will get an **endpoint URL** and an **API key**
- ✅ Free with institutional Microsoft 365 Education access

*Note: If Azure approval is taking too long, skip this for now. Gemini alone is
enough to get started. You can add Azure later.*

**3. Anthropic (Claude API key) — Optional**
- Go to: https://console.anthropic.com
- Create an account and add a credit card
- Go to **API Keys** → **Create Key**
- Copy the key
- 💳 Pay-as-you-go — $5–10 will last months at research use volumes
- ✅ Optional — Gemini covers the free tier well on its own

**4. GitHub (free account for sync and backup)**
- Go to: https://github.com
- Create a free account
- You will use this to keep your research backed up and synced between machines
- ✅ Free

**5. Tailscale (free account for multi-device access)**
- Go to: https://tailscale.com
- Sign up with your Google account or email
- ✅ Free for personal use (up to 100 devices)

---

### Software to Download

Download all of these before starting the installation steps.

| Software | What it does | Download link | Cost |
|---|---|---|---|
| **Python 3** | Runs Marginalia | https://www.python.org/downloads/ | Free |
| **Ollama** | Runs local AI models on your machine | https://ollama.ai/download | Free |
| **Tailscale** | Secure access from phone and laptop | https://tailscale.com/download | Free |
| **Git** | Version control and backup | https://git-scm.com/downloads | Free |
| **VS Code** | Text editor (optional but recommended) | https://code.visualstudio.com | Free |

*Note on Python: Download **Python 3.12** specifically — not 3.13.
Python 3.13 changes how several internal dependencies work and can cause
installation errors on some machines. On the downloads page, look for the
3.12.x release in the list below the featured download.*

*During installation on Mac, run the **"Install Certificates"** command that
appears after install — double-click it in the Python folder. This prevents
a common network error.*

---

## Part 1 — Install the Downloads

Work through these in order. Each should take 2–5 minutes.

### Step 1 — Install Python

1. Open the Python installer you downloaded
2. Follow the prompts — all defaults are fine
3. When installation finishes, open the **Python folder** in your Applications
4. Double-click **"Install Certificates.command"**
   - A terminal window will open and close automatically
   - This is normal
5. ✅ Python is installed

**Check it worked:** Open Terminal (search "Terminal" in Spotlight)
Type exactly this and press Enter:
```
python3 --version
```
You should see something like `Python 3.12.3`
If you see an error, reinstall Python from step 1.

---

### Step 2 — Install Git

1. Open the Git installer you downloaded
2. Follow all prompts — all defaults are fine
3. ✅ Git is installed

**Check it worked:** In Terminal, type:
```
git --version
```
You should see something like `git version 2.44.0`

*Mac alternative: Git may already be installed. Just run the check above first —
if it works, skip the download entirely.*

---

### Step 3 — Install Ollama

1. Open the Ollama installer you downloaded
2. Drag Ollama to your Applications folder when prompted
3. Open Ollama from Applications — a small llama icon will appear in your menu bar
4. ✅ Ollama is installed and running

**Check it worked:** In Terminal, type:
```
ollama --version
```
You should see a version number.

---

### Step 4 — Install Tailscale

1. Open the Tailscale installer
2. Follow the prompts
3. Sign in with the Tailscale account you created earlier
4. The Tailscale icon will appear in your menu bar
5. ✅ Tailscale is installed

*Repeat this on every device you want to access Marginalia from —
your laptop, Mac Mini, and phone.*

---

## Part 2 — Download Marginalia

### Step 5 — Get the Marginalia project files

Open Terminal and type these commands one at a time, pressing Enter after each:

```bash
cd Desktop
```
*This moves you to your Desktop so the project folder is easy to find.*

```bash
git clone https://github.com/idarknightrex/marginalia.git marginalia
```
*This downloads Marginalia into a folder called "marginalia" on your Desktop.*

```bash
cd marginalia
```
*This moves you into the project folder.*

✅ You should now see a folder called **marginalia** on your Desktop.

---

### Step 6 — Create your API keys file

Marginalia needs to know your API keys. They live in a file called `.env`
inside the marginalia folder. This file never leaves your machine.

In Terminal (you should still be in the marginalia folder), type:
```bash
cp .env.example .env
```
*This creates your personal keys file from the template.*

Now open the file to edit it. Type:
```bash
open -e .env
```
*This opens the file in TextEdit.*

You will see something like this:
```
GOOGLE_API_KEY=your_key_here
AZURE_OPENAI_KEY=your_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_DEPLOYMENT_NAME=your_deployment_name_here
ANTHROPIC_API_KEY=your_key_here
```
*The `AZURE_DEPLOYMENT_NAME` is the name you give your GPT-4o model when you
deploy it in Azure OpenAI Studio — not the model name itself. It defaults to
"gpt-4o" if you didn't change it during setup.*

Replace each `your_key_here` with the actual key you copied earlier.
- If you don't have an Azure key yet, leave those two lines as-is
- If you're skipping Anthropic, leave that line as-is
- Save and close TextEdit

> **Note — the .env file is hidden by design:**
> Because `.env` starts with a dot, macOS treats it as a hidden system file.
> If you open your marginalia folder in Finder, you won't see it — this is normal
> and intentional. Your API keys should not be casually visible.
>
> If you ever need to edit your keys again, open Terminal and type:
> ```bash
> cd Desktop/marginalia
> open -e .env
> ```
> This will open it in TextEdit exactly as before.

> **Security note — your keys never leave Flask:**
> Marginalia's Python backend loads your API keys once at startup and holds them
> in memory. Your browser interface only ever talks to `localhost` — it never
> sees or handles your raw API keys. This means your keys won't appear in browser
> network logs or developer tools, even if you inspect the page.

✅ Your API keys are configured.

---

## Part 3 — Download Local AI Models

These models run entirely on your machine — no internet needed once downloaded.
Download takes 5–15 minutes depending on your connection.

### Step 7 — Pull local models via Ollama

In Terminal, type each of these and press Enter. Wait for each to finish
before starting the next.

**What to expect during download:**
Each `ollama pull` command prints a continuous stream of progress text as it
downloads data in chunks. This is normal — it has not frozen. Wait until the
terminal shows a clean new prompt line (ending in `$`) before running the next
command. This is your signal that the download finished successfully.

```bash
ollama pull llama3.1:8b
```
*General reasoning model — about 4.7GB download. Wait for the `$` prompt.*

```bash
ollama pull deepseek-r1:8b
```
*Analytical reasoning model — about 4.9GB download. Wait for the `$` prompt.*

```bash
ollama pull gemma2:9b
```
*Structural language model — about 5.4GB download.
This one takes the longest. Wait for the `$` prompt before closing Terminal.*

✅ Local models are ready.

*Tip: You can do something else while these download — just don't close
the Terminal window until you see the `$` prompt for each one.*

> **Note on model versions:** The Marginalia scope document references Gemma 4 12B
> as a future multimodal ingestion model (announced June 2026). As of this guide,
> that model is not yet packaged in Ollama's library. `gemma2:9b` is the current
> best available Gemma model via Ollama. When Gemma 4 becomes available, the
> CHANGELOG.md in your repo will note the upgrade path.

---

## Part 4 — Launch Marginalia

### ⚠️ Important Mac Security Step — Do This Before Step 8

Because `bootstrap.command` is an automation script downloaded from the internet,
macOS will block it the first time you try to open it. You will see a message
saying *"bootstrap.command cannot be opened because it is from an unidentified developer."*

This is normal. Here is how to unblock it — you only need to do this once:

1. Find **bootstrap.command** in your marginalia folder on the Desktop
2. **Right-click** it (or hold Control and click)
3. Select **Open** from the menu that appears
4. Click **Open** in the security prompt that appears

After this, you can double-click it normally every time.

---

### Step 8 — First launch

On Mac, find the file **bootstrap.command** in your marginalia folder on the Desktop.

**Double-click it.**

The first time you run it:
- A terminal window will open
- You will see it installing dependencies (takes 1–2 minutes)
- When it's ready, Marginalia will open automatically in your browser

✅ Marginalia is running.

*If your browser doesn't open automatically, go to:*
`http://localhost:5000`

---

### Step 9 — Every launch after the first

Just double-click **bootstrap.command** again.
It will be much faster — dependencies are already installed.

Or, if you want Marginalia to start automatically when your Mac Mini boots:
- See **SETUP.md** in the marginalia folder for launchd configuration instructions

---

## Part 5 — Connect Your Other Devices

### Step 10 — Access from your laptop or phone

1. Make sure Tailscale is running on both devices and signed into the same account
2. On the machine running Marginalia, find your Tailscale IP one of two ways:

   **Easier:** Click the **Tailscale icon** in your Mac menu bar → your device's
   IP address is shown at the top of the dropdown. Click it to copy.

   **Or in Terminal:**
   ```bash
   tailscale ip -4
   ```
   Either way you get something like `100.x.x.x`

3. On your phone or laptop, open a browser and go to:
```
http://100.x.x.x:5000
```
(replace with your actual Tailscale IP)

4. Bookmark this URL on your phone — use this address always, even at home

✅ Marginalia is accessible from any device, anywhere.

---

## Part 6 — Set Up Backup and Sync

### Step 11 — Create your private GitHub repository

1. Go to https://github.com and sign in
2. Click the **+** in the top right → **New repository**
3. Name it `marginalia-research` (or whatever you prefer)
4. Set it to **Private** — important, this holds your research data
5. ⚠️ Do **NOT** check "Add a README", "Add .gitignore", or "Choose a license"
   — leave all three boxes unchecked, repository completely empty
   *(If you add any files here, the push in Step 12 will be rejected)*
6. Click **Create repository**
7. Copy the repository URL shown on the next page

### Step 12 — Connect your local folder to GitHub

Your marginalia folder already knows about the main Marginalia codebase
(so you can receive updates and bug fixes later). You need to add your
**private backup** as a separate destination — without replacing the original.

In Terminal (in your marginalia folder), type these one at a time:

```bash
git remote add backup [paste your private repository URL here]
```
*This adds your private repo as a backup destination called "backup"
without touching the connection to the main Marginalia codebase.*

```bash
git add .
git commit -m "Initial setup"
git push -u backup main
```

✅ Your research is backed up to your private GitHub repository.

**After every research session**, run these three commands to save your work:
```bash
git add .
git commit -m "Research session [date]"
git push backup
```

**To get Marginalia updates** when new versions are released:
```bash
git pull origin main
```
*This pulls updates from the main Marginalia codebase without touching your research data.*

Or use the **Commit** and **Check for Updates** buttons in Marginalia's interface
(coming in Phase 1 UI).

---

## You're Ready

Marginalia is running, your models are loaded, your keys are configured,
and your research is backed up. Here's what to do next:

1. **Start a synthesis session** — type a research question in the prompt box
2. **Flag a reference** — click "Flag as reference" on anything worth keeping
3. **Add your existing books and papers** — use "Manual entry" in the reference library
4. **Take a photo of handwritten notes** — use the "Ingest" button (Phase 4)

---

## Troubleshooting

**"Command not found" when typing python3**
→ Python didn't install correctly. Re-download from python.org and reinstall.
Make sure to run "Install Certificates" after installing.

**Marginalia opens but models show "unavailable"**
→ Ollama may not be running. Open Ollama from your Applications folder.
The llama icon should appear in your menu bar.

**Can't connect from phone**
→ Make sure you're using the Tailscale IP (100.x.x.x), not the local IP (192.168.x.x).
Both devices must be signed into the same Tailscale account.

**Port already in use error**
→ Marginalia will automatically find the next available port. Check the terminal
window to see which port it chose, then use that in your browser.

**Azure key not working**
→ Azure OpenAI requires a model deployment step after account approval.
Log into portal.azure.com, find your Azure OpenAI resource, and deploy a GPT-4o model.
The deployment name goes into your .env file as AZURE_DEPLOYMENT_NAME.

**Something else went wrong**
→ Check the terminal window that opened when you launched Marginalia.
The error message there will tell you what happened.
Copy it and bring it to the Marginalia GitHub issues page.

---

## Quick Reference — Your Key Files

| File | What it is | Where it lives |
|---|---|---|
| `bootstrap.command` | Launch Marginalia | marginalia folder on Desktop |
| `.env` | Your API keys | marginalia folder (hidden file) |
| `db/research.sql` | Your research database backup | marginalia/db/ |
| `SETUP.md` | Technical infrastructure notes | marginalia folder |
| `CHANGELOG.md` | Model version history | marginalia folder |

---

## Quick Reference — Your API Key Sources

| Key | Where to get it | Cost |
|---|---|---|
| `GOOGLE_API_KEY` | aistudio.google.com → Get API Key | Free |
| `AZURE_OPENAI_KEY` | portal.azure.com → Azure OpenAI resource | Free (institutional) |
| `AZURE_OPENAI_ENDPOINT` | portal.azure.com → Azure OpenAI resource → Keys and Endpoint | Free (institutional) |
| `AZURE_DEPLOYMENT_NAME` | portal.azure.com → Azure OpenAI → Model deployments → your deployment name | Free (institutional) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | Pay-as-you-go |

---

*If you get stuck anywhere in this guide, the terminal window that opens when
you launch Marginalia is your first source of diagnostic information.
Error messages there are specific and searchable.*


---

## Appendix — For Contributors and Windows Users

### Line endings (.gitattributes)

If you are contributing to Marginalia or editing project files on Windows,
line ending differences between operating systems can silently break shell scripts.

The Marginalia repo includes a `.gitattributes` file that handles this automatically —
Mac and Linux scripts stay in LF format, Windows scripts in CRLF. You do not need
to configure anything. Just be aware that if you open `.sh` or `.command` files in
a Windows text editor and save them, Git will normalise the line endings correctly
on your next commit.

If you ever see a script error like `^M: command not found` on Mac or Linux after
editing on Windows, run:
```bash
sed -i 's/\r//' bootstrap.command
```
This strips any accidentally introduced Windows line endings.


---

## PDF Organisation — Do This Before You Start

Setting up your PDF folder before your first research session saves significant
reorganisation later.

### Recommended folder structure

Create this folder on your Mac:
```
Documents/
└── Research/
    └── PDFs/
```

In Terminal:
```bash
mkdir -p ~/Documents/Research/PDFs
```

### Naming convention

Name every research PDF using this pattern:
```
AuthorLastname_Year_ShortTitle.pdf
```

**Examples:**
```
Battiste_2013_DecolonizingEducation.pdf
Couldry_2019_CostsOfConnection.pdf
Mueller_2014_PenMightier.pdf
Barrett_1996_EducationalLuddism.pdf
```

**Why this matters:**
This shorthand travels consistently across your entire workflow. In a margin note,
in a Marginalia annotation, in a prompt to an LLM — `Battiste_2013` means exactly
one thing, always. "Cool paper 23" means nothing six months later.

When you enter a reference in Marginalia, paste the filename into the
**Holding location** field. That connects the physical or digital copy to
the reference record permanently.

### Keep PDFs out of the Marginalia project folder

**Important:** Do not save PDFs inside the `marginalia` folder on your Desktop.

Marginalia's Save & Break button commits your research to GitHub. If a PDF
ends up inside the project folder, GitHub will reject the push (100MB file
limit) and your sync pipeline will break.

Marginalia automatically detects and excludes large files before committing —
but the safest habit is keeping PDFs in their dedicated folder from the start.

If you accidentally save a PDF inside the project folder, Marginalia will
warn you and add it to `.gitignore` automatically. It will not be committed.

### Backup your PDFs separately

Your PDF folder (`~/Documents/Research/PDFs`) should be backed up outside
the Marginalia project — iCloud is fine for this. PDFs are large binary
files that do not belong in the Marginalia GitHub repository.

---

## The Save & Take a Break Button

Visible in the Marginalia navigation bar at all times.

**What it does:** saves everything you have done in the current session
to your private GitHub backup. One click. Done.

**When to use it:**
- When you finish a deep read and put the book down
- Before switching from the Mac Mini to your laptop
- Any time you want to checkpoint your work

You do not need to understand Git to use it. Just hit the button when you
are done for the session.

