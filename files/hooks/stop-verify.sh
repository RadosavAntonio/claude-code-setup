#!/usr/bin/env bash
# Stop hook (async + asyncRewake) — when a turn ends, verify the changed JS/TS files.
# Runs eslint, tsc --noEmit, and jest --findRelatedTests on changed files, but only
# fails if a problem touches a file you actually changed. Exit 2 wakes the model to fix it.
# No-ops fast when: not a git repo, no changed .ts/tsx/js/jsx files, or tools absent.
set -uo pipefail

cat >/dev/null 2>&1 || true   # drain stdin

repo=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$repo" 2>/dev/null || exit 0

files=$( { git diff --name-only --diff-filter=ACM 2>/dev/null; \
           git diff --cached --name-only --diff-filter=ACM 2>/dev/null; \
           git ls-files --others --exclude-standard 2>/dev/null; } \
         | grep -Ei '\.(ts|tsx|js|jsx)$' | sort -u )
[ -z "$files" ] && exit 0   # nothing changed -> nothing to verify

eslint="$repo/node_modules/.bin/eslint"
tsc="$repo/node_modules/.bin/tsc"
out=""
fail=0

# 1) ESLint on changed files only (scoped, fast, high signal)
if [ -x "$eslint" ]; then
  emsg=$(printf '%s\n' "$files" | tr '\n' '\0' \
         | xargs -0 "$eslint" --no-error-on-unmatched-pattern 2>&1) || {
    fail=1
    out="${out}ESLint on changed files:\n${emsg}\n\n"
  }
fi

# 2) tsc --noEmit project-wide, but report only errors in YOUR changed files
if [ -x "$tsc" ]; then
  tmsg=$("$tsc" --noEmit 2>&1) || true
  pat=$(printf '%s\n' "$files" | sed 's/[.]/\\./g' | paste -sd'|' -)
  if [ -n "$pat" ]; then
    myerr=$(printf '%s\n' "$tmsg" | grep -E "($pat)\(" || true)
    if [ -n "$myerr" ]; then
      fail=1
      out="${out}tsc --noEmit (your files):\n${myerr}\n"
    fi
  fi
fi

# 3) jest --findRelatedTests on changed files only (scoped, skips if no jest or no matching tests)
jest="$repo/node_modules/.bin/jest"
if [ -x "$jest" ]; then
  jmsg=$(printf '%s\n' "$files" | tr '\n' '\0' \
         | xargs -0 "$jest" --findRelatedTests --passWithNoTests 2>&1) || {
    fail=1
    out="${out}jest --findRelatedTests (your files):\n${jmsg}\n\n"
  }
fi

if [ "$fail" -eq 1 ]; then
  printf 'Verification failed on files you changed:\n\n%b\nFix these before claiming done.\n' "$out" >&2
  exit 2
fi
exit 0
