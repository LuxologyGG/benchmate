#!/usr/bin/env bash
set -euo pipefail
# Force-push local main (full tree incl. artifacts) to the public submission repo.
# Requires a GitHub PAT with repo scope in GITHUB_TOKEN, or SSH access.
REPO_URL="${GITHUB_REPO_URL:-https://github.com/LuxologyGG/benchmate.git}"
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  REPO_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/LuxologyGG/benchmate.git"
fi
git remote remove github 2>/dev/null || true
git remote add github "$REPO_URL"
git push -u github main --force
echo "Pushed main to LuxologyGG/benchmate"
