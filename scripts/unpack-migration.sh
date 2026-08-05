#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

ARCHIVE="${1:?Usage: npm run machine:unpack -- <archive.tar.gz>}"

if [ ! -f "$ARCHIVE" ]; then
  echo "Archive not found: $ARCHIVE" >&2
  exit 1
fi

for existing in .env.local data footage; do
  if [ -e "$existing" ]; then
    echo "Warning: '$existing' already exists in this checkout ($(pwd))." >&2
    read -rp "Extract on top of it anyway? [y/N] " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
      echo "Aborted." >&2
      exit 1
    fi
    break
  fi
done

tar xzf "$ARCHIVE"

echo ""
echo "Extracted $ARCHIVE into $(pwd)"
echo ""
echo "Next steps:"
echo "  npm install"
echo "  npm run doctor"
