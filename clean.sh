#!/usr/bin/env bash
#
# Remove generated and local-only files from the working tree.
#
# Usage:
#   ./clean.sh            show what would be removed, delete nothing
#   ./clean.sh --force    actually remove it
#   ./clean.sh --deps     also remove node_modules (forces a fresh npm ci)
#
# Only ever touches files git already ignores, so committed work is safe.
# Dry run is the default on purpose: read the list before deleting.

set -uo pipefail

FORCE=0
DEPS=0

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --deps)  DEPS=1 ;;
    -h|--help) sed -n '3,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $arg (try --help)" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")"

APP_DIR="VThere Spatial Experience Builder"

# Build-output and cache directories, relative to the app folder.
TARGETS=(
  "dist"
  "coverage"
  "playwright-report"
  "test-results"
  ".vite"
  ".pytest_cache"
  "apps/api/.pytest_cache"
)

echo "Repository cleanup"
echo "=================="
if [[ $FORCE -eq 0 ]]; then
  echo "DRY RUN - nothing will be deleted. Re-run with --force to apply."
fi
echo

removed=0
found=0

# remove <path> <label>
remove() {
  local path="$1"
  [[ -e "$path" ]] || return 0
  found=$((found + 1))
  local size
  size="$(du -sh "$path" 2>/dev/null | cut -f1)"
  printf '  %-48s %s\n' "$path" "${size:-?}"
  if [[ $FORCE -eq 1 ]]; then
    rm -rf "$path" && removed=$((removed + 1))
  fi
}

echo "Build output and caches:"
for t in "${TARGETS[@]}"; do
  remove "$APP_DIR/$t"
done
[[ $found -eq 0 ]] && echo "  (none)"

echo
echo "Python bytecode:"
pyc_found=0
while IFS= read -r -d '' d; do
  pyc_found=1
  found=$((found + 1))
  printf '  %s\n' "$d"
  [[ $FORCE -eq 1 ]] && rm -rf "$d" && removed=$((removed + 1))
done < <(find "$APP_DIR" -name __pycache__ -type d -not -path '*/node_modules/*' -print0 2>/dev/null)
[[ $pyc_found -eq 0 ]] && echo "  (none)"

echo
echo "TypeScript build info:"
tsb_found=0
while IFS= read -r -d '' f; do
  tsb_found=1
  found=$((found + 1))
  printf '  %s\n' "$f"
  [[ $FORCE -eq 1 ]] && rm -f "$f" && removed=$((removed + 1))
done < <(find "$APP_DIR" -name '*.tsbuildinfo' -not -path '*/node_modules/*' -print0 2>/dev/null)
[[ $tsb_found -eq 0 ]] && echo "  (none)"

if [[ $DEPS -eq 1 ]]; then
  echo
  echo "Dependencies:"
  remove "$APP_DIR/node_modules"
fi

# Anything git ignores that this script does not know about. Reported only --
# never deleted, because .env files live here and are not recoverable.
echo
echo "Other ignored files (NOT removed - review by hand):"
other=0
while IFS= read -r line; do
  path="${line#!! }"
  path="${path%\"}"; path="${path#\"}"
  case "$path" in
    */node_modules/*|*/node_modules|.claude/) continue ;;
    */dist/*|*/dist|*/coverage/*|*/__pycache__/*|*.tsbuildinfo) continue ;;
    */.pytest_cache/*|*/.pytest_cache|*/playwright-report/*|*/test-results/*) continue ;;
  esac
  other=$((other + 1))
  printf '  %s\n' "$path"
done < <(git status --short --ignored 2>/dev/null | grep '^!!')
[[ $other -eq 0 ]] && echo "  (none)"

echo
echo "----------------------------------------------------------------"
if [[ $FORCE -eq 1 ]]; then
  echo "Removed $removed of $found item(s)."
else
  echo "Found $found item(s). Re-run with --force to remove them."
fi
