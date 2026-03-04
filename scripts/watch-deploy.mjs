import chokidar from 'chokidar';
import { spawn } from 'node:child_process';

const WATCH_GLOBS = [
  'api/**/*.php',
  'frontend/src/**/*',
  'frontend/public/**/*',
  'deploy-root.htaccess',
  'prepare-deploy.sh',
  'package.json',
  'frontend/package.json'
];

let running = false;
let pending = false;

function runDeploy() {
  if (running) {
    pending = true;
    return;
  }
  running = true;
  pending = false;

  const p = spawn('bash', ['./prepare-deploy.sh'], { stdio: 'inherit' });
  p.on('exit', (code) => {
    running = false;
    if (pending) runDeploy();
    if (code !== 0) process.exitCode = code ?? 1;
  });
}

console.log('Watching for changes. Auto-running `bash ./prepare-deploy.sh`...');
runDeploy();

const watcher = chokidar.watch(WATCH_GLOBS, {
  ignoreInitial: true,
  ignored: [
    '**/node_modules/**',
    'deploy/**',
    '.git/**'
  ]
});

watcher.on('all', (_event, path) => {
  console.log(`Change detected: ${path}`);
  runDeploy();
});

process.on('SIGINT', async () => {
  await watcher.close();
  process.exit(0);
});
