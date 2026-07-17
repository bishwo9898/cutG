import { createHash, randomUUID } from 'node:crypto';

const apiUrl = process.env.API_BASE_URL ?? 'http://localhost:4000';
const email = process.env.HAIR_STUDIO_TEST_EMAIL ?? 'client.test@example.com';
const password = process.env.HAIR_STUDIO_TEST_PASSWORD ?? 'password123';

const request = async (path, init = {}, token) => {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status}): ${body.message}`);
  }
  return body;
};

const waitFor = async (read, terminal, label) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const value = await read();
    if (terminal(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} did not reach a terminal state.`);
};

const login = await request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
const token = login.accessToken;
const scan = await request(
  '/clients/me/hair-scans',
  {
    method: 'POST',
    body: JSON.stringify({
      consentAccepted: true,
      ageConfirmed: true,
      consentVersion: 'acceptance-v1',
    }),
  },
  token,
);

for (const [index, angle] of ['FRONT', 'LEFT', 'RIGHT'].entries()) {
  const image = Buffer.alloc(20_000, index + 20);
  image[0] = 0xff;
  image[1] = 0xd8;
  image[image.length - 2] = 0xff;
  image[image.length - 1] = 0xd9;
  const checksumSha256 = createHash('sha256').update(image).digest('hex');
  const signed = await request(
    `/clients/me/hair-scans/${scan.id}/captures/presign`,
    {
      method: 'POST',
      body: JSON.stringify({
        angle,
        mimeType: 'image/jpeg',
        sizeBytes: image.length,
        checksumSha256,
      }),
    },
    token,
  );
  const upload = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: signed.headers,
    body: image,
  });
  if (!upload.ok) throw new Error(`${angle} direct upload failed (${upload.status}).`);
  await request(
    `/clients/me/hair-scans/${scan.id}/captures/${signed.captureId}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({
        width: 900,
        height: 1200,
        brightness: 110,
        sharpness: 12,
        faceCount: 1,
        poseScore: 0.95,
      }),
    },
    token,
  );
}

await request(
  `/clients/me/hair-scans/${scan.id}/complete`,
  {
    method: 'POST',
    body: JSON.stringify({
      preferences: {
        desiredLength: 'short',
        maintenance: 'low',
        texture: 'natural',
        fadePreference: 'low',
        overallStyle: 'clean',
      },
    }),
  },
  token,
);
const analyzed = await waitFor(
  () => request(`/clients/me/hair-scans/${scan.id}`, {}, token),
  (value) => ['COMPLETED', 'FAILED'].includes(value.analysisStatus),
  'Scan analysis',
);
if (analyzed.analysisStatus !== 'COMPLETED' || analyzed.suggestions.length !== 3) {
  throw new Error(`Scan analysis failed: ${analyzed.analysisError ?? 'invalid suggestions'}`);
}

const style = analyzed.suggestions[0];
const design = await request(
  '/clients/me/designs/generate',
  {
    method: 'POST',
    body: JSON.stringify({
      scanId: scan.id,
      styleName: style.name,
      styleCategory: style.category,
      description: style.description,
      idempotencyKey: randomUUID(),
    }),
  },
  token,
);
const generated = await waitFor(
  () => request(`/clients/me/designs/${design.id}`, {}, token),
  (value) => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(value.generationStatus),
  'Image generation',
);
if (generated.generationStatus !== 'COMPLETED' || generated.generatedPreviewUrl === null) {
  throw new Error(`Generation failed: ${generated.errorMessage ?? generated.generationStatus}`);
}
const preview = await fetch(generated.generatedPreviewUrl);
if (!preview.ok || (await preview.arrayBuffer()).byteLength !== 20_000) {
  throw new Error('The authorized generated preview could not be read from private storage.');
}
await request(`/clients/me/designs/${design.id}`, { method: 'DELETE' }, token);

console.info(
  JSON.stringify({
    status: 'ok',
    provider: generated.provider,
    anglesUploaded: 3,
    suggestions: analyzed.suggestions.length,
    privatePreviewVerified: true,
    deleted: true,
  }),
);
