#!/bin/bash
# Marginalia bootstrap — macOS
# Make executable once: chmod +x bootstrap-macos.sh
# Then run: ./bootstrap-macos.sh
#
# This script is for first-time human setup and manual local runs.
# Do NOT point a launchd entry at this file — production process
# managers should call the venv's python and app.py directly.
# See HANDOFF.md, "Production vs bootstrap scripts," and the
# marginalia-seeds.md entry on the June 2026 bootstrap.sh incident
# for why this distinction matters.

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
    echo "Install via Homebrew: brew install python3"
    echo "Or from: https://www.python.org/downloads/macos/"
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
# macOS reserves port 5000 for AirPlay Receiver (since Monterey) and
# port 7000 for AirPlay-related services on some systems. We default
# to 5001 first rather than 5000 to sidestep the most common collision
# automatically, rather than failing into it.
#
# Uses `lsof` for the in-use check — macOS-native, no Linux-only `ss`
# dependency. (The original cross-platform script used `ss`, which
# does not exist on macOS and silently failed its in-use check —
# see HANDOFF.md / seeds.md for the incident this caused in production.)
PORT=5001
while lsof -i :"$PORT" -sTCP:LISTEN &>/dev/null; do
    echo "Port $PORT in use, trying $((PORT+1))..."
    PORT=$((PORT+1))
done

echo "Launching Marginalia on port $PORT..."
echo ""

if [ "$PORT" = "5000" ]; then
    echo "NOTE: running on port 5000. If you hit 'Address already in use'"
    echo "      unexpectedly on a future run, it is very likely macOS's"
    echo "      AirPlay Receiver. This script already defaults away from"
    echo "      5000 to avoid that — you're only here if 5001+ were all busy."
    echo ""
fi

# ── Launch (browser auto-opens via app.py) ────────────────────────────────────
MARGINALIA_PORT=$PORT python3 app.py
