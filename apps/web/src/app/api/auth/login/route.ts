import { NextResponse } from 'next/server';

import { createSession } from '@/lib/server-api';

export async function POST(request: Request): Promise<NextResponse> {
  const result = await createSession(await request.json());
  return NextResponse.json(result.body, { status: result.response.status });
}
