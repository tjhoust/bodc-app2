const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { TOTP } = require('otpauth');
const QRCode = require('qrcode');
const { query, transaction } = require('../utils/db');
const { authenticate } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');
const { auditLog } = require('../utils/audit');

// ── Helpers ──────────────────────────────────────────────────

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, orgId: user.org_id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id, orgId: user.org_id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '30d' }
  );
}

async function storeRefreshToken(userId, token, req) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, hash, expires, req.ip, req.headers['user-agent']]
  );
}

// ── POST /auth/login ─────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const { email, password, totp_code, org_slug } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user — join org for context
    const result = await query(
      `SELECT u.*, o.status as org_status, o.slug as org_slug, o.app_name
       FROM users u
       JOIN organisations o ON o.id = u.org_id
       WHERE LOWER(u.email) = LOWER($1) AND u.is_active = true`,
      [email],
      null, true  // super admin context to search across orgs
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // If org_slug provided, verify it matches
    if (org_slug && user.org_slug !== org_slug) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.org_status === 'suspended') {
      return res.status(403).json({ error: 'Your organisation account is suspended' });
    }

    // 2FA check
    if (user.totp_enabled) {
      if (!totp_code) {
        return res.status(200).json({ requires_2fa: true, user_id: user.id });
      }
      const totp = new TOTP({ secret: user.totp_secret, algorithm: 'SHA1', digits: 6, period: 30 });
      const delta = totp.validate({ token: totp_code, window: 1 });
      if (delta === null) {
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }
    }

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await storeRefreshToken(user.id, refreshToken, req);

    // Update last login
    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id], user.org_id);

    await auditLog(user.org_id, user.id, user.email, 'user.login', null, null, null, req);

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        org_id: user.org_id,
        org_slug: user.org_slug,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        capture_mode: user.capture_mode,
        totp_enabled: user.totp_enabled,
        app_name: user.app_name,
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /auth/refresh ────────────────────────────────────────

router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    const hash = crypto.createHash('sha256').update(refresh_token).digest('hex');

    const tokenResult = await query(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [hash], null, true
    );

    if (!tokenResult.rows.length) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const userResult = await query(
      'SELECT * FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId], decoded.orgId
    );

    if (!userResult.rows.length) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Rotate tokens
    await query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
      [hash]
    );

    const newAccess  = generateAccessToken(user);
    const newRefresh = generateRefreshToken(user);
    await storeRefreshToken(user.id, newRefresh, req);

    res.json({ access_token: newAccess, refresh_token: newRefresh });
  } catch (err) {
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────

router.post('/logout', authenticate, async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      const hash = crypto.createHash('sha256').update(refresh_token).digest('hex');
      await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1', [hash]);
    }
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ── POST /auth/2fa/setup ──────────────────────────────────────

router.post('/2fa/setup', authenticate, async (req, res) => {
  try {
    const totp = new TOTP({
      issuer: 'BODC',
      label: req.user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    const secret = totp.secret.base32;
    const uri = totp.toString();
    const qrCode = await QRCode.toDataURL(uri);

    // Store secret temporarily (not enabled yet)
    await query(
      'UPDATE users SET totp_secret = $1 WHERE id = $2',
      [secret, req.user.id], req.orgId
    );

    res.json({ secret, qr_code: qrCode, uri });
  } catch (err) {
    res.status(500).json({ error: '2FA setup failed' });
  }
});

// ── POST /auth/2fa/verify ─────────────────────────────────────

router.post('/2fa/verify', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    const userResult = await query('SELECT totp_secret FROM users WHERE id = $1', [req.user.id], req.orgId);
    const { totp_secret } = userResult.rows[0];

    const totp = new TOTP({ secret: totp_secret, algorithm: 'SHA1', digits: 6, period: 30 });
    const delta = totp.validate({ token: code, window: 1 });

    if (delta === null) return res.status(400).json({ error: 'Invalid code' });

    await query(
      'UPDATE users SET totp_enabled = true, totp_verified_at = NOW() WHERE id = $1',
      [req.user.id], req.orgId
    );

    await auditLog(req.orgId, req.user.id, req.user.email, 'user.2fa_enabled', 'user', req.user.id, null, req);
    res.json({ message: '2FA enabled' });
  } catch (err) {
    res.status(500).json({ error: '2FA verification failed' });
  }
});

// ── POST /auth/2fa/disable ────────────────────────────────────

router.post('/2fa/disable', authenticate, async (req, res) => {
  try {
    const { password } = req.body;
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id], req.orgId);
    const ok = await bcrypt.compare(password, userResult.rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Incorrect password' });

    await query(
      'UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE id = $1',
      [req.user.id], req.orgId
    );
    res.json({ message: '2FA disabled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// ── POST /auth/forgot-password ────────────────────────────────

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await query(
      'SELECT id, org_id, first_name FROM users WHERE LOWER(email) = LOWER($1) AND is_active = true',
      [email], null, true
    );

    // Always return 200 to prevent email enumeration
    if (!result.rows.length) return res.json({ message: 'If that email exists, a reset link has been sent' });

    const user = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
      [token, expires, user.id], user.org_id
    );

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await sendEmail({
      to: email,
      subject: 'Reset your BODC password',
      html: `<p>Hi ${user.first_name},</p><p>Click the link below to reset your password. It expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
    });

    res.json({ message: 'If that email exists, a reset link has been sent' });
  } catch (err) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// ── POST /auth/reset-password ─────────────────────────────────

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const result = await query(
      `SELECT id, org_id FROM users
       WHERE password_reset_token = $1 AND password_reset_expires > NOW()`,
      [token], null, true
    );

    if (!result.rows.length) return res.status(400).json({ error: 'Invalid or expired reset token' });

    const user = result.rows[0];
    const hash = await bcrypt.hash(password, 12);

    await query(
      'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
      [hash, user.id], user.org_id
    );

    // Revoke all refresh tokens on password reset
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1', [user.id]);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// ── POST /auth/accept-invite ──────────────────────────────────

router.post('/accept-invite', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const result = await query(
      `SELECT id, org_id, email, first_name, role FROM users
       WHERE invitation_token = $1 AND invitation_expires > NOW()`,
      [token], null, true
    );

    if (!result.rows.length) return res.status(400).json({ error: 'Invalid or expired invitation' });

    const user = result.rows[0];
    const hash = await bcrypt.hash(password, 12);

    await query(
      `UPDATE users SET
         password_hash = $1,
         invitation_token = NULL,
         invitation_expires = NULL,
         is_active = true
       WHERE id = $2`,
      [hash, user.id], user.org_id
    );

    await auditLog(user.org_id, user.id, user.email, 'user.accepted_invite', 'user', user.id, null, req);
    res.json({ message: 'Account activated. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Invite acceptance failed' });
  }
});

// ── GET /auth/me ──────────────────────────────────────────────

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
