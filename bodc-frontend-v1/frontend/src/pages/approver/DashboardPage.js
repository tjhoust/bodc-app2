import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { entriesAPI, reportsAPI } from '../../api/client';
import { format, subDays } from 'date-fns';

export default function ApproverDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const today = format(new Date(), 'yyyy-MM-dd');
  const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

  const { data: reportData } = useQuery({
    queryKey: ['reports-summary', weekAgo, today],
    queryFn: () => reportsAPI.summary({ start_date: weekAgo, end_date: today }).then(r => r.data),
  });

  const { data: pendingData } = useQuery({
    queryKey: ['entries-pending'],
    queryFn: () => entriesAPI.list({ status: 'submitted', limit: 10 }).then(r => r.data),
  });

  const { data: exceptionsData } = useQuery({
    queryKey: ['entries-exceptions'],
    queryFn: () => entriesAPI.list({ limit: 5 }).then(r => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => entriesAPI.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entries-pending'] }),
  });

  const s = reportData?.summary;
  const pending = pendingData?.entries || [];
  const exceptions = (exceptionsData?.entries || []).filter(e => e.outside_boundary || !e.gps_captured);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-sub">Last 7 days — your team</div>
      </div>

      {/* Stats */}
      <div className="stat-grid stat-grid-4">
        <div className="stat-card">
          <div className="stat-label">Pending approval</div>
          <div className="stat-value" style={{ color: pending.length > 0 ? 'var(--amber)' : undefined }}>{pending.length}</div>
          <div className="stat-sub">entries awaiting review</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Open exceptions</div>
          <div className="stat-value" style={{ color: exceptions.length > 0 ? 'var(--red)' : undefined }}>{exceptions.length}</div>
          <div className="stat-sub">GPS flags to review</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved this week</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{s?.approved_entries || 0}</div>
          <div className="stat-sub">{s?.total_hours ? `${parseFloat(s.total_hours).toFixed(1)} hrs total` : ''}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">GPS compliance</div>
          <div className="stat-value" style={{ color: s?.gps_compliance >= 90 ? 'var(--green)' : 'var(--amber)' }}>
            {s?.gps_compliance || 100}%
          </div>
          <div className="stat-sub">this week</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Pending approvals */}
        <div style={{ flex: 2, minWidth: 300 }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Awaiting approval</div>
              {pending.length > 0 && (
                <button className="btn btn-success btn-sm" onClick={() => navigate('/approve')}>
                  Review all
                </button>
              )}
            </div>
            {pending.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 13 }}>
                All caught up — no pending entries
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Worker</th><th>Date</th><th>Hrs</th><th>GPS</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {pending.slice(0, 5).map(e => (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 500 }}>{e.first_name} {e.last_name}</td>
                        <td style={{ fontSize: 12 }}>{format(new Date(e.entry_date), 'd MMM')}</td>
                        <td>{(e.total_minutes / 60).toFixed(1)}</td>
                        <td>
                          {!e.gps_captured ? <span className="gps-err">Missing</span> :
                           e.outside_boundary ? <span className="gps-warn">Outside</span> :
                           <span className="gps-ok">OK</span>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => approveMutation.mutate(e.id)}
                              disabled={approveMutation.isPending}
                            >Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => navigate('/queries')}>Query</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Exceptions & worker totals */}
        <div style={{ flex: 1, minWidth: 260 }}>
          {exceptions.length > 0 && (
            <div className="card">
              <div className="card-title">Action needed</div>
              {exceptions.slice(0, 4).map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: !e.gps_captured ? 'var(--red)' : 'var(--amber)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12 }}>
                    {e.first_name} {e.last_name} — {!e.gps_captured ? 'GPS missing' : 'Outside boundary'}
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate('/exceptions')}>Review</button>
                </div>
              ))}
            </div>
          )}

          {reportData?.by_worker?.length > 0 && (
            <div className="card">
              <div className="card-title">Hours by worker this week</div>
              {reportData.by_worker.map(w => (
                <div key={w.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span>{w.worker}</span>
                  <span style={{ fontWeight: 600 }}>{w.hours} hrs</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
