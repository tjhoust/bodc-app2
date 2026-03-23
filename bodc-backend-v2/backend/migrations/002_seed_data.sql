-- ============================================================
-- BODC — Seed Script
-- Creates one test organisation with full sample data
-- Run after 001_initial_schema.sql
-- ============================================================

-- NOTE: Passwords are bcrypt hashes of 'Password1!'
-- Generated with bcrypt rounds=12
-- Replace with real hashes in production

DO $$
DECLARE
  v_org_id        UUID := uuid_generate_v4();
  v_site_a_id     UUID := uuid_generate_v4();
  v_site_b_id     UUID := uuid_generate_v4();
  v_super_id      UUID := uuid_generate_v4();
  v_admin_id      UUID := uuid_generate_v4();
  v_approver_id   UUID := uuid_generate_v4();
  v_worker1_id    UUID := uuid_generate_v4();
  v_worker2_id    UUID := uuid_generate_v4();
  v_worker3_id    UUID := uuid_generate_v4();
  v_wc1_id        UUID := uuid_generate_v4();
  v_wc2_id        UUID := uuid_generate_v4();
  v_wc3_id        UUID := uuid_generate_v4();
  v_tmpl_id       UUID := uuid_generate_v4();
  v_entry1_id     UUID := uuid_generate_v4();
  v_entry2_id     UUID := uuid_generate_v4();
  v_entry3_id     UUID := uuid_generate_v4();
  v_query_id      UUID := uuid_generate_v4();
BEGIN

-- ── Super Admin (platform level) ─────────────────────────────
-- Uses a special placeholder org_id since super admins span all orgs
INSERT INTO organisations (id, name, slug, industry, country, plan, status, app_name)
VALUES (v_org_id, 'Ridgeline Mining Pty Ltd', 'ridgeline', 'Mining', 'Australia', 'enterprise', 'active', 'BODC');

-- ── Users ─────────────────────────────────────────────────────
-- Super Admin
INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, role, totp_enabled)
VALUES (
  v_super_id, v_org_id,
  'superadmin@bodc.app',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMqJqhcanFp8/SeguBNjBHGJCi', -- Password1!
  'Platform', 'Admin', 'super_admin', false
);

-- Org Admin
INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, role, totp_enabled)
VALUES (
  v_admin_id, v_org_id,
  'admin@ridgeline.com.au',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMqJqhcanFp8/SeguBNjBHGJCi',
  'Lisa', 'Torres', 'org_admin', false
);

-- Approver
INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, role, totp_enabled)
VALUES (
  v_approver_id, v_org_id,
  'approver@ridgeline.com.au',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMqJqhcanFp8/SeguBNjBHGJCi',
  'Sam', 'Patel', 'approver', false
);

-- Workers
INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, role, approver_id, capture_mode)
VALUES
  (v_worker1_id, v_org_id, 'jamie@ridgeline.com.au',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMqJqhcanFp8/SeguBNjBHGJCi',
   'Jamie', 'Mitchell', 'worker', v_approver_id, 'both'),
  (v_worker2_id, v_org_id, 'ryan@ridgeline.com.au',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMqJqhcanFp8/SeguBNjBHGJCi',
   'Ryan', 'Kowalski', 'worker', v_approver_id, 'timer'),
  (v_worker3_id, v_org_id, 'adeola@ridgeline.com.au',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMqJqhcanFp8/SeguBNjBHGJCi',
   'Adeola', 'Okafor', 'worker', v_approver_id, 'manual');

-- ── Sites ─────────────────────────────────────────────────────
INSERT INTO sites (id, org_id, name, description, boundary_type, centre_lat, centre_lng, radius_metres, enforcement_mode, gps_required)
VALUES
  (v_site_a_id, v_org_id, 'Site A — Pit 2', 'Main excavation pit', 'radius', -27.4698, 153.0251, 200, 'log_flag', true),
  (v_site_b_id, v_org_id, 'Site B — Stockpile', 'Stockpile area', 'radius', -27.4750, 153.0300, 150, 'warn', true);

-- Assign workers to sites
INSERT INTO user_sites (user_id, site_id, is_default) VALUES
  (v_worker1_id, v_site_a_id, true),
  (v_worker1_id, v_site_b_id, false),
  (v_worker2_id, v_site_a_id, true),
  (v_worker3_id, v_site_a_id, true);

-- ── Work Codes ────────────────────────────────────────────────
INSERT INTO work_codes (id, org_id, code, name, category, is_active) VALUES
  (v_wc1_id, v_org_id, 'EX-01', 'Excavation', 'Civil', true),
  (v_wc2_id, v_org_id, 'HW-02', 'Haul Work', 'Transport', true),
  (v_wc3_id, v_org_id, 'MT-03', 'Maintenance', 'Mechanical', true),
  (uuid_generate_v4(), v_org_id, 'SV-04', 'Survey', 'Civil', false),
  (uuid_generate_v4(), v_org_id, 'HS-05', 'Housekeeping', 'Site Services', true);

-- ── Custom Fields ─────────────────────────────────────────────
INSERT INTO custom_fields (org_id, name, field_key, field_type, applies_to, is_required, options) VALUES
  (v_org_id, 'Cost Centre', 'cost_centre', 'dropdown', 'entry', true, '["CC-001 Operations","CC-002 Maintenance","CC-003 Admin"]'),
  (v_org_id, 'Shift Type', 'shift_type', 'dropdown', 'entry', true, '["Day shift","Night shift","Overtime"]'),
  (v_org_id, 'Billable', 'billable', 'boolean', 'entry', false, null),
  (v_org_id, 'Contractor ID', 'contractor_id', 'text', 'user', false, null);

-- ── Checklist Template ────────────────────────────────────────
INSERT INTO checklist_templates (id, org_id, name, version, is_active, frequency, require_before_timer, created_by)
VALUES (v_tmpl_id, v_org_id, 'Daily Pre-start — Mining', 3, true, 'daily', true, v_admin_id);

INSERT INTO checklist_items (template_id, question, hint, item_type, is_required, display_order) VALUES
  (v_tmpl_id, 'I have read and understood today''s site safety briefing', 'Site A — Pit 2 safety brief', 'acknowledgement', true, 1),
  (v_tmpl_id, 'I am fit for work and not affected by fatigue, illness, or substances', 'Fatigue management policy FMP-001', 'declaration', true, 2),
  (v_tmpl_id, 'I have completed my vehicle pre-start inspection', 'Record defects on Form VPI-02', 'acknowledgement', true, 3),
  (v_tmpl_id, 'I am aware of all exclusion zones and barricades in my work area', 'Refer to daily site map', 'acknowledgement', true, 4),
  (v_tmpl_id, 'My PPE is present and in serviceable condition', 'Hard hat, boots, hi-vis, glasses, gloves', 'photo', false, 5),
  (v_tmpl_id, 'I understand the emergency evacuation procedure for this site', 'Muster point: Gate 3, west car park', 'declaration', true, 6);

-- ── Time Entries ──────────────────────────────────────────────
-- Entry 1: Approved
INSERT INTO time_entries (
  id, org_id, user_id, site_id, work_code_id, approver_id,
  entry_date, started_at, stopped_at, total_minutes,
  start_lat, start_lng, stop_lat, stop_lng,
  gps_captured, status, is_timer, approved_by, approved_at, notes
) VALUES (
  v_entry1_id, v_org_id, v_worker1_id, v_site_a_id, v_wc1_id, v_approver_id,
  CURRENT_DATE - 1,
  (CURRENT_DATE - 1) + '06:00'::time,
  (CURRENT_DATE - 1) + '14:00'::time,
  480,
  -27.4698, 153.0251, -27.4700, 153.0253,
  true, 'approved', true, v_approver_id, NOW() - INTERVAL '2 hours',
  'North section, machine 4'
);

-- Entry 2: Submitted (pending approval)
INSERT INTO time_entries (
  id, org_id, user_id, site_id, work_code_id, approver_id,
  entry_date, started_at, stopped_at, total_minutes,
  start_lat, start_lng, stop_lat, stop_lng,
  gps_captured, outside_boundary, outside_minutes,
  status, is_timer
) VALUES (
  v_entry2_id, v_org_id, v_worker2_id, v_site_a_id, v_wc2_id, v_approver_id,
  CURRENT_DATE,
  CURRENT_DATE + '06:30'::time,
  CURRENT_DATE + '13:00'::time,
  390,
  -27.4698, 153.0251, -27.4850, 153.0450,  -- stop coords outside boundary
  true, true, 45,
  'submitted', true
);

-- Entry 3: Queried (GPS missing)
INSERT INTO time_entries (
  id, org_id, user_id, site_id, work_code_id, approver_id,
  entry_date, total_minutes,
  gps_captured, status, is_timer, notes
) VALUES (
  v_entry3_id, v_org_id, v_worker3_id, v_site_a_id, v_wc3_id, v_approver_id,
  CURRENT_DATE - 2,
  480,
  false, 'queried', false,
  'Maintenance workshop all day'
);

-- ── GPS Exceptions ────────────────────────────────────────────
INSERT INTO gps_exceptions (org_id, entry_id, user_id, exception_type, detail, minutes_outside) VALUES
  (v_org_id, v_entry2_id, v_worker2_id, 'outside_boundary', 'Worker outside Site A boundary for 45 minutes between 10:15–11:00', 45),
  (v_org_id, v_entry3_id, v_worker3_id, 'missing', 'No GPS coordinates captured at entry start or stop', null);

-- ── Query Thread ──────────────────────────────────────────────
INSERT INTO queries (id, org_id, entry_id, raised_by, is_resolved)
VALUES (v_query_id, v_org_id, v_entry3_id, v_approver_id, false);

INSERT INTO query_messages (query_id, sender_id, message) VALUES
  (v_query_id, v_approver_id, 'No GPS data was captured for this entry. Please explain your location or provide an alternative location record.'),
  (v_query_id, v_worker3_id, 'My phone battery died at 09:00 AM. I was working in the maintenance workshop (Building 4) for the entire day. My supervisor can confirm.');

-- ── Notifications ─────────────────────────────────────────────
INSERT INTO notifications (org_id, user_id, event, title, body, ref_type, ref_id, channel) VALUES
  (v_org_id, v_worker3_id, 'entry_queried', 'Query raised on your entry', 'Sam Patel has raised a query about your GPS data on ' || (CURRENT_DATE - 2)::text || '.', 'entry', v_entry3_id, 'in_app'),
  (v_org_id, v_worker1_id, 'entry_approved', '1 entry approved', 'Sam Patel approved your timesheet for ' || (CURRENT_DATE - 1)::text || ' (8.0 hrs).', 'entry', v_entry1_id, 'in_app'),
  (v_org_id, v_approver_id, 'entry_submitted', 'New timesheet submitted', 'Ryan Kowalski submitted a timesheet for ' || CURRENT_DATE::text || '.', 'entry', v_entry2_id, 'in_app');

-- ── Default notification preferences ──────────────────────────
-- Workers
INSERT INTO notification_preferences (user_id, org_id, event, channel, is_enabled)
SELECT v_worker1_id, v_org_id, e, 'in_app'::notif_channel, true
FROM unnest(ARRAY['entry_approved','entry_queried','query_responded','checklist_overdue','offline_synced']::notif_event[]) e;

INSERT INTO notification_preferences (user_id, org_id, event, channel, is_enabled)
SELECT v_worker1_id, v_org_id, e, 'email'::notif_channel, true
FROM unnest(ARRAY['entry_approved','entry_queried']::notif_event[]) e;

-- Approver
INSERT INTO notification_preferences (user_id, org_id, event, channel, is_enabled)
SELECT v_approver_id, v_org_id, e, 'in_app'::notif_channel, true
FROM unnest(ARRAY['entry_submitted','query_responded','gps_exception','weekly_digest']::notif_event[]) e;

-- ── Audit log seed entries ─────────────────────────────────────
INSERT INTO audit_log (org_id, user_id, user_email, action, entity_type, entity_id, new_value) VALUES
  (v_org_id, v_admin_id, 'admin@ridgeline.com.au', 'organisation.created', 'organisation', v_org_id, jsonb_build_object('name', 'Ridgeline Mining Pty Ltd')),
  (v_org_id, v_admin_id, 'admin@ridgeline.com.au', 'user.invited', 'user', v_worker1_id, jsonb_build_object('email', 'jamie@ridgeline.com.au', 'role', 'worker')),
  (v_org_id, v_admin_id, 'admin@ridgeline.com.au', 'user.invited', 'user', v_worker2_id, jsonb_build_object('email', 'ryan@ridgeline.com.au', 'role', 'worker')),
  (v_org_id, v_approver_id, 'approver@ridgeline.com.au', 'entry.approved', 'time_entry', v_entry1_id, jsonb_build_object('status', 'approved')),
  (v_org_id, v_approver_id, 'approver@ridgeline.com.au', 'query.raised', 'query', v_query_id, jsonb_build_object('entry_id', v_entry3_id));

END $$;
