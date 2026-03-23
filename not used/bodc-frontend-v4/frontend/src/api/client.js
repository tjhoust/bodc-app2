import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach access token ─────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bodc_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor — handle token refresh ───────────────
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token));
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('bodc_refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
        localStorage.setItem('bodc_access_token', data.access_token);
        localStorage.setItem('bodc_refresh_token', data.refresh_token);
        api.defaults.headers.common.Authorization = `Bearer ${data.access_token}`;
        processQueue(null, data.access_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('bodc_access_token');
        localStorage.removeItem('bodc_refresh_token');
        localStorage.removeItem('bodc_user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────
export const authAPI = {
  login: (email, password, totp_code) => api.post('/auth/login', { email, password, totp_code }),
  refresh: (refresh_token) => api.post('/auth/refresh', { refresh_token }),
  logout: (refresh_token) => api.post('/auth/logout', { refresh_token }),
  me: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  acceptInvite: (token, password) => api.post('/auth/accept-invite', { token, password }),
  setup2FA: () => api.post('/auth/2fa/setup'),
  verify2FA: (code) => api.post('/auth/2fa/verify', { code }),
  disable2FA: (password) => api.post('/auth/2fa/disable', { password }),
};

// ── Time Entries ──────────────────────────────────────────────
export const entriesAPI = {
  list: (params) => api.get('/entries', { params }),
  get: (id) => api.get(`/entries/${id}`),
  create: (data) => api.post('/entries', data),
  update: (id, data) => api.patch(`/entries/${id}`, data),
  submit: (id) => api.post(`/entries/${id}/submit`),
  approve: (id) => api.post(`/entries/${id}/approve`),
  bulkApprove: (entry_ids) => api.post('/entries/bulk-approve', { entry_ids }),
  raiseQuery: (id, message) => api.post(`/entries/${id}/query`, { message }),
  sync: (entries) => api.post('/entries/sync', { entries }),
  exportCsv: (params) => api.get('/entries/export/csv', { params, responseType: 'blob' }),
};

// ── Users ─────────────────────────────────────────────────────
export const usersAPI = {
  list: (params) => api.get('/users', { params }),
  invite: (data) => api.post('/users/invite', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  myProfile: () => api.get('/users/me/profile'),
  updateProfile: (data) => api.patch('/users/me/profile', data),
};

// ── Organisations ─────────────────────────────────────────────
export const orgsAPI = {
  me: () => api.get('/orgs/me'),
  updateBranding: (data) => api.patch('/orgs/me/branding', data),
  updateFeatures: (data) => api.patch('/orgs/me/features', data),
  list: () => api.get('/orgs'),
  create: (data) => api.post('/orgs', data),
};

// ── Sites ─────────────────────────────────────────────────────
export const sitesAPI = {
  list: () => api.get('/sites'),
  create: (data) => api.post('/sites', data),
  update: (id, data) => api.patch(`/sites/${id}`, data),
};

// ── Checklist ─────────────────────────────────────────────────
export const checklistAPI = {
  templates: () => api.get('/checklists/templates'),
  todayStatus: () => api.get('/checklists/today'),
  submit: (templateId, responses) => api.post('/checklists/respond', { template_id: templateId, responses }),
};

// ── Work Codes ────────────────────────────────────────────────
export const workCodesAPI = {
  list: () => api.get('/work-codes'),
  create: (data) => api.post('/work-codes', data),
  update: (id, data) => api.patch(`/work-codes/${id}`, data),
};

// ── Queries ───────────────────────────────────────────────────
export const queriesAPI = {
  list: () => api.get('/queries'),
  get: (id) => api.get(`/queries/${id}`),
  reply: (id, message) => api.post(`/queries/${id}/reply`, { message }),
  resolve: (id) => api.post(`/queries/${id}/resolve`),
};

// ── Notifications ─────────────────────────────────────────────
export const notifsAPI = {
  list: () => api.get('/notifications'),
  readAll: () => api.post('/notifications/read-all'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  preferences: () => api.get('/notifications/preferences'),
  updatePreferences: (preferences) => api.put('/notifications/preferences', { preferences }),
};

// ── Reports ───────────────────────────────────────────────────
export const reportsAPI = {
  summary: (params) => api.get('/reports/summary', { params }),
};

// ── Audit ─────────────────────────────────────────────────────
export const auditAPI = {
  list: (params) => api.get('/audit', { params }),
};

// ── GPS exceptions ────────────────────────────────────────────
export const exceptionsAPI = {
  list: (params) => api.get('/exceptions', { params }),
};

export default api;
