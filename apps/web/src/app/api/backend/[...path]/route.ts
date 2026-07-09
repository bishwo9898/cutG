import { NextResponse } from 'next/server';

import { apiRequest } from '@/lib/server-api';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const handler = async (request: Request, context: RouteContext): Promise<NextResponse> => {
  const { path } = await context.params;
  const body =
    request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
  const init: RequestInit = { method: request.method };

  if (body !== undefined) {
    init.body = body;
  }

  const result = await apiRequest(`/${path.join('/')}${new URL(request.url).search}`, init);

  return NextResponse.json(result.body, { status: result.response.status });
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
