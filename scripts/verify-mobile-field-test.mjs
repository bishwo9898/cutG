const apiUrl = (process.env.API_BASE_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');

const request = async (path, { token, method = 'GET', body } = {}) => {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `${method} ${path} returned ${response.status}: ${String(payload.message ?? payload.error ?? 'unknown error')}`,
    );
  }
  return payload;
};

const login = async (email) =>
  request('/auth/login', {
    method: 'POST',
    body: { email, password: 'password123' },
  });

const client = await login('client.test@example.com');
const barber = await login('barber.test@example.com');
if (client.user?.userType !== 'CLIENT' || barber.user?.userType !== 'BARBER') {
  throw new Error('The seeded accounts returned the wrong roles.');
}

const barberProfile = await request('/barbers/me', { token: barber.accessToken });
if (
  typeof barberProfile.id !== 'string' ||
  typeof barberProfile.address !== 'string' ||
  typeof barberProfile.latitude !== 'number' ||
  typeof barberProfile.longitude !== 'number'
) {
  throw new Error('The seeded barber does not have a complete shop location.');
}
const shopSearch = await request('/barbers/me/shop-location/search', {
  token: barber.accessToken,
  method: 'POST',
  body: {
    query: `${barberProfile.businessName}, ${barberProfile.address}`,
    latitude: barberProfile.latitude,
    longitude: barberProfile.longitude,
  },
});
if (
  !Array.isArray(shopSearch.suggestions) ||
  shopSearch.suggestions.length === 0 ||
  typeof shopSearch.suggestions[0]?.formattedAddress !== 'string'
) {
  throw new Error('Shop name/address search did not return a usable map suggestion.');
}
const publicBarber = await request(`/barbers/${barberProfile.id}`);
if (
  publicBarber.shopLocation?.address !== barberProfile.address ||
  publicBarber.shopLocation?.latitude !== barberProfile.latitude ||
  publicBarber.shopLocation?.longitude !== barberProfile.longitude
) {
  throw new Error('The saved shop location was not exposed on the public barber profile.');
}

const appointments = await request('/barbers/me/appointments?limit=50', {
  token: barber.accessToken,
});
const appointment = appointments.appointments?.find(
  (candidate) => candidate.isMobileService === true && candidate.status === 'CONFIRMED',
);
if (appointment === undefined) {
  throw new Error(
    'No confirmed seeded mobile appointment was found. Run pnpm field-test:prepare first.',
  );
}

const appointmentPath = `/barbers/me/appointments/${appointment.id}`;
await request(`${appointmentPath}/status`, {
  token: barber.accessToken,
  method: 'PATCH',
  body: { status: 'ON_THE_WAY' },
});
await request(`${appointmentPath}/location`, {
  token: barber.accessToken,
  method: 'POST',
  body: {
    latitude: 37.6467,
    longitude: -84.7729,
    accuracyMeters: 5,
    headingDegrees: 180,
    speedMs: 4,
  },
});

const liveLocation = await request(`/clients/me/appointments/${appointment.id}/barber-location`, {
  token: client.accessToken,
});
if (
  liveLocation.isTracking !== true ||
  liveLocation.lastPing?.latitude !== 37.6467 ||
  typeof liveLocation.estimatedArrivalMinutes !== 'number' ||
  typeof liveLocation.distanceRemainingMiles !== 'number'
) {
  throw new Error('The client did not receive the expected live barber location and travel data.');
}

await request(`${appointmentPath}/status`, {
  token: barber.accessToken,
  method: 'PATCH',
  body: { status: 'ARRIVED' },
});
const arrivedTimeline = await request(`/clients/me/appointments/${appointment.id}/status-updates`, {
  token: client.accessToken,
});
if (arrivedTimeline.currentStatus !== 'ARRIVED' || arrivedTimeline.arrivedAt === null) {
  throw new Error('The client timeline did not receive the barber arrival.');
}

await request(`${appointmentPath}/status`, {
  token: barber.accessToken,
  method: 'PATCH',
  body: { status: 'IN_PROGRESS' },
});
await request(`${appointmentPath}/status`, {
  token: barber.accessToken,
  method: 'PATCH',
  body: { status: 'COMPLETED' },
});

const completedTimeline = await request(
  `/clients/me/appointments/${appointment.id}/status-updates`,
  { token: client.accessToken },
);
if (completedTimeline.currentStatus !== 'COMPLETED') {
  throw new Error('The client timeline did not reach completion.');
}

const rejectedPing = await fetch(`${apiUrl}${appointmentPath}/location`, {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    Authorization: `Bearer ${barber.accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ latitude: 37.6454, longitude: -84.7739 }),
  signal: AbortSignal.timeout(15_000),
});
if (rejectedPing.status !== 400) {
  throw new Error(`Location remained active after completion (received ${rejectedPing.status}).`);
}

console.log(
  [
    'Mobile barber field-test smoke check passed.',
    `Appointment: ${appointment.id}`,
    `Client received: ${liveLocation.distanceRemainingMiles.toFixed(2)} miles / ${liveLocation.estimatedArrivalMinutes} minutes`,
    'Verified: shop search, public shop map data, journey, GPS ping, client tracking, arrival, service, completion, tracking stop.',
  ].join('\n'),
);
