/**
 * Shared authentication middleware.
 * Replaces the manual `if (!req.session?.tokens)` checks in every route.
 */

// Requires a valid Gmail OAuth session (tokens present)
export function requireTokens(req, res, next) {
  if (!req.session?.tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Requires a logged-in user (user info in session)
export function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Requires manager or owner role
export function requireManager(req, res, next) {
  const role = req.session?.user?.role;
  if (role !== 'owner' && role !== 'manager') {
    return res.status(403).json({ error: 'Only managers and owners can do this' });
  }
  next();
}
