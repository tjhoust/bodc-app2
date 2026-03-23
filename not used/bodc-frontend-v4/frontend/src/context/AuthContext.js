import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [org, setOrg]         = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Bootstrap — rehydrate from localStorage ───────────────
  useEffect(() => {
    const stored = localStorage.getItem('bodc_user');
    const token  = localStorage.getItem('bodc_access_token');
    if (stored && token) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        setOrg(parsed.org || null);
        // Apply branding immediately from cache
        applyBranding(parsed.org);
      } catch {}
    }
    setLoading(false);
  }, []);

  // ── Login ─────────────────────────────────────────────────
  const login = useCallback(async (email, password, totpCode = null) => {
    const { data } = await authAPI.login(email, password, totpCode);

    if (data.requires_2fa) return { requires_2fa: true, user_id: data.user_id };

    localStorage.setItem('bodc_access_token',  data.access_token);
    localStorage.setItem('bodc_refresh_token', data.refresh_token);

    const userWithOrg = { ...data.user, org: data.org };
    localStorage.setItem('bodc_user', JSON.stringify(userWithOrg));
    setUser(userWithOrg);
    setOrg(data.org || null);
    applyBranding(data.org);

    return { success: true, role: data.user.role };
  }, []);

  // ── Logout ────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      const rt = localStorage.getItem('bodc_refresh_token');
      if (rt) await authAPI.logout(rt);
    } catch {}
    localStorage.removeItem('bodc_access_token');
    localStorage.removeItem('bodc_refresh_token');
    localStorage.removeItem('bodc_user');
    setUser(null);
    setOrg(null);
    resetBranding();
  }, []);

  // ── Update user in state (e.g. after profile edit) ────────
  const updateUser = useCallback((updates) => {
    setUser(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem('bodc_user', JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Branding helpers ──────────────────────────────────────
  function applyBranding(orgData) {
    if (!orgData) return;
    const root = document.documentElement;
    if (orgData.primary_colour) root.style.setProperty('--brand-primary', orgData.primary_colour);
    if (orgData.accent_colour)  root.style.setProperty('--brand-accent',  orgData.accent_colour);
    if (orgData.app_name)       document.title = orgData.app_name;
  }

  function resetBranding() {
    document.documentElement.style.removeProperty('--brand-primary');
    document.documentElement.style.removeProperty('--brand-accent');
    document.title = 'BODC';
  }

  const isWorker   = user?.role === 'worker';
  const isApprover = ['approver', 'org_admin', 'super_admin'].includes(user?.role);
  const isAdmin    = ['org_admin', 'super_admin'].includes(user?.role);
  const isSuper    = user?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{
      user, org, loading,
      login, logout, updateUser,
      isWorker, isApprover, isAdmin, isSuper,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
