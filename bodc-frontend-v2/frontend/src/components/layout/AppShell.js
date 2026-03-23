import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../context/OfflineContext';
import { useQuery } from '@tanstack/react-query';
import { notifsAPI } from '../../api/client';

import styles from './AppShell.module.css';

// ── Nav config by role ────────────────────────────────────────

function getNav(role) {
  const worker = [
    { to: '/timer',         label: 'Timer',         icon: 'clock',    section: 'Time' },
    { to: '/checklist',     label: 'Pre-start',     icon: 'shield',   section: 'Time' },
    { to: '/timesheets',    label: 'Timesheets',    icon: 'list',     section: 'Time' },
    { to: '/weekly',        label: 'Weekly view',   icon: 'calendar', section: 'Time' },
    { to: '/notifications', label: 'Notifications', icon: 'bell',     section: 'Account', badge: true },
    { to: '/profile',       label: 'Profile',       icon: 'user',     section: 'Account' },
  ];
  const approver = [
    { to: '/dashboard',  label: 'Dashboard',  icon: 'grid',    section: 'Review' },
    { to: '/approve',    label: 'Timesheets', icon: 'list',    section: 'Review' },
    { to: '/queries',    label: 'Queries',    icon: 'message', section: 'Review' },
    { to: '/exceptions', label: 'Exceptions', icon: 'warning', section: 'Review' },
    { to: '/reports',    label: 'Reports',    icon: 'chart',   section: 'Reports' },
    { to: '/export',     label: 'Export',     icon: 'download',section: 'Reports' },
    { to: '/notifications', label: 'Notifications', icon: 'bell', section: 'Account', badge: true },
    { to: '/profile',    label: 'Profile',    icon: 'user',    section: 'Account' },
  ];
  const admin = [
    { to: '/users',      label: 'Users',       icon: 'users',    section: 'Manage' },
    { to: '/sites',      label: 'Sites',       icon: 'map',      section: 'Manage' },
    { to: '/geofence',   label: 'Geofence',    icon: 'fence',    section: 'Manage' },
    { to: '/work-codes', label: 'Work codes',  icon: 'tag',      section: 'Manage' },
    { to: '/checklists', label: 'Checklists',  icon: 'shield',   section: 'Manage' },
    { to: '/features',   label: 'Features',    icon: 'toggle',   section: 'Config' },
    { to: '/fields',     label: 'Custom fields', icon: 'sliders', section: 'Config' },
    { to: '/branding',   label: 'Branding',    icon: 'paint',    section: 'Config' },
    { to: '/notif-settings', label: 'Notifications', icon: 'bell', section: 'Config' },
    { to: '/audit',      label: 'Audit log',   icon: 'log',      section: 'Config' },
  ];
  const superAdmin = [
    { to: '/orgs',     label: 'Organisations', icon: 'building', section: 'Platform' },
    { to: '/onboard',  label: 'Onboard org',   icon: 'plus',     section: 'Platform' },
    { to: '/platform', label: 'Platform config', icon: 'toggle', section: 'Platform' },
    { to: '/audit',    label: 'Audit log',     icon: 'log',      section: 'Platform' },
  ];

  if (role === 'super_admin') return superAdmin;
  if (role === 'org_admin')   return [...admin, ...approver.filter(n => !['profile','notifications'].includes(n.to.slice(1)))];
  if (role === 'approver')    return approver;
  return worker;
}

// Bottom nav for mobile — show 4 most important items per role
function getBottomNav(role) {
  if (role === 'worker')      return ['/timer', '/checklist', '/timesheets', '/notifications'];
  if (role === 'approver')    return ['/dashboard', '/approve', '/queries', '/notifications'];
  if (role === 'org_admin')   return ['/users', '/approve', '/sites', '/audit'];
  if (role === 'super_admin') return ['/orgs', '/onboard', '/platform', '/audit'];
  return [];
}

// ── SVG Icons ─────────────────────────────────────────────────

function Icon({ name, size = 16 }) {
  const s = { width: size, height: size, flexShrink: 0 };
  const icons = {
    clock:    <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2 1.5"/></svg>,
    shield:   <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 2L3 4v4c0 3 2.5 5 5 6 2.5-1 5-3 5-6V4z"/></svg>,
    list:     <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 4h10M3 8h10M3 12h6"/></svg>,
    calendar: <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M5 1v3M11 1v3M2 7h12"/></svg>,
    bell:     <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 2a4 4 0 014 4v3l1 2H3l1-2V6a4 4 0 014-4z"/><path d="M6.5 13a1.5 1.5 0 003 0"/></svg>,
    user:     <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="6" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/></svg>,
    grid:     <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="5" height="5" rx="1.5"/><rect x="9" y="2" width="5" height="5" rx="1.5"/><rect x="2" y="9" width="5" height="5" rx="1.5"/><rect x="9" y="9" width="5" height="5" rx="1.5"/></svg>,
    message:  <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 3h12v8H9l-3 2v-2H2z"/></svg>,
    warning:  <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 2L1.5 13h13z"/><path d="M8 7v3M8 12v.5"/></svg>,
    chart:    <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12l3-4 3 2 3-5 3 3"/><line x1="2" y1="14" x2="14" y2="14"/></svg>,
    download: <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 2v8M5 7l3 3 3-3"/><path d="M2 12v2h12v-2"/></svg>,
    users:    <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="6" cy="5" r="2.5"/><path d="M1 13c0-2.5 2-4 5-4s5 1.5 5 4"/><path d="M11 3a2 2 0 010 4M14 13c0-2-1.5-3.5-3-4"/></svg>,
    map:      <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 2C5.8 2 4 3.8 4 6c0 3 4 8 4 8s4-5 4-8c0-2.2-1.8-4-4-4z"/><circle cx="8" cy="6" r="1.5"/></svg>,
    fence:    <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 4l2-2 2 2M9 4l2-2 2 2"/><path d="M2 5h12M2 9h12"/><path d="M3 5v7M7 5v7M11 5v7"/></svg>,
    tag:      <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 2h5l7 7-5 5-7-7V2z"/><circle cx="5" cy="5" r="1"/></svg>,
    toggle:   <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="5" width="14" height="6" rx="3"/><circle cx="10" cy="8" r="2"/></svg>,
    sliders:  <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 4h12M2 8h12M2 12h12"/><circle cx="5" cy="4" r="1.5" fill="white"/><circle cx="11" cy="8" r="1.5" fill="white"/><circle cx="7" cy="12" r="1.5" fill="white"/></svg>,
    paint:    <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 11c0-1 4-8 6-8s2 1 2 2-1 2-2 2H5"/><path d="M12 9c1 0 2 1 2 2s-1 2-2 2-2-1-2-2v-2"/></svg>,
    log:      <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="1" width="10" height="14" rx="1.5"/><path d="M6 5h4M6 8h4M6 11h2"/></svg>,
    building: <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M5 14V9h6v5M5 6h1M7 6h1M9 6h1"/></svg>,
    plus:     <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3v10M3 8h10"/></svg>,
    menu:     <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 4h12M2 8h12M2 12h12"/></svg>,
    x:        <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13"/></svg>,
  };
  return icons[name] || null;
}

export { Icon };

// ── AppShell ─────────────────────────────────────────────────

export default function AppShell() {
  const { user, org, logout } = useAuth();
  const { isOnline, pendingCount } = useOffline();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const { data: notifData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => notifsAPI.list().then(r => r.data),
    refetchInterval: 60000,
  });

  const unreadCount = notifData?.unread || 0;
  const nav = getNav(user?.role);
  const bottomNav = getBottomNav(user?.role);
  const bottomNavItems = nav.filter(n => bottomNav.includes(n.to));

  // Group sidebar nav by section
  const sections = [...new Set(nav.map(n => n.section))];

  const initials = user ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase() : '??';
  const appName = org?.app_name || 'BODC';

  return (
    <div className={styles.shell}>
      {/* Offline banner */}
      {!isOnline && (
        <div className="offline-banner">
          <Icon name="warning" size={14} />
          Offline — {pendingCount > 0 ? `${pendingCount} entries queued` : 'entries will sync when reconnected'}
        </div>
      )}

      {/* Top bar */}
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <Icon name="clock" size={16} />
          </div>
          {appName}
        </div>

        {/* Desktop user info */}
        <div className={styles.topRight}>
          {pendingCount > 0 && (
            <span className={styles.syncBadge}>{pendingCount} pending sync</span>
          )}
          <span className={styles.userName}>{user?.first_name} {user?.last_name}</span>
          <div className={`avatar avatar-sm avatar-blue ${styles.avatar}`}>{initials}</div>
          <button className={`btn btn-secondary btn-sm ${styles.logoutBtn}`} onClick={logout}>Logout</button>
          {/* Mobile hamburger */}
          <button className={`btn btn-icon ${styles.hamburger}`} onClick={() => setMobileMenuOpen(v => !v)}>
            <Icon name={mobileMenuOpen ? 'x' : 'menu'} size={18} />
          </button>
        </div>
      </header>

      <div className={styles.body}>
        {/* Sidebar — desktop always visible, mobile drawer */}
        <nav className={`${styles.sidebar} ${mobileMenuOpen ? styles.sidebarOpen : ''}`}>
          {sections.map(section => (
            <div key={section} className={styles.navSection}>
              <div className={styles.navLabel}>{section}</div>
              {nav.filter(n => n.section === section).map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon name={item.icon} size={15} />
                  <span>{item.label}</span>
                  {item.badge && unreadCount > 0 && (
                    <span className={styles.badge}>{unreadCount}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}

          {/* Mobile logout inside sidebar */}
          <div className={styles.sidebarFooter}>
            <div className={styles.userCard}>
              <div className={`avatar avatar-sm avatar-blue`}>{initials}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.first_name} {user?.last_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{user?.role?.replace('_', ' ')}</div>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm btn-full" onClick={logout}>Logout</button>
          </div>
        </nav>

        {/* Sidebar overlay on mobile */}
        {mobileMenuOpen && (
          <div className={styles.overlay} onClick={() => setMobileMenuOpen(false)} />
        )}

        {/* Main content */}
        <main className={styles.main}>
          <div className={styles.content}>
            <Outlet />
          </div>
          <div className="bottom-nav-spacer" />
        </main>
      </div>

      {/* Bottom navigation — mobile only */}
      <nav className={styles.bottomNav}>
        {bottomNavItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `${styles.bottomItem} ${isActive ? styles.bottomItemActive : ''}`}
          >
            <div className={styles.bottomIcon}>
              <Icon name={item.icon} size={20} />
              {item.badge && unreadCount > 0 && <span className={styles.bottomBadge}>{unreadCount}</span>}
            </div>
            <span className={styles.bottomLabel}>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
