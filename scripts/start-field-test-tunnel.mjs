import { spawn } from 'node:child_process';

const localUrl = 'http://127.0.0.1:3000';
const timeoutAt = Date.now() + 120_000;

process.stdout.write('Waiting for the field-test web app');
while (Date.now() < timeoutAt) {
  try {
    const response = await fetch(localUrl, { signal: AbortSignal.timeout(1_500) });
    if (response.status < 500) break;
  } catch {
    // The web process is still starting.
  }
  process.stdout.write('.');
  await new Promise((resolve) => setTimeout(resolve, 750));
}
process.stdout.write('\n');

if (Date.now() >= timeoutAt) {
  console.error(`The field-test web app did not become ready at ${localUrl}.`);
  process.exit(1);
}

console.log(
  [
    'Starting a temporary HTTPS field-test tunnel.',
    'Share the https://*.trycloudflare.com URL printed below with the second tester.',
    'The URL exists only while this command is running. Press Ctrl+C to close it.',
    '',
  ].join('\n'),
);

const tunnel = spawn('pnpm', ['exec', 'wrangler', 'tunnel', 'quick-start', localUrl], {
  env: {
    ...process.env,
    WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH ?? '/tmp/cutg-wrangler-field-test.log',
  },
  stdio: 'inherit',
});

const stop = (signal) => {
  if (!tunnel.killed) tunnel.kill(signal);
};
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

tunnel.on('error', (error) => {
  console.error(
    `Unable to start the field-test tunnel: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
tunnel.on('exit', (code, signal) => {
  if (signal !== null) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
