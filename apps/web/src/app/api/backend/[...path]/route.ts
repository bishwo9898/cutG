import { NextResponse } from 'next/server';

import { apiRequest } from '@/lib/server-api';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const handler = async (request: Request, context: RouteContext): Promise<NextResponse> => {
  const { path } = await context.params;
  const body =
    request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
  const init: RequestInit = { method: request.method };

  if (body !== undefined) {
    init.headers = {
      'Content-Type': request.headers.get('content-type') ?? 'application/json',
    };
    init.body = body;
  }

  const result = await apiRequest(`/${path.join('/')}${new URL(request.url).search}`, init);

  const response = NextResponse.json(result.body, { status: result.response.status });
  if (
    request.method === 'GET' &&
    path[0] === 'clients' &&
    path[1] === 'me' &&
    path[2] === 'designs'
  ) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Vary', 'Cookie');
  }
  return response;
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
