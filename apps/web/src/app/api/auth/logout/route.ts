import { NextResponse } from 'next/server';

import { apiRequest, clearSession } from '@/lib/server-api';

export async function POST(): Promise<NextResponse> {
  const result = await apiRequest('/auth/logout', { method: 'POST' }, false);
  await clearSession();
  return NextResponse.json(result.body, { status: result.response.status });
}
