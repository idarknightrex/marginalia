@echo off
:: Marginalia bootstrap — Windows
:: Double-click to launch, or run from Command Prompt

cd /d "%~dp0"

echo.
echo ╔════════════════════════════════╗
echo ║     Starting Marginalia...     ║
echo ╚════════════════════════════════╝
echo.

:: ── Check Python ──────────────────────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found.
    echo Please install Python 3.12 from https://www.python.org/downloads/
    echo During installation, check "Add Python to PATH"
    start https://www.python.org/downloads/
    pause
    exit /b 1
)

:: ── Isolated environment (Rule 1) ─────────────────────────────────────────────
if not exist ".venv" (
    echo Setting up isolated environment (first run only)...
    python -m venv .venv
)

call .venv\Scripts\activate.bat
echo Installing dependencies...
pip install -r requirements.txt --quiet --upgrade

:: ── .env setup ────────────────────────────────────────────────────────────────
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
        echo.
        echo WARNING: No .env file found - created from template.
        echo Edit .env and add your API keys before using cloud models.
        echo Run: notepad .env
        echo.
    )
)

:: ── Check Ollama (optional) ───────────────────────────────────────────────────
ollama --version >nul 2>&1
if errorlevel 1 (
    echo NOTE: Ollama not found - local models unavailable.
    echo Install from: https://ollama.ai/download
    echo.
)

:: ── Port safety (Rule 2) ──────────────────────────────────────────────────────
set PORT=5000
:CHECK_PORT
netstat -an | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo Port %PORT% in use, trying next...
    set /a PORT=%PORT%+1
    goto CHECK_PORT
)

echo Launching Marginalia on port %PORT%...
echo.

:: ── Launch (browser auto-opens via app.py) ────────────────────────────────────
set MARGINALIA_PORT=%PORT%
python app.py

pause
