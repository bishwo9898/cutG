import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const apiUrl = process.env.API_BASE_URL ?? 'http://localhost:4000';
const email = process.env.HAIR_STUDIO_TEST_EMAIL ?? 'client.test@example.com';
const password = process.env.HAIR_STUDIO_TEST_PASSWORD ?? 'password123';
const realProvider = process.env.HAIR_STUDIO_REAL_PROVIDER === '1';
const python = process.env.HAIR_STUDIO_PYTHON ?? resolve('services/ai/.venv/bin/python');
const requiredAngles = ['FRONT', 'LEFT', 'RIGHT'];
let stage = 'fixture-preparation';

const hash = (value) => createHash('sha256').update(value).digest('hex');

const loadFrame = async (path) => {
  const bytes = await readFile(path);
  return path.endsWith('.b64')
    ? Buffer.from(bytes.toString('ascii').replaceAll(/\s/g, ''), 'base64')
    : bytes;
};

const loadFrames = async () => {
  const front = await loadFrame(
    process.env.HAIR_STUDIO_TEST_FRONT ?? resolve('scripts/fixtures/hair-studio-front.jpg.b64'),
  );
  const leftPath =
    process.env.HAIR_STUDIO_TEST_LEFT ?? resolve('scripts/fixtures/hair-studio-left.jpg');
  const left = await loadFrame(leftPath);
  let right;
  if (process.env.HAIR_STUDIO_TEST_RIGHT !== undefined) {
    right = await loadFrame(process.env.HAIR_STUDIO_TEST_RIGHT);
  } else {
    const mirrored = spawnSync(
      python,
      [
        '-c',
        'from PIL import Image,ImageOps; import io,sys; image=Image.open(sys.argv[1]).convert("RGB"); output=io.BytesIO(); ImageOps.mirror(image).save(output,format="JPEG",quality=90); sys.stdout.buffer.write(output.getvalue())',
        leftPath,
      ],
      { encoding: 'buffer', maxBuffer: 5_000_000 },
    );
    if (mirrored.status !== 0 || mirrored.stdout.length === 0) {
      throw new Error('Could not create the deterministic right-view fixture with Pillow.');
    }
    right = mirrored.stdout;
  }
  return new Map([
    ['FRONT', front],
    ['LEFT', left],
    ['RIGHT', right],
  ]);
};

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
    throw new Error(
      `${init.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(body)}`,
    );
  }
  return body;
};

const waitFor = async (read, terminal, label) => {
  const attempts = realProvider ? 240 : 60;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const value = await read();
    if (terminal(value)) return value;
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(`${label} did not reach a terminal state.`);
};

const run = async () => {
  const frames = await loadFrames();

  stage = 'authentication';
  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const token = login.accessToken;

  stage = realProvider ? 'real-provider-preflight' : 'mock-provider-preflight';
  const config = await request('/clients/me/hair-studio/config', {}, token);
  if (realProvider && (config.provider !== 'fal' || config.isMock === true)) {
    throw new Error(
      'Real-provider smoke test requires services started with AI_PROVIDER=fal and a server-only funded FAL_KEY.',
    );
  }
  if (!realProvider && config.isMock !== true) {
    throw new Error(
      'Refusing an unapproved paid-provider request. Set HAIR_STUDIO_REAL_PROVIDER=1 to opt in.',
    );
  }
  if (JSON.stringify(config.requiredAngles) !== JSON.stringify(requiredAngles)) {
    throw new Error(
      `API requires an unexpected capture set: ${JSON.stringify(config.requiredAngles)}`,
    );
  }

  stage = 'scan-creation';
  const scan = await request(
    '/clients/me/hair-scans',
    {
      method: 'POST',
      body: JSON.stringify({
        consentAccepted: true,
        ageConfirmed: true,
        consentVersion: config.consentVersion,
      }),
    },
    token,
  );

  stage = 'private-capture-upload';
  for (const angle of requiredAngles) {
    const image = frames.get(angle);
    const signed = await request(
      `/clients/me/hair-scans/${scan.id}/captures/presign`,
      {
        method: 'POST',
        body: JSON.stringify({
          angle,
          mimeType: 'image/jpeg',
          sizeBytes: image.length,
          checksumSha256: hash(image),
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
          width: angle === 'FRONT' ? 256 : 615,
          height: angle === 'FRONT' ? 300 : 800,
          brightness: 110,
          sharpness: 80,
          faceCount: 1,
          poseScore: 0.95,
        }),
      },
      token,
    );
  }

  stage = 'server-frame-validation';
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

  stage = 'custom-style-generation-request';
  const design = await request(
    '/clients/me/designs/generate',
    {
      method: 'POST',
      body: JSON.stringify({
        scanId: scan.id,
        styleName: 'Custom textured taper',
        styleCategory: 'haircut',
        description:
          'Keep three inches of wavy texture on top, a low taper at the temples and nape, a soft rounded shape styled loosely forward, retain the beard but shorten it at the cheeks, and use a natural dark-brown color.',
        idempotencyKey: randomUUID(),
      }),
    },
    token,
  );

  stage = 'generation-worker-callback';
  const generated = await waitFor(
    () => request(`/clients/me/designs/${design.id}`, {}, token),
    (value) => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(value.generationStatus),
    'Image generation',
  );
  if (generated.generationStatus !== 'COMPLETED' || generated.generatedPreviewUrl === null) {
    throw new Error(`Generation failed: ${generated.errorMessage ?? generated.generationStatus}`);
  }

  stage = 'private-result-storage';
  const preview = await fetch(generated.generatedPreviewUrl);
  if (!preview.ok) {
    throw new Error(`The authorized generated preview returned ${preview.status}.`);
  }
  const previewBytes = Buffer.from(await preview.arrayBuffer());
  if (previewBytes.length < 10_000) {
    throw new Error('The authorized generated preview is unexpectedly small.');
  }
  if (!realProvider && hash(previewBytes) !== hash(frames.get('FRONT'))) {
    throw new Error('Mock output does not match the validated front source portrait.');
  }

  stage = 'saved-looks';
  const saved = await request('/clients/me/designs', {}, token);
  if (
    !saved.designs.some((item) => item.id === design.id && item.generationStatus === 'COMPLETED')
  ) {
    throw new Error('The completed generated image did not appear in saved looks.');
  }

  stage = 'cleanup';
  await request(`/clients/me/designs/${design.id}`, { method: 'DELETE' }, token);

  console.info(
    JSON.stringify({
      status: 'ok',
      provider: generated.provider,
      anglesUploaded: requiredAngles.length,
      suggestions: analyzed.suggestions.length,
      customDescriptionVerified: true,
      privatePreviewVerified: true,
      savedLooksVerified: true,
      deleted: true,
    }),
  );
};

try {
  await run();
} catch (error) {
  console.error(
    JSON.stringify({
      status: 'failed',
      stage,
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
}
