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

export type UploadFile = { uri: string; name: string; type: string };

export async function apiUpload<T>(
  path: string,
  file: UploadFile,
  fields: Record<string, string>,
  onProgress: (progress: number) => void,
): Promise<T> {
  if (!API_URL) throw new ApiError('The API URL is not configured.', 0);
  const token = await tokenStorage.get();
  if (!token) throw new ApiError('Your session has expired. Please sign in again.', 401);

  const form = new FormData();
  form.append('file', file as unknown as Blob);
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));

  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${API_URL}${path}`);
    request.setRequestHeader('Accept', 'application/json');
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new ApiError('The photo upload lost its connection.', 0));
    request.onload = () => {
      const payload = (() => {
        try { return JSON.parse(request.responseText); } catch { return null; }
      })();
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve(payload as T);
        return;
      }
      if (request.status === 401) {
        void tokenStorage.remove();
        unauthorizedHandler?.();
      }
      reject(new ApiError(typeof payload?.detail === 'string' ? payload.detail : 'The photo could not be uploaded.', request.status));
    };
    request.send(form);
  });
}
