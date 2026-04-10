import express from 'express';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { createOAuthClient, getAuthUrl } from '../lib/oauth.js';
import { isDBConnected } from '../lib/db.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';

const isProd = process.env.NODE_ENV === 'production';

// Redirect via a 200 HTML page so Vercel edge doesn't interfere.
// The session JWT is embedded in the URL hash — never sent to server,
// never stripped by Vercel, read by the client and stored in localStorage.
function htmlRedirect(res, redirectUrl) {
  res.setHeader('Cache-Control', 'no-store, no-cache, private');
  const safeUrl = JSON.stringify(redirectUrl);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
<script>window.location.replace(${safeUrl});</script>
</head><body>Redirecting...</body></html>`);
}

const router = express.Router();

// GET /auth/status
router.get('/status', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, private');
  const hasTokens = !!req.session?.tokens;
  console.log('[status] tokens:', hasTokens, '| user:', req.session?.user?.email || 'none');
  if (hasTokens) {
    res.json({ loggedIn: true, user: req.session.user || null });
  } else {
    res.json({ loggedIn: false });
  }
});

// GET /auth/google — start OAuth flow
router.get('/google', (_req, res) => {
  res.redirect(getAuthUrl('consent'));
});

// GET /auth/callback — handle OAuth return
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return htmlRedirect(res, `${process.env.CLIENT_ORIGIN}?error=no_code`);

  try {
    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    // Strip id_token — large JWT (~1.5KB) not needed after auth
    const { id_token: _discarded, ...sessionTokens } = tokens;
    // Verify Gmail scopes were actually granted — if user unchecked them, redirect immediately
    const grantedScopes = (tokens.scope || '').split(' ');
    if (!grantedScopes.some(s => s.includes('gmail'))) {
      console.warn('[auth] Gmail scopes missing — user must re-auth and grant Gmail access');
      return htmlRedirect(res, `${process.env.CLIENT_ORIGIN}?error=gmail_permission_required`);
    }

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    const userInfo = {
      name:    data.name,
      email:   data.email,
      picture: data.picture,
      role:    'agent',
    };

    // ── Save to MongoDB if connected ──────────────────────────────────────────
    if (isDBConnected()) {
      try {
        let workspace = await Workspace.findOne();
        if (!workspace) {
          workspace = await Workspace.create({
            name: 'Support Team',
            ownerId: new (await import('mongoose')).default.Types.ObjectId(),
            members: [],
            settings: { defaultLanguage: 'nl', timezone: 'Europe/Amsterdam' },
          });
        }

        let dbUser = await User.findOne({ googleId: data.id });
        if (!dbUser) {
          const totalUsers = await User.countDocuments();
          const role = totalUsers === 0 ? 'owner' : 'agent';
          dbUser = await User.create({
            googleId:    data.id,
            email:       data.email,
            name:        data.name,
            picture:     data.picture,
            role,
            workspaceId: workspace._id,
          });
          if (role === 'owner') workspace.ownerId = dbUser._id;
          workspace.members.push({ userId: dbUser._id });
          await workspace.save();
          console.log(`✅ New user: ${dbUser.email} (${role})`);
        } else {
          await dbUser.updateLastLogin();
          console.log(`🔄 Login: ${dbUser.email} (${dbUser.role})`);
        }

        userInfo.id      = dbUser._id.toString();
        userInfo.role    = dbUser.role;
        userInfo.dbSaved = true;
      } catch (dbErr) {
        console.error('⚠️  DB error (login still works):', dbErr.message);
      }
    }

    // Sign session as a JWT and embed in redirect URL hash.
    // The hash is never sent to the server — Vercel can't strip it.
    // The React client reads it from window.location.hash and stores in localStorage.
    const sessionJwt = jwt.sign(
      { tokens: sessionTokens, user: userInfo },
      process.env.SESSION_SECRET,
      { expiresIn: '24h' }
    );
    console.log('[auth] session JWT created for:', userInfo.email);
    htmlRedirect(res, `${process.env.CLIENT_ORIGIN}#t=${encodeURIComponent(sessionJwt)}`);

  } catch (err) {
    console.error('OAuth callback error:', err.message);
    htmlRedirect(res, `${process.env.CLIENT_ORIGIN}?error=auth_failed`);
  }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  req.session = null;
  res.json({ success: true });
});

// GET /auth/switch
router.get('/switch', (_req, res) => {
  res.redirect(getAuthUrl('select_account consent'));
});

export default router;
