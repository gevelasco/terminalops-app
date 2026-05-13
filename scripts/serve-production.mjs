/**
 * Sirve el build de Angular en producción (Railway, Docker, etc.).
 * Respeta `PORT` (Railway lo inyecta) y enlaza en todas las interfaces.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'dist', 'terminalops-app', 'browser');
const port = process.env.PORT ?? '3000';
const serveCli = path.join(__dirname, '..', 'node_modules', 'serve', 'build', 'main.js');

const child = spawn(process.execPath, [serveCli, '-s', root, '-l', `tcp://0.0.0.0:${port}`], {
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
