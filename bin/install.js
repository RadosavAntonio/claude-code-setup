#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const os = require('os');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const FILES_DIR = path.join(__dirname, '..', 'files');

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
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    ok(`Created ${dir}`);
  }
}

function copyFile(src, dest, opts = {}) {
  const exists = fs.existsSync(dest);
  if (exists && opts.skipIfExists) {
    info(`Skipped (exists): ${dest}`);
    return;
  }
  fs.copyFileSync(src, dest);
  ok(`Copied → ${dest}`);
}

function makeExecutable(filePath) {
  fs.chmodSync(filePath, '755');
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

function mergeSettings(existingPath, incomingPath) {
  const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
  const incoming = JSON.parse(fs.readFileSync(incomingPath, 'utf8'));

  // Deep merge: scalars from incoming win, arrays are union-merged by value
  function mergeArrays(a, b) {
    const seen = new Set(a.map((x) => JSON.stringify(x)));
    const result = [...a];
    for (const item of b) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
    return result;
  }

  function deepMerge(base, override) {
    const out = { ...base };
    for (const [k, v] of Object.entries(override)) {
      if (Array.isArray(v) && Array.isArray(base[k])) {
        out[k] = mergeArrays(base[k], v);
      } else if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
        out[k] = deepMerge(base[k], v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  return deepMerge(existing, incoming);
}

function main() {
  console.log(c.bold('\nclaude-code-setup — installing Antonio\'s Claude config\n'));

  // 1. Dependencies
  //    jq is required (hooks parse JSON with it). python3 powers the
  //    transcript-search MCP server; ffmpeg powers claude-video-vision —
  //    both best-effort (feature stays dormant if absent).
  console.log(c.bold('Dependencies:'));
  if (!brewInstall('jq', { required: true })) process.exit(1);
  brewInstall('python3');
  brewInstall('ffmpeg');

  // 2. Ensure dirs
  ensureDir(CLAUDE_DIR);
  ensureDir(path.join(CLAUDE_DIR, 'hooks'));
  ensureDir(path.join(CLAUDE_DIR, 'skills'));
  ensureDir(path.join(CLAUDE_DIR, 'skills', 'caveman'));
  ensureDir(path.join(CLAUDE_DIR, 'commands'));
  ensureDir(path.join(CLAUDE_DIR, 'agents'));
  ensureDir(path.join(CLAUDE_DIR, 'transcript-search'));

  // 3. Hooks
  const hooks = ['caveman-activate.sh', 'check-dep.sh', 'eslint-fix.sh', 'notify-sound.sh', 'scan-secrets.sh', 'stop-verify.sh'];
  for (const h of hooks) {
    const dest = path.join(CLAUDE_DIR, 'hooks', h);
    copyFile(path.join(FILES_DIR, 'hooks', h), dest);
    makeExecutable(dest);
  }

  // 4. Skills (mute/unmute + the caveman /caveman skill with intensity levels)
  for (const s of ['mute.md', 'unmute.md']) {
    copyFile(path.join(FILES_DIR, 'skills', s), path.join(CLAUDE_DIR, 'skills', s), { skipIfExists: true });
  }
  copyFile(path.join(FILES_DIR, 'skills', 'caveman', 'SKILL.md'), path.join(CLAUDE_DIR, 'skills', 'caveman', 'SKILL.md'), { skipIfExists: true });

  // 4b. Commands (slash commands referenced by CLAUDE.md)
  for (const cmd of ['check-dep.md', 'debug.md', 'scan-secrets.md']) {
    copyFile(path.join(FILES_DIR, 'commands', cmd), path.join(CLAUDE_DIR, 'commands', cmd), { skipIfExists: true });
  }

  // 4c. transcript-search engine (the MCP server script — index.db is built
  //     per-user from their own ~/.claude/projects and is never shipped)
  copyFile(path.join(FILES_DIR, 'transcript-search', 'rag_lite.py'), path.join(CLAUDE_DIR, 'transcript-search', 'rag_lite.py'));

  // 4d. Agents (custom subagent definitions: Explore, Plan, statusline-setup).
  //     Overwritten on re-run so updates propagate, same as hooks/statusline.
  for (const a of ['Explore.md', 'Plan.md', 'statusline-setup.md']) {
    copyFile(path.join(FILES_DIR, 'agents', a), path.join(CLAUDE_DIR, 'agents', a));
  }

  // 5. Statusline
  const statuslineDest = path.join(CLAUDE_DIR, 'statusline.sh');
  copyFile(path.join(FILES_DIR, 'statusline.sh'), statuslineDest);
  makeExecutable(statuslineDest);

  // 6. CLAUDE.md
  const claudeMdDest = path.join(CLAUDE_DIR, 'CLAUDE.md');
  if (fs.existsSync(claudeMdDest)) {
    warn('CLAUDE.md already exists — skipped (edit manually if needed)');
    info(`  Your file: ${claudeMdDest}`);
    info(`  Reference: ${path.join(FILES_DIR, 'CLAUDE.md')}`);
  } else {
    copyFile(path.join(FILES_DIR, 'CLAUDE.md'), claudeMdDest);
  }

  // 7. settings.json — smart merge
  const settingsDest = path.join(CLAUDE_DIR, 'settings.json');
  if (fs.existsSync(settingsDest)) {
    info('Merging settings.json...');
    try {
      const merged = mergeSettings(settingsDest, path.join(FILES_DIR, 'settings.json'));
      fs.writeFileSync(settingsDest, JSON.stringify(merged, null, 2) + '\n');
      ok('settings.json merged');
    } catch (e) {
      fail(`settings.json merge failed: ${e.message}`);
      warn('Manual merge needed — reference file at: ' + path.join(FILES_DIR, 'settings.json'));
    }
  } else {
    copyFile(path.join(FILES_DIR, 'settings.json'), settingsDest);
  }

  // 8. MCP servers (transcript-search + claude-video-vision)
  console.log(c.bold('\nMCP servers:'));
  registerMcpServers();

  console.log(c.bold(c.green('\nDone. Restart Claude Code to apply.')));
  console.log(c.dim('Two one-time steps on a new machine (identity, not config — they can\'t ship):'));
  console.log(c.dim('  1. Log into Claude Code.'));
  console.log(c.dim('  2. For video analysis, give claude-video-vision your own API key.\n'));
}

main();
