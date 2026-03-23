import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI } from '../../api/client';
import { format, subDays } from 'date-fns';

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(),7),'yyyy-MM-dd'));
  const [endDate,   setEndDate]   = useState(format(new Date(),'yyyy-MM-dd'));
  const { data, isLoading } = useQuery({
    queryKey: ['reports', startDate, endDate],
    queryFn: () => reportsAPI.summary({ start_date: startDate, end_date: endDate }).then(r => r.data),
  });
  const s = data?.summary;

  return (<div>
    <div className="page-header"><div className="page-title">Reports & analytics</div></div>
    <div style={{display:'flex',gap:8,alignItems:'flex-end',marginBottom:18,flexWrap:'wrap'}}>
      <div className="form-group" style={{flex:'0 0 auto'}}><label className="form-label">From</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></div>
      <div className="form-group" style={{flex:'0 0 auto'}}><label className="form-label">To</label><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></div>
    </div>
    {isLoading ? <div className="loading-center"><div className="spinner"/></div> : s && (<>
      <div className="stat-grid stat-grid-4">
        <div className="stat-card"><div className="stat-label">Total hours</div><div className="stat-value">{parseFloat(s.total_hours||0).toFixed(1)}</div></div>
        <div className="stat-card"><div className="stat-label">Approval rate</div><div className="stat-value" style={{color:'var(--green)'}}>{s.approval_rate||0}%</div></div>
        <div className="stat-card"><div className="stat-label">GPS compliance</div><div className="stat-value" style={{color:s.gps_compliance>=90?'var(--green)':'var(--amber)'}}>{s.gps_compliance||100}%</div></div>
        <div className="stat-card"><div className="stat-label">Total entries</div><div className="stat-value">{s.total_entries||0}</div></div>
      </div>
      <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:260}} className="card"><div className="card-title">Hours by worker</div>
          {(data?.by_worker||[]).map(w=>(<div key={w.user_id} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
            <span>{w.worker}</span><span style={{fontWeight:600}}>{w.hours} hrs</span>
          </div>))}
        </div>
        <div style={{flex:1,minWidth:260}} className="card"><div className="card-title">Hours by work code</div>
          {(data?.by_work_code||[]).map(c=>(<div key={c.code} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
            <span>{c.code} — {c.name}</span><span style={{fontWeight:600}}>{c.hours} hrs</span>
          </div>))}
        </div>
      </div>
    </>)}
  </div>);
}