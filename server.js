import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import dotenv from 'dotenv';
import { doubleCsrf } from 'csrf-csrf';

import { connectDB }    from './lib/db.js';
import { requireAuth }  from './lib/middleware.js';
import authRoutes       from './routes/auth.js';
import emailRoutes      from './routes/emails.js';
import replyRoutes      from './routes/reply.js';
import sendRoutes       from './routes/send.js';
import workspaceRoutes    from './routes/workspace.js';
import emailStatusRoutes  from './routes/emailStatus.js';
import ticketRoutes       from './routes/tickets.js';
import analyticsRoutes    from './routes/analytics.js';

dotenv.config();

process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Unhandled rejection (non-fatal):', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
  process.exit(1);
});

const app  = express();
const PORT = process.env.PORT || 3002;
const isProd = process.env.NODE_ENV === 'production';

const SESSION_COOKIE = 'mf_session';
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24h

// ── Startup checks ────────────────────────────────────────────────────────────
if (!process.env.SESSION_SECRET) {
  console.error('❌  SESSION_SECRET is required. Set it in your .env file.');
  process.exit(1);
}

// ── Connect to MongoDB ────────────────────────────────────────────────────────
connectDB();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_ORIGIN,
  credentials: true,
  exposedHeaders: ['X-Session-Token'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ── JWT Session Middleware ────────────────────────────────────────────────────
// Reads session JWT from:
//   1. Authorization: Bearer <token>  header (primary — SPA localStorage flow)
//   2. mf_session cookie              (fallback — local dev)
// Returns a fresh signed JWT in X-Session-Token response header so the client
// can persist refreshed OAuth tokens (e.g. after Google access-token renewal).
app.use((req, res, next) => {
  // Read
  const authHeader = req.headers['authorization'];
  const raw = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.cookies?.[SESSION_COOKIE];

  req.session = {};
  if (raw) {
    try {
      const { iat, exp, ...data } = jwt.verify(raw, process.env.SESSION_SECRET);
      req.session = data;
    } catch { /* expired or tampered — start fresh */ }
  }

  // Write helper — called before every JSON/redirect response
  const persistSession = () => {
    if (req.session === null) {
      res.clearCookie(SESSION_COOKIE, { path: '/' });
      return;
    }
    if (Object.keys(req.session).length === 0) return;
    const token = jwt.sign(req.session, process.env.SESSION_SECRET, { expiresIn: '24h' });
    // Header-based (SPA) — client reads this and updates localStorage
    res.setHeader('X-Session-Token', token);
    // Cookie-based fallback (local dev)
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    });
  };

  const origRedirect = res.redirect.bind(res);
  res.redirect = (urlOrStatus, url) => {
    persistSession();
    return typeof urlOrStatus === 'number'
      ? origRedirect(urlOrStatus, url)
      : origRedirect(urlOrStatus);
  };

  const origJson = res.json.bind(res);
  res.json = (body) => {
    persistSession();
    return origJson(body);
  };

  next();
});

// ── CSRF Protection ───────────────────────────────────────────────────────────
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET,
  getSessionIdentifier: (req) => req.session?.user?.email || req.cookies?.[SESSION_COOKIE] || 'anon',
  cookieName: '_csrf',
  cookieOptions: { httpOnly: true, sameSite: 'lax', secure: isProd },
  getTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

app.get('/api/csrf-token', (req, res) => {
  const token = generateCsrfToken(req, res);
  res.json({ csrfToken: token });
});

app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path.startsWith('/auth/')) {
    return next();
  }
  doubleCsrfProtection(req, res, next);
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth',          authRoutes);
app.use('/api/emails',    emailRoutes);
app.use('/api/reply',     replyRoutes);
app.use('/api/send',      sendRoutes);
app.use('/api/workspace',     workspaceRoutes);
app.use('/api/email-status',  emailStatusRoutes);
app.use('/api/tickets',       ticketRoutes);
app.use('/api/analytics',     analyticsRoutes);

app.get('/api/profile', requireAuth, (req, res) => {
  res.json(req.session.user);
});

// ── Local dev server ──────────────────────────────────────────────────────────
if (!isProd) {
  const server = app.listen(PORT, () => {
    console.log(`\n✅  MailFlow server  →  http://localhost:${PORT}`);
    console.log(`🔐  Login           →  http://localhost:${PORT}/auth/google`);
    if (!process.env.GROQ_API_KEY) console.warn('\n⚠️   GROQ_API_KEY not set\n');
    if (!process.env.MONGODB_URI)  console.warn('⚠️   MONGODB_URI not set — no database\n');
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') console.error(`\n❌  Port ${PORT} is already in use.\n`);
    else console.error('Server error:', err.message);
    process.exit(1);
  });
}

export default app;
