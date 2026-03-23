import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entriesAPI } from '../../api/client';
import { format } from 'date-fns';

export default function TimesheetsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState([]);
  const [statusFilter, setStatusFilter] = useState('submitted');

  const { data, isLoading } = useQuery({
    queryKey: ['approve-entries', statusFilter],
    queryFn: () => entriesAPI.list({ status: statusFilter, limit: 50 }).then(r => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => entriesAPI.approve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['approve-entries'] }); setSelected([]); },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: () => entriesAPI.bulkApprove(selected),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['approve-entries'] }); setSelected([]); },
  });

  const entries = data?.entries || [];
  const toggle  = id => setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]);
  const toggleAll = () => setSelected(s => s.length === entries.length ? [] : entries.map(e=>e.id));

  if (isLoading) return <div className="loading-center"><div className="spinner"/></div>;

  return (<div>
    <div className="page-header"><div className="page-title">Timesheets</div></div>
    <div style={{display:'flex',gap:8,marginBottom:14,alignItems:'center',flexWrap:'wrap'}}>
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{width:'auto'}}>
        <option value="submitted">Submitted</option>
        <option value="approved">Approved</option>
        <option value="queried">Queried</option>
        <option value="">All statuses</option>
      </select>
      {selected.length > 0 && (<button className="btn btn-success" onClick={()=>bulkApproveMutation.mutate()} disabled={bulkApproveMutation.isPending}>
        Bulk approve ({selected.length})
      </button>)}
    </div>
    <div className="card"><div className="table-wrap"><table>
      <thead><tr>
        <th><input type="checkbox" onChange={toggleAll} checked={selected.length===entries.length&&entries.length>0}/></th>
        <th>Worker</th><th>Date</th><th>Site</th><th>Code</th><th>Hours</th><th>GPS</th><th>Status</th><th>Actions</th>
      </tr></thead>
      <tbody>{entries.map(e => (<tr key={e.id}>
        <td><input type="checkbox" checked={selected.includes(e.id)} onChange={()=>toggle(e.id)}/></td>
        <td style={{fontWeight:500}}>{e.first_name} {e.last_name}</td>
        <td style={{fontSize:12}}>{format(new Date(e.entry_date),'d MMM')}</td>
        <td style={{fontSize:12}}>{e.site_name||'—'}</td>
        <td style={{fontFamily:'monospace',fontSize:11}}>{e.work_code||'—'}</td>
        <td>{(e.total_minutes/60).toFixed(1)}</td>
        <td>{!e.gps_captured?<span className="gps-err">Missing</span>:e.outside_boundary?<span className="gps-warn">Outside</span>:<span className="gps-ok">OK</span>}</td>
        <td><span className={`pill pill-${e.status}`}>{e.status}</span></td>
        <td><div style={{display:'flex',gap:4}}>
          {e.status==='submitted'&&<><button className="btn btn-success btn-sm" onClick={()=>approveMutation.mutate(e.id)}>Approve</button><button className="btn btn-danger btn-sm">Query</button></>}
        </div></td>
      </tr>))}</tbody>
    </table></div></div>
  </div>);
}