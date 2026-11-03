#!/usr/bin/env bash
# Loads META_API_KEY from the local upload path into the current shell.
# Never echo the key. Upload path is gitignored.
set -euo pipefail
KEY_FILE="${META_API_KEY_FILE:-}"
if [[ -z "$KEY_FILE" ]]; then
  for candidate in \
    "/workspace/uploads/meta_api_key_5cce.txt" \
    "/workspace/uploads/meta_api_key.txt" \
    "$HOME/.config/benchmate/meta_api_key.txt"; do
    if [[ -f "$candidate" ]]; then KEY_FILE="$candidate"; break; fi
  done
fi
if [[ -z "${KEY_FILE}" || ! -f "$KEY_FILE" ]]; then
  echo "META_API_KEY file not found (looked in uploads/). Export META_API_KEY manually." >&2
  return 1 2>/dev/null || exit 1
fi
export META_API_KEY="$(tr -d ' \t\r\n' < "$KEY_FILE")"
export META_API_BASE_URL="${META_API_BASE_URL:-https://api.meta.ai/v1}"
export META_MODEL="${META_MODEL:-muse-spark-1.3}"
export META_WONDER_MODEL="${META_WONDER_MODEL:-muse-wonder-1.0}"
export META_SAM_MODEL_ID="${META_SAM_MODEL_ID:-sam-3.1}"
# length-only confirmation
python3 -c "import os; print('loaded META_API_KEY len=' + str(len(os.environ.get('META_API_KEY',''))))"
