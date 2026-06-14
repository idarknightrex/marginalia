#!/bin/bash
# deploy.sh — run from forkd to deploy a new build to Solaris
# Usage: ./deploy.sh marginalia-v1.0.7_0614-2232.zip "commit message"

set -e

ZIP="${1:?Usage: ./deploy.sh <zipfile> <commit message>}"
MSG="${2:?Usage: ./deploy.sh <zipfile> <commit message>}"
SOLARIS="rajboora@100.126.14.57"
ZIP_PATH="$HOME/Downloads/$ZIP"

echo "→ Copying $ZIP to Solaris..."
scp "$ZIP_PATH" "$SOLARIS:/tmp/$ZIP"

echo "→ Deploying on Solaris..."
ssh "$SOLARIS" bash << REMOTE
set -e
ZIP="$ZIP"
SRC="/tmp/mu/marginalia-v1.0"
DEST="\$HOME/Developer/marginalia"

cp \$DEST/setup.env \$HOME/setup.env.bak
cd /tmp && unzip -o \$ZIP -d mu

cp \$SRC/app.py                        \$DEST/app.py
cp \$SRC/templates/index.html          \$DEST/templates/index.html
cp \$SRC/static/app.js                 \$DEST/static/app.js
cp \$SRC/static/app.css                \$DEST/static/app.css
cp \$SRC/setup.sh                      \$DEST/setup.sh
cp \$SRC/requirements.txt              \$DEST/requirements.txt
cp \$SRC/utils/git_preflight.py        \$DEST/utils/git_preflight.py
cp \$SRC/com.marginalia.server.plist   \$DEST/com.marginalia.server.plist
cp \$SRC/HANDOFF.md                    \$DEST/HANDOFF.md
cp \$SRC/marginalia-seeds.md           \$DEST/marginalia-seeds.md

cp \$HOME/setup.env.bak \$DEST/setup.env

pkill -9 -f "python.*app.py" 2>/dev/null || true
sleep 2
cd \$DEST && nohup .venv/bin/python app.py > /tmp/marginalia.log 2>&1 &
sleep 2

git add -A && git commit -m "$MSG" && git push origin main
echo "✓ deployed"
REMOTE

echo "✓ $ZIP live on Solaris"
