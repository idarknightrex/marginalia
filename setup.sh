#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Marginalia — setup.sh
# Safe first-run and re-install script.
#
# What this script does:
#   1. Checks for Homebrew — offers to install if missing
#   2. Checks for Python 3.12+ — offers to install via Homebrew if missing
#   3. Checks for Ollama — offers to install if missing
#   4. Lists running Ollama models and explains how to add more
#   5. Creates or validates setup.env — offers to open editor with instructions
#   6. Creates Python virtual environment with correct Python version
#   7. Installs Python dependencies from requirements.txt
#   8. Confirms everything is ready and explains how to start Marginalia
#
# What this script NEVER does:
#   - Overwrites setup.env if it already exists (asks first)
#   - Deletes or modifies existing files without asking
#   - Run anything with sudo unless Homebrew itself requires it
#   - Install Homebrew packages you haven't confirmed
#   - Continue past a failure — stops clearly and tells you what went wrong
#
# Usage:
#   ./setup.sh
#
# To read this script before running:
#   cat setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e  # Stop on any error

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────
ok()   { echo -e "${GREEN}  ✓${RESET}  $1"; }
warn() { echo -e "${YELLOW}  ⚠${RESET}  $1"; }
info() { echo -e "${BLUE}  →${RESET}  $1"; }
fail() { echo -e "${RED}  ✗${RESET}  $1"; }
step() { echo -e "\n${BOLD}$1${RESET}"; }
dim()  { echo -e "${DIM}     $1${RESET}"; }

ask() {
  # ask "Question" → returns 0 (yes) or 1 (no)
  echo -e "${YELLOW}  ?${RESET}  $1 [y/n] "
  read -r answer
  [[ "$answer" =~ ^[Yy]$ ]]
}

stop() {
  echo ""
  fail "$1"
  echo ""
  echo -e "  ${DIM}Setup stopped. Nothing was broken. Fix the issue above and run ./setup.sh again.${RESET}"
  echo ""
  exit 1
}

# ── Header ────────────────────────────────────────────────────────────────────
clear
echo ""
echo -e "${BOLD}  Marginalia — Setup${RESET}"
echo -e "${DIM}  A research instrument. Slow down.${RESET}"
echo ""
echo -e "  This script will check your system and set up Marginalia."
echo -e "  It will ${BOLD}ask before installing anything${RESET} and stop clearly if something goes wrong."
echo -e "  You can read every step in this file before running it: ${DIM}cat setup.sh${RESET}"
echo ""
echo -e "  ${DIM}Press Ctrl+C at any time to stop without making changes.${RESET}"
echo ""
read -rp "  Ready to begin? [press Enter to continue, Ctrl+C to stop] "

# ── Step 1: Homebrew ──────────────────────────────────────────────────────────
step "1 of 7 — Homebrew"

if command -v brew &>/dev/null; then
  BREW_VERSION=$(brew --version | head -1)
  ok "Homebrew found: $BREW_VERSION"
else
  warn "Homebrew not found."
  dim "Homebrew is a package manager for Mac that installs developer tools."
  dim "It installs to /opt/homebrew on Apple Silicon — it does not touch system files."
  dim "Installation page: https://brew.sh"
  echo ""
  if ask "Install Homebrew now?"; then
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Add to PATH for this session (Apple Silicon path)
    if [[ -f /opt/homebrew/bin/brew ]]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
      # Add to shell profile permanently
      if ! grep -q "homebrew" ~/.zprofile 2>/dev/null; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        ok "Added Homebrew to ~/.zprofile (will be active in new terminals)"
      fi
    fi
    ok "Homebrew installed."
  else
    stop "Homebrew is required. Install it from https://brew.sh and run ./setup.sh again."
  fi
fi

# ── Step 2: Python 3.12+ ─────────────────────────────────────────────────────
step "2 of 7 — Python 3.12+"
dim "Marginalia requires Python 3.12 or newer."
dim "The system Python on Mac is 3.9 and is past end-of-life — we need a newer version."

PYTHON_CMD=""
# Check for 3.12 or 3.13 explicitly
for cmd in python3.13 python3.12 python3; do
  if command -v "$cmd" &>/dev/null; then
    VERSION=$("$cmd" --version 2>&1 | awk '{print $2}')
    MAJOR=$(echo "$VERSION" | cut -d. -f1)
    MINOR=$(echo "$VERSION" | cut -d. -f2)
    if [[ "$MAJOR" -ge 3 && "$MINOR" -ge 12 ]]; then
      PYTHON_CMD="$cmd"
      ok "Found Python $VERSION at $(command -v $cmd)"
      break
    fi
  fi
done

if [[ -z "$PYTHON_CMD" ]]; then
  warn "Python 3.12+ not found."
  dim "This will install Python 3.12 via Homebrew. It will not touch your system Python."
  echo ""
  if ask "Install Python 3.12 via Homebrew?"; then
    info "Installing Python 3.12 (this may take a few minutes)..."
    brew install python@3.12
    PYTHON_CMD="python3.12"
    ok "Python 3.12 installed."
  else
    stop "Python 3.12+ is required. Install it with: brew install python@3.12"
  fi
fi

# ── Step 3: Ollama ────────────────────────────────────────────────────────────
step "3 of 7 — Ollama"
dim "Ollama runs AI models locally on your machine."

OLLAMA_INSTALLED=false
OLLAMA_RUNNING=false

if command -v ollama &>/dev/null; then
  OLLAMA_INSTALLED=true
  ok "Ollama found: $(ollama --version 2>/dev/null || echo 'version unknown')"
else
  warn "Ollama not found."
  dim "Ollama is required to run local models (DeepSeek, Gemma, Qwen, Mistral, Llama, Command R7B)."
  dim "Without it, only cloud models (Gemini, Claude, GPT-4o) will work."
  dim "Download from: https://ollama.com/download"
  echo ""
  if ask "Open the Ollama download page in your browser?"; then
    open "https://ollama.com/download"
    echo ""
    warn "Please install Ollama, then run ./setup.sh again."
    echo ""
    echo -e "  ${DIM}Continuing setup without Ollama — local models will not be available.${RESET}"
  fi
fi

# ── Step 4: Ollama models ─────────────────────────────────────────────────────
step "4 of 7 — Ollama models"

if $OLLAMA_INSTALLED; then
  # Check if Ollama is responding
  if ollama list &>/dev/null 2>&1; then
    OLLAMA_RUNNING=true
    MODELS=$(ollama list 2>/dev/null)
    MODEL_COUNT=$(echo "$MODELS" | tail -n +2 | grep -c "." || true)

    if [[ "$MODEL_COUNT" -eq 0 ]]; then
      warn "Ollama is running but no models are installed."
    else
      ok "$MODEL_COUNT model(s) available:"
      echo ""
      echo "$MODELS" | tail -n +2 | while IFS= read -r line; do
        NAME=$(echo "$line" | awk '{print $1}')
        SIZE=$(echo "$line" | awk '{print $3, $4}')
        echo -e "     ${GREEN}◆${RESET} $NAME  ${DIM}$SIZE${RESET}"
      done
    fi

    echo ""
    info "Marginalia uses these models (pull any you want to add):"
    echo ""
    echo -e "     ${DIM}ollama pull deepseek-r1:8b${RESET}    ${DIM}# Reasoning · China · 5.2GB${RESET}"
    echo -e "     ${DIM}ollama pull gemma4:latest${RESET}     ${DIM}# Multimodal + OCR · Google · 9.6GB${RESET}"
    echo -e "     ${DIM}ollama pull qwen2.5:14b${RESET}       ${DIM}# Asia/Global South · Alibaba · 9.0GB${RESET}"
    echo -e "     ${DIM}ollama pull mistral:7b${RESET}        ${DIM}# Europe · Mistral AI · 4.4GB${RESET}"
    echo -e "     ${DIM}ollama pull llama3.1:8b${RESET}       ${DIM}# General · Meta · 4.9GB${RESET}"
    echo -e "     ${DIM}ollama pull command-r7b${RESET}       ${DIM}# Canada · Cohere · 5.1GB · RAG-optimised${RESET}"
    echo ""
    dim "Models on an external drive? Add this to setup.env:"
    dim "  OLLAMA_MODELS_PATH=/Volumes/YourDrive/path/to/models"
    echo ""
    dim "You don't need all models — DeepSeek R1 alone is enough to start."

  else
    warn "Ollama is installed but not running."
    dim "Start Ollama from Applications, or run: open -a Ollama"
    dim "Local models will show as unavailable until Ollama is running."
    echo ""
    if ask "Try to start Ollama now?"; then
      open -a Ollama 2>/dev/null || warn "Could not start Ollama automatically — please start it from Applications."
      sleep 3
      if ollama list &>/dev/null 2>&1; then
        ok "Ollama is now running."
        OLLAMA_RUNNING=true
      else
        warn "Ollama may still be starting. You can start it manually before launching Marginalia."
      fi
    fi
  fi
else
  warn "Skipping model check — Ollama not installed."
fi

# ── Step 5: setup.env ─────────────────────────────────────────────────────────
step "5 of 7 — API keys (setup.env)"

SETUP_ENV="$(pwd)/setup.env"
SETUP_ENV_TEMPLATE="$(pwd)/setup.env.template"

if [[ -f "$SETUP_ENV" ]]; then
  ok "setup.env found."
  dim "Checking which keys are configured..."
  echo ""

  check_key() {
    local KEY_NAME=$1
    local KEY_LABEL=$2
    local KEY_URL=$3
    local KEY_COST=$4
    local VALUE
    VALUE=$(grep "^${KEY_NAME}=" "$SETUP_ENV" 2>/dev/null | cut -d'=' -f2- | tr -d '[:space:]"' || true)
    if [[ -n "$VALUE" && "$VALUE" != "your_key_here" && "$VALUE" != "" ]]; then
      ok "$KEY_LABEL — configured"
    else
      warn "$KEY_LABEL — not set"
      dim "Get your key at: $KEY_URL"
      dim "Cost: $KEY_COST"
    fi
  }

  check_key "GOOGLE_API_KEY"    "Gemini (Google)"   "aistudio.google.com → Get API Key"         "Free tier available — no credit card needed"
  check_key "ANTHROPIC_API_KEY" "Claude (Anthropic)" "console.anthropic.com → API Keys"          "Pay-as-you-go · ~\$0.0008 per query at Haiku rates"
  check_key "OPENAI_API_KEY"    "GPT-4o (OpenAI)"   "platform.openai.com/api-keys"              "Pay-as-you-go · ~\$0.005 per query"
  echo ""
  dim "Local models (DeepSeek, Gemma, etc.) do not require API keys."
  echo ""
  if ask "Open setup.env in a text editor to review or update keys?"; then
    # Try common editors in order of preference
    if command -v nano &>/dev/null; then
      nano "$SETUP_ENV"
    elif command -v vim &>/dev/null; then
      vim "$SETUP_ENV"
    else
      open -e "$SETUP_ENV"  # TextEdit fallback on Mac
    fi
  fi

else
  warn "setup.env not found — this is normal on a fresh install."
  dim "Marginalia needs this file for API keys and configuration."
  dim "It is never committed to Git — your keys stay on your machine only."
  echo ""
  info "Creating setup.env from template..."

  cat > "$SETUP_ENV" << 'ENVEOF'
# ─────────────────────────────────────────────────────────────────────────────
# Marginalia — setup.env
# Your API keys and configuration. This file is NEVER committed to Git.
# Edit this file, never touch app.py.
# ─────────────────────────────────────────────────────────────────────────────

# ── Cloud model API keys ──────────────────────────────────────────────────────
# Leave blank to disable a cloud model. Local models work without any keys.

# Google Gemini — free tier available, no credit card needed
# Get your key: https://aistudio.google.com → Get API Key
GOOGLE_API_KEY=

# Anthropic Claude — pay-as-you-go, ~$0.0008 per query at Haiku rates
# Get your key: https://console.anthropic.com → API Keys
ANTHROPIC_API_KEY=

# OpenAI GPT-4o — pay-as-you-go, ~$0.005 per query
# Get your key: https://platform.openai.com/api-keys
OPENAI_API_KEY=

# ── Local model configuration ─────────────────────────────────────────────────
# If your Ollama models are on an external drive, set the path here.
# Leave blank if models are in the default Ollama location (~/.ollama/models).
# Example: OLLAMA_MODELS_PATH=/Volumes/Vault/Marginalia/ollama/models
OLLAMA_MODELS_PATH=

# Ollama host — leave as default unless you're running Ollama on another machine
OLLAMA_HOST=http://127.0.0.1:11434

# ── Research folders ──────────────────────────────────────────────────────────
# Where your PDFs live. Leave blank for default (~/Documents/Research/PDFs/)
# Example: RESEARCH_PDF_PATH=/Volumes/Vault/Research/PDFs
RESEARCH_PDF_PATH=

# ── Server configuration ──────────────────────────────────────────────────────
# Port Marginalia runs on. Change if 5001 is taken by another app.
MARGINALIA_PORT=5001
ENVEOF

  ok "setup.env created."
  echo ""
  if ask "Open setup.env now to add your API keys?"; then
    echo ""
    info "Opening setup.env. Add your keys, save the file, then come back here."
    dim "You only need one key to start — Gemini is free and a good first choice."
    dim "Local models (DeepSeek etc.) work without any keys if Ollama is running."
    echo ""
    read -rp "  Press Enter when ready to open the file... "
    if command -v nano &>/dev/null; then
      nano "$SETUP_ENV"
    elif command -v vim &>/dev/null; then
      vim "$SETUP_ENV"
    else
      open -e "$SETUP_ENV"
      read -rp "  Press Enter when you've saved the file and closed the editor... "
    fi
  fi
fi

# ── Step 6: Python virtual environment ───────────────────────────────────────
step "6 of 7 — Python environment"
dim "Creating an isolated Python environment so Marginalia's packages"
dim "don't interfere with anything else on your machine."

VENV_DIR="$(pwd)/.venv"
VENV_PYTHON="$VENV_DIR/bin/python"

if [[ -d "$VENV_DIR" ]]; then
  # Check if the venv uses the right Python version
  if [[ -f "$VENV_PYTHON" ]]; then
    VENV_VERSION=$("$VENV_PYTHON" --version 2>&1 | awk '{print $2}')
    VENV_MINOR=$(echo "$VENV_VERSION" | cut -d. -f2)
    if [[ "$VENV_MINOR" -ge 12 ]]; then
      ok "Virtual environment found with Python $VENV_VERSION"
    else
      warn "Virtual environment uses Python $VENV_VERSION (need 3.12+)."
      if ask "Rebuild the virtual environment with Python 3.12?"; then
        info "Removing old venv..."
        rm -rf "$VENV_DIR"
        info "Creating new venv with $PYTHON_CMD..."
        "$PYTHON_CMD" -m venv "$VENV_DIR"
        ok "Virtual environment rebuilt."
      else
        warn "Keeping existing venv — some features may not work correctly."
      fi
    fi
  fi
else
  info "Creating virtual environment with $PYTHON_CMD..."
  "$PYTHON_CMD" -m venv "$VENV_DIR"
  ok "Virtual environment created."
fi

# Install/update dependencies
info "Installing dependencies from requirements.txt..."
"$VENV_DIR/bin/pip" install --upgrade pip --quiet
"$VENV_DIR/bin/pip" install -r requirements.txt --quiet

# Check pdfplumber separately — may not be in requirements.txt yet
if ! "$VENV_DIR/bin/python" -c "import pdfplumber" &>/dev/null 2>&1; then
  info "Installing pdfplumber (PDF text extraction)..."
  "$VENV_DIR/bin/pip" install pdfplumber --quiet
fi

ok "All dependencies installed."

# ── Step 7: Final check ───────────────────────────────────────────────────────
step "7 of 7 — Final check"

READY=true

# Check Flask can be imported
if "$VENV_PYTHON" -c "import flask" &>/dev/null 2>&1; then
  ok "Flask — ready"
else
  fail "Flask not installed correctly"
  READY=false
fi

# Check app.py exists
if [[ -f "$(pwd)/app.py" ]]; then
  ok "app.py — found"
else
  fail "app.py not found — are you running this from the marginalia directory?"
  READY=false
fi

# Check setup.env exists
if [[ -f "$SETUP_ENV" ]]; then
  ok "setup.env — found"
else
  fail "setup.env missing"
  READY=false
fi

# Check canonical directories exist
for dir in canonical canonical/references canonical/sessions; do
  if [[ ! -d "$(pwd)/$dir" ]]; then
    mkdir -p "$(pwd)/$dir"
    ok "Created $dir/"
  else
    ok "$dir/ — found"
  fi
done

# ── Step 8: Canonical repo ───────────────────────────────────────────────────
step "8 of 9 — Research data backup (canonical)"
dim "Your references, sessions, notes, and writing live in canonical/"
dim "This sets up a private GitHub repo so Save & Break backs them up automatically."

CANONICAL_DIR="$(pwd)/canonical"
CANONICAL_GIT="$CANONICAL_DIR/.git"

# Read GitHub config from setup.env
GITHUB_USER_VAL=$(grep "^GITHUB_USER=" "$SETUP_ENV" 2>/dev/null | cut -d'=' -f2- | tr -d '[:space:]"' || true)
GITHUB_CANONICAL_VAL=$(grep "^GITHUB_CANONICAL_REPO=" "$SETUP_ENV" 2>/dev/null | cut -d'=' -f2- | tr -d '[:space:]"' || true)

if [[ -d "$CANONICAL_GIT" ]]; then
  ok "Canonical repo already initialised."
  REMOTE_URL=$(git -C "$CANONICAL_DIR" remote get-url origin 2>/dev/null || true)
  if [[ -n "$REMOTE_URL" ]]; then
    ok "Remote: $REMOTE_URL"
  else
    warn "No remote set — canonical won't push on Save & Break."
  fi
elif [[ -n "$GITHUB_USER_VAL" && -n "$GITHUB_CANONICAL_VAL" ]]; then
  info "Initialising canonical repo..."
  cd "$CANONICAL_DIR"
  git init -q
  git add -A
  git commit -q -m "canonical init — $(date +%Y-%m-%d)"
  echo ""
  info "To push to GitHub you need a Personal Access Token."
  dim "Go to: github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)"
  dim "Generate new token → check 'repo' scope → copy it"
  dim "Then create a private repo at: github.com/new named '$GITHUB_CANONICAL_VAL'"
  echo ""
  if ask "Set up the GitHub remote now?"; then
    echo -e "${YELLOW}  ?${RESET}  Paste your Personal Access Token (input hidden): "
    read -rs GITHUB_TOKEN
    echo ""
    REMOTE="https://${GITHUB_USER_VAL}:${GITHUB_TOKEN}@github.com/${GITHUB_USER_VAL}/${GITHUB_CANONICAL_VAL}.git"
    git remote add origin "$REMOTE" 2>/dev/null || git remote set-url origin "$REMOTE"
    info "Pushing to GitHub..."
    if git push -u origin main 2>/dev/null; then
      ok "Canonical repo pushed to github.com/${GITHUB_USER_VAL}/${GITHUB_CANONICAL_VAL}"
      # Store clean URL (without token) for display
      git remote set-url origin "https://github.com/${GITHUB_USER_VAL}/${GITHUB_CANONICAL_VAL}.git"
    else
      warn "Push failed — check the repo exists on GitHub and the token has repo scope."
      dim "You can set this up manually later: cd canonical && git remote add origin [url] && git push -u origin main"
    fi
  else
    warn "Skipping canonical remote — set it up manually before your first Save & Break."
  fi
  cd "$(dirname "$CANONICAL_DIR")"
else
  warn "GITHUB_USER not set in setup.env — skipping canonical remote setup."
  dim "Add GITHUB_USER and GITHUB_CANONICAL_REPO to setup.env and run ./setup.sh again."
fi


# ── Step 9: launchd auto-start (optional) ────────────────────────────────────
step "9 of 9 — Auto-start on boot (optional)"
dim "Installs a launchd service so Marginalia starts automatically when the Mac boots."
dim "Useful for headless operation — no need to SSH in and run bootstrap manually."
dim "You can skip this and start Marginalia manually with ./bootstrap.command"
echo ""

PLIST_SRC="$(pwd)/com.marginalia.server.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.marginalia.server.plist"

if [[ -f "$PLIST_DST" ]]; then
  ok "launchd service already installed."
  if ask "Reinstall / update it?"; then
    launchctl unload "$PLIST_DST" 2>/dev/null || true
    cp "$PLIST_SRC" "$PLIST_DST"
    launchctl load "$PLIST_DST"
    ok "launchd service updated and loaded."
  fi
elif [[ -f "$PLIST_SRC" ]]; then
  if ask "Install auto-start service?"; then
    mkdir -p "$HOME/Library/LaunchAgents"
    cp "$PLIST_SRC" "$PLIST_DST"
    launchctl load "$PLIST_DST"
    ok "Marginalia will now start automatically on boot."
    dim "To remove:  launchctl unload $PLIST_DST && rm $PLIST_DST"
    dim "Logs:       tail -f /tmp/marginalia.log"
  else
    info "Skipped — start manually with ./bootstrap.command"
  fi
else
  warn "com.marginalia.server.plist not found — skipping auto-start setup."
fi


# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
if $READY; then
  echo -e "  ${GREEN}${BOLD}Marginalia is ready.${RESET}"
  echo ""
  echo -e "  To start:"
  echo -e "  ${BOLD}  ./bootstrap.command${RESET}          double-click in Finder, or run in terminal"
  echo ""
  echo -e "  Then open: ${BOLD}http://localhost:5001${RESET}"
  echo ""
  if ! $OLLAMA_RUNNING; then
    warn "Ollama is not running — local models will be unavailable until you start it."
    dim "Start Ollama from Applications before launching Marginalia."
    echo ""
  fi
  dim "To add models later:  ollama pull [model-name]"
  dim "To update Marginalia: git pull && ./setup.sh"
  dim "Logs while running:   tail -f /tmp/marginalia.log"
  echo ""
else
  echo -e "  ${RED}${BOLD}Setup incomplete — see errors above.${RESET}"
  echo ""
  echo -e "  Fix the issues listed in red and run ${BOLD}./setup.sh${RESET} again."
  echo -e "  Nothing was broken — this script only adds, never removes."
  echo ""
  exit 1
fi
