import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entriesAPI } from '../../api/client';
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks } from 'date-fns';

export default function WeeklyViewPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = startOfWeek(subWeeks(new Date(), -weekOffset), { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(weekStart, { weekStartsOn: 1 });

  const { data } = useQuery({
    queryKey: ['weekly-entries', weekOffset],
    queryFn: () => entriesAPI.list({ start_date: format(weekStart,'yyyy-MM-dd'), end_date: format(weekEnd,'yyyy-MM-dd') }).then(r => r.data),
  });

  const entries = data?.entries || [];
  const total   = entries.reduce((s,e) => s + e.total_minutes/60, 0);
  const approved= entries.filter(e=>e.status==='approved').reduce((s,e)=>s+e.total_minutes/60, 0);

  return (<div>
    <div className="page-header"><div className="page-title">Weekly timesheet</div></div>
    <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:18}}>
      <button className="btn btn-secondary" onClick={()=>setWeekOffset(v=>v-1)}>← Prev</button>
      <span style={{fontSize:13,fontWeight:600}}>{format(weekStart,'d MMM')} — {format(weekEnd,'d MMM yyyy')}</span>
      <button className="btn btn-secondary" disabled={weekOffset===0} onClick={()=>setWeekOffset(v=>v+1)}>Next →</button>
    </div>
    <div className="stat-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
      <div className="stat-card"><div className="stat-label">Total hours</div><div className="stat-value">{total.toFixed(1)}</div></div>
      <div className="stat-card"><div className="stat-label">Approved</div><div className="stat-value" style={{color:'var(--green)'}}>{approved.toFixed(1)}</div></div>
      <div className="stat-card"><div className="stat-label">Pending</div><div className="stat-value" style={{color:'var(--amber)'}}>{(total-approved).toFixed(1)}</div></div>
    </div>
    <div className="card">
      {entries.length === 0 ? <div style={{textAlign:'center',padding:'24px 0',color:'var(--text3)',fontSize:13}}>No entries this week</div> : (
        entries.map(e => (<div key={e.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
          <div style={{width:90,fontSize:12,fontWeight:500,color:'var(--text2)'}}>{format(new Date(e.entry_date),'EEE d MMM')}</div>
          <div style={{flex:1,fontSize:12}}>{e.work_code} — {e.site_name||'—'}</div>
          <div style={{fontWeight:600,width:48,textAlign:'right'}}>{(e.total_minutes/60).toFixed(1)}h</div>
          <div style={{width:80,textAlign:'right'}}><span className={`pill pill-${e.status}`}>{e.status}</span></div>
        </div>))
      )}
      {entries.length > 0 && (<div style={{display:'flex',justifyContent:'space-between',padding:'12px 0 0',fontWeight:700,fontSize:13}}>
        <span>Weekly total</span><span>{total.toFixed(1)} hrs</span>
      </div>)}
    </div>
    {entries.filter(e=>e.status==='draft'||e.status==='submitted').length > 0 && (
      <button className="btn btn-primary" onClick={()=>alert('Week submitted for approval')}>Submit week for approval</button>
    )}
  </div>);
}