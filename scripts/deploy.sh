#!/bin/sh
# Publishes the journal to https://thespygeneral.github.io
# Usage: npm run deploy
set -e
cd "$(dirname "$0")/.."

ACCOUNT=$(gh api user --jq .login)
if [ "$ACCOUNT" != "thespygeneral" ]; then
  echo "Signed in to GitHub as '$ACCOUNT'. Switch first:  gh auth switch --user thespygeneral"
  exit 1
fi

npm test
npm run build
touch dist/.nojekyll

TMP=$(mktemp -d)
cp -R dist/. "$TMP"
cd "$TMP"
git init -q -b gh-pages
git config user.name "The Spy General"
git config user.email "360089798+thespygeneral@users.noreply.github.com"
git add -A
git commit -q -m "Publish $(date '+%Y-%m-%d %H:%M')"
git push -q -f https://github.com/thespygeneral/thespygeneral.github.io.git gh-pages
cd - >/dev/null
rm -rf "$TMP"
echo "Published. Live in about a minute at https://thespygeneral.github.io"
