import express from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import MongoStore from 'connect-mongo';
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

dotenv.config();

process.on('unhandledRejection', (reason) => {
  // Log but do NOT exit — Groq rate limits, DB blips, etc. should not kill the server
  console.error('⚠️  Unhandled rejection (non-fatal):', reason);
});

process.on('uncaughtException', (err) => {
  // Truly unexpected synchronous throws — exit is appropriate here
  console.error('❌ Uncaught exception:', err);
  process.exit(1);
});

const app  = express();
const PORT = process.env.PORT || 3002;

// ── Startup checks ────────────────────────────────────────────────────────────
if (!process.env.SESSION_SECRET) {
  console.error('❌  SESSION_SECRET is required. Set it in your .env file.');
  process.exit(1);
}

// ── Connect to MongoDB ────────────────────────────────────────────────────────
connectDB();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 },
  store: (() => {
    if (!process.env.MONGODB_URI) return undefined;
    const store = MongoStore.create({ mongoUrl: process.env.MONGODB_URI, collectionName: 'sessions' });
    store.on('error', (err) => console.error('❌ Session store error:', err));
    return store;
  })(),
}));

// ── CSRF Protection ──────────────────────────────────────────────────────────
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET,
  getSessionIdentifier: (req) => req.session?.id || '',
  cookieName: '_csrf',
  cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
  getTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

// Endpoint to get CSRF token — frontend calls this on load
// Writing to the session forces express-session to persist it and send
// a stable session cookie, which csrf-csrf needs to validate future tokens.
app.get('/api/csrf-token', (req, res) => {
  req.session.csrfInit = true;
  const token = generateCsrfToken(req, res);
  res.json({ csrfToken: token });
});

// Apply CSRF protection to all state-changing requests (POST/PUT/DELETE)
app.use((req, res, next) => {
  // Skip CSRF for GET/HEAD/OPTIONS and OAuth callback
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

// GET /api/profile
app.get('/api/profile', requireAuth, (req, res) => {
  res.json(req.session.user);
});

// ── Local dev server (not used by Vercel serverless) ─────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const server = app.listen(PORT, () => {
    console.log(`\n✅  MailFlow server  →  http://localhost:${PORT}`);
    console.log(`🔐  Login           →  http://localhost:${PORT}/auth/google`);
    console.log(`📧  Emails API      →  http://localhost:${PORT}/api/emails`);
    if (!process.env.GROQ_API_KEY) console.warn('\n⚠️   GROQ_API_KEY not set\n');
    else console.log('✨  Groq AI         →  enabled\n');
    if (!process.env.MONGODB_URI) console.warn('⚠️   MONGODB_URI not set — no database\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌  Port ${PORT} is already in use.`);
      console.error(`    Get-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess | Stop-Process -Force\n`);
    } else {
      console.error('Server error:', err.message);
    }
    process.exit(1);
  });
}

export default app;

