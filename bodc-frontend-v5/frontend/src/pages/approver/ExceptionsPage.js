/* eslint-disable */
import React from 'react';
import { ExceptionMap } from '../../components/MapView';
import { useQuery } from '@tanstack/react-query';
import { entriesAPI } from '../../api/client';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function ExceptionsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['exceptions'],
    queryFn: () => entriesAPI.list({ limit: 50 }).then(r => r.data),
  });
  const entries = (data?.entries || []).filter(e => !e.gps_captured || e.outside_boundary);

  if (isLoading) return <div className="loading-center"><div className="spinner"/></div>;

  return (<div>
    <div className="page-header"><div className="page-title">Exceptions & flags</div><div className="page-sub">{entries.length} open</div></div>
    {entries.length > 0 && <ExceptionMap entries={entries} />}
    {entries.length===0 ? <div className="alert alert-success">No exceptions to review.</div> : (
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Worker</th><th>Date</th><th>Flag</th><th>Detail</th><th>Action</th></tr></thead>
        <tbody>{entries.map(e => (<tr key={e.id}>
          <td style={{fontWeight:500}}>{e.first_name} {e.last_name}</td>
          <td>{format(new Date(e.entry_date),'d MMM')}</td>
          <td>{!e.gps_captured?<span className="gps-err">GPS missing</span>:<span className="gps-warn">Outside boundary</span>}</td>
          <td style={{fontSize:12,color:'var(--text2)'}}>{!e.gps_captured?'No coordinates captured':`${e.outside_minutes||0} min outside boundary`}</td>
          <td><button className="btn btn-secondary btn-sm" onClick={()=>navigate('/queries')}>Raise query</button></td>
        </tr>))}</tbody>
      </table></div></div>
    )}
  </div>);
}