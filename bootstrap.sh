#!/bin/bash
# Marginalia bootstrap — Linux
# Make executable once: chmod +x bootstrap.sh
# Then run: ./bootstrap.sh

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
    echo "Install via your package manager:"
    echo "  Ubuntu/Debian: sudo apt install python3 python3-venv python3-pip"
    echo "  Fedora/RHEL:   sudo dnf install python3"
    echo "  Arch:          sudo pacman -S python"
    exit 1
fi

# ── Isolated environment (Rule 1) ─────────────────────────────────────────────
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
        echo "   Edit .env and add your API keys: nano .env"
        echo ""
    fi
fi

# ── Check Ollama (optional) ───────────────────────────────────────────────────
if ! command -v ollama &> /dev/null; then
    echo "NOTE: Ollama not found — local models unavailable."
    echo "Install from: https://ollama.ai/download"
    echo ""
fi

# ── Port safety (Rule 2) ──────────────────────────────────────────────────────
PORT=5000
while ss -tlnp | grep -q ":$PORT " 2>/dev/null || \
      netstat -tlnp 2>/dev/null | grep -q ":$PORT "; do
    echo "Port $PORT in use, trying $((PORT+1))..."
    PORT=$((PORT+1))
done

echo "Launching Marginalia on port $PORT..."
echo ""

# ── Launch (browser auto-opens via app.py) ────────────────────────────────────
MARGINALIA_PORT=$PORT python3 app.py
