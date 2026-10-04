#!/usr/bin/env bash
set -u

failures=()
echo "VectorSpace environment check"

if ! command -v node >/dev/null 2>&1; then
  failures+=("Node.js was not found. Install Node.js 22+ LTS from https://nodejs.org/")
else
  node_version="$(node --version)"
  node_major="${node_version#v}"
  node_major="${node_major%%.*}"
  echo "  Node.js: $node_version"
  if (( node_major < 22 )); then failures+=("Node.js 22+ is required; found $node_version."); fi
fi

if ! command -v npm >/dev/null 2>&1; then
  failures+=("npm was not found. Install Node.js LTS, which includes npm.")
else
  echo "  npm: $(npm --version)"
fi

if [[ ! -d node_modules ]]; then
  failures+=("Dependencies are not installed. Run: npm install")
else
  echo "  Dependencies: installed"
fi

if (( ${#failures[@]} > 0 )); then
  echo ""
  printf '  [FAIL] %s\n' "${failures[@]}"
  echo ""
  echo "Environment is not ready. Fix the failures above, then run: npm run dev"
  exit 1
fi

echo "Environment ready. Start the editor with: npm run dev"