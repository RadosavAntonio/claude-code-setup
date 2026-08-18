#!/bin/sh
# Caveman mode — inject rules as system context on session start.
# Single source of truth: skills/caveman/SKILL.md. This strips its YAML
# frontmatter and just the Intensity table/examples (level-switching detail
# only needed when /caveman is invoked mid-session) — everything else,
# including Auto-Clarity and Boundaries, is kept: those are safety-relevant
# (e.g. "revert to normal prose for irreversible action confirmations").
skill="$HOME/.claude/skills/caveman/SKILL.md"
[ -f "$skill" ] || exit 0

awk '
  NR==1 && $0=="---" { infm=1; next }
  infm && $0=="---" { infm=0; next }
  infm { next }
  /^## Intensity/ { inint=1; next }
  /^## Auto-Clarity/ { inint=0 }
  inint { next }
  { print }
' "$skill"
