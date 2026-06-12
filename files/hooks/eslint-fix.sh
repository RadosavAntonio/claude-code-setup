#!/usr/bin/env bash
# PostToolUse(Write|Edit) — auto eslint --fix the edited JS/TS file, best-effort.
# Silently no-ops if the file isn't lintable or eslint isn't installed.
set -uo pipefail

input=$(cat)
f=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null)
[ -z "$f" ] && exit 0

case "$f" in
  *.ts|*.tsx|*.js|*.jsx|*.cjs|*.mjs) ;;
  *) exit 0 ;;
esac
[ -f "$f" ] || exit 0

# Walk up to the nearest node_modules/.bin/eslint
dir=$(dirname "$f")
eslint=""
while [ "$dir" != "/" ] && [ -n "$dir" ]; do
  if [ -x "$dir/node_modules/.bin/eslint" ]; then
    eslint="$dir/node_modules/.bin/eslint"
    break
  fi
  dir=$(dirname "$dir")
done
[ -z "$eslint" ] && exit 0   # eslint not installed -> skip silently

"$eslint" --fix --no-error-on-unmatched-pattern "$f" >/dev/null 2>&1 || true
exit 0
