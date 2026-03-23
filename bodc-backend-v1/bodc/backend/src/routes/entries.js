const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../utils/db');
const { authenticate, requireApprover } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');
const { createNotification } = require('../utils/notifications');
const { checkGpsBoundary } = require('../utils/gps');

// All routes require auth
router.use(authenticate);

// ── GET /entries ──────────────────────────────────────────────
// Workers: own entries. Approvers+: assigned team or all.

router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, status, user_id, site_id, work_code_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const params = [req.orgId];
    const conditions = ['e.org_id = $1', 'e.deleted_at IS NULL'];

    // Role-based scoping
    if (req.user.role === 'worker') {
      conditions.push(`e.user_id = $${params.length + 1}`);
      params.push(req.user.id);
    } else if (req.user.role === 'approver') {
      // Approvers see workers assigned to them
      conditions.push(`e.approver_id = $${params.length + 1}`);
      params.push(req.user.id);
    }
    // org_admin and super_admin see all

    if (user_id && req.user.role !== 'worker') {
      conditions.push(`e.user_id = $${params.length + 1}`);
      params.push(user_id);
    }
    if (start_date) { conditions.push(`e.entry_date >= $${params.length + 1}`); params.push(start_date); }
    if (end_date)   { conditions.push(`e.entry_date <= $${params.length + 1}`); params.push(end_date); }
    if (status)     { conditions.push(`e.status = $${params.length + 1}`);      params.push(status); }
    if (site_id)    { conditions.push(`e.site_id = $${params.length + 1}`);     params.push(site_id); }
    if (work_code_id) { conditions.push(`e.work_code_id = $${params.length + 1}`); params.push(work_code_id); }

    const sql = `
      SELECT
        e.*,
        u.first_name, u.last_name, u.email,
        s.name as site_name,
        wc.code as work_code, wc.name as work_code_name,
        ap.first_name as approver_first_name, ap.last_name as approver_last_name,
        ROUND(e.total_minutes::numeric / 60, 2) as total_hours,
        COUNT(*) OVER() as total_count
      FROM time_entries e
      JOIN users u ON u.id = e.user_id
      LEFT JOIN sites s ON s.id = e.site_id
      LEFT JOIN work_codes wc ON wc.id = e.work_code_id
      LEFT JOIN users ap ON ap.id = e.approver_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY e.entry_date DESC, e.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await query(sql, params, req.orgId, req.isSuperAdmin);
    const total = result.rows[0]?.total_count || 0;

    res.json({
      entries: result.rows,
      pagination: { page: +page, limit: +limit, total: +total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Get entries error:', err);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// ── GET /entries/:id ──────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*, u.first_name, u.last_name, u.email,
              s.name as site_name, s.centre_lat, s.centre_lng, s.radius_metres,
              wc.code as work_code, wc.name as work_code_name,
              ROUND(e.total_minutes::numeric / 60, 2) as total_hours
       FROM time_entries e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN sites s ON s.id = e.site_id
       LEFT JOIN work_codes wc ON wc.id = e.work_code_id
       WHERE e.id = $1 AND e.org_id = $2 AND e.deleted_at IS NULL`,
      [req.params.id, req.orgId], req.orgId, req.isSuperAdmin
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Entry not found' });

    // Workers can only view their own entries
    const entry = result.rows[0];
    if (req.user.role === 'worker' && entry.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fetch GPS track points
    const gps = await query(
      'SELECT lat, lng, accuracy, captured_at FROM gps_track_points WHERE entry_id = $1 ORDER BY captured_at',
      [req.params.id]
    );

    res.json({ entry: { ...entry, gps_track: gps.rows } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// ── POST /entries ─────────────────────────────────────────────
// Create entry (timer start or manual)

router.post('/', async (req, res) => {
  try {
    const {
      site_id, work_code_id, entry_date, started_at, stopped_at,
      total_minutes, break_minutes = 0, start_lat, start_lng,
      start_accuracy, stop_lat, stop_lng, stop_accuracy,
      is_timer = true, notes, custom_fields = {},
      client_id  // idempotency key for offline
    } = req.body;

    if (!entry_date) return res.status(400).json({ error: 'entry_date is required' });
    if (!total_minutes && total_minutes !== 0) return res.status(400).json({ error: 'total_minutes is required' });

    // Idempotency check for offline sync
    if (client_id) {
      const existing = await query(
        'SELECT id FROM time_entries WHERE client_id = $1 AND org_id = $2',
        [client_id, req.orgId], req.orgId
      );
      if (existing.rows.length) {
        return res.status(200).json({ entry: existing.rows[0], duplicate: true });
      }
    }

    // Check GPS boundary
    let outsideBoundary = false;
    let outsideMinutes = 0;
    let gpsCaptured = !!(start_lat && start_lng);

    if (gpsCaptured && site_id) {
      const siteResult = await query(
        'SELECT * FROM sites WHERE id = $1', [site_id], req.orgId
      );
      if (siteResult.rows.length) {
        const site = siteResult.rows[0];
        outsideBoundary = !checkGpsBoundary(start_lat, start_lng, site);
      }
    }

    // Find approver for this worker
    const userResult = await query(
      'SELECT approver_id FROM users WHERE id = $1', [req.user.id], req.orgId
    );
    const approverId = userResult.rows[0]?.approver_id;

    const entryId = uuidv4();
    const result = await query(
      `INSERT INTO time_entries (
        id, org_id, user_id, site_id, work_code_id, approver_id,
        entry_date, started_at, stopped_at, total_minutes, break_minutes,
        start_lat, start_lng, start_accuracy, stop_lat, stop_lng, stop_accuracy,
        gps_captured, outside_boundary, outside_minutes,
        status, is_timer, notes, custom_fields, client_id, sync_status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
      ) RETURNING *`,
      [
        entryId, req.orgId, req.user.id, site_id || null, work_code_id || null, approverId || null,
        entry_date, started_at || null, stopped_at || null, total_minutes, break_minutes,
        start_lat || null, start_lng || null, start_accuracy || null,
        stop_lat || null, stop_lng || null, stop_accuracy || null,
        gpsCaptured, outsideBoundary, outsideMinutes,
        'draft', is_timer, notes || null,
        JSON.stringify(custom_fields), client_id || null, 'synced'
      ],
      req.orgId, req.isSuperAdmin
    );

    // Auto-flag GPS exceptions
    if (!gpsCaptured) {
      await query(
        `INSERT INTO gps_exceptions (org_id, entry_id, user_id, exception_type, detail)
         VALUES ($1, $2, $3, 'missing', 'No GPS coordinates captured')`,
        [req.orgId, entryId, req.user.id], req.orgId
      );
    }

    await auditLog(req.orgId, req.user.id, req.user.email, 'entry.created', 'time_entry', entryId, req.body, req);

    res.status(201).json({ entry: result.rows[0] });
  } catch (err) {
    console.error('Create entry error:', err);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

// ── PATCH /entries/:id ────────────────────────────────────────

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const current = await query(
      'SELECT * FROM time_entries WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL',
      [id, req.orgId], req.orgId
    );

    if (!current.rows.length) return res.status(404).json({ error: 'Entry not found' });

    const entry = current.rows[0];

    // Workers can only edit their own draft entries
    if (req.user.role === 'worker') {
      if (entry.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
      if (entry.status !== 'draft') return res.status(400).json({ error: 'Only draft entries can be edited' });
    }

    const { site_id, work_code_id, total_minutes, break_minutes, notes, custom_fields } = req.body;

    const result = await query(
      `UPDATE time_entries SET
        site_id = COALESCE($1, site_id),
        work_code_id = COALESCE($2, work_code_id),
        total_minutes = COALESCE($3, total_minutes),
        break_minutes = COALESCE($4, break_minutes),
        notes = COALESCE($5, notes),
        custom_fields = COALESCE($6, custom_fields)
       WHERE id = $7 RETURNING *`,
      [site_id, work_code_id, total_minutes, break_minutes, notes,
       custom_fields ? JSON.stringify(custom_fields) : null, id],
      req.orgId
    );

    await auditLog(req.orgId, req.user.id, req.user.email, 'entry.updated', 'time_entry', id, req.body, req);
    res.json({ entry: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// ── POST /entries/:id/submit ──────────────────────────────────

router.post('/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE time_entries SET status = 'submitted'
       WHERE id = $1 AND org_id = $2 AND user_id = $3 AND status = 'draft'
       RETURNING *, (SELECT approver_id FROM users WHERE id = $3) as approver_id_check`,
      [id, req.orgId, req.user.id], req.orgId
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Entry not found or not in draft status' });

    const entry = result.rows[0];

    // Notify approver
    if (entry.approver_id) {
      await createNotification(req.orgId, entry.approver_id, 'entry_submitted',
        'New timesheet submitted',
        `${req.user.first_name} ${req.user.last_name} submitted a timesheet for ${entry.entry_date}.`,
        'entry', id
      );
    }

    await auditLog(req.orgId, req.user.id, req.user.email, 'entry.submitted', 'time_entry', id, null, req);
    res.json({ entry: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit entry' });
  }
});

// ── POST /entries/:id/approve ─────────────────────────────────

router.post('/:id/approve', requireApprover, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE time_entries SET
        status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2 AND org_id = $3 AND status = 'submitted'
       RETURNING *`,
      [req.user.id, id, req.orgId], req.orgId
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Entry not found or not in submitted status' });

    const entry = result.rows[0];

    await createNotification(req.orgId, entry.user_id, 'entry_approved',
      'Your entry has been approved',
      `${req.user.first_name} ${req.user.last_name} approved your timesheet for ${entry.entry_date}.`,
      'entry', id
    );

    await auditLog(req.orgId, req.user.id, req.user.email, 'entry.approved', 'time_entry', id, null, req);
    res.json({ entry: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve entry' });
  }
});

// ── POST /entries/bulk-approve ────────────────────────────────

router.post('/bulk-approve', requireApprover, async (req, res) => {
  try {
    const { entry_ids } = req.body;
    if (!entry_ids?.length) return res.status(400).json({ error: 'entry_ids required' });

    const result = await query(
      `UPDATE time_entries SET
        status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = ANY($2::uuid[]) AND org_id = $3 AND status = 'submitted'
       RETURNING id, user_id, entry_date`,
      [req.user.id, entry_ids, req.orgId], req.orgId
    );

    // Notify each affected worker
    const workerGroups = {};
    result.rows.forEach(e => {
      if (!workerGroups[e.user_id]) workerGroups[e.user_id] = [];
      workerGroups[e.user_id].push(e.entry_date);
    });

    for (const [userId, dates] of Object.entries(workerGroups)) {
      await createNotification(req.orgId, userId, 'entry_approved',
        `${dates.length} ${dates.length === 1 ? 'entry' : 'entries'} approved`,
        `${req.user.first_name} ${req.user.last_name} approved ${dates.length} of your timesheets.`,
        'entry', null
      );
    }

    await auditLog(req.orgId, req.user.id, req.user.email, 'entry.bulk_approved', 'time_entry', null,
      { count: result.rows.length }, req);

    res.json({ approved: result.rows.length, entries: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Bulk approval failed' });
  }
});

// ── POST /entries/:id/query ───────────────────────────────────

router.post('/:id/query', requireApprover, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const { id } = req.params;

    await transaction(async (client) => {
      // Set entry to queried status
      await client.query(
        `UPDATE time_entries SET status = 'queried' WHERE id = $1 AND org_id = $2`,
        [id, req.orgId]
      );

      // Create query thread
      const queryResult = await client.query(
        'INSERT INTO queries (org_id, entry_id, raised_by) VALUES ($1, $2, $3) RETURNING id',
        [req.orgId, id, req.user.id]
      );
      const queryId = queryResult.rows[0].id;

      // Add first message
      await client.query(
        'INSERT INTO query_messages (query_id, sender_id, message) VALUES ($1, $2, $3)',
        [queryId, req.user.id, message]
      );

      return queryId;
    }, req.orgId);

    // Notify worker
    const entryResult = await query('SELECT user_id FROM time_entries WHERE id = $1', [id], req.orgId);
    if (entryResult.rows.length) {
      await createNotification(req.orgId, entryResult.rows[0].user_id, 'entry_queried',
        'Query raised on your entry',
        `${req.user.first_name} ${req.user.last_name} has raised a query on your entry.`,
        'entry', id
      );
    }

    await auditLog(req.orgId, req.user.id, req.user.email, 'query.raised', 'time_entry', id, { message }, req);
    res.json({ message: 'Query raised' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to raise query' });
  }
});

// ── POST /entries/sync (offline batch) ───────────────────────

router.post('/sync', async (req, res) => {
  try {
    const { entries } = req.body;
    if (!entries?.length) return res.status(400).json({ error: 'entries array required' });

    const results = [];
    for (const entry of entries) {
      try {
        // Each entry goes through the normal create flow
        entry.sync_status = 'synced';
        const mock = { body: entry, user: req.user, orgId: req.orgId, isSuperAdmin: req.isSuperAdmin, ip: req.ip, headers: req.headers };
        // Re-use create logic inline (simplified for sync)
        if (entry.client_id) {
          const existing = await query(
            'SELECT id FROM time_entries WHERE client_id = $1 AND org_id = $2',
            [entry.client_id, req.orgId], req.orgId
          );
          if (existing.rows.length) {
            results.push({ client_id: entry.client_id, id: existing.rows[0].id, status: 'duplicate' });
            continue;
          }
        }

        const entryId = uuidv4();
        await query(
          `INSERT INTO time_entries (id, org_id, user_id, site_id, work_code_id, entry_date,
            total_minutes, break_minutes, is_timer, notes, status, gps_captured,
            client_id, sync_status, offline_created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,$12,'synced',$13)`,
          [entryId, req.orgId, req.user.id, entry.site_id || null, entry.work_code_id || null,
           entry.entry_date, entry.total_minutes, entry.break_minutes || 0,
           entry.is_timer || false, entry.notes || null, entry.gps_captured || false,
           entry.client_id || null, entry.offline_created_at || null],
          req.orgId
        );
        results.push({ client_id: entry.client_id, id: entryId, status: 'created' });
      } catch (e) {
        results.push({ client_id: entry.client_id, status: 'failed', error: e.message });
      }
    }

    res.json({ synced: results.filter(r => r.status === 'created').length, results });
  } catch (err) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

// ── GET /entries/export/csv ───────────────────────────────────

router.get('/export/csv', requireApprover, async (req, res) => {
  try {
    const { start_date, end_date, user_id, site_id, status } = req.query;
    const params = [req.orgId];
    const conditions = ['e.org_id = $1', 'e.deleted_at IS NULL'];

    if (req.user.role === 'approver') {
      conditions.push(`e.approver_id = $${params.length + 1}`);
      params.push(req.user.id);
    }
    if (user_id)     { conditions.push(`e.user_id = $${params.length + 1}`);    params.push(user_id); }
    if (start_date)  { conditions.push(`e.entry_date >= $${params.length + 1}`); params.push(start_date); }
    if (end_date)    { conditions.push(`e.entry_date <= $${params.length + 1}`); params.push(end_date); }
    if (status)      { conditions.push(`e.status = $${params.length + 1}`);      params.push(status); }

    const result = await query(
      `SELECT e.entry_date, u.first_name || ' ' || u.last_name as worker,
              u.email, s.name as site, wc.code as work_code, wc.name as work_code_name,
              ROUND(e.total_minutes::numeric / 60, 2) as hours,
              e.break_minutes / 60.0 as break_hours,
              e.status, e.gps_captured, e.outside_boundary, e.notes,
              e.start_lat, e.start_lng, e.created_at
       FROM time_entries e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN sites s ON s.id = e.site_id
       LEFT JOIN work_codes wc ON wc.id = e.work_code_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.entry_date DESC, u.last_name`,
      params, req.orgId
    );

    // Build CSV
    const headers = ['Date','Worker','Email','Site','Work Code','Work Code Name','Hours','Break Hours','Status','GPS Captured','Outside Boundary','Notes','Start Lat','Start Lng','Created At'];
    const rows = result.rows.map(r => [
      r.entry_date, r.worker, r.email, r.site, r.work_code, r.work_code_name,
      r.hours, r.break_hours, r.status, r.gps_captured, r.outside_boundary,
      `"${(r.notes || '').replace(/"/g, '""')}"`, r.start_lat, r.start_lng, r.created_at
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="bodc-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;
