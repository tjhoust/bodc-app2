import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { notifsAPI } from '../../api/client';

export default function NotifSettingsPage() {
  const EVENTS = [['entry_submitted','Timesheet submitted','Approver'],['entry_approved','Entry approved','Worker'],['entry_queried','Query raised','Worker, Approver'],['checklist_overdue','Checklist overdue','Worker, Approver'],['gps_exception','GPS exception','Approver'],['offline_synced','Offline sync complete','Worker'],['weekly_digest','Weekly digest','Approver, Admin']];
  const [channels, setChannels] = React.useState({inapp:true,email:true,push:false});
  const [events, setEvents] = React.useState(Object.fromEntries(EVENTS.map(([k])=>[k,true])));
  return (<div>
    <div className="page-header"><div className="page-title">Notification settings</div></div>
    <div className="card" style={{maxWidth:520,marginBottom:16}}>
      <div className="card-title">Delivery channels</div>
      {[['inapp','In-app notifications'],['email','Email notifications'],['push','Push notifications (mobile)']].map(([k,l])=>(
        <div key={k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
          <div style={{fontSize:13,fontWeight:500}}>{l}</div>
          <button className={`toggle ${channels[k]?'on':''}`} onClick={()=>setChannels(c=>({...c,[k]:!c[k]}))}/>
        </div>
      ))}
    </div>
    <div className="card" style={{maxWidth:520}}>
      <div className="card-title">Notification triggers</div>
      <div className="table-wrap"><table>
        <thead><tr><th>Event</th><th>Notifies</th><th>Active</th></tr></thead>
        <tbody>{EVENTS.map(([k,l,r])=>(<tr key={k}>
          <td style={{fontSize:12,fontWeight:500}}>{l}</td>
          <td style={{fontSize:11,color:'var(--text2)'}}>{r}</td>
          <td><button className={`toggle ${events[k]?'on':''}`} onClick={()=>setEvents(e=>({...e,[k]:!e[k]}))}/></td>
        </tr>))}</tbody>
      </table></div>
    </div>
  </div>);
}