#!/bin/bash
# Marginalia bootstrap — dispatcher
#
# Detects the OS and runs the correct platform-specific bootstrap script.
# This file exists so `./bootstrap.sh` keeps working for anyone following
# old instructions, READMEs, or muscle memory.
#
# Direct use of bootstrap-macos.sh or bootstrap-linux.sh is equally fine
# and skips the one-line detection step.
#
# Do NOT point a launchd/systemd/supervisor entry at this file or at
# either platform script. Production process managers should call the
# venv's python and app.py directly. See HANDOFF.md.

set -e
cd "$(dirname "$0")"

case "$(uname -s)" in
    Darwin)
        exec bash bootstrap-macos.sh
        ;;
    Linux)
        exec bash bootstrap-linux.sh
        ;;
    *)
        echo "Unrecognized OS: $(uname -s)"
        echo "Marginalia's bootstrap scripts support macOS and Linux."
        echo "Try running bootstrap-linux.sh directly — most Unix-like"
        echo "systems are close enough to work, or adapt it for your platform."
        exit 1
        ;;
esac
