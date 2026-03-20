#!/usr/bin/env bash
set -e

echo "Cleaning up..."
rm -rf node_modules
rm -f package-lock.json

echo "Clearing cache..."
npm cache clean --force

echo "Re-installing dependencies..."
npm install --legacy-peer-deps

echo "Installing PWA + static-copy plugins..."
npm install vite-plugin-pwa vite-plugin-static-copy lucide-react @tailwindcss/vite --legacy-peer-deps || true

echo "Adding changes to git..."
git add .
if git diff --staged --quiet; then
  echo "Nothing to commit"
else
  git commit -m "Finish setup: PWA, static-copy, IndexedDB, guard optional imports"
fi

if git remote | grep -q origin; then
  git push origin main || git push -u origin main || echo "git push failed"
else
  echo "No remote named origin configured; set remote then push"
fi

echo "Starting dev server..."
# start dev server in background so script exits
npm run dev -- --host &

echo "Script finished. Dev server started in background."