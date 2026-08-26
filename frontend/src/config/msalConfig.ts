import { Configuration, PublicClientApplication, RedirectRequest, PopupRequest, AuthenticationResult } from '@azure/msal-browser';

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

// Singleton MSAL PublicClientApplication instance
export const msalInstance = new PublicClientApplication(msalConfig);

// Module-level initialization promise executed exactly ONCE for application lifespan
const msalInitPromise = msalInstance.initialize().then(() => {
  return msalInstance.handleRedirectPromise();
}).catch(err => {
  console.warn('MSAL initialization warning:', err);
});

export async function ensureMsalInitialized(): Promise<PublicClientApplication> {
  await msalInitPromise;
  return msalInstance;
}

// Module-level interaction state tracking
let isInteractionInProgress = false;

export async function executeMicrosoftPopupLogin(): Promise<AuthenticationResult> {
  await ensureMsalInitialized();

  if (isInteractionInProgress) {
    const err: any = new Error('A Microsoft sign-in window is already in progress. Please complete or close the pop-up window.');
    err.errorCode = 'interaction_in_progress';
    throw err;
  }

  isInteractionInProgress = true;
  try {
    const response = await msalInstance.loginPopup(loginRequest);
    return response;
  } catch (err: any) {
    if (err.errorCode === 'interaction_in_progress' || err.message?.includes('interaction_in_progress')) {
      err.message = 'A Microsoft sign-in window is already in progress. Please complete or close the pop-up window.';
    }
    throw err;
  } finally {
    isInteractionInProgress = false;
  }
}
