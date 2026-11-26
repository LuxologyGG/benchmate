#!/usr/bin/env bash
# Build the static Course Lab and publish ./out to the gh-pages branch (GitHub Pages, free).
# No secrets are involved: the static build has no API keys (visitors may paste their own Groq key).
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build:static
REMOTE=$(git remote get-url origin)
TMP=$(mktemp -d)
cp -r out/. "$TMP/"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="Camron Farjami" -c user.email="83742449+LuxologyGG@users.noreply.github.com" commit -qm "deploy: Course Lab static build $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "$REMOTE" gh-pages
echo "Published to gh-pages"
