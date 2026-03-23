import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queriesAPI, entriesAPI } from '../../api/client';
import { format } from 'date-fns';

export default function QueriesPage() {
  const qc = useQueryClient();
  const [reply, setReply] = useState({});
  const { data, isLoading } = useQuery({ queryKey:['queries'], queryFn:()=>queriesAPI.list().then(r=>r.data) });
  const resolveMutation = useMutation({ mutationFn:(id)=>queriesAPI.resolve(id), onSuccess:()=>qc.invalidateQueries({queryKey:['queries']}) });
  const queries = data?.queries || [];

  if (isLoading) return <div className="loading-center"><div className="spinner"/></div>;

  return (<div>
    <div className="page-header"><div className="page-title">Queries</div><div className="page-sub">{queries.filter(q=>!q.is_resolved).length} open</div></div>
    {queries.length === 0 ? <div className="alert alert-success">No open queries.</div> :
      queries.map(q => (<div key={q.id} className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
          <div><div className="card-title" style={{marginBottom:4}}>{format(new Date(q.entry_date||new Date()),'d MMM')} — {q.work_code||'entry'}</div>
            <div style={{display:'flex',gap:6}}><span className={`pill pill-${q.is_resolved?'approved':'queried'}`}>{q.is_resolved?'Resolved':'Open'}</span></div>
          </div>
          {!q.is_resolved && <button className="btn btn-success btn-sm" onClick={()=>resolveMutation.mutate(q.id)}>Resolve</button>}
        </div>
        <div style={{border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',marginBottom:10}}>
          {(q.messages||[]).map((m,i) => (<div key={i} style={{padding:'9px 14px',fontSize:13,lineHeight:1.6,borderBottom:'1px solid var(--border)',background:m.is_approver?'var(--amber-bg)':'var(--surface2)'}}>
            <div style={{fontSize:10,fontWeight:700,marginBottom:3,color:'var(--text3)'}}>{m.sender_name} — {format(new Date(m.sent_at),'d MMM HH:mm')}</div>
            {m.message}
          </div>))}
        </div>
        {!q.is_resolved && (<>
          <textarea value={reply[q.id]||''} onChange={e=>setReply(r=>({...r,[q.id]:e.target.value}))} placeholder="Add message..." style={{width:'100%',marginBottom:8,resize:'vertical',minHeight:72}} rows={2}/>
          <button className="btn btn-primary btn-sm" disabled={!reply[q.id]}>Send message</button>
        </>)}
      </div>))
    }
  </div>);
}