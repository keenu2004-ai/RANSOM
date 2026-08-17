/**
 * THEIAKSHI ENTERPRISE HRMS — CENTRALIZED FRONTEND API CLIENT
 * All production API requests MUST go through this centralized client.
 */

export function getApiUrl(endpoint: string): string {
  let baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').trim();
  // Strip trailing slashes
  baseUrl = baseUrl.replace(/\/+$/, '');
  
  // If baseUrl already ends with /api, remove it so we can append cleanly
  if (baseUrl.endsWith('/api')) {
    baseUrl = baseUrl.substring(0, baseUrl.length - 4);
  }
  
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
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}${queryString}`;
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

    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      // Clear expired auth session for protected endpoints
      localStorage.removeItem('theiakshi_auth_token');
      localStorage.removeItem('theiakshi_auth_user');
      throw new ApiError('Your session has expired or is unauthorized. Please sign in again.', 401, 'UNAUTHENTICATED');
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      const status = response.status;
      const code = data.code || 'UNKNOWN_ERROR';
      let message = data.error || 'An error occurred while communicating with the server.';

      if (status === 401 && endpoint.includes('/auth/login')) {
        message = data.error || 'Invalid email address or password.';
      } else if (status === 403) {
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
    const isNetwork = error.name === 'TypeError' || (error.message && error.message.includes('Failed to fetch'));
    const message = isNetwork 
      ? 'Unable to connect to the server. Please try again.'
      : (error.message || 'Unable to connect to the server. Please try again.');
    throw new ApiError(message, 0, 'NETWORK_ERROR');
  }
}
