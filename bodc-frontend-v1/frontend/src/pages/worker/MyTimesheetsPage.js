import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entriesAPI, queriesAPI } from '../../api/client';
import { format } from 'date-fns';

export default function MyTimesheetsPage() {
  const qc = useQueryClient();
  const [queryEntry, setQueryEntry] = useState(null);
  const [replyMsg, setReplyMsg] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['my-entries'],
    queryFn: () => entriesAPI.list({ limit: 30 }).then(r => r.data),
  });
  const submitMutation = useMutation({
    mutationFn: (id) => entriesAPI.submit(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-entries'] }),
  });
  const entries = data?.entries || [];
  const totalHours = entries.reduce((s, e) => s + e.total_minutes / 60, 0);
  const approved = entries.filter(e => e.status === 'approved').reduce((s, e) => s + e.total_minutes / 60, 0);
  const openQueries = entries.filter(e => e.status === 'queried').length;

  if (isLoading) return <div className="loading-center"><div className="spinner" /></div>;

  return (<div>
    <div className="page-header"><div className="page-title">My timesheets</div><div className="page-sub">Last 30 days</div></div>
    <div className="stat-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
      <div className="stat-card"><div className="stat-label">Total hours</div><div className="stat-value">{totalHours.toFixed(1)}</div></div>
      <div className="stat-card"><div className="stat-label">Approved</div><div className="stat-value" style={{color:'var(--green)'}}>{approved.toFixed(1)}</div></div>
      <div className="stat-card"><div className="stat-label">Open queries</div><div className="stat-value" style={{color:openQueries>0?'var(--amber)':undefined}}>{openQueries}</div></div>
    </div>
    {openQueries > 0 && <div className="alert alert-warning">You have {openQueries} open {openQueries===1?'query':'queries'} — review and respond below.</div>}
    <div className="card"><div className="table-wrap"><table>
      <thead><tr><th>Date</th><th>Site</th><th>Code</th><th>Hours</th><th>GPS</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>{entries.map(e => (
        <tr key={e.id}>
          <td>{format(new Date(e.entry_date),'d MMM')}</td>
          <td style={{fontSize:12}}>{e.site_name||'—'}</td>
          <td style={{fontFamily:'monospace',fontSize:11}}>{e.work_code||'—'}</td>
          <td>{(e.total_minutes/60).toFixed(1)}</td>
          <td>{!e.gps_captured?<span className="gps-err">Missing</span>:e.outside_boundary?<span className="gps-warn">Outside</span>:<span className="gps-ok">OK</span>}</td>
          <td><span className={`pill pill-${e.status}`}>{e.status}</span></td>
          <td>{e.status==='draft'?<button className="btn btn-primary btn-sm" onClick={()=>submitMutation.mutate(e.id)}>Submit</button>
            :e.status==='queried'?<button className="btn btn-danger btn-sm" onClick={()=>setQueryEntry(e)}>Respond</button>:'—'}</td>
        </tr>
      ))}</tbody>
    </table></div></div>
    {queryEntry && (<div className="card">
      <div className="card-title">Query — {format(new Date(queryEntry.entry_date),'d MMM')}</div>
      <div style={{border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',marginBottom:12}}>
        <div style={{padding:'10px 14px',fontSize:13,background:'var(--amber-bg)'}}>
          <div style={{fontSize:11,fontWeight:600,marginBottom:3,color:'var(--amber-text)'}}>Approver query</div>
          Review your GPS data for this entry.
        </div>
        <div style={{padding:'10px 14px',fontSize:13,background:'var(--surface2)'}}>
          <div style={{fontSize:11,fontWeight:600,marginBottom:3}}>Your response</div>
          <textarea value={replyMsg} onChange={e=>setReplyMsg(e.target.value)} placeholder="Explain your location or situation..." style={{width:'100%',border:'none',background:'transparent',resize:'none',fontSize:13,outline:'none'}} rows={3}/>
        </div>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button className="btn btn-primary" onClick={()=>{setQueryEntry(null);setReplyMsg('');}}>Submit response</button>
        <button className="btn btn-secondary" onClick={()=>setQueryEntry(null)}>Cancel</button>
      </div>
    </div>)}
  </div>);
}