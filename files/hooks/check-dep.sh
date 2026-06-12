#!/usr/bin/env bash
# PreToolUse(Bash) hook — when a command ADDS a dependency, return permission
# decision "ask" with a reminder to research it first (/check-dep). Bare installs
# that just restore existing deps (yarn install, npm ci, npm install) do NOT trigger.
set -uo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)

has_pkg() {
  local s="$1" rest tok
  case "$s" in
    *"yarn add "*)     rest="${s#*yarn add }" ;;
    *"pnpm add "*)     rest="${s#*pnpm add }" ;;
    *"npm install "*)  rest="${s#*npm install }" ;;
    *"npm i "*)        rest="${s#*npm i }" ;;
    *"npm add "*)      rest="${s#*npm add }" ;;
    *) return 1 ;;
  esac
  for tok in $rest; do
    case "$tok" in
      "&&"|";"|"|") break ;;   # stop at the next command
      -*) ;;                    # flag — skip
      *) return 0 ;;            # a real package argument
    esac
  done
  return 1
}

if has_pkg "$cmd"; then
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"Adding a dependency. Run /check-dep first — bundle size, maintenance, RN native-linking, lighter alternatives — before approving."}}'
fi
exit 0
