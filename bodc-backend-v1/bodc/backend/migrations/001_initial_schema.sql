-- ============================================================
-- BODC — Business Operations Data Capture
-- Database Schema v1.0
-- PostgreSQL 15+
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";  -- for GPS geometry (optional, fallback to lat/lng)

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('super_admin', 'org_admin', 'approver', 'worker');
CREATE TYPE org_plan AS ENUM ('trial', 'standard', 'enterprise');
CREATE TYPE org_status AS ENUM ('active', 'suspended', 'cancelled');
CREATE TYPE entry_status AS ENUM ('draft', 'submitted', 'approved', 'queried');
CREATE TYPE capture_mode AS ENUM ('timer', 'manual', 'both');
CREATE TYPE boundary_type AS ENUM ('polygon', 'radius');
CREATE TYPE enforcement_mode AS ENUM ('warn', 'block', 'log_flag');
CREATE TYPE checklist_item_type AS ENUM ('acknowledgement', 'declaration', 'photo', 'text_response');
CREATE TYPE notif_channel AS ENUM ('in_app', 'email', 'push');
CREATE TYPE notif_event AS ENUM (
  'entry_submitted', 'entry_approved', 'entry_queried',
  'query_responded', 'checklist_overdue', 'gps_exception',
  'offline_synced', 'weekly_digest'
);
CREATE TYPE sync_status AS ENUM ('pending', 'synced', 'failed');

-- ============================================================
-- ORGANISATIONS (multi-tenant root)
-- ============================================================

CREATE TABLE organisations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  slug              VARCHAR(100) NOT NULL UNIQUE,  -- subdomain: ridgeline.bodc.app
  industry          VARCHAR(100),
  country           VARCHAR(100) DEFAULT 'Australia',
  state             VARCHAR(50),
  abn               VARCHAR(20),
  plan              org_plan NOT NULL DEFAULT 'trial',
  plan_expires_at   TIMESTAMPTZ,
  max_users         INTEGER DEFAULT 25,
  status            org_status NOT NULL DEFAULT 'active',
  -- Branding
  app_name          VARCHAR(100) DEFAULT 'BODC',
  primary_colour    VARCHAR(7) DEFAULT '#1a6dc9',
  accent_colour     VARCHAR(7) DEFAULT '#1a8c5e',
  logo_url          VARCHAR(500),
  custom_domain     VARCHAR(255),
  -- Feature flags (per org overrides)
  feature_gps             BOOLEAN DEFAULT true,
  feature_manual_only     BOOLEAN DEFAULT false,
  feature_checklist       BOOLEAN DEFAULT true,
  feature_map             BOOLEAN DEFAULT true,
  feature_2fa             BOOLEAN DEFAULT true,
  feature_offline         BOOLEAN DEFAULT true,
  -- Data retention
  retention_years   INTEGER DEFAULT 7,
  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID  -- super admin who created it
);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email               VARCHAR(255) NOT NULL,
  password_hash       VARCHAR(255) NOT NULL,
  first_name          VARCHAR(100) NOT NULL,
  last_name           VARCHAR(100) NOT NULL,
  role                user_role NOT NULL DEFAULT 'worker',
  capture_mode        capture_mode NOT NULL DEFAULT 'timer',
  -- Approver assignment (workers point to their approver)
  approver_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  -- 2FA
  totp_secret         VARCHAR(255),
  totp_enabled        BOOLEAN DEFAULT false,
  totp_verified_at    TIMESTAMPTZ,
  -- Account status
  is_active           BOOLEAN DEFAULT true,
  invited_at          TIMESTAMPTZ,
  invitation_token    VARCHAR(255),
  invitation_expires  TIMESTAMPTZ,
  last_login_at       TIMESTAMPTZ,
  password_reset_token      VARCHAR(255),
  password_reset_expires    TIMESTAMPTZ,
  -- Push notifications
  push_token          VARCHAR(500),
  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, email)
);

-- ============================================================
-- SITES
-- ============================================================

CREATE TABLE sites (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  -- Boundary definition
  boundary_type     boundary_type NOT NULL DEFAULT 'radius',
  -- For radius boundary
  centre_lat        DECIMAL(10, 7),
  centre_lng        DECIMAL(10, 7),
  radius_metres     INTEGER DEFAULT 200,
  -- For polygon boundary (GeoJSON polygon stored as JSON)
  boundary_polygon  JSONB,
  -- Enforcement
  enforcement_mode  enforcement_mode NOT NULL DEFAULT 'log_flag',
  gps_required      BOOLEAN DEFAULT true,
  alert_threshold_minutes INTEGER DEFAULT 15,
  -- Status
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Worker-site assignments (many to many)
CREATE TABLE user_sites (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id   UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, site_id)
);

-- ============================================================
-- WORK CODES
-- ============================================================

CREATE TABLE work_codes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  code        VARCHAR(20) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  category    VARCHAR(100),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, code)
);

-- ============================================================
-- CUSTOM FIELDS
-- ============================================================

CREATE TYPE custom_field_type AS ENUM ('text', 'number', 'dropdown', 'boolean', 'date');
CREATE TYPE custom_field_applies_to AS ENUM ('entry', 'user', 'site', 'work_code');

CREATE TABLE custom_fields (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  field_key     VARCHAR(50) NOT NULL,  -- snake_case key used in JSON
  field_type    custom_field_type NOT NULL DEFAULT 'text',
  applies_to    custom_field_applies_to NOT NULL DEFAULT 'entry',
  is_required   BOOLEAN DEFAULT false,
  options       JSONB,  -- for dropdown: ["Option A", "Option B"]
  display_order INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, field_key, applies_to)
);

-- ============================================================
-- CHECKLIST TEMPLATES
-- ============================================================

CREATE TABLE checklist_templates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1,
  is_active     BOOLEAN DEFAULT true,
  frequency     VARCHAR(50) DEFAULT 'daily',  -- daily, per_timer, weekly
  require_before_timer BOOLEAN DEFAULT true,
  -- Site scope (null = all sites)
  site_scope    UUID[] DEFAULT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE checklist_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id     UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  hint            TEXT,
  item_type       checklist_item_type NOT NULL DEFAULT 'acknowledgement',
  is_required     BOOLEAN DEFAULT true,
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable version snapshots (when admin saves new version, old items are snapshotted)
CREATE TABLE checklist_versions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id   UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  items_snapshot JSONB NOT NULL,  -- full snapshot of items at this version
  saved_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  saved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note          TEXT
);

-- ============================================================
-- TIME ENTRIES (core)
-- ============================================================

CREATE TABLE time_entries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id           UUID REFERENCES sites(id) ON DELETE SET NULL,
  work_code_id      UUID REFERENCES work_codes(id) ON DELETE SET NULL,
  approver_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Time
  entry_date        DATE NOT NULL,
  started_at        TIMESTAMPTZ,  -- null for manual entries
  stopped_at        TIMESTAMPTZ,  -- null for manual entries
  total_minutes     INTEGER NOT NULL,  -- always stored in minutes
  break_minutes     INTEGER DEFAULT 0,
  -- GPS at start/stop
  start_lat         DECIMAL(10, 7),
  start_lng         DECIMAL(10, 7),
  start_accuracy    DECIMAL(8, 2),  -- metres
  stop_lat          DECIMAL(10, 7),
  stop_lng          DECIMAL(10, 7),
  stop_accuracy     DECIMAL(8, 2),
  -- GPS flags
  gps_captured      BOOLEAN DEFAULT false,
  outside_boundary  BOOLEAN DEFAULT false,
  outside_minutes   INTEGER DEFAULT 0,
  -- Status
  status            entry_status NOT NULL DEFAULT 'draft',
  -- Capture method
  is_timer          BOOLEAN DEFAULT true,  -- false = manual entry
  -- Notes and custom fields
  notes             TEXT,
  custom_fields     JSONB DEFAULT '{}',
  -- Approval
  approved_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at       TIMESTAMPTZ,
  -- Offline sync
  sync_status       sync_status DEFAULT 'synced',
  offline_created_at TIMESTAMPTZ,
  client_id         VARCHAR(100),  -- idempotency key from offline client
  -- Soft delete
  deleted_at        TIMESTAMPTZ,
  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GPS track points (periodic captures during timer)
CREATE TABLE gps_track_points (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id    UUID NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  lat         DECIMAL(10, 7) NOT NULL,
  lng         DECIMAL(10, 7) NOT NULL,
  accuracy    DECIMAL(8, 2),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Break records
CREATE TABLE breaks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id    UUID NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL,
  ended_at    TIMESTAMPTZ,
  is_paid     BOOLEAN DEFAULT false,
  minutes     INTEGER,  -- computed on end
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CHECKLIST RESPONSES (per shift)
-- ============================================================

CREATE TABLE checklist_responses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id     UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  template_version INTEGER NOT NULL,
  response_date   DATE NOT NULL,
  completed_at    TIMESTAMPTZ,
  -- GPS at completion
  lat             DECIMAL(10, 7),
  lng             DECIMAL(10, 7),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE checklist_item_responses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  response_id     UUID NOT NULL REFERENCES checklist_responses(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  is_checked      BOOLEAN DEFAULT false,
  text_response   TEXT,
  photo_url       VARCHAR(500),
  responded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- QUERIES (approver ↔ worker threads)
-- ============================================================

CREATE TABLE queries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  entry_id    UUID NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  raised_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE query_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_id    UUID NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- GPS EXCEPTIONS (auto-generated flags)
-- ============================================================

CREATE TABLE gps_exceptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  entry_id        UUID NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exception_type  VARCHAR(50) NOT NULL,  -- 'missing', 'outside_boundary', 'excess_hours'
  detail          TEXT,
  minutes_outside INTEGER,
  is_reviewed     BOOLEAN DEFAULT false,
  reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event       notif_event NOT NULL,
  title       VARCHAR(255) NOT NULL,
  body        TEXT,
  -- Link to relevant record
  ref_type    VARCHAR(50),   -- 'entry', 'query', 'checklist'
  ref_id      UUID,
  -- Delivery
  channel     notif_channel NOT NULL DEFAULT 'in_app',
  is_read     BOOLEAN DEFAULT false,
  read_at     TIMESTAMPTZ,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification preferences per user
CREATE TABLE notification_preferences (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  event       notif_event NOT NULL,
  channel     notif_channel NOT NULL,
  is_enabled  BOOLEAN DEFAULT true,
  UNIQUE(user_id, event, channel)
);

-- ============================================================
-- AUDIT LOG (immutable)
-- ============================================================

CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID REFERENCES organisations(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email  VARCHAR(255),  -- denormalised in case user deleted
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),   -- 'entry', 'user', 'site', etc
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log is append-only — no updates or deletes allowed
-- Enforced via application layer + DB role permissions

-- ============================================================
-- OFFLINE SYNC QUEUE (server-side record of synced batches)
-- ============================================================

CREATE TABLE sync_batches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  entries_count   INTEGER DEFAULT 0,
  status          sync_status DEFAULT 'pending',
  payload_hash    VARCHAR(64),
  error_message   TEXT,
  synced_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SESSIONS (JWT refresh token store)
-- ============================================================

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Users
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_approver ON users(approver_id);
CREATE INDEX idx_users_invitation ON users(invitation_token) WHERE invitation_token IS NOT NULL;

-- Sites
CREATE INDEX idx_sites_org ON sites(org_id);

-- Work codes
CREATE INDEX idx_work_codes_org ON work_codes(org_id);

-- Time entries (most queried table)
CREATE INDEX idx_entries_org ON time_entries(org_id);
CREATE INDEX idx_entries_user ON time_entries(user_id);
CREATE INDEX idx_entries_approver ON time_entries(approver_id);
CREATE INDEX idx_entries_date ON time_entries(entry_date);
CREATE INDEX idx_entries_status ON time_entries(status);
CREATE INDEX idx_entries_org_date ON time_entries(org_id, entry_date DESC);
CREATE INDEX idx_entries_user_date ON time_entries(user_id, entry_date DESC);
CREATE INDEX idx_entries_client_id ON time_entries(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_entries_deleted ON time_entries(deleted_at) WHERE deleted_at IS NULL;

-- GPS track
CREATE INDEX idx_gps_entry ON gps_track_points(entry_id);

-- Queries
CREATE INDEX idx_queries_entry ON queries(entry_id);
CREATE INDEX idx_queries_org ON queries(org_id);

-- Notifications
CREATE INDEX idx_notifs_user ON notifications(user_id);
CREATE INDEX idx_notifs_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Audit log
CREATE INDEX idx_audit_org ON audit_log(org_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- Checklist responses
CREATE INDEX idx_cl_resp_user_date ON checklist_responses(user_id, response_date);

-- GPS exceptions
CREATE INDEX idx_gps_exc_org ON gps_exceptions(org_id);
CREATE INDEX idx_gps_exc_reviewed ON gps_exceptions(org_id, is_reviewed);

-- Refresh tokens
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_token ON refresh_tokens(token_hash);

-- ============================================================
-- UPDATED_AT TRIGGER (auto-update timestamp)
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organisations_updated BEFORE UPDATE ON organisations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sites_updated BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_work_codes_updated BEFORE UPDATE ON work_codes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_entries_updated BEFORE UPDATE ON time_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON checklist_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (multi-tenant isolation)
-- ============================================================

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_exceptions ENABLE ROW LEVEL SECURITY;

-- App role (used by backend API — sees only its org's data)
-- Super admin role (sees everything)
-- These policies are enforced via a DB role set per connection
-- The backend sets: SET app.current_org_id = '<uuid>' per request

CREATE POLICY org_isolation ON organisations
  USING (id = current_setting('app.current_org_id', true)::uuid
      OR current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY org_isolation ON users
  USING (org_id = current_setting('app.current_org_id', true)::uuid
      OR current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY org_isolation ON sites
  USING (org_id = current_setting('app.current_org_id', true)::uuid
      OR current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY org_isolation ON work_codes
  USING (org_id = current_setting('app.current_org_id', true)::uuid
      OR current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY org_isolation ON time_entries
  USING (org_id = current_setting('app.current_org_id', true)::uuid
      OR current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY org_isolation ON checklist_templates
  USING (org_id = current_setting('app.current_org_id', true)::uuid
      OR current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY org_isolation ON checklist_items
  USING (template_id IN (
    SELECT id FROM checklist_templates
    WHERE org_id = current_setting('app.current_org_id', true)::uuid
  ) OR current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY org_isolation ON checklist_responses
  USING (org_id = current_setting('app.current_org_id', true)::uuid
      OR current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY org_isolation ON queries
  USING (org_id = current_setting('app.current_org_id', true)::uuid
      OR current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY org_isolation ON notifications
  USING (org_id = current_setting('app.current_org_id', true)::uuid
      OR current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY org_isolation ON gps_exceptions
  USING (org_id = current_setting('app.current_org_id', true)::uuid
      OR current_setting('app.is_super_admin', true) = 'true');

-- Audit log: readable by org, never writable via policy (app writes via service role)
CREATE POLICY org_isolation ON audit_log
  USING (org_id = current_setting('app.current_org_id', true)::uuid
      OR current_setting('app.is_super_admin', true) = 'true');
