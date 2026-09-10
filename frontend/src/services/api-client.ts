/**
 * THEIAKSHI ENTERPRISE HRMS — CENTRALIZED FRONTEND API CLIENT
 * All production API requests MUST go through this centralized client.
 */

export function getApiUrl(endpoint: string): string {
  let baseUrl = import.meta.env.VITE_API_URL;
  if (!baseUrl) {
    baseUrl = '';
  }
  baseUrl = baseUrl.trim();
  // Strip trailing slashes
  baseUrl = baseUrl.replace(/\/+$/, '');
  
  // If baseUrl already ends with /api or /api/v1, remove it so we can append cleanly
  if (baseUrl.endsWith('/api/v1')) {
    baseUrl = baseUrl.substring(0, baseUrl.length - 7);
  } else if (baseUrl.endsWith('/api')) {
    baseUrl = baseUrl.substring(0, baseUrl.length - 4);
  }
  
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // Strip duplicate leading /api/v1/ or /api/
  if (cleanEndpoint.startsWith('/api/v1/')) {
    cleanEndpoint = cleanEndpoint.substring(7);
  } else if (cleanEndpoint === '/api/v1') {
    cleanEndpoint = '';
  } else if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.substring(4);
  } else if (cleanEndpoint === '/api') {
    cleanEndpoint = '';
  }
  
  return `${baseUrl}/api/v1${cleanEndpoint}`;
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

  const config: RequestInit = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    credentials: 'include',
    ...customConfig
  };

  try {
    const response = await fetch(url, config);

    if (response.status === 401 && !endpoint.includes('/auth/login')) {
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

export async function apiDownload(endpoint: string, options: ApiOptions = {}, defaultFilename = 'THEIAKSHI_Weekly_Plan.xlsx'): Promise<void> {
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

  const config: RequestInit = {
    method: 'GET',
    headers: {
      ...headers
    },
    credentials: 'include',
    ...customConfig
  };

  try {
    const response = await fetch(url, config);

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        const isLogin = endpoint.includes('/auth/login') || endpoint.includes('/auth/microsoft');
        if (!isLogin) {
          window.dispatchEvent(new CustomEvent('theiakshi:auth:logout'));
        }
      }
      throw new ApiError('Your session has expired. Please sign in again.', 401, 'UNAUTHENTICATED');
    }

    if (response.status === 403) {
      throw new ApiError('You do not have permission to perform this export.', 403, 'PERMISSION_DENIED');
    }

    if (!response.ok) {
      let errorMsg = 'Unable to download export file.';
      try {
        const errJson = await response.json();
        errorMsg = errJson.error || errJson.message || errorMsg;
      } catch (_) {}
      throw new ApiError(errorMsg, response.status, 'DOWNLOAD_FAILED');
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition');
    let filename = defaultFilename;

    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^";]+)"?/i) || contentDisposition.match(/filename\*=UTF-8''([^";]+)/i);
      if (match && match[1]) {
        filename = decodeURIComponent(match[1].trim());
      }
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || 'Unable to download file export.', 0, 'DOWNLOAD_ERROR');
  }
}

export function buildAttachmentViewPath(attachmentId: string): string {
  if (!attachmentId) return '#';
  const cleanId = attachmentId.trim().replace(/^\/api\/v1\/files\//, '').replace(/^\/api\/files\//, '').replace(/\/view$/, '').replace(/^\/files\//, '');
  return `/api/v1/files/${cleanId}/view`;
}

export function buildAttachmentDownloadPath(attachmentId: string): string {
  if (!attachmentId) return '#';
  const cleanId = attachmentId.trim().replace(/^\/api\/v1\/files\//, '').replace(/^\/api\/files\//, '').replace(/\/download$/, '').replace(/^\/files\//, '');
  return `/api/v1/files/${cleanId}/download`;
}

export function getSecureFileUrl(url: string | null | undefined): string {
  if (!url) return '#';
  const trimmed = url.trim();
  
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:') || trimmed.includes('/blob:')) {
    console.warn('[STORAGE] getSecureFileUrl rejected invalid blob/data URL:', trimmed);
    return '#';
  }

  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmed);
  let targetPath = trimmed;
  if (isUuid) {
    targetPath = buildAttachmentViewPath(trimmed);
  }

  let fullUrl = targetPath;
  if (!targetPath.startsWith('http://') && !targetPath.startsWith('https://')) {
    fullUrl = getApiUrl(targetPath);
  }

  // Ensure no duplicate /api/v1/api/v1 in fullUrl under any circumstance
  fullUrl = fullUrl.replace(/\/api\/v1\/api\/v1\//g, '/api/v1/').replace(/\/api\/api\//g, '/api/v1/');

  return fullUrl;
}

