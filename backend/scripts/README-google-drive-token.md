# RANSOM HRMS — Google Drive OAuth Refresh Token Generator

This directory contains a one-time, secure local helper script to generate a `GOOGLE_DRIVE_REFRESH_TOKEN` for RANSOM HRMS binary storage.

## 1. Purpose
The RANSOM backend uses Google Drive as its canonical binary storage provider (storing expense claims, trip receipts, employee documents, weekly plans, and monthly report archives). The backend requires a long-lived OAuth2 `refresh_token` to automatically upload, stream, and manage files without requiring user login or public Drive links.

## 2. Prerequisites
- Node.js v18 or higher
- Existing Google OAuth 2.0 Client Credentials (`Client ID` and `Client Secret`) for a **Desktop Application**.
- `googleapis` package installed in backend (`npm install googleapis`).

## 3. Google OAuth Client & Scope
- **Client Type**: Desktop application
- **Redirect URI**: `http://127.0.0.1:3000/oauth2callback`
- **OAuth Scope**: `https://www.googleapis.com/auth/drive.file` (Restricted to files opened or created by RANSOM HRMS).

## 4. How to Generate the Refresh Token (PowerShell)

Open PowerShell in the project workspace:

```powershell
# Navigate to backend directory
cd backend

# Set environment variables for your OAuth Client
$env:GOOGLE_DRIVE_CLIENT_ID="YOUR_GOOGLE_DRIVE_CLIENT_ID.apps.googleusercontent.com"
$env:GOOGLE_DRIVE_CLIENT_SECRET="YOUR_GOOGLE_DRIVE_CLIENT_SECRET"

# Run the token generator script
node scripts/generate-google-drive-refresh-token.mjs
```

## 5. Authorization Process
1. The script validates credentials and starts a temporary local server on `http://127.0.0.1:3000`.
2. Open the printed Google authorization URL in your browser.
3. Sign into the Google Account that owns your **Google One** storage subscription.
4. Click **Allow** to grant file management access.
5. Google redirects to `http://127.0.0.1:3000/oauth2callback`, exchanges the authorization code, and prints your `GOOGLE_DRIVE_REFRESH_TOKEN` once in the terminal.
6. The script verifies account access and cleanly shuts down.

## 6. Configuring Production Environment Variables on Render

Copy the output values into your Render **Backend Web Service** Environment configuration:

| Variable Name | Description | Scope |
|---|---|---|
| `GOOGLE_DRIVE_CLIENT_ID` | OAuth Client ID | Backend Only |
| `GOOGLE_DRIVE_CLIENT_SECRET` | OAuth Client Secret | Backend Only |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | Generated OAuth Refresh Token | Backend Only |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Root Folder ID of "RANSOM HRMS" folder | Backend Only |

> ⚠️ **CRITICAL SECURITY WARNING**:
> - NEVER put Google Drive credentials in frontend environment variables (`VITE_`).
> - NEVER save the refresh token to disk, source code, or `.env` files committed to Git.
> - NEVER share or expose `GOOGLE_DRIVE_CLIENT_SECRET` or `GOOGLE_DRIVE_REFRESH_TOKEN`.

## 7. How to Revoke or Regenerate Token
If you need to force a new refresh token or revoke access:
1. Visit [Google Account Third-Party Access](https://myaccount.google.com/permissions).
2. Select **RANSOM HRMS Drive Client** and click **Remove Access**.
3. Re-run `node scripts/generate-google-drive-refresh-token.mjs` to request consent and receive a new refresh token.
