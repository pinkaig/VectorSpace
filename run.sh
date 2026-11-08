#!/usr/bin/env bash
#
# VectorSpace — one-command setup, build, test, and run.
#
# Usage:
#   ./run.sh              full pipeline, then serve the app
#   ./run.sh --no-e2e     skip the browser tests (they download Chromium on first run)
#   ./run.sh --ci         run every check and exit without serving
#   ./run.sh --no-docker  serve the static build only (no API / database)
#
# After the checks, if Docker is running, this starts the full local stack:
# Postgres in Docker + API (dev login, local only) + web app. Without Docker it
# falls back to serving the frontend build on its own.

set -uo pipefail

APP_DIR=VectorSpace
MIN_NODE_MAJOR=22
MIN_NPM_MAJOR=10
RUN_E2E=1
SERVE=1
DOCKER=1

for arg in "$@"; do
  case "$arg" in
    --no-e2e) RUN_E2E=0 ;;
    --ci) SERVE=0 ;;
    --no-docker) DOCKER=0 ;;
    -h|--help) sed -n '3,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
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

echo VectorSpace
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

if [[ $DOCKER -eq 1 ]] && command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  # Same steps as scripts/dev-stack-docker.bat.
  docker compose up -d --wait postgres || die "Could not start Postgres in Docker."
  export APP_ENV=local AUTH_DEV_BYPASS=true CORS_ORIGINS=http://localhost:5173
  export DATABASE_URL="postgresql://${POSTGRES_USER:-vectorspace_app}:${POSTGRES_PASSWORD:-vectorspace_local}@localhost:5432/${POSTGRES_DB:-vectorspace}"
  (
    cd apps/api || exit 1
    if [[ ! -x .venv/bin/python ]]; then
      python3 -m venv .venv && .venv/bin/python -m pip install -r requirements.txt || exit 1
    fi
    host="$(.venv/bin/python -c "from app.config import get_settings as g; from urllib.parse import urlparse as u; print(u(g().sqlalchemy_database_url).hostname or '')")"
    [[ "$host" == "localhost" || "$host" == "127.0.0.1" ]] || { echo "Database host is '$host', not local Docker. Refusing to migrate or seed." >&2; exit 1; }
    .venv/bin/alembic upgrade head && .venv/bin/python -m app.seed --apply
  ) || die "API setup failed (see above)."
  (cd apps/api && exec .venv/bin/uvicorn app.main:app --port 8000) &
  api_pid=$!
  trap 'kill $api_pid 2>/dev/null; docker compose stop postgres' EXIT
  printf '
  API:     http://localhost:8000/health
  Browser: http://localhost:5173  (Ctrl+C stops everything)

'
  VITE_API_URL=http://localhost:8000 npm run dev
  exit $?
fi
[[ $DOCKER -eq 1 ]] && echo "  Docker is not running: serving the frontend build only."
cat <<'BANNER'

  ----------------------------------------------------------------
  All checks passed. Serving the production build.

    Open http://localhost:4173 in your browser.
    Press Ctrl+C to stop.
  ----------------------------------------------------------------

BANNER

npm run preview -- --host 127.0.0.1 --port 4173
