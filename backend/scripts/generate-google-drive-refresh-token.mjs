import http from 'http';
import { URL } from 'url';
import { google } from 'googleapis';

const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('\n❌ ERROR: Missing required environment variables.');
  if (!clientId) console.error('   - Missing GOOGLE_DRIVE_CLIENT_ID');
  if (!clientSecret) console.error('   - Missing GOOGLE_DRIVE_CLIENT_SECRET');
  console.error('\nPlease set environment variables before running script:');
  console.error('  $env:GOOGLE_DRIVE_CLIENT_ID="your_client_id"');
  console.error('  $env:GOOGLE_DRIVE_CLIENT_SECRET="your_client_secret"\n');
  process.exit(1);
}

const redirectUri = 'http://127.0.0.1:3000/oauth2callback';
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive.file'],
  prompt: 'consent',
  include_granted_scopes: true
});

console.log('\n================================================');
console.log('RANSOM GOOGLE DRIVE REFRESH TOKEN GENERATOR');
console.log('================================================');
console.log('\nOpen this Google authorization URL in your browser:\n');
console.log(authUrl);
console.log('\nWaiting for browser authorization callback on http://127.0.0.1:3000/oauth2callback ...\n');

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, 'http://127.0.0.1:3000');
    if (reqUrl.pathname === '/oauth2callback') {
      const code = reqUrl.searchParams.get('code');
      const error = reqUrl.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h2>Authorization Failed</h2><p>${error}</p>`);
        console.error(`\n❌ Authorization failed: ${error}`);
        server.close();
        process.exit(1);
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h2>Missing Authorization Code</h2>');
        return;
      }

      console.log('Authorization code received. Exchanging for tokens...');
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens || !tokens.refresh_token) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <h2>Refresh Token Not Returned</h2>
          <p>Google did not return a refresh token. Please revoke RANSOM HRMS authorization at 
          <a href="https://myaccount.google.com/permissions" target="_blank">Google Account Security</a> 
          and run this script again.</p>
        `);
        console.error('\n❌ Google did not return a refresh token.');
        console.error('Please revoke existing RANSOM HRMS app access at: https://myaccount.google.com/permissions');
        console.error('Then run this script again with prompt=consent.\n');
        server.close();
        process.exit(1);
      }

      oauth2Client.setCredentials(tokens);

      let userInfo = '';
      try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const about = await drive.about.get({ fields: 'user' });
        if (about.data.user) {
          userInfo = about.data.user.emailAddress || about.data.user.displayName || '';
        }
      } catch (_) {}

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 30px; border-radius: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534;">
          <h2 style="margin-top:0; color: #15803d;">Authorization Successful!</h2>
          <p>Google Drive OAuth refresh token generated successfully.</p>
          <p>You can now close this browser window and return to your terminal.</p>
        </div>
      `);

      console.log('\n================================================');
      console.log('Authorization successful.');
      if (userInfo) {
        console.log(`Google Drive OAuth Account: ${userInfo}`);
      }
      console.log('================================================');
      console.log('\nGOOGLE_DRIVE_REFRESH_TOKEN:\n');
      console.log(tokens.refresh_token);
      console.log('\n================================================');
      console.log('IMPORTANT SECURITY WARNING:');
      console.log('Copy this refresh token directly into Render\'s backend Environment variables.');
      console.log('NEVER commit this token to Git or save it to disk.\n');

      server.close();
      process.exit(0);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h2>Token Exchange Error</h2><p>${err.message}</p>`);
    console.error('\n❌ Token Exchange Exception:', err);
    server.close();
    process.exit(1);
  }
});

server.listen(3000, '127.0.0.1', () => {});
