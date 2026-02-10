#!/usr/bin/env node
/**
 * Ensure the Excalidecks server is running (with version check).
 * Replaces the Step 0 bash block so the skill only needs `node <path>`.
 */
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PROJECT_DIR = path.resolve(__dirname, '..', '..', '..');
const DIST_INDEX = path.join(PROJECT_DIR, 'dist', 'index.js');
const PLUGIN_JSON = path.join(PROJECT_DIR, '.claude-plugin', 'plugin.json');
const EXCALIDECKS_DIR = path.join(require('os').homedir(), '.excalidecks');
const HEALTH_URL = 'http://localhost:41520/health';

// ── Helpers ────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getExpectedVersion() {
  try {
    return JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

function fetchHealth() {
  return new Promise((resolve) => {
    http.get(HEALTH_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function build() {
  console.log('Building server...');
  if (!fs.existsSync(path.join(PROJECT_DIR, 'node_modules'))) {
    execSync('npm ci', { cwd: PROJECT_DIR, stdio: 'inherit' });
  }
  execSync('npm run build', { cwd: PROJECT_DIR, stdio: 'inherit' });
}

function killPort() {
  try {
    const pids = execSync("lsof -ti:41520", { encoding: 'utf8' }).trim();
    if (pids) {
      for (const pid of pids.split('\n')) {
        try { process.kill(Number(pid)); } catch {}
      }
    }
  } catch {}
}

function startServer() {
  const child = spawn('node', [DIST_INDEX, '--canvas-only'], {
    cwd: PROJECT_DIR,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

async function waitForServer(maxSeconds = 15) {
  for (let i = 0; i < maxSeconds; i++) {
    const health = await fetchHealth();
    if (health) return health;
    await sleep(1000);
  }
  return null;
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  ensureDir(EXCALIDECKS_DIR);

  const expectedVersion = getExpectedVersion();
  let health = await fetchHealth();

  if (!health) {
    // Server not running — build if needed, then start
    if (!fs.existsSync(DIST_INDEX)) {
      build();
    }
    startServer();
    health = await waitForServer();
    if (!health) {
      console.log('ERROR: Server failed to start after 15s');
      process.exit(1);
    }
    console.log(`Server started (v${health.version || 'unknown'})`);
    return;
  }

  const runningVersion = health.version || 'unknown';

  // Version mismatch — rebuild and restart
  if (expectedVersion !== 'unknown' && runningVersion !== expectedVersion) {
    console.log(`Upgrading server: v${runningVersion} -> v${expectedVersion}`);
    killPort();
    await sleep(2000);
    build();
    startServer();
    health = await waitForServer();
    if (!health) {
      console.log('ERROR: Server failed to restart after upgrade');
      process.exit(1);
    }
    console.log(`Server upgraded to v${health.version || expectedVersion}`);
    return;
  }

  console.log(`Server running (v${runningVersion})`);
}

main();
