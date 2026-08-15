# claude-code-setup

[![npm](https://img.shields.io/npm/v/@antonior/claude-code-setup?color=cb3837&logo=npm)](https://www.npmjs.com/package/@antonior/claude-code-setup)
[![license](https://img.shields.io/npm/l/@antonior/claude-code-setup?color=blue)](./LICENSE)
[![platform](https://img.shields.io/badge/platform-macOS-black?logo=apple&logoColor=white)](#platforms)
[![tokens](https://img.shields.io/badge/optimised%20for-low%20token%20usage-brightgreen)](#optimised-for-low-token-usage)

One-command installer for my [Claude Code](https://claude.com/claude-code) configuration — hooks, slash commands, skills, statusline, and global rules. Install once, get the exact setup I use every day. **Optimised for low token usage.**

## Why this setup?

Stock Claude Code is powerful but neutral. This config turns it into a careful, cost-aware engineer with guardrails — the difference between an assistant that *sounds* confident and one that *proves* its work.

- **🛡️ Trustworthy by default.** Built-in rules forbid the things that quietly burn you: never fakes or weakens tests, never suppresses errors with `@ts-ignore` / `eslint-disable` / swallowed `catch`, never claims "done" without verifying. Failures get surfaced, not hidden.
- **🔒 Catches mistakes before they ship.** `scan-secrets` blocks any commit containing API keys or a real `.env`. `stop-verify` runs lint + typecheck on the files you changed at the end of every turn and won't let "done" slide if they fail. `check-dep` forces a real look at any new dependency (size, maintenance, lighter alternatives) before it's added.
- **🎯 Stays in scope.** Only changes what you asked for — no drive-by refactors, no unrequested "improvements", no comments bolted onto code it didn't touch.
- **🧠 Remembers across sessions.** The `transcript-search` MCP indexes your *own* past conversations locally, so Claude recalls prior decisions ("like we did last time") instead of saying "I don't remember" — and instead of you re-explaining context.
- **💸 Cheap on tokens.** Caveman mode keeps full technical accuracy while cutting chatter ~75%; video defaults to audio-only transcription; verification hooks touch only changed files, not the whole repo. See [Optimised for low token usage](#optimised-for-low-token-usage).
- **🎬 Understands video.** The `claude-video-vision` MCP lets Claude watch and reason about video, not just text.
- **📊 Knows where you stand.** A rich statusline shows git branch + dirty state, model and effort level, context-window %, and your 5-hour / 7-day rate-limit usage at a glance.
- **⚡ One-command, exact mirror.** Installs everything, auto-installs its dependencies, and registers the MCP servers. It reproduces my config **1:1** — existing files are overwritten so you get an identical setup, with any file it replaces backed up to `<file>.bak` first. It never deletes files it doesn't manage. Idempotent — re-run any time to pull the latest.

## Install

```sh
npx @antonior/claude-code-setup
```

That's it. The installer is idempotent — safe to re-run to pull updates.

## Platforms

Built and tested on **macOS**. Linux and native Windows aren't officially supported yet — the hooks are bash and the installer uses Homebrew, so a full cross-platform pass is needed before I'd claim them.

## Dependencies (auto-installed via Homebrew)

The installer installs these for you if missing:

| Tool | For | Notes |
|------|-----|-------|
| `jq` | hooks (JSON parsing) | **Required** — install aborts without it. |
| `python3` | `transcript-search` MCP + video-FPS hook | Best-effort — feature stays dormant if it can't install. |
| `ffmpeg` | `claude-video-vision` MCP | Best-effort. |
| `tmux` | optional `cr` tmux launch workflow (lives in shell config, not shipped) | Best-effort. |
| `git`, `eslint`, `tsc` | commit-scan / lint / typecheck hooks | Optional — hooks no-op cleanly when absent. |

## What it installs (into `~/.claude/`)

- **`CLAUDE.md`** — global rules (trust/integrity, scope discipline, verification). *Overwritten to match; any existing one is saved to `CLAUDE.md.bak`.*
- **`settings.json`** + **`settings.local.json`** — permissions, hooks, effort/theme. *Overwritten to match; any existing ones are saved to `.bak`.*
- **`hooks/`**
  - `caveman-activate.sh` — terse response style on session start
  - `scan-secrets.sh` — blocks `git commit` if staged diff contains secrets/`.env`
  - `check-dep.sh` — prompts to research a dependency before adding it
  - `eslint-fix.sh` — auto `eslint --fix` on edited JS/TS files
  - `stop-verify.sh` — lint + typecheck changed files when a turn ends
  - `notify-sound.sh` — sound on notification/stop
- **`commands/`** — `/check-dep`, `/scan-secrets`, `/updateClaudeNpm` slash commands
- **`skills/`** — `/mute`, `/unmute`, `/debug` (auto-invokes on recurring errors or guess-and-check, not just when typed), and `/caveman` (with intensity levels)
- **`agents/`** — custom subagents: `Explore` (fast read-only code search), `Plan` (architect/implementation plans), `statusline-setup` (statusline config)
- **`statusline.sh`** — git, model, context %, rate-limit statusline
- **`transcript-search/rag_lite.py`** — the transcript-search MCP engine
- **MCP servers** (registered via `claude mcp add-json`, user scope) — see below

## Bundled MCP servers

Both are installed and auto-registered for you:

- **`transcript-search`** — full-text search over your *own* past Claude Code transcripts ("we talked about…", "like last time"). Pure-Python, stdlib only. The index is built **locally on your machine** from `~/.claude/projects/` on first run — nothing about your conversations is ever shipped in this package.
- **`claude-video-vision`** — lets Claude watch/analyse videos (frames via `ffmpeg`). Published as [`claude-video-vision`](https://www.npmjs.com/package/claude-video-vision) on npm; run via `npx`.
  - **Tip:** when it asks how many FPS, answer **0** to use audio transcription only (no frame extraction) — much cheaper on tokens. Bump the FPS only when you actually need on-screen/visual detail.

## Optimised for low token usage

This setup is deliberately token-lean:

- **`/caveman` skill + caveman hook** — ultra-compressed replies that keep full technical accuracy while cutting chatter (~75% fewer tokens), with `lite`/`full`/`ultra` intensity levels.
- **Video → 0 FPS** — analyse video by audio transcription only unless you explicitly need visual frames, avoiding expensive frame tokens.
- **`transcript-search` over re-explaining** — recalls past decisions from your own history instead of re-deriving context.
- **Scoped, high-signal hooks** — `stop-verify` and `eslint-fix` only act on files you actually changed, not whole-repo sweeps.

## On a new machine — two one-time steps

The installer reproduces **100% of the configuration and behaviour**. Two things are *identity and secrets*, not config, and can never live in a public package — you set them once:

1. **Log into Claude Code** (your account — you'd do this on any new machine anyway).
2. **Give `claude-video-vision` your own API key** if you use video analysis.

## Shell workflow (optional, not shipped)

The package mirrors `~/.claude` only, so anything in your shell config (`~/.zshrc`) is **not** shipped. Add it per machine. These two bits drive how I launch Claude:

**Start Claude in bypass mode** (skips per-tool permission prompts). Note: `skipDangerousModePermissionPrompt` in `settings.json` only suppresses the warning; this alias is what actually starts a session in bypass mode:

```sh
alias claude="claude --dangerously-skip-permissions"
```

**`cr` — launch Claude inside a tmux session** (named after the current directory, or pass a name: `cr myname`):

```sh
cr() {
  local session="${1:-$(basename "$PWD")}"
  session="${session//[.:]/_}"   # tmux treats . and : as target separators
  if tmux has-session -t "$session" 2>/dev/null; then
    tmux attach-session -t "$session"
  else
    tmux new-session -s "$session" -d -c "$PWD"
    tmux send-keys -t "$session" "claude --dangerously-skip-permissions --remote-control '$session'" Enter
    tmux attach-session -t "$session"
  fi
}
```

`cr` needs `tmux`, which the installer now installs best effort (see the dependencies table). After editing `~/.zshrc`, run `source ~/.zshrc` or open a new terminal.

## Local/alternate model routing: `claude-lm`, `claude-or`, `claude-google` (optional, not shipped)

Not part of the installer — no secrets, keys, or router config are shipped; this needs a live local credential store per machine. Three extra launchers, alongside plain `claude`:

- **`claude-lm`** — routes through [LM Studio](https://lmstudio.ai) (local models, free, runs on your own hardware).
- **`claude-or`** — routes through [OpenRouter](https://openrouter.ai) (hosted models, incl. free tiers, but capped at 50 free-model requests/day on a free OpenRouter account — resets daily, or add credits for 1000/day).
- **`claude-google`** — routes through [Google AI Studio](https://aistudio.google.com) direct (Gemini), bypassing OpenRouter's shared free pool entirely — your own per-key quota instead.

Both go through [Claude Code Router](https://www.npmjs.com/package/@musistudio/claude-code-router) (CCR), a local proxy that lets Claude Code talk to non-Anthropic backends. **Plain `claude` is never touched by any of this** — different launcher script, different Claude Code config directory, zero shared state.

### 1. Install and start CCR + LM Studio

```sh
npm install -g @musistudio/claude-code-router
ccr serve --no-open          # starts the router on :3456

# LM Studio: download a model in the app, then:
lms server start              # serves LM Studio on :1234
```

Add LM Studio as a provider via CCR's own web UI (URL + token printed in its startup log, e.g. `http://127.0.0.1:3458/?ccr_web_token=...`). CCR strips the caller's own auth header on every proxied request and substitutes its own credential, so plain OAuth passthrough of a Claude subscription doesn't work automatically through it — sign in once through CCR's own "Browser session account login" if you also want Anthropic models reachable from inside these launchers.

**Known CCR bug:** any model id containing a literal `/` (e.g. `google/gemma-4-12b`, or basically every OpenRouter model) breaks CCR's own routing with `"Model selector conflicts with x-target-provider"` — confirmed by direct testing, not a config mistake. Workarounds below route around it.

### 2. `claude-lm` — LM Studio

CCR's LM Studio provider is configured with a single generic model alias (`"local"`, no slash) rather than real per-model names — LM Studio ignores the requested model string as long as *something* is loaded, so this one alias always routes to whatever you currently have loaded in LM Studio's own UI, regardless of which model that is.

```sh
#!/bin/sh
# ~/bin/claude-lm
exec ~/.claude-code-router/bin/ccr-claude-code-wrapper-default-claude-code --dangerously-skip-permissions "$@"
```

**LM Studio's context length matters.** Claude Code's own system prompt + every registered MCP tool schema is large (tens of KB — expect 25k+ tokens with a few MCP servers registered). If the model you load in LM Studio has too little context (its RAM guardrail may silently cap it below what you asked for), you'll get `"tokens to keep from the initial prompt is greater than the context length"`. Fix in LM Studio's own UI: manually choose load parameters and raise context length until it fits, watching for its resource-guardrail warning as the real ceiling for your hardware.

### 3. `claude-or` — OpenRouter

Because of the CCR slash bug above, OpenRouter needs a small local shim between CCR and the real API: CCR talks to the shim using a slash-free placeholder model name, the shim rewrites it to the real OpenRouter model id and forwards on with your real key — which never enters CCR's own config.

**`~/.claude-code-router/openrouter-shim.cjs`** (~70 lines, plain Node, no deps) reads two tiny local files on every request:

| File | Contents | Perms |
|---|---|---|
| `~/.claude-code-router/openrouter.key` | your OpenRouter API key, nothing else | `chmod 600` |
| `~/.claude-code-router/openrouter.model` | the model id to use by default, e.g. `poolside/laguna-s-2.1:free` | `chmod 600` |

**To set your key:** `echo -n "sk-or-v1-..." > ~/.claude-code-router/openrouter.key && chmod 600 ~/.claude-code-router/openrouter.key`

**To change the default model:** `echo -n "vendor/model-id:free" > ~/.claude-code-router/openrouter.model` — takes effect on the next request, no restart needed. Browse free models at [openrouter.ai/models?max_price=0](https://openrouter.ai/models?max_price=0). Free-tier models sit on OpenRouter's shared rate-limit pool and 429 intermittently under load — that's normal, not a bug; Claude Code retries automatically, or add your own provider key at [openrouter.ai/settings/integrations](https://openrouter.ai/settings/integrations) to get a dedicated quota.

```sh
#!/bin/sh
# ~/bin/claude-or
if [ ! -s ~/.claude-code-router/openrouter.key ]; then
  echo "No OpenRouter API key set. Put it in ~/.claude-code-router/openrouter.key (chmod 600) first." >&2
  exit 1
fi
if ! curl -s -o /dev/null -m 2 http://127.0.0.1:3491/health 2>/dev/null; then
  nohup node ~/.claude-code-router/openrouter-shim.cjs >> ~/.claude-code-router/openrouter-shim.log 2>&1 &
  disown
  sleep 1
fi
exec ~/.claude-code-router/bin/ccr-claude-code-wrapper-openrouter --dangerously-skip-permissions "$@"
```

### 4. `claude-google` — Google AI Studio (Gemini) direct

No CCR slash bug here — Gemini model ids (`gemini-3.7-flash`, etc.) have no `/`. Still uses the same small local shim pattern, purely to keep the real key out of CCR's own config: CCR talks to `google-shim.cjs`, which forwards to Google's OpenAI-compatible endpoint (`generativelanguage.googleapis.com/v1beta/openai/...`) with your real key.

| File | Contents | Perms |
|---|---|---|
| `~/.claude-code-router/google.key` | your Google AI Studio API key, nothing else | `chmod 600` |
| `~/.claude-code-router/google.model` | the model id to use by default, e.g. `gemini-3.7-flash` | `chmod 600` |

**To set your key:** `echo -n "AQ...." > ~/.claude-code-router/google.key && chmod 600 ~/.claude-code-router/google.key` — get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

**To change the default model:** `echo -n "gemini-x.y-flash" > ~/.claude-code-router/google.model` — takes effect on the next request, no restart needed. List what your key can actually use with `curl "https://generativelanguage.googleapis.com/v1beta/models?key=$(cat ~/.claude-code-router/google.key)"` — older model ids get deprecated over time and 404 for new keys.

```sh
#!/bin/sh
# ~/bin/claude-google
if [ ! -s ~/.claude-code-router/google.key ]; then
  echo "No Google API key set. Put it in ~/.claude-code-router/google.key (chmod 600) first." >&2
  exit 1
fi
if ! curl -s -o /dev/null -m 2 http://127.0.0.1:3492/health 2>/dev/null; then
  nohup node ~/.claude-code-router/google-shim.cjs >> ~/.claude-code-router/google-shim.log 2>&1 &
  disown
  sleep 1
fi
exec ~/.claude-code-router/bin/ccr-claude-code-wrapper-google --dangerously-skip-permissions "$@"
```

### 5. Keep each launcher's default model separate

`claude-lm`, `claude-or`, and `claude-google` each need their **own** Claude Code config directory — CCR's wrapper scripts pin a config dir via `CLAUDE_CONFIG_DIR`, and if two launchers point at the same one, picking a model in either overwrites the other's default too (they share one `settings.json`). Duplicate the CCR-generated wrapper per launcher, changing only that path, e.g.:

```sh
sed 's|profiles/default-claude-code/claude|profiles/openrouter-claude-code/claude|' \
  ~/.claude-code-router/bin/ccr-claude-code-wrapper-default-claude-code \
  > ~/.claude-code-router/bin/ccr-claude-code-wrapper-openrouter
```

Each config dir's `settings.json` can then pin its own default `"model"` — CCR's gateway-discovery model ids are `anthropic/claude-ccr-h<hex-of-"ProviderName/modelId">` (plain hex, no salt), so e.g. `"LM Studio/local"`, `"OpenRouter/or-default"`, and `"Google/gm-default"` encode deterministically and can be set directly without picking via `/model` first.

**Bypass permissions** (`--dangerously-skip-permissions`, same as the `claude` alias below) is baked directly into all three launcher scripts above, since shell aliases don't apply inside another script's `exec`.

Plain `claude` is always 100% Anthropic, unaffected by any of this.

## Maintaining (for me)

The package is an exact mirror of my own `~/.claude`. To refresh it from my live config and publish:

- `scripts/sync-from-local.sh` rebuilds `files/` from an allowlist of my config (`CLAUDE.md`, `settings*.json`, `statusline.sh`, `hooks/`, `commands/`, `agents/`, `skills/`, the caveman skill, the transcript-search engine). It never copies private or runtime data (history, transcripts, memory, the search index, sessions, caches, marketplace clones).
- The `/updateClaudeNpm` slash command runs that sync, scans for secrets, bumps the version, pushes to `main`, and publishes to npm — so a fresh `npx @antonior/claude-code-setup` on another machine reproduces my setup 1:1.

## License

[MIT](./LICENSE) © Antonio Radosav

---

<p align="center">Made with ❤️ in the UK</p>
