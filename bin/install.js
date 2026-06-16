#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const FILES_DIR = path.join(__dirname, '..', 'files');

// --config-only: just mirror the config files; skip Homebrew deps + MCP
// registration (useful for a quick re-sync on an already-set-up machine).
const CONFIG_ONLY = process.argv.includes('--config-only');

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function log(symbol, msg) { console.log(`${symbol} ${msg}`); }
function ok(msg) { log(c.green('✓'), msg); }
function warn(msg) { log(c.yellow('⚠'), msg); }
function info(msg) { log(c.dim('·'), msg); }
function fail(msg) { log(c.red('✗'), msg); }

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Is a command resolvable on PATH? (uses `command -v` via a shell so it sees
// the same PATH the user's tools do, not just the bare which builtin.)
function have(cmd) {
  return spawnSync('bash', ['-lc', `command -v ${cmd}`], { encoding: 'utf8' }).status === 0;
}

function hasBrew() {
  return have('brew');
}

// Install a Homebrew formula. `required:true` → return false on failure so the
// caller can abort; `required:false` → best-effort, warn and continue (the
// related feature just stays dormant until the user installs it).
function brewInstall(pkg, { required = false } = {}) {
  if (have(pkg)) { ok(`${pkg} present`); return true; }
  if (!hasBrew()) {
    const m = `${pkg} not found and Homebrew not installed.`;
    if (required) { fail(m); console.log(c.yellow(`  Install Homebrew (https://brew.sh) then re-run, or install ${pkg} manually.`)); return false; }
    warn(`${m} Skipping — install it later for the related feature.`);
    return false;
  }
  console.log(c.yellow(`  Installing ${pkg} via Homebrew...`));
  const r = spawnSync('brew', ['install', pkg], { stdio: 'inherit' });
  if (r.status !== 0) {
    if (required) { fail(`brew install ${pkg} failed. Install manually.`); return false; }
    warn(`brew install ${pkg} failed — continuing without it.`);
    return false;
  }
  ok(`${pkg} installed`);
  return true;
}

// Recursively list files under `dir`, returned as paths relative to it.
function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full));
  }
  return out;
}

function sameContent(a, b) {
  try { return fs.readFileSync(a).equals(fs.readFileSync(b)); } catch (_) { return false; }
}

// Lay one shipped file down at the mirrored path under ~/.claude. Overwrites to
// guarantee parity, but backs up any differing existing file to <file>.bak
// first (reversible). Unchanged files are left alone. *.sh become executable.
function installFile(rel) {
  const src = path.join(FILES_DIR, rel);
  const dest = path.join(CLAUDE_DIR, rel);
  ensureDir(path.dirname(dest));
  if (fs.existsSync(dest)) {
    if (sameContent(src, dest)) {
      info(`Unchanged: ${rel}`);
    } else {
      fs.copyFileSync(dest, dest + '.bak');
      fs.copyFileSync(src, dest);
      ok(`Updated (backup → ${rel}.bak): ${rel}`);
    }
  } else {
    fs.copyFileSync(src, dest);
    ok(`Installed: ${rel}`);
  }
  if (rel.endsWith('.sh')) fs.chmodSync(dest, '755');
}

// Register the MCP servers via the official `claude` CLI (writes to user scope,
// the same place they already live). Idempotent: skip any server already
// registered. SECURITY: env is always {} — never serialize the user's real
// environment or read ~/.claude.json (it holds the OAuth token).
function registerMcpServers() {
  if (!have('claude')) {
    warn('`claude` CLI not on PATH — skipping MCP registration.');
    info('  After installing Claude Code, register them manually:');
    info(`    claude mcp add-json transcript-search '{"type":"stdio","command":"python3","args":["${path.join(CLAUDE_DIR, 'transcript-search', 'rag_lite.py')}","serve"],"env":{}}' --scope user`);
    info("    claude mcp add claude-video-vision --scope user -- npx claude-video-vision");
    return;
  }
  const existing = spawnSync('bash', ['-lc', 'claude mcp list'], { encoding: 'utf8', timeout: 60000 }).stdout || '';
  const servers = [
    {
      name: 'transcript-search',
      json: JSON.stringify({
        type: 'stdio',
        command: 'python3',
        args: [path.join(CLAUDE_DIR, 'transcript-search', 'rag_lite.py'), 'serve'],
        env: {},
      }),
    },
    {
      name: 'claude-video-vision',
      json: JSON.stringify({
        type: 'stdio',
        command: 'npx',
        args: ['claude-video-vision'],
        env: {},
      }),
    },
  ];
  for (const s of servers) {
    if (existing.includes(s.name)) { info(`MCP ${s.name} already registered — skipped`); continue; }
    const r = spawnSync('claude', ['mcp', 'add-json', s.name, s.json, '--scope', 'user'], { encoding: 'utf8', timeout: 60000 });
    if (r.status === 0) ok(`MCP ${s.name} registered`);
    else warn(`MCP ${s.name} registration failed: ${(r.stderr || '').trim() || 'unknown error'}`);
  }
}

function main() {
  console.log(c.bold('\nclaude-code-setup — installing Antonio\'s Claude config\n'));

  // 1. Dependencies
  //    jq is required (hooks parse JSON with it). python3 powers the
  //    transcript-search MCP server; ffmpeg powers claude-video-vision —
  //    both best-effort (feature stays dormant if absent).
  if (!CONFIG_ONLY) {
    console.log(c.bold('Dependencies:'));
    if (!brewInstall('jq', { required: true })) process.exit(1);
    brewInstall('python3');
    brewInstall('ffmpeg');
    brewInstall('tmux');
  }

  // 2. Mirror every shipped config file into ~/.claude at the same relative
  //    path. The package's files/ tree IS the source of truth — whatever is in
  //    it lands, so new hooks/commands/agents/skills need no code changes here.
  ensureDir(CLAUDE_DIR);
  console.log(c.bold('\nMirroring config into ~/.claude:'));
  for (const rel of walk(FILES_DIR)) installFile(rel);

  // 3. MCP servers (transcript-search + claude-video-vision)
  if (!CONFIG_ONLY) {
    console.log(c.bold('\nMCP servers:'));
    registerMcpServers();
  }

  console.log(c.bold(c.green('\nDone. Restart Claude Code to apply.')));
  console.log(c.dim('Overwrites are backed up to <file>.bak. Unmanaged files already in ~/.claude are left untouched.'));
  if (!CONFIG_ONLY) {
    console.log(c.dim('Two one-time steps on a new machine (identity, not config — they can\'t ship):'));
    console.log(c.dim('  1. Log into Claude Code.'));
    console.log(c.dim('  2. For video analysis, give claude-video-vision your own API key.\n'));
  }
}

main();
