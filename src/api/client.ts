import { tokenStorage } from '@/features/auth/storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  authenticated?: boolean;
  body?: unknown;
  token?: string;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_URL) {
    throw new ApiError('The API URL is not configured.', 0);
  }

  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  const token = options.token ?? (options.authenticated ? await tokenStorage.get() : null);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const { authenticated: _authenticated, token: _token, body, ...requestOptions } = options;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...requestOptions,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Unable to reach Vialbum. Check your connection and try again.', 0);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && options.authenticated) {
      await tokenStorage.remove();
      unauthorizedHandler?.();
    }
    const detail = typeof payload?.detail === 'string' ? payload.detail : 'The request failed.';
    throw new ApiError(detail, response.status);
  }
  return payload as T;
}
