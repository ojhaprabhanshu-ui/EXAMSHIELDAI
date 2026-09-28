import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const services = [
  { name: 'ai-service', cwd: path.join(root, 'ai_service'), executable: 'python', command: ['server.py'], optional: true },
  { name: 'backend', cwd: path.join(root, 'backend'), executable: process.execPath, command: ['--watch', 'src/server.js'], requiresNodeModules: true },
  { name: 'frontend', cwd: path.join(root, 'frontend'), executable: process.execPath, command: ['node_modules/vite/bin/vite.js', '--open'], requiresNodeModules: true },
];

const missing = services.filter(({ cwd, requiresNodeModules }) => requiresNodeModules && !existsSync(path.join(cwd, 'node_modules')));
if (missing.length) {
  console.error(`Install dependencies first in: ${missing.map(({ name }) => name).join(', ')}`);
  console.error('Run npm install from each listed folder, then run npm run dev from the project root.');
  process.exit(1);
}

const children = services.map(({ name, cwd, command, executable, optional = false }) => {
  const child = spawn(executable, command, { cwd, stdio: 'inherit', env: process.env });
  child.on('error', (error) => {
    console.error(`[${name}] Could not start: ${error.message}`);
    if (optional) return;
    stopAll(1);
  });
  child.on('exit', (code) => {
    if (optional) {
      if (!shuttingDown) console.error(`[${name}] exited${code === null ? '' : ` with code ${code}`}; AI analysis endpoints will be unavailable.`);
      return;
    }
    if (!shuttingDown) {
      console.error(`[${name}] exited${code === null ? '' : ` with code ${code}`}; stopping the other service.`);
      stopAll(code || 1);
    }
  });
  return child;
});

let shuttingDown = false;
function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.pid && child.exitCode === null) {
      if (process.platform === 'win32') {
        try {
          execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' });
        } catch (e) {
          child.kill();
        }
      } else {
        child.kill('SIGTERM');
      }
    }
  }
  process.exitCode = exitCode;
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
