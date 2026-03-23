const jwt = require('jsonwebtoken');
const { query } = require('../utils/db');

/**
 * Verify access token and attach user to request.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Fetch fresh user from DB (catches revoked/deactivated accounts)
    const result = await query(
      `SELECT u.id, u.org_id, u.email, u.first_name, u.last_name,
              u.role, u.is_active, u.totp_enabled, u.approver_id,
              o.slug as org_slug, o.status as org_status,
              o.app_name, o.primary_colour, o.feature_gps,
              o.feature_checklist, o.feature_offline, o.feature_2fa
       FROM users u
       JOIN organisations o ON o.id = u.org_id
       WHERE u.id = $1`,
      [decoded.userId],
      decoded.orgId,
      decoded.role === 'super_admin'
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }
    if (user.org_status === 'suspended') {
      return res.status(403).json({ error: 'Organisation is suspended' });
    }

    req.user = user;
    req.orgId = user.org_id;
    req.isSuperAdmin = user.role === 'super_admin';
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Role guard factory.
 * Usage: requireRole('approver', 'org_admin', 'super_admin')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

const requireWorker   = requireRole('worker', 'approver', 'org_admin', 'super_admin');
const requireApprover = requireRole('approver', 'org_admin', 'super_admin');
const requireAdmin    = requireRole('org_admin', 'super_admin');
const requireSuper    = requireRole('super_admin');

module.exports = { authenticate, requireRole, requireWorker, requireApprover, requireAdmin, requireSuper };
