import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditAPI } from '../../api/client';
import { format } from 'date-fns';

export default function AuditPage() {
  const { data, isLoading } = useQuery({ queryKey:['audit'], queryFn:()=>auditAPI.list().then(r=>r.data) });
  const logs = data?.logs||[];
  if(isLoading)return<div className="loading-center"><div className="spinner"/></div>;
  return (<div>
    <div className="page-header"><div className="page-title">Audit log</div><div className="page-sub">All actions are immutable and timestamped</div></div>
    <div className="card"><div className="table-wrap"><table>
      <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Detail</th><th>IP</th></tr></thead>
      <tbody>{logs.map(l=>(<tr key={l.id}>
        <td style={{fontSize:11,fontFamily:'monospace',whiteSpace:'nowrap'}}>{format(new Date(l.created_at),'d MMM HH:mm:ss')}</td>
        <td style={{fontSize:12}}>{l.user_email}</td>
        <td style={{fontSize:12,fontWeight:500}}>{l.action}</td>
        <td style={{fontSize:11,color:'var(--text2)',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.new_value?JSON.stringify(l.new_value).slice(0,60):''}</td>
        <td style={{fontSize:11,fontFamily:'monospace'}}>{l.ip_address}</td>
      </tr>))}</tbody>
    </table></div></div>
  </div>);
}