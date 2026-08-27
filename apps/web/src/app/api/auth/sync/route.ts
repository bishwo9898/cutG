import { NextResponse } from 'next/server';

import { apiRequest } from '@/lib/server-api';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as { userType?: unknown };
  const userType = body.userType === 'BARBER' || body.userType === 'CLIENT' ? body.userType : null;

  if (userType === null) {
    return NextResponse.json({ status: 'error', message: 'userType is required.' }, { status: 400 });
  }

  const result = await apiRequest('/auth/sync', {
    method: 'POST',
    body: JSON.stringify({ userType }),
  });

  return NextResponse.json(result.body, { status: result.response.status });
}
