#!/bin/bash
# The fork's name is brand.json (docs/branding.md). This script is the deep option:
#   scripts/rename-brand.sh [--dry-run] [--deep] [dir]
# --dry-run (default) lists every file, match count and what the allow-list protected;
# --deep rewrites the internal herdr names (crates, binaries, HERDR_ variables, fork-* mods)
# to brand.json's slug. Only on a throwaway release branch or a scratch copy, never on
# ethan/browser-parity: upstream merges stay cheap there.
set -euo pipefail
mode=--dry-run dir=$(cd "$(dirname "$0")/.." && pwd)
for a in "$@"; do
  case $a in --dry-run|--deep) mode=$a ;; *) dir=$(cd "$a" && pwd) ;; esac
done
if [[ $mode == --deep ]]; then
  branch=$(git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  case $branch in
    ethan/browser-parity|master|main) echo "rename-brand: refusing --deep on $branch (use a throwaway release branch or a scratch copy)" >&2; exit 1 ;;
  esac
fi
exec python3 "$(dirname "$0")/rename_brand.py" "$dir" "$mode"
