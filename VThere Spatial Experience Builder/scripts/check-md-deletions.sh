#!/usr/bin/env bash
#
# check-md-deletions.sh — report markdown files a merge would remove.
#
# WHY THIS EXISTS
# Merge commit c055534 (PR #18) deleted 9 tracked .md files, including
# docs/code/subsystems/audio-system.md and a CREDITS.md belonging to an
# entirely unrelated project in this monorepo. No commit on the merged branch
# ever deleted them — they were lost in a merge resolution performed against a
# stale checkout. Git only raises a modify/delete CONFLICT for a doc you have
# edited since the merge base; a doc you own but have not touched is removed
# with no conflict and no prompt. That silent class is what this script catches.
#
# USAGE
#   scripts/check-md-deletions.sh <other-branch> [base-ref]
#     scripts/check-md-deletions.sh Working                 # vs HEAD
#
# Read-only: uses `git merge-tree --write-tree`, which builds the merged tree
# in the object database and touches neither the working tree nor any branch.
#
# Exit codes: 0 = no .md would be lost, 1 = some would (list printed), 2 = usage/error.
set -euo pipefail

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  echo "usage: $0 <other-branch> [base-ref]" >&2
  exit 2
fi

OTHER="$1"
BASE="${2:-HEAD}"

for ref in "$BASE" "$OTHER"; do
  git rev-parse --verify --quiet "$ref" >/dev/null || { echo "error: no such ref: $ref" >&2; exit 2; }
done

# --write-tree prints the merged tree oid on line 1, then conflict prose.
# A conflicted merge still produces a usable tree, so a non-zero status here is
# expected and must not abort under `set -e`.
MERGED_TREE="$(git merge-tree --write-tree "$BASE" "$OTHER" 2>/dev/null | head -1 || true)"

if ! git rev-parse --verify --quiet "${MERGED_TREE}^{tree}" >/dev/null 2>&1; then
  echo "error: could not compute a merged tree for $BASE <- $OTHER" >&2
  exit 2
fi

BEFORE="$(mktemp)"; AFTER="$(mktemp)"
trap 'rm -f "$BEFORE" "$AFTER"' EXIT

git ls-tree -r --name-only "$BASE"         | grep '\.md$' | sort > "$BEFORE"
git ls-tree -r --name-only "$MERGED_TREE"  | grep '\.md$' | sort > "$AFTER"

# -2 hides lines only in AFTER (docs the merge ADDS — fine).
# -3 hides lines in both (unchanged — fine). What remains: removed by the merge.
LOST="$(comm -23 "$BEFORE" "$AFTER" || true)"

if [ -z "$LOST" ]; then
  echo "OK: merging '$OTHER' into '$BASE' removes no tracked .md files."
  exit 0
fi

COUNT="$(printf '%s\n' "$LOST" | wc -l | tr -d ' ')"
echo "WARNING: merging '$OTHER' into '$BASE' would REMOVE $COUNT tracked .md file(s):"
echo
printf '%s\n' "$LOST" | sed 's/^/  - /'
cat <<'EOF'

To keep every one of them, after running `git merge` (and before committing):

    git checkout HEAD -- $(scripts/check-md-deletions.sh <branch> | sed -n 's/^  - //p' | tr '\n' ' ')

Or restore them one at a time:

    git checkout HEAD -- "<path>"

Then verify the merge removed nothing by re-running this script against the
result. Note an untracked new doc never appears here — commit it before merging.
EOF
exit 1
