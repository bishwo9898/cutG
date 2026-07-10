export type ApiErrorBody = {
  status: 'error';
  code?: string;
  message: string;
  details?: Record<string, unknown>;
};

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string | undefined;
  public readonly details: Record<string, unknown> | undefined;

  public constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly headers?: ApiClientOptions['headers'];

  public constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.headers = options.headers;
  }

  public get<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: 'GET' });
  }

  public post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    const requestInit: RequestInit = { ...init, method: 'POST' };

    if (body !== undefined) {
      requestInit.body = JSON.stringify(body);
    }

    return this.request<T>(path, requestInit);
  }

  public put<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: 'PUT', body: JSON.stringify(body) });
  }

  public patch<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: 'PATCH', body: JSON.stringify(body) });
  }

  public delete<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: 'DELETE' });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const configuredHeaders =
      typeof this.headers === 'function' ? await this.headers() : (this.headers ?? {});
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...configuredHeaders,
        ...init.headers,
      },
    });
    const body = (await response.json().catch(() => ({
      status: 'error',
      message: 'The server returned an unreadable response.',
    }))) as T | ApiErrorBody;

    if (!response.ok) {
      throw new ApiError(response.status, body as ApiErrorBody);
    }

    return body as T;
  }
}

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export const toQueryString = (params: QueryParams = {}): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const value = search.toString();
  return value.length > 0 ? `?${value}` : '';
};

export const barberDiscoveryApi = {
  search: <T>(client: ApiClient, params?: QueryParams): Promise<T> =>
    client.get<T>(`/barbers${toQueryString(params)}`),
  getProfile: <T>(client: ApiClient, barberId: string): Promise<T> =>
    client.get<T>(`/barbers/${barberId}`),
  getServices: <T>(client: ApiClient, barberId: string): Promise<T> =>
    client.get<T>(`/barbers/${barberId}/services`),
  getSlots: <T>(client: ApiClient, barberId: string, params?: QueryParams): Promise<T> =>
    client.get<T>(`/barbers/${barberId}/slots${toQueryString(params)}`),
  getReviews: <T>(client: ApiClient, barberId: string, params?: QueryParams): Promise<T> =>
    client.get<T>(`/barbers/${barberId}/reviews${toQueryString(params)}`),
};

export const clientApi = {
  me: <T>(client: ApiClient): Promise<T> => client.get<T>('/clients/me'),
  savedBarbers: <T>(client: ApiClient): Promise<T> => client.get<T>('/clients/me/saved-barbers'),
  saveBarber: <T>(client: ApiClient, barberId: string): Promise<T> =>
    client.post<T>('/clients/me/saved-barbers', { barberId }),
  removeSavedBarber: <T>(client: ApiClient, barberId: string): Promise<T> =>
    client.delete<T>(`/clients/me/saved-barbers/${barberId}`),
  bookAppointment: <T>(client: ApiClient, body: unknown): Promise<T> =>
    client.post<T>('/clients/me/appointments', body),
  appointments: <T>(client: ApiClient, params?: QueryParams): Promise<T> =>
    client.get<T>(`/clients/me/appointments${toQueryString(params)}`),
  appointment: <T>(client: ApiClient, appointmentId: string): Promise<T> =>
    client.get<T>(`/clients/me/appointments/${appointmentId}`),
  cancelAppointment: <T>(client: ApiClient, appointmentId: string): Promise<T> =>
    client.delete<T>(`/clients/me/appointments/${appointmentId}`),
  createReview: <T>(client: ApiClient, body: unknown): Promise<T> =>
    client.post<T>('/clients/me/reviews', body),
};
