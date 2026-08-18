#!/usr/bin/env bash
# PreToolUse(Bash) hook — block (exit 2) irreversible/destructive commands so
# the model must surface the reason and get explicit confirmation before
# retrying. Uses exit 2, not permissionDecision:ask, because exit 2 blocks
# unconditionally regardless of permission mode (incl. bypassPermissions),
# same mechanism as scan-secrets.sh; ask is routed through the permission
# system, which bypass mode can skip.
# Covers: force push, git reset --hard, git clean -f, git branch -D,
# git checkout/restore of uncommitted work, rm -rf, --no-verify/--no-gpg-sign.
set -uo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)

reason=""
case "$cmd" in
  *"git push"*--force*|*"git push"*" -f"*) reason="force push can overwrite remote history" ;;
esac
case "$cmd" in
  *"git reset"*--hard*) reason="${reason:+$reason; }git reset --hard discards uncommitted work" ;;
esac
case "$cmd" in
  *"git clean"*"-f"*|*"git clean"*"--force"*) reason="${reason:+$reason; }git clean -f permanently deletes untracked files" ;;
esac
case "$cmd" in
  *"git branch"*-D*) reason="${reason:+$reason; }git branch -D force-deletes a branch, can lose commits" ;;
esac
case "$cmd" in
  *"git checkout --"*|*"git checkout ."*|*"git restore"*) reason="${reason:+$reason; }discards uncommitted changes" ;;
esac
case "$cmd" in
  *"rm -rf"*|*"rm -fr"*|*"rm -r -f"*|*"rm -f -r"*|*"rm --recursive --force"*|*"rm --force --recursive"*) \
    reason="${reason:+$reason; }rm -rf is irreversible" ;;
esac
case "$cmd" in
  *"--no-verify"*|*"--no-gpg-sign"*) reason="${reason:+$reason; }bypasses commit hooks/signing" ;;
esac

if [ -n "$reason" ]; then
  printf 'BLOCKED: destructive/irreversible command (%s).\nConfirm with the user this is intended before retrying. If confirmed, run it yourself in the terminal.\n' "$reason" >&2
  exit 2
fi
exit 0
