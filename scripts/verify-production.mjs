const webUrl = (process.env.WEB_URL ?? 'https://cut-g-web.vercel.app').replace(/\/$/, '');
const apiUrl = process.env.API_URL?.replace(/\/$/, '');
const clientEmail = process.env.PRODUCTION_CLIENT_EMAIL ?? 'client.test@example.com';
const barberEmail = process.env.PRODUCTION_BARBER_EMAIL ?? 'barber.test@example.com';
const testPassword = process.env.PRODUCTION_TEST_PASSWORD ?? 'password123';

const report = (name, status) =>
  process.stdout.write(`${status === 'pass' ? 'PASS' : 'FAIL'} ${name}\n`);

const request = async (name, url, init = {}, expectedStatus = 200) => {
  let response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    throw new Error(
      `${name} could not be reached: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (response.status !== expectedStatus) {
    const body = await response.text();
    throw new Error(`${name} returned ${response.status}: ${body.slice(0, 300)}`);
  }
  report(name, 'pass');
  return response;
};

const cookiesFrom = (response) => {
  const values =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean);
  return values.map((value) => value.split(';', 1)[0]).join('; ');
};

const login = async (role, email) => {
  const response = await request(`${role.toLowerCase()} seed login`, `${webUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: testPassword, expectedUserType: role }),
  });
  const cookies = cookiesFrom(response);
  if (!cookies.includes('barber_access=') || !cookies.includes('barber_refresh=')) {
    throw new Error(`${role.toLowerCase()} login did not set the session cookies.`);
  }
  return cookies;
};

const run = async () => {
  await request('web home', `${webUrl}/`);
  await request('web-to-api health', `${webUrl}/api/backend/health`);
  if (apiUrl !== undefined) await request('direct API health', `${apiUrl}/health`);

  const discovery = await request(
    'barber discovery',
    `${webUrl}/api/backend/barbers?limit=1&verified=true`,
  );
  const discoveryBody = await discovery.json();
  if (!Array.isArray(discoveryBody.barbers) || discoveryBody.barbers.length === 0) {
    throw new Error('Barber discovery returned no seeded verified barber.');
  }

  const clientCookies = await login('CLIENT', clientEmail);
  await request('client profile', `${webUrl}/api/backend/clients/me`, {
    headers: { Cookie: clientCookies },
  });
  await request('client appointments', `${webUrl}/api/backend/clients/me/appointments`, {
    headers: { Cookie: clientCookies },
  });
  await request(
    'hair studio configuration',
    `${webUrl}/api/backend/clients/me/hair-studio/config`,
    {
      headers: { Cookie: clientCookies },
    },
  );

  const barberCookies = await login('BARBER', barberEmail);
  await request('barber profile', `${webUrl}/api/backend/barbers/me`, {
    headers: { Cookie: barberCookies },
  });
  await request('barber appointments', `${webUrl}/api/backend/barbers/me/appointments`, {
    headers: { Cookie: barberCookies },
  });

  process.stdout.write('Production smoke test completed successfully.\n');
};

run().catch((error) => {
  report('production smoke test', 'fail');
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
