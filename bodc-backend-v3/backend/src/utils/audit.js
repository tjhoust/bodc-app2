// ============================================================
// BODC — Utility Helpers
// ============================================================

const nodemailer = require('nodemailer');
const { query } = require('./db');

// ── Audit Log ─────────────────────────────────────────────────

async function auditLog(orgId, userId, userEmail, action, entityType, entityId, newValue, req) {
  try {
    await query(
      `INSERT INTO audit_log (org_id, user_id, user_email, action, entity_type, entity_id, new_value, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        orgId || null, userId || null, userEmail || null,
        action, entityType || null, entityId || null,
        newValue ? JSON.stringify(newValue) : null,
        req?.ip || null, req?.headers?.['user-agent'] || null
      ],
      null, true  // audit log uses super admin context
    );
  } catch (err) {
    // Audit failures should never crash the request
    console.error('Audit log error:', err.message);
  }
}

// ── Notifications ─────────────────────────────────────────────

async function createNotification(orgId, userId, event, title, body, refType = null, refId = null) {
  try {
    // Check user's preferences for this event
    const prefs = await query(
      `SELECT channel, is_enabled FROM notification_preferences
       WHERE user_id = $1 AND event = $2`,
      [userId, event]
    );

    // Default: always create in_app notification
    const channels = new Set(['in_app']);
    prefs.rows.forEach(p => {
      if (p.is_enabled) channels.add(p.channel);
    });

    for (const channel of channels) {
      await query(
        `INSERT INTO notifications (org_id, user_id, event, title, body, ref_type, ref_id, channel)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [orgId, userId, event, title, body, refType, refId, channel],
        orgId, true
      );
    }

    // Send email if channel enabled (async, non-blocking)
    if (channels.has('email')) {
      const userResult = await query('SELECT email, first_name FROM users WHERE id = $1', [userId], orgId);
      if (userResult.rows.length) {
        sendEmail({
          to: userResult.rows[0].email,
          subject: title,
          html: `<p>Hi ${userResult.rows[0].first_name},</p><p>${body}</p><p><a href="${process.env.FRONTEND_URL}">Open BODC</a></p>`
        }).catch(err => console.error('Notification email error:', err.message));
      }
    }
  } catch (err) {
    console.error('Create notification error:', err.message);
  }
}

// ── GPS Boundary Check ────────────────────────────────────────

/**
 * Check if a lat/lng point is inside a site's boundary.
 * Returns true if inside, false if outside.
 */
function checkGpsBoundary(lat, lng, site) {
  if (!lat || !lng || !site) return true; // can't check, don't flag

  if (site.boundary_type === 'radius') {
    if (!site.centre_lat || !site.centre_lng) return true;
    const distance = haversineDistance(lat, lng, site.centre_lat, site.centre_lng);
    return distance <= (site.radius_metres || 200);
  }

  if (site.boundary_type === 'polygon' && site.boundary_polygon) {
    try {
      const polygon = typeof site.boundary_polygon === 'string'
        ? JSON.parse(site.boundary_polygon)
        : site.boundary_polygon;
      return pointInPolygon([parseFloat(lng), parseFloat(lat)], polygon.coordinates[0]);
    } catch {
      return true;
    }
  }

  return true;
}

/**
 * Haversine formula — distance between two lat/lng points in metres.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in metres
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function toRad(degrees) { return degrees * Math.PI / 180; }

/**
 * Ray-casting point-in-polygon test.
 * point: [lng, lat], polygon: [[lng,lat], ...]
 */
function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ── Email ─────────────────────────────────────────────────────

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL SKIPPED — no SMTP configured] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || 'BODC <noreply@bodc.app>',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ''),
    });
  } catch (err) {
    console.error('Email send error:', err.message);
    throw err;
  }
}

// ── Migration runner ──────────────────────────────────────────

async function runMigrations() {
  const fs = require('fs');
  const path = require('path');
  const { pool } = require('./db');

  const client = await pool.connect();
  try {
    // Create migrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const exists = await client.query('SELECT id FROM _migrations WHERE filename = $1', [file]);
      if (exists.rows.length) continue;

      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  ✓ ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ ${file}: ${err.message}`);
        throw err;
      }
    }
    console.log('All migrations complete.');
  } finally {
    client.release();
  }
}

module.exports = { auditLog, createNotification, checkGpsBoundary, sendEmail, runMigrations };
