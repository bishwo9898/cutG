const checks =
  process.env.CUTG_PREFLIGHT_SCOPE === 'field-test'
    ? [
        ['web', 'http://127.0.0.1:3000'],
        ['API', 'http://127.0.0.1:4000/health'],
      ]
    : [
        ['web', 'http://127.0.0.1:3000'],
        ['API', 'http://127.0.0.1:4000/health'],
        ['AI service', 'http://127.0.0.1:8000/health'],
      ];

const active = [];
for (const [name, url] of checks) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(900) });
    if (response.status < 500) active.push(`${name} (${url})`);
  } catch {
    // The endpoint is available for this new dev process.
  }
}

if (active.length > 0) {
  console.error(
    [
      'A cutG development stack is already running or only partially stopped:',
      ...active.map((entry) => `  - ${entry}`),
      '',
      'Return to the terminal that started it and press Ctrl+C once before running pnpm dev again.',
      'This guard prevents duplicate servers from fighting over ports and leaving partial stacks alive.',
    ].join('\n'),
  );
  process.exit(1);
}
