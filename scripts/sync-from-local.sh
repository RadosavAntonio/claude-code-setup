#!/usr/bin/env bash
#
# sync-from-local.sh — mirror the local ~/.claude CONFIG into files/ so the
# published package reproduces it on another machine.
#
# Ships config + tools ONLY. Private and machine-runtime data is never copied:
# history, transcripts, memory, the transcript-search index, sessions, caches,
# daemon/ide/jobs state, marketplace clones. This is a public npm package — the
# allowlist below is deliberate; do not widen it to private data.
#
set -euo pipefail

CLAUDE="${CLAUDE_DIR:-$HOME/.claude}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FILES="$ROOT/files"

die() { echo "✗ $*" >&2; exit 1; }
[ -d "$CLAUDE" ] || die "no ~/.claude at $CLAUDE"

# Rebuild files/ from scratch so removals propagate (repo is version-controlled).
rm -rf "$FILES"
mkdir -p "$FILES"

copy() { # copy <rel-src> <rel-dst>
  local src="$CLAUDE/$1" dst="$FILES/$2"
  [ -e "$src" ] || { echo "· skip (absent): $1"; return; }
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  echo "✓ $1"
}

copydir() { # copydir <rel-src> <rel-dst>  (all files, recursively)
  local src="$CLAUDE/$1" dst="$FILES/$2"
  [ -d "$src" ] || { echo "· skip (absent dir): $1/"; return; }
  mkdir -p "$dst"
  cp -R "$src/." "$dst/"
  echo "✓ $1/"
}

# Single config files
copy CLAUDE.md            CLAUDE.md
copy settings.json        settings.json
copy settings.local.json  settings.local.json
copy statusline.sh        statusline.sh

# Whole config dirs (every file)
copydir hooks    hooks
copydir commands commands
copydir agents   agents

# Skills: proper <name>/SKILL.md dirs (e.g. mute, unmute)
mkdir -p "$FILES/skills"
shopt -s nullglob
for d in "$CLAUDE"/skills/*/; do
  name="$(basename "$d")"
  [ -f "$d/SKILL.md" ] || continue
  mkdir -p "$FILES/skills/$name"
  cp "$d/SKILL.md" "$FILES/skills/$name/SKILL.md"
  echo "✓ skills/$name/SKILL.md"
done
# Legacy top-level *.md skills, if any remain
for f in "$CLAUDE"/skills/*.md; do
  cp "$f" "$FILES/skills/"
  echo "✓ skills/$(basename "$f")"
done

# The caveman skill lives under plugins/ locally; ship it as a skill.
if [ -f "$CLAUDE/plugins/caveman/skills/caveman/SKILL.md" ]; then
  mkdir -p "$FILES/skills/caveman"
  cp "$CLAUDE/plugins/caveman/skills/caveman/SKILL.md" "$FILES/skills/caveman/SKILL.md"
  echo "✓ plugins/caveman/skills/caveman/SKILL.md → skills/caveman/SKILL.md"
fi

# transcript-search ENGINE only — never the per-machine index (index.db*).
copy transcript-search/rag_lite.py transcript-search/rag_lite.py

echo ""
echo "Mirror complete → $FILES"
