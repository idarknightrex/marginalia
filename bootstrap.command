#!/bin/bash
# Marginalia bootstrap — Mac
# Make executable once: chmod +x bootstrap.command
# Then double-click in Finder to launch

set -e
cd "$(dirname "$0")"

echo ""
echo "╔════════════════════════════════╗"
echo "║     Starting Marginalia...     ║"
echo "╚════════════════════════════════╝"
echo ""

# ── Check Python ──────────────────────────────────────────────────────────────
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 not found."
    echo "Please install Python 3.12 from https://www.python.org/downloads/"
    open "https://www.python.org/downloads/"
    read -p "Press Enter after installing Python, then run this script again."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(sys.version_info.major * 10 + sys.version_info.minor)')
if [ "$PYTHON_VERSION" -lt 38 ]; then
    echo "ERROR: Python 3.8 or higher required."
    exit 1
fi

# ── Isolated environment inside project folder (Rule 1) ───────────────────────
if [ ! -d ".venv" ]; then
    echo "Setting up isolated environment (first run only)..."
    python3 -m venv .venv
fi

source .venv/bin/activate
echo "Installing dependencies..."
pip install -r requirements.txt --quiet --upgrade

# ── .env setup ────────────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        chmod 600 .env
        echo ""
        echo "⚠  No .env file found — created from template."
        echo "   Open .env and add your API keys before using cloud models."
        echo "   Run: open -e .env"
        echo ""
    fi
fi

# ── Check Ollama (optional) ───────────────────────────────────────────────────
if ! command -v ollama &> /dev/null; then
    echo ""
    echo "NOTE: Ollama not found — local models unavailable."
    echo "Cloud models (Gemini, Azure, Anthropic) will still work."
    echo "Install Ollama later from: https://ollama.ai/download"
    echo ""
fi

# ── Port safety: find available port (Rule 2) ─────────────────────────────────
PORT=5000
while lsof -i :$PORT &> /dev/null 2>&1; do
    echo "Port $PORT in use, trying $((PORT+1))..."
    PORT=$((PORT+1))
done

echo "Launching Marginalia on port $PORT..."
echo ""

# ── Launch (Rule 3: browser auto-opens via app.py) ───────────────────────────
# caffeinate keeps Mac Mini awake when running headless
if system_profiler SPHardwareDataType 2>/dev/null | grep -q "Mac mini"; then
    echo "Mac Mini detected — asserting wake lock via caffeinate..."
    MARGINALIA_PORT=$PORT caffeinate -disu python3 app.py
else
    MARGINALIA_PORT=$PORT python3 app.py
fi
