import express from 'express';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { createOAuthClient, getAuthUrl } from '../lib/oauth.js';
import { isDBConnected } from '../lib/db.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';

const isProd = process.env.NODE_ENV === 'production';
const SESSION_COOKIE = 'mf_session';

// Send a 200 HTML page that sets the cookie and redirects via JS.
// Vercel's edge strips Set-Cookie from 302 responses — a 200 body is reliable.
function htmlRedirect(res, redirectUrl, sessionData) {
  if (sessionData) {
    const token = jwt.sign(sessionData, process.env.SESSION_SECRET, { expiresIn: '24h' });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
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
  if (req.session?.tokens) {
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
  if (!code) return res.redirect(`${process.env.CLIENT_ORIGIN}?error=no_code`);

  try {
    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    // Strip id_token — it's a large JWT (~1.5KB) we don't need after auth,
    // and storing it can push the session cookie over the 4KB browser limit.
    const { id_token: _discarded, ...sessionTokens } = tokens;
    req.session.tokens = sessionTokens;

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    // Basic user info — always saved in session
    const userInfo = {
      name:    data.name,
      email:   data.email,
      picture: data.picture,
      role:    'agent',
    };

    // ── Save to MongoDB if connected ──────────────────────────────────────────
    if (isDBConnected()) {
      try {
        // Check if workspace exists
        let workspace = await Workspace.findOne();

        // First ever login — create the workspace
        if (!workspace) {
          workspace = await Workspace.create({
            name: 'Support Team',
            ownerId: new (await import('mongoose')).default.Types.ObjectId(),
            members: [],
            settings: { defaultLanguage: 'nl', timezone: 'Europe/Amsterdam' },
          });
        }

        // Find or create user in DB
        let dbUser = await User.findOne({ googleId: data.id });

        if (!dbUser) {
          // First user ever = owner, everyone after = agent
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

          // Add to workspace — role only lives in User model
          if (role === 'owner') workspace.ownerId = dbUser._id;
          workspace.members.push({ userId: dbUser._id });
          await workspace.save();

          console.log(`✅ New user: ${dbUser.email} (${role})`);
        } else {
          // Existing user — update last login time
          await dbUser.updateLastLogin();
          console.log(`🔄 Login: ${dbUser.email} (${dbUser.role})`);
        }

        // Save DB info to session
        userInfo.id      = dbUser._id.toString();
        userInfo.role    = dbUser.role;
        userInfo.dbSaved = true;

      } catch (dbErr) {
        console.error('⚠️  DB error (login still works):', dbErr.message);
      }
    }

    req.session.user = userInfo;
    htmlRedirect(res, `${process.env.CLIENT_ORIGIN}?auth=success`, {
      tokens: req.session.tokens,
      user:   req.session.user,
    });

  } catch (err) {
    console.error('OAuth callback error:', err.message);
    htmlRedirect(res, `${process.env.CLIENT_ORIGIN}?error=auth_failed`, null);
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
