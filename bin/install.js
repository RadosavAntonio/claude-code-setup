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

function checkJq() {
  const r = spawnSync('which', ['jq'], { encoding: 'utf8' });
  return r.status === 0;
}

function installJq() {
  const hasBrew = spawnSync('which', ['brew'], { encoding: 'utf8' }).status === 0;
  if (!hasBrew) {
    fail('jq not found and Homebrew not installed.');
    console.log(c.yellow('  Install jq manually: https://stedolan.github.io/jq/download/'));
    return false;
  }
  console.log(c.yellow('  Installing jq via Homebrew...'));
  const r = spawnSync('brew', ['install', 'jq'], { stdio: 'inherit' });
  if (r.status !== 0) {
    fail('brew install jq failed. Install manually.');
    return false;
  }
  ok('jq installed');
  return true;
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

  // 1. Check jq
  if (!checkJq()) {
    warn('jq not found — required by hooks');
    const ok2 = installJq();
    if (!ok2) process.exit(1);
  } else {
    ok('jq present');
  }

  // 2. Ensure dirs
  ensureDir(CLAUDE_DIR);
  ensureDir(path.join(CLAUDE_DIR, 'hooks'));
  ensureDir(path.join(CLAUDE_DIR, 'skills'));
  ensureDir(path.join(CLAUDE_DIR, 'commands'));

  // 3. Hooks
  const hooks = ['caveman-activate.sh', 'check-dep.sh', 'eslint-fix.sh', 'notify-sound.sh', 'scan-secrets.sh', 'stop-verify.sh'];
  for (const h of hooks) {
    const dest = path.join(CLAUDE_DIR, 'hooks', h);
    copyFile(path.join(FILES_DIR, 'hooks', h), dest);
    makeExecutable(dest);
  }

  // 4. Skills
  for (const s of ['mute.md', 'unmute.md']) {
    copyFile(path.join(FILES_DIR, 'skills', s), path.join(CLAUDE_DIR, 'skills', s), { skipIfExists: true });
  }

  // 4b. Commands (slash commands referenced by CLAUDE.md)
  for (const cmd of ['check-dep.md', 'debug.md', 'scan-secrets.md']) {
    copyFile(path.join(FILES_DIR, 'commands', cmd), path.join(CLAUDE_DIR, 'commands', cmd), { skipIfExists: true });
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

  console.log(c.bold(c.green('\nDone. Restart Claude Code to apply.\n')));
}

main();
