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

# Strip heredoc bodies before matching, so prose that merely mentions these
# commands (e.g. a commit message documenting this hook) doesn't false-trigger.
scan=$(printf '%s' "$cmd" | python3 -c '
import re, sys
s = sys.stdin.read()
out = []
i = 0
opener = re.compile(r"<<-?\s*([\"'"'"']?)([A-Za-z_][A-Za-z0-9_]*)\1")
# Interpreters that EXECUTE heredoc bodies (must still be scanned) vs. commands
# like `cat`/`git commit -m "$(cat <<EOF ...)"` where the body is inert data.
interp = re.compile(r"(?:^|[|;&(]\s*|\s)(bash|sh|zsh|python[0-9.]*|node|ruby|perl)\s*$")
while True:
    m = opener.search(s, i)
    if not m:
        out.append(s[i:])
        break
    out.append(s[i:m.end()])
    closer = re.compile(r"\n" + re.escape(m.group(2)) + r"(?=\n|$)")
    cm = closer.search(s, m.end())
    if not cm:
        out.append(s[m.end():])
        i = len(s)
        break
    if interp.search(s[:m.start()]):
        out.append(s[m.end():cm.end()])   # executed by an interpreter: keep, do not strip
    i = cm.end()
print("".join(out), end="")
' 2>/dev/null)
[ -z "$scan" ] && scan="$cmd"   # python3 missing/failed -> fall back to full string (safe, may over-match)

reason=""
case "$scan" in
  *"git push"*--force*|*"git push"*" -f"*) reason="force push can overwrite remote history" ;;
esac
case "$scan" in
  *"git reset"*--hard*) reason="${reason:+$reason; }git reset --hard discards uncommitted work" ;;
esac
case "$scan" in
  *"git clean"*"-f"*|*"git clean"*"--force"*) reason="${reason:+$reason; }git clean -f permanently deletes untracked files" ;;
esac
case "$scan" in
  *"git branch"*-D*) reason="${reason:+$reason; }git branch -D force-deletes a branch, can lose commits" ;;
esac
case "$scan" in
  *"git checkout --"*|*"git checkout ."*|*"git restore"*) reason="${reason:+$reason; }discards uncommitted changes" ;;
esac
case "$scan" in
  *"rm -rf"*|*"rm -fr"*|*"rm -r -f"*|*"rm -f -r"*|*"rm --recursive --force"*|*"rm --force --recursive"*) \
    reason="${reason:+$reason; }rm -rf is irreversible" ;;
esac
case "$scan" in
  *"--no-verify"*|*"--no-gpg-sign"*) reason="${reason:+$reason; }bypasses commit hooks/signing" ;;
esac

if [ -n "$reason" ]; then
  printf 'BLOCKED: destructive/irreversible command (%s).\nConfirm with the user this is intended before retrying. If confirmed, run it yourself in the terminal.\n' "$reason" >&2
  exit 2
fi
exit 0
