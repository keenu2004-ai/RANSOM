import { Configuration, PublicClientApplication, RedirectRequest, PopupRequest, AuthenticationResult } from '@azure/msal-browser';

// Retrieve public Vite environment configuration
const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '11111111-1111-1111-1111-111111111111';
const tenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID || '00000000-0000-0000-0000-000000000000';

// Canonical Redirect URI Resolution
const getRedirectUri = (): string => {
  if (import.meta.env.VITE_MICROSOFT_REDIRECT_URI) {
    return import.meta.env.VITE_MICROSOFT_REDIRECT_URI.trim();
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/login`;
  }
  return 'https://ransom-1-npfy.onrender.com/login';
};

export const redirectUri = getRedirectUri();

// MSAL Browser Configuration for Single-Tenant SPA
export const msalConfig: Configuration = {
  auth: {
    clientId: clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: redirectUri,
    postLogoutRedirectUri: redirectUri
  },
  cache: {
    cacheLocation: 'sessionStorage'
  }
};

// Requested MSAL login scopes (minimum identity scopes)
export const loginRequest: PopupRequest | RedirectRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read']
};

// Singleton MSAL PublicClientApplication instance
export const msalInstance = new PublicClientApplication(msalConfig);

// Module-level interaction state tracking
let isInteractionInProgress = false;
let msalInitPromise: Promise<AuthenticationResult | null> | null = null;

/**
 * Initializes MSAL instance ONCE for application lifespan.
 * Prevents nested popup processing if executing inside a child popup window.
 */
export function initializeMsal(): Promise<AuthenticationResult | null> {
  if (!msalInitPromise) {
    msalInitPromise = (async () => {
      await msalInstance.initialize();

      // Guard against nested popup window processing
      if (typeof window !== 'undefined' && window.opener && window.opener !== window) {
        try {
          await msalInstance.handleRedirectPromise();
        } catch (e) {
          console.warn('[MSAL CHILD WINDOW] handleRedirectPromise:', e);
        }
        return null;
      }

      try {
        const result = await msalInstance.handleRedirectPromise();
        if (result && result.account) {
          msalInstance.setActiveAccount(result.account);
        }
        return result;
      } catch (err: any) {
        console.warn('MSAL handleRedirectPromise warning:', err);
        throw err;
      }
    })();
  }
  return msalInitPromise;
}

// Module-level init promise exported for contract compatibility
export const msalInitPromiseLegacy = initializeMsal();

/**
 * Executes a single redirect-based Microsoft login flow (Primary SPA Flow).
 */
export async function executeMicrosoftRedirectLogin(): Promise<void> {
  await initializeMsal();

  if (isInteractionInProgress) {
    const err: any = new Error('Microsoft sign-in is already in progress. Please wait for it to finish.');
    err.errorCode = 'interaction_in_progress';
    throw err;
  }

  isInteractionInProgress = true;
  try {
    await msalInstance.loginRedirect(loginRequest);
  } catch (err: any) {
    isInteractionInProgress = false;
    if (err.errorCode === 'interaction_in_progress' || err.message?.includes('interaction_in_progress')) {
      err.message = 'Microsoft sign-in is already in progress. Please wait for it to finish.';
    } else if (err.errorCode === 'block_nested_popups' || err.message?.includes('block_nested_popups')) {
      err.message = 'Microsoft sign-in could not complete because another authentication window is active. Please close any open window and try again.';
    }
    throw err;
  }
}

/**
 * Executes a popup-based Microsoft login flow with interaction guards (Fallback Flow).
 */
export async function executeMicrosoftPopupLogin(): Promise<AuthenticationResult> {
  await initializeMsal();

  if (isInteractionInProgress) {
    const err: any = new Error('Microsoft sign-in is already in progress. Please wait for it to finish.');
    err.errorCode = 'interaction_in_progress';
    throw err;
  }

  isInteractionInProgress = true;
  try {
    const response = await msalInstance.loginPopup(loginRequest);
    if (response && response.account) {
      msalInstance.setActiveAccount(response.account);
    }
    return response;
  } catch (err: any) {
    if (err.errorCode === 'block_nested_popups' || err.message?.includes('block_nested_popups')) {
      err.message = 'Microsoft sign-in could not complete because another authentication window is active. Please close the Microsoft sign-in window and try again.';
    } else if (err.errorCode === 'interaction_in_progress' || err.message?.includes('interaction_in_progress')) {
      err.message = 'Microsoft sign-in is already in progress. Please wait for it to finish.';
    }
    throw err;
  } finally {
    isInteractionInProgress = false;
  }
}

/**
 * Attempts silent token acquisition for an existing MSAL session.
 */
export async function getSilentIdToken(): Promise<string | null> {
  await initializeMsal();

  let account = msalInstance.getActiveAccount();
  if (!account) {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      account = accounts[0];
      msalInstance.setActiveAccount(account);
    }
  }

  if (!account) return null;

  try {
    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account
    });
    return response.idToken;
  } catch (err) {
    console.warn('Silent token acquisition warning:', err);
    return null;
  }
}
