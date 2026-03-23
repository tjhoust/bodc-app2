// ============================================================
// BODC — Routes: users, orgs, sites, notifications, reports
// ============================================================

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../utils/db');
const { authenticate, requireApprover, requireAdmin, requireSuper } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');
const { sendEmail } = require('../utils/email');

// ── USERS ROUTER ──────────────────────────────────────────────

const usersRouter = express.Router();
usersRouter.use(authenticate);

// GET /users — list org users (admin/approver)
usersRouter.get('/', requireApprover, async (req, res) => {
  try {
    const { role, search, is_active } = req.query;
    const params = [req.orgId];
    const conditions = ['u.org_id = $1'];

    if (role)      { conditions.push(`u.role = $${params.length + 1}`);      params.push(role); }
    if (search)    { conditions.push(`(u.first_name ILIKE $${params.length + 1} OR u.last_name ILIKE $${params.length + 1} OR u.email ILIKE $${params.length + 1})`); params.push(`%${search}%`); }
    if (is_active !== undefined) { conditions.push(`u.is_active = $${params.length + 1}`); params.push(is_active === 'true'); }

    // Approvers only see workers assigned to them
    if (req.user.role === 'approver') {
      conditions.push(`(u.approver_id = $${params.length + 1} OR u.id = $${params.length + 1})`);
      params.push(req.user.id);
    }

    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.capture_mode,
              u.is_active, u.totp_enabled, u.last_login_at, u.created_at,
              ap.first_name || ' ' || ap.last_name as approver_name,
              (SELECT array_agg(s.name) FROM user_sites us JOIN sites s ON s.id = us.site_id WHERE us.user_id = u.id) as sites
       FROM users u
       LEFT JOIN users ap ON ap.id = u.approver_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.last_name, u.first_name`,
      params, req.orgId
    );

    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /users/invite
usersRouter.post('/invite', requireAdmin, async (req, res) => {
  try {
    const { email, first_name, last_name, role = 'worker', approver_id, capture_mode = 'timer', site_ids = [] } = req.body;
    if (!email || !first_name || !last_name) return res.status(400).json({ error: 'email, first_name, last_name required' });

    // Check existing
    const existing = await query('SELECT id FROM users WHERE org_id = $1 AND email = $2', [req.orgId, email], req.orgId);
    if (existing.rows.length) return res.status(409).json({ error: 'Email already exists in this organisation' });

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const userId = uuidv4();
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, role,
          approver_id, capture_mode, invitation_token, invitation_expires, is_active)
         VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9,$10,false)`,
        [userId, req.orgId, email, first_name, last_name, role,
         approver_id || null, capture_mode, inviteToken, expires]
      );

      if (site_ids.length) {
        for (const siteId of site_ids) {
          await client.query('INSERT INTO user_sites (user_id, site_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, siteId]);
        }
      }
    }, req.orgId);

    // Get org branding for email
    const orgResult = await query('SELECT app_name FROM organisations WHERE id = $1', [req.orgId], req.orgId);
    const appName = orgResult.rows[0]?.app_name || 'BODC';

    const inviteUrl = `${process.env.FRONTEND_URL}/accept-invite?token=${inviteToken}`;
    await sendEmail({
      to: email,
      subject: `You've been invited to ${appName}`,
      html: `<p>Hi ${first_name},</p><p>You've been invited to join <strong>${appName}</strong> as a ${role.replace('_', ' ')}.</p><p>Click below to set your password and activate your account. This link expires in 7 days.</p><p><a href="${inviteUrl}">Accept invitation</a></p>`
    });

    await auditLog(req.orgId, req.user.id, req.user.email, 'user.invited', 'user', userId, { email, role }, req);
    res.status(201).json({ message: 'Invitation sent', user_id: userId });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// PATCH /users/:id
usersRouter.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { first_name, last_name, role, capture_mode, approver_id, is_active } = req.body;
    const result = await query(
      `UPDATE users SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        role = COALESCE($3, role),
        capture_mode = COALESCE($4, capture_mode),
        approver_id = COALESCE($5, approver_id),
        is_active = COALESCE($6, is_active)
       WHERE id = $7 AND org_id = $8 RETURNING *`,
      [first_name, last_name, role, capture_mode, approver_id, is_active, req.params.id, req.orgId],
      req.orgId
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    await auditLog(req.orgId, req.user.id, req.user.email, 'user.updated', 'user', req.params.id, req.body, req);
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /users/me/profile
usersRouter.get('/me/profile', async (req, res) => {
  try {
    const result = await query(
      `SELECT u.*, array_agg(json_build_object('id',s.id,'name',s.name,'is_default',us.is_default)) as sites
       FROM users u
       LEFT JOIN user_sites us ON us.user_id = u.id
       LEFT JOIN sites s ON s.id = us.site_id
       WHERE u.id = $1 GROUP BY u.id`,
      [req.user.id], req.orgId
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PATCH /users/me/profile
usersRouter.patch('/me/profile', async (req, res) => {
  try {
    const { first_name, last_name, capture_mode, push_token } = req.body;
    const result = await query(
      `UPDATE users SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        capture_mode = COALESCE($3, capture_mode),
        push_token = COALESCE($4, push_token)
       WHERE id = $5 RETURNING id, first_name, last_name, capture_mode`,
      [first_name, last_name, capture_mode, push_token, req.user.id], req.orgId
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ── ORGANISATIONS ROUTER ──────────────────────────────────────

const orgsRouter = express.Router();
orgsRouter.use(authenticate);

// GET /orgs/me
orgsRouter.get('/me', async (req, res) => {
  try {
    const result = await query('SELECT * FROM organisations WHERE id = $1', [req.orgId], req.orgId);
    res.json({ organisation: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch organisation' });
  }
});

// PATCH /orgs/me/branding
orgsRouter.patch('/me/branding', requireAdmin, async (req, res) => {
  try {
    const { app_name, primary_colour, accent_colour, logo_url, custom_domain } = req.body;
    const result = await query(
      `UPDATE organisations SET
        app_name = COALESCE($1, app_name),
        primary_colour = COALESCE($2, primary_colour),
        accent_colour = COALESCE($3, accent_colour),
        logo_url = COALESCE($4, logo_url),
        custom_domain = COALESCE($5, custom_domain)
       WHERE id = $6 RETURNING *`,
      [app_name, primary_colour, accent_colour, logo_url, custom_domain, req.orgId], req.orgId
    );
    await auditLog(req.orgId, req.user.id, req.user.email, 'org.branding_updated', 'organisation', req.orgId, req.body, req);
    res.json({ organisation: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update branding' });
  }
});

// PATCH /orgs/me/features
orgsRouter.patch('/me/features', requireAdmin, async (req, res) => {
  try {
    const { feature_gps, feature_manual_only, feature_checklist, feature_map, feature_2fa, feature_offline } = req.body;
    const old = await query('SELECT feature_gps, feature_manual_only, feature_checklist, feature_map, feature_2fa, feature_offline FROM organisations WHERE id = $1', [req.orgId], req.orgId);
    const result = await query(
      `UPDATE organisations SET
        feature_gps = COALESCE($1, feature_gps),
        feature_manual_only = COALESCE($2, feature_manual_only),
        feature_checklist = COALESCE($3, feature_checklist),
        feature_map = COALESCE($4, feature_map),
        feature_2fa = COALESCE($5, feature_2fa),
        feature_offline = COALESCE($6, feature_offline)
       WHERE id = $7 RETURNING *`,
      [feature_gps, feature_manual_only, feature_checklist, feature_map, feature_2fa, feature_offline, req.orgId], req.orgId
    );
    await auditLog(req.orgId, req.user.id, req.user.email, 'org.features_updated', 'organisation', req.orgId, { old: old.rows[0], new: req.body }, req);
    res.json({ organisation: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update features' });
  }
});

// GET /orgs — super admin only: list all orgs
orgsRouter.get('/', requireSuper, async (req, res) => {
  try {
    const result = await query(
      `SELECT o.*, COUNT(u.id) as user_count
       FROM organisations o
       LEFT JOIN users u ON u.org_id = o.id AND u.is_active = true
       GROUP BY o.id ORDER BY o.created_at DESC`,
      [], null, true
    );
    res.json({ organisations: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch organisations' });
  }
});

// POST /orgs — super admin: create org
orgsRouter.post('/', requireSuper, async (req, res) => {
  try {
    const {
      name, slug, industry, country, state, abn, plan = 'trial', max_users = 25,
      app_name = 'BODC', primary_colour = '#1a6dc9',
      admin_email, admin_first_name, admin_last_name,
      feature_gps = true, feature_checklist = true, feature_2fa = true, feature_offline = true
    } = req.body;

    if (!name || !slug || !admin_email) return res.status(400).json({ error: 'name, slug, admin_email required' });

    const orgId = uuidv4();
    const adminId = uuidv4();
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO organisations (id, name, slug, industry, country, state, abn, plan, max_users,
          app_name, primary_colour, feature_gps, feature_checklist, feature_2fa, feature_offline, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [orgId, name, slug, industry, country, state, abn, plan, max_users,
         app_name, primary_colour, feature_gps, feature_checklist, feature_2fa, feature_offline, req.user.id]
      );

      await client.query(
        `INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, role,
          invitation_token, invitation_expires, is_active)
         VALUES ($1,$2,$3,'pending',$4,$5,'org_admin',$6,$7,false)`,
        [adminId, orgId, admin_email, admin_first_name || 'Admin', admin_last_name || 'User', inviteToken, inviteExpires]
      );
    }, null, true);

    const inviteUrl = `${process.env.FRONTEND_URL}/accept-invite?token=${inviteToken}`;
    await sendEmail({
      to: admin_email,
      subject: `Welcome to ${app_name} — set up your account`,
      html: `<p>Hi ${admin_first_name || 'there'},</p><p>Your organisation <strong>${name}</strong> has been set up on <strong>${app_name}</strong>.</p><p>Click below to set your password and get started.</p><p><a href="${inviteUrl}">Activate your account</a></p>`
    });

    await auditLog(null, req.user.id, req.user.email, 'organisation.created', 'organisation', orgId, { name, slug }, req);
    res.status(201).json({ organisation_id: orgId, admin_id: adminId });
  } catch (err) {
    console.error('Create org error:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Organisation slug already taken' });
    res.status(500).json({ error: 'Failed to create organisation' });
  }
});

// ── SITES ROUTER ──────────────────────────────────────────────

const sitesRouter = express.Router();
sitesRouter.use(authenticate);

sitesRouter.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, COUNT(us.user_id) as worker_count
       FROM sites s
       LEFT JOIN user_sites us ON us.site_id = s.id
       WHERE s.org_id = $1 AND s.is_active = true
       GROUP BY s.id ORDER BY s.name`,
      [req.orgId], req.orgId
    );
    res.json({ sites: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

sitesRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, description, boundary_type = 'radius', centre_lat, centre_lng,
            radius_metres = 200, boundary_polygon, enforcement_mode = 'log_flag',
            gps_required = true, alert_threshold_minutes = 15 } = req.body;

    const result = await query(
      `INSERT INTO sites (org_id, name, description, boundary_type, centre_lat, centre_lng,
        radius_metres, boundary_polygon, enforcement_mode, gps_required, alert_threshold_minutes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.orgId, name, description, boundary_type, centre_lat, centre_lng,
       radius_metres, boundary_polygon ? JSON.stringify(boundary_polygon) : null,
       enforcement_mode, gps_required, alert_threshold_minutes],
      req.orgId
    );
    await auditLog(req.orgId, req.user.id, req.user.email, 'site.created', 'site', result.rows[0].id, req.body, req);
    res.status(201).json({ site: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create site' });
  }
});

sitesRouter.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, centre_lat, centre_lng, radius_metres, boundary_polygon, enforcement_mode, alert_threshold_minutes, gps_required } = req.body;
    const result = await query(
      `UPDATE sites SET
        name = COALESCE($1, name),
        centre_lat = COALESCE($2, centre_lat),
        centre_lng = COALESCE($3, centre_lng),
        radius_metres = COALESCE($4, radius_metres),
        boundary_polygon = COALESCE($5, boundary_polygon),
        enforcement_mode = COALESCE($6, enforcement_mode),
        alert_threshold_minutes = COALESCE($7, alert_threshold_minutes),
        gps_required = COALESCE($8, gps_required)
       WHERE id = $9 AND org_id = $10 RETURNING *`,
      [name, centre_lat, centre_lng, radius_metres,
       boundary_polygon ? JSON.stringify(boundary_polygon) : null,
       enforcement_mode, alert_threshold_minutes, gps_required,
       req.params.id, req.orgId], req.orgId
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Site not found' });
    await auditLog(req.orgId, req.user.id, req.user.email, 'site.updated', 'site', req.params.id, req.body, req);
    res.json({ site: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update site' });
  }
});

// ── NOTIFICATIONS ROUTER ──────────────────────────────────────

const notifsRouter = express.Router();
notifsRouter.use(authenticate);

notifsRouter.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY sent_at DESC LIMIT 50`,
      [req.user.id], req.orgId
    );
    const unread = result.rows.filter(n => !n.is_read).length;
    res.json({ notifications: result.rows, unread });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

notifsRouter.post('/read-all', async (req, res) => {
  try {
    await query(
      'UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false',
      [req.user.id], req.orgId
    );
    res.json({ message: 'All notifications marked read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

notifsRouter.patch('/:id/read', async (req, res) => {
  try {
    await query(
      'UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id], req.orgId
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// GET /notifications/preferences
notifsRouter.get('/preferences', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [req.user.id], req.orgId
    );
    res.json({ preferences: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// PUT /notifications/preferences
notifsRouter.put('/preferences', async (req, res) => {
  try {
    const { preferences } = req.body; // [{event, channel, is_enabled}]
    for (const pref of preferences) {
      await query(
        `INSERT INTO notification_preferences (user_id, org_id, event, channel, is_enabled)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id, event, channel) DO UPDATE SET is_enabled = EXCLUDED.is_enabled`,
        [req.user.id, req.orgId, pref.event, pref.channel, pref.is_enabled], req.orgId
      );
    }
    res.json({ message: 'Preferences updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ── REPORTS ROUTER ────────────────────────────────────────────

const reportsRouter = express.Router();
reportsRouter.use(authenticate);
reportsRouter.use(requireApprover);

reportsRouter.get('/summary', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const start = start_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end   = end_date   || new Date().toISOString().split('T')[0];

    const scopeCondition = req.user.role === 'approver' ? `AND e.approver_id = '${req.user.id}'` : '';

    const [totals, byWorker, byCode, daily, exceptions] = await Promise.all([
      query(`SELECT
               COALESCE(SUM(total_minutes) / 60.0, 0) as total_hours,
               COUNT(*) as total_entries,
               COUNT(*) FILTER (WHERE status = 'approved') as approved_entries,
               COUNT(*) FILTER (WHERE status = 'submitted') as pending_entries,
               COUNT(*) FILTER (WHERE gps_captured = false) as missing_gps
             FROM time_entries e
             WHERE org_id = $1 AND entry_date BETWEEN $2 AND $3
               AND deleted_at IS NULL ${scopeCondition}`,
        [req.orgId, start, end], req.orgId),

      query(`SELECT u.first_name || ' ' || u.last_name as worker,
               u.id as user_id,
               ROUND(SUM(e.total_minutes)::numeric / 60, 2) as hours,
               COUNT(*) as entries
             FROM time_entries e
             JOIN users u ON u.id = e.user_id
             WHERE e.org_id = $1 AND e.entry_date BETWEEN $2 AND $3
               AND e.deleted_at IS NULL ${scopeCondition}
             GROUP BY u.id, u.first_name, u.last_name
             ORDER BY hours DESC`,
        [req.orgId, start, end], req.orgId),

      query(`SELECT wc.code, wc.name,
               ROUND(SUM(e.total_minutes)::numeric / 60, 2) as hours
             FROM time_entries e
             JOIN work_codes wc ON wc.id = e.work_code_id
             WHERE e.org_id = $1 AND e.entry_date BETWEEN $2 AND $3
               AND e.deleted_at IS NULL ${scopeCondition}
             GROUP BY wc.id, wc.code, wc.name ORDER BY hours DESC`,
        [req.orgId, start, end], req.orgId),

      query(`SELECT entry_date,
               ROUND(SUM(total_minutes)::numeric / 60, 2) as hours,
               COUNT(*) as entries
             FROM time_entries e
             WHERE org_id = $1 AND entry_date BETWEEN $2 AND $3
               AND deleted_at IS NULL ${scopeCondition}
             GROUP BY entry_date ORDER BY entry_date`,
        [req.orgId, start, end], req.orgId),

      query(`SELECT COUNT(*) as count FROM gps_exceptions WHERE org_id = $1 AND is_reviewed = false`,
        [req.orgId], req.orgId),
    ]);

    const t = totals.rows[0];
    const approvalRate = t.total_entries > 0 ? Math.round(t.approved_entries / t.total_entries * 100) : 0;
    const gpsCompliance = t.total_entries > 0 ? Math.round((1 - t.missing_gps / t.total_entries) * 100) : 100;

    res.json({
      summary: { ...t, approval_rate: approvalRate, gps_compliance: gpsCompliance },
      by_worker: byWorker.rows,
      by_work_code: byCode.rows,
      daily_trend: daily.rows,
      open_exceptions: exceptions.rows[0].count,
    });
  } catch (err) {
    console.error('Reports error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ── AUDIT LOG ROUTER ──────────────────────────────────────────

const auditRouter = express.Router();
auditRouter.use(authenticate);
auditRouter.use(requireAdmin);

auditRouter.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, action } = req.query;
    const offset = (page - 1) * limit;
    const params = [req.orgId];
    const conditions = ['org_id = $1'];
    if (action) { conditions.push(`action ILIKE $${params.length + 1}`); params.push(`%${action}%`); }

    const result = await query(
      `SELECT *, COUNT(*) OVER() as total
       FROM audit_log
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset], req.orgId, req.isSuperAdmin
    );

    res.json({
      logs: result.rows,
      pagination: { page: +page, limit: +limit, total: +(result.rows[0]?.total || 0) }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

module.exports = { usersRouter, orgsRouter, sitesRouter, notifsRouter, reportsRouter, auditRouter };
