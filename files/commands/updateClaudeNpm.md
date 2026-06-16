---
description: Mirror 100% of my local ~/.claude config to the @antonior/claude-code-setup npm package + GitHub and publish, so another machine reproduces it exactly.
---

# /updateClaudeNpm

Publish my current local `~/.claude` config to npm + GitHub so another machine reproduces it 1:1.

- Package: `@antonior/claude-code-setup`
- Repo: https://github.com/RadosavAntonio/claude-code-setup

## Scope — what "100%" means

Ship 100% of CONFIG and TOOLS. NEVER ship private or machine-runtime data to the public registry.

- **SHIP:** `CLAUDE.md`, `settings.json`, `settings.local.json`, `statusline.sh`, `hooks/`, `commands/`, `agents/`, `skills/*.md`, the caveman skill (`plugins/caveman/skills/caveman/SKILL.md`), `transcript-search/rag_lite.py`.
- **NEVER SHIP:** `history.jsonl`, `projects/` (transcripts + memory), the transcript-search index (`index.db*`), `sessions/`, `session-env/`, `shell-snapshots/`, `paste-cache/`, `file-history/`, `backups/`, `cache/`, `daemon*`, `ide/`, `jobs/`, `plans/`, `telemetry/`, `plugins/marketplaces/`, `known_marketplaces.json`, `.DS_Store`.

The allowlist in `scripts/sync-from-local.sh` already encodes this. Do NOT widen it to private data even if asked for "everything" — this is a public npm package.

## Procedure

1. **Preconditions.** Run `npm whoami` (must print `antonior`) and `gh auth status` (must be logged in). If either fails, STOP and tell me.
2. **Clone fresh** into a temp dir: `gh repo clone RadosavAntonio/claude-code-setup <tmp>` (or `git pull` if already cloned). Work there.
3. **Sync.** Run `bash scripts/sync-from-local.sh`. It rebuilds `files/` as an exact mirror of my current allowlisted config.
4. **No-op guard.** `git add -A`, then `git diff --cached --quiet`. If it reports no changes, STOP and tell me "already in sync, nothing to publish." Do not bump or publish.
5. **Secret gate.** Run `/scan-secrets` over the staged files. If it flags anything, STOP and show me — do not publish.
6. **Bump.** `npm version patch --no-git-tag-version`.
7. **Commit + push.** Commit with a normal-English message summarising the diff (end with the `Co-Authored-By: Claude ...` line), push to `main`.
8. **Publish.** `npm publish --access public`.
9. **Verify + report.** Confirm `npm view @antonior/claude-code-setup version` equals the new version. Report what changed, the new version, and the install command for the other machine: `npx @antonior/claude-code-setup`.

## Notes

- The installer **overwrites** `CLAUDE.md` + `settings.json` (and everything else shipped) on the target, backing up any existing file to `<file>.bak` first, so the other machine ends up byte-identical. It does NOT delete unmanaged files already present on the target.
- `npx @antonior/claude-code-setup --config-only` lays down config without re-checking Homebrew deps / re-registering MCP servers — useful for a quick re-sync.
