const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');

function supervise(child, probe, state, intervalMs = 350) {
  let ended = false, probing = false;
  const started = Date.now();
  const timer = setInterval(async () => {
    if (ended || probing) return;
    probing = true;
    try {
      if (await probe()) {
        if (ended) return;
        ended = true; clearInterval(timer); state('ready', 'Server siap.'); child.unref();
      } else if (Date.now() - started > 85000) {
        ended = true; clearInterval(timer); state('failed', 'Server belum merespons. Periksa runtime/logs/launcher-server.log.'); child.unref();
      }
    } finally { probing = false; }
  }, intervalMs);
  function failed(message) { if (ended) return; ended = true; clearInterval(timer); state('failed', message); }
  child.once('error', () => failed('Proses server tidak dapat dijalankan. Periksa Node.js dan log launcher.'));
  child.once('exit', code => failed('Server berhenti saat startup (kode ' + code + '). Lihat penyebab lengkap di log startup. Periksa runtime/logs/launcher-server.log.'));
}

if (require.main === module) {
  const app = path.resolve(__dirname, '../..');
  const logs = path.join(app, 'runtime', 'logs');
  const statusFile = process.argv[2];
  fs.mkdirSync(logs, {recursive: true});
  const state = (value, message) => {
    if (statusFile) fs.writeFileSync(statusFile, JSON.stringify({state: value, message, at: new Date().toISOString()}));
  };
  state('starting', 'Menyalakan server.');
  const fd = fs.openSync(path.join(logs, 'launcher-server.log'), 'a');
  fs.writeSync(fd, '\n--- Startup ' + new Date().toISOString() + ' ---\n');
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: app, env: process.env, detached: true, windowsHide: true, stdio: ['ignore', fd, fd]
  });
  child.once('spawn', () => fs.closeSync(fd));
  child.once('error', () => { try { fs.closeSync(fd); } catch {} });
  supervise(child, async () => {
    try {
      const r = await fetch('http://127.0.0.1:' + (process.env.PORT || '3001') + '/api/health', {signal: AbortSignal.timeout(1000)});
      if (!r.ok) return false;
      const body = await r.json();
      return body.localTrial === true && body.service === 'Backend Logic Processor - Sistem Aplikasi Retur Gudang e-Commerce';
    } catch { return false; }
  }, state);
}
module.exports = {supervise};
