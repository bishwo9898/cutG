import { NextResponse } from 'next/server';

import { createSession } from '@/lib/server-api';

export async function POST(request: Request): Promise<NextResponse> {
  const input = (await request.json()) as Record<string, unknown>;
  const expectedUserType =
    input.expectedUserType === 'CLIENT' || input.expectedUserType === 'BARBER'
      ? input.expectedUserType
      : undefined;
  const credentials = { ...input };
  delete credentials.expectedUserType;
  const result = await createSession(credentials, expectedUserType);
  return NextResponse.json(result.body, { status: result.response.status });
}
