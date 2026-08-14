/**
 * THEIAKSHI ENTERPRISE HRMS — CENTRALIZED FRONTEND API CLIENT
 * All production API requests MUST go through this centralized client.
 */

export function getApiUrl(endpoint: string): string {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}/api${cleanEndpoint}`;
}

export interface ApiOptions extends RequestInit {
  params?: Record<string, string | number | undefined | null>;
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { params, headers, ...customConfig } = options;

  let url = getApiUrl(endpoint);
  if (params) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const token = localStorage.getItem('theiakshi_auth_token');

  const config: RequestInit = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    ...customConfig
  };

  try {
    const response = await fetch(url, config);

    if (response.status === 401) {
      // Clear expired auth session
      localStorage.removeItem('theiakshi_auth_token');
      localStorage.removeItem('theiakshi_auth_user');
      throw new ApiError('Your session has expired or is unauthorized. Please sign in again.', 401, 'UNAUTHENTICATED');
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      const status = response.status;
      const code = data.code || 'UNKNOWN_ERROR';
      let message = data.error || 'An error occurred while communicating with the server.';

      if (status === 403) {
        message = data.error || 'You do not have permission to perform this action.';
      } else if (status === 404) {
        message = data.error || 'The requested resource was not found.';
      } else if (status === 409) {
        message = data.error || 'A conflict occurred with the existing database state.';
      } else if (status >= 500) {
        message = data.error || 'Server error. Please try again later.';
      }

      throw new ApiError(message, status, code);
    }

    return data.data as T;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error.message || 'Unable to connect to the API server. Please check your network connection.',
      0,
      'NETWORK_ERROR'
    );
  }
}
