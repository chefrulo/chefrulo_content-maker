#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

OUTPUT="${1:-../chefrulo-content-maker-migration-$(date +%Y%m%d-%H%M%S).tar.gz}"

INCLUDE=()
[ -f .env.local ] && INCLUDE+=(.env.local)
[ -d data ] && INCLUDE+=(data)
[ -d footage ] && INCLUDE+=(footage)

if [ ${#INCLUDE[@]} -eq 0 ]; then
  echo "Nothing to pack: no .env.local, data/, or footage/ found in $(pwd)." >&2
  exit 1
fi

echo "Packing: ${INCLUDE[*]}"
tar czf "$OUTPUT" "${INCLUDE[@]}"

echo ""
echo "Created $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
echo ""
echo "This archive contains real credentials (.env.local: Meta, OpenAI, Apify tokens)"
echo "and generated media (data/, footage/). Move it to the new machine over a channel"
echo "you control — USB, rsync over SSH, AirDrop. Never email or chat."
echo ""
echo "On the new machine, after cloning this repo, run:"
echo "  npm run machine:unpack -- $(basename "$OUTPUT")"
