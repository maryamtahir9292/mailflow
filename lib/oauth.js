import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let credentials;
try {
  credentials = JSON.parse(readFileSync(join(__dirname, '../credentials.json'), 'utf8'));
} catch {
  console.error('❌  credentials.json not found. Copy it from gmail-app/ to mailflow/');
  process.exit(1);
}

// Supports both "web" and "installed" OAuth client types
const { client_id, client_secret } = credentials.web || credentials.installed;

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export function createOAuthClient() {
  return new google.auth.OAuth2(client_id, client_secret, process.env.REDIRECT_URI);
}

/**
 * Creates an OAuth client with tokens set, and auto-refreshes if expired.
 * Updates the session with new tokens when a refresh happens.
 */
export function createAuthenticatedClient(req) {
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials(req.session.tokens);

  // Listen for token refresh events — save new tokens back to session
  oauth2Client.on('tokens', (newTokens) => {
    console.log('🔄 OAuth tokens refreshed');
    // Merge new tokens with existing (refresh_token may not be in the new set)
    req.session.tokens = { ...req.session.tokens, ...newTokens };
  });

  return oauth2Client;
}

export function getAuthUrl(prompt = 'consent') {
  const client = createOAuthClient();
  return client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt });
}
