import { Configuration, PublicClientApplication, RedirectRequest, PopupRequest } from '@azure/msal-browser';

// Retrieve public Vite environment configuration
const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '11111111-1111-1111-1111-111111111111';
const tenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID || '00000000-0000-0000-0000-000000000000';
const redirectUri = import.meta.env.VITE_MICROSOFT_REDIRECT_URI || (typeof window !== 'undefined' ? `${window.location.origin}/login` : 'https://ransom-1-npfy.onrender.com/login');

// MSAL Browser Configuration for Single-Tenant SPA
export const msalConfig: Configuration = {
  auth: {
    clientId: clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: redirectUri,
    postLogoutRedirectUri: redirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  }
};

// Requested MSAL login scopes (minimum identity scopes)
export const loginRequest: PopupRequest | RedirectRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read']
};

// Export singleton MSAL PublicClientApplication instance
export const msalInstance = new PublicClientApplication(msalConfig);

let isMsalInitialized = false;

export async function ensureMsalInitialized(): Promise<PublicClientApplication> {
  if (!isMsalInitialized) {
    try {
      await msalInstance.initialize();
      isMsalInitialized = true;
    } catch (err: any) {
      console.warn('MSAL initialization warning:', err);
    }
  }
  return msalInstance;
}
