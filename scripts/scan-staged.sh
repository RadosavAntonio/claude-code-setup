#!/usr/bin/env bash
#
# scan-staged.sh — pre-publish secret gate. Scans the staged git diff for
# token signatures. Excludes itself (it holds the patterns) so it never
# self-matches. Exit 1 if anything looks like a secret.
#
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

HITS=$(git diff --cached -U0 -- . ':(exclude)scripts/scan-staged.sh' \
  | grep '^+' | grep -vE '^\+\+\+' \
  | grep -inE 'AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|github_pat_|xox[baprs]-|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.|(api[_-]?key|secret|token|passwd|password)["'"'"' ]*[:=]["'"'"' ]*[A-Za-z0-9/+]{16,}' \
  || true)

if [ -n "$HITS" ]; then
  echo "⚠ potential secrets in staged changes:" >&2
  echo "$HITS" >&2
  exit 1
fi
echo "✓ secret scan clean"
