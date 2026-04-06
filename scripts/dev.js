const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

// Read config
let config = { ports: { devServer: 5173 } };
try {
  const configData = fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8');
  config = JSON.parse(configData);
} catch (e) {
  console.warn('Could not read config.json, using default port 5173');
}

const port = config.ports?.devServer || 5173;

// We need to run: concurrently --kill-others "vite --port PORT" "wait-on tcp:PORT && cross-env NODE_ENV=development electron ."
// Since we are already in node, we can just use concurrently's API or just spawn it.
// Spawning concurrently is easier.

const concurrently = path.join(__dirname, '..', 'node_modules', '.bin', 'concurrently.cmd');
const vite = path.join(__dirname, '..', 'node_modules', '.bin', 'vite.cmd');
const waitOn = path.join(__dirname, '..', 'node_modules', '.bin', 'wait-on.cmd');
const crossEnv = path.join(__dirname, '..', 'node_modules', '.bin', 'cross-env.cmd');
const electron = path.join(__dirname, '..', 'node_modules', '.bin', 'electron.cmd');

const cmd = `concurrently --kill-others "vite --port ${port}" "wait-on tcp:${port} && cross-env NODE_ENV=development electron ."`;

console.log(`Starting dev server on port ${port}...`);

const child = spawn('cmd.exe', ['/c', cmd], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code);
});
