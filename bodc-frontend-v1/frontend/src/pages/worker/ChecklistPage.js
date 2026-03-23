import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { checklistAPI } from '../../api/client';
import { format } from 'date-fns';

export default function ChecklistPage() {
  const qc = useQueryClient();
  const [responses, setResponses] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['checklist-today'],
    queryFn: () => checklistAPI.todayStatus().then(r => r.data),
  });

  const submitMutation = useMutation({
    mutationFn: () => checklistAPI.submit(data?.template?.id, responses),
    onSuccess: () => { setSubmitted(true); qc.invalidateQueries({ queryKey: ['checklist-today'] }); },
  });

  if (isLoading) return <div className="loading-center"><div className="spinner" /></div>;

  const template = data?.template;
  const alreadyDone = data?.completed_today || submitted;
  const items = template?.items || [];
  const checked = Object.values(responses).filter(Boolean).length;
  const pct = items.length ? Math.round(checked / items.length * 100) : 0;
  const allDone = checked === items.length && items.length > 0;

  if (alreadyDone) {
    return (
      <div>
        <div className="page-header"><div className="page-title">Pre-start declaration</div></div>
        <div className="card" style={{ maxWidth: 560, textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ width: 56, height: 56, background: 'var(--green-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Declaration complete</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>Completed at {data?.completed_at ? format(new Date(data.completed_at), 'HH:mm') : 'today'}. You may start the timer.</div>
          <a href="/timer" className="btn btn-primary">Go to timer</a>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div>
        <div className="page-header"><div className="page-title">Pre-start declaration</div></div>
        <div className="alert alert-info">No active checklist template assigned to your site. Contact your admin.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Pre-start declaration</div>
        <div className="page-sub">{template.name} — {format(new Date(), 'd MMM yyyy')}</div>
      </div>
      <div style={{ maxWidth: 600 }}>
        <div className="alert alert-info">All items must be acknowledged before you can start work today.</div>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{checked}/{items.length} completed</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{pct}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ height: '100%', borderRadius: 3, background: 'var(--green)', width: `${pct}%`, transition: 'width 0.3s' }} />
          </div>
          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div
                className={`checkbox ${responses[item.id] ? 'checked' : ''}`}
                onClick={() => setResponses(r => ({ ...r, [item.id]: !r[item.id] }))}
                style={{ marginTop: 1 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{item.question}</div>
                {item.hint && <div style={{ fontSize: 12, color: 'var(--text2)' }}>{item.hint}</div>}
                {item.item_type === 'text_response' && responses[item.id] && (
                  <input type="text" style={{ marginTop: 6, width: '100%' }} placeholder="Your response..." />
                )}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary btn-lg"
              disabled={!allDone || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
              style={{ opacity: allDone ? 1 : 0.5 }}
            >
              {submitMutation.isPending ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> : 'Acknowledge & proceed to work'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
