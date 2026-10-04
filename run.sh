#!/usr/bin/env bash
#
# VThere Spatial Experience Builder — one-command setup, build, test, and run.
#
# Usage:
#   ./run.sh              full pipeline, then serve the app
#   ./run.sh --no-e2e     skip the browser tests (they download Chromium on first run)
#   ./run.sh --ci         run every check and exit without serving
#
# This project is a frontend-only single-page app for M1: there is no backend or
# database to start. See README.md for why.

set -uo pipefail

APP_DIR="VThere Spatial Experience Builder"
MIN_NODE_MAJOR=22
MIN_NPM_MAJOR=10
RUN_E2E=1
SERVE=1

for arg in "$@"; do
  case "$arg" in
    --no-e2e) RUN_E2E=0 ;;
    --ci) SERVE=0 ;;
    -h|--help) sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $arg (try --help)" >&2; exit 2 ;;
  esac
done

# Always operate from the repository root, no matter where the script is called from.
cd "$(dirname "$0")"

step=0
say() { step=$((step + 1)); printf -- '\n[%d/%d] %s\n' "$step" "$TOTAL" "$1"; }
die() {
  printf -- '\n----------------------------------------------------------------\n' >&2
  printf -- 'FAILED: %s\n' "$1" >&2
  [[ $# -gt 1 ]] && printf -- '%s\n' "$2" >&2
  printf -- '----------------------------------------------------------------\n' >&2
  exit 1
}

TOTAL=5
[[ $RUN_E2E -eq 1 ]] && TOTAL=$((TOTAL + 1))
[[ $SERVE -eq 1 ]] && TOTAL=$((TOTAL + 1))

echo "VThere Spatial Experience Builder"
echo "================================"

# ---------------------------------------------------------------- environment
say "Checking environment"

command -v node >/dev/null 2>&1 || die "Node.js was not found." \
  "Install Node.js ${MIN_NODE_MAJOR} LTS or newer from https://nodejs.org/ and reopen your terminal."

node_version="$(node --version)"
node_major="${node_version#v}"; node_major="${node_major%%.*}"
if (( node_major < MIN_NODE_MAJOR )); then
  die "Node.js ${MIN_NODE_MAJOR}+ is required; found ${node_version}." \
    "Install Node.js ${MIN_NODE_MAJOR} LTS or newer from https://nodejs.org/"
fi
echo "  Node.js: ${node_version}"

command -v npm >/dev/null 2>&1 || die "npm was not found." \
  "Install Node.js LTS, which bundles npm."

npm_version="$(npm --version)"
npm_major="${npm_version%%.*}"
if (( npm_major < MIN_NPM_MAJOR )); then
  die "npm ${MIN_NPM_MAJOR}+ is required; found ${npm_version}." "Run: npm install -g npm@latest"
fi
echo "  npm: ${npm_version}"

[[ -d "$APP_DIR" ]] || die "Could not find the app directory '${APP_DIR}'." \
  "Run this script from the repository root, on a complete clone."

cd "$APP_DIR"

# ------------------------------------------------------------------- install
say "Installing locked dependencies (npm ci)"
npm ci || die "Dependency installation failed." \
  "Check your network connection. If package-lock.json is out of sync, run 'npm install' to refresh it."

# ----------------------------------------------------------------- typecheck
say "Type-checking"
npm run typecheck || die "TypeScript reported type errors (see above)."

# --------------------------------------------------------------- unit tests
say "Running unit tests"
npm test || die "Unit tests failed (see above)."

# --------------------------------------------------------------------- build
say "Building production bundle"
npm run build || die "Production build failed (see above)."

# -------------------------------------------------------------- browser tests
if [[ $RUN_E2E -eq 1 ]]; then
  say "Running browser tests"
  # Chromium is ~130MB and is only downloaded the first time.
  if ! npx playwright install chromium; then
    echo "  WARNING: could not download the Chromium test browser; skipping browser tests."
    echo "  Everything else passed. Re-run with network access, or use --no-e2e to skip this step."
  else
    npm run test:e2e || die "Browser tests failed (see above)." \
      "Open the report with: cd \"${APP_DIR}\" && npx playwright show-report"
  fi
fi

# --------------------------------------------------------------------- serve
if [[ $SERVE -eq 0 ]]; then
  printf '\nAll checks passed.\n'
  exit 0
fi

say "Starting the app"
cat <<'BANNER'

  ----------------------------------------------------------------
  All checks passed. Serving the production build.

    Open http://localhost:4173 in your browser.
    Press Ctrl+C to stop.
  ----------------------------------------------------------------

BANNER

npm run preview -- --host 127.0.0.1 --port 4173
