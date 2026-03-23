import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifsAPI } from '../../api/client';
import { formatDistanceToNow } from 'date-fns';

const TYPE_ICON  = { entry_queried:'🔔', entry_approved:'✓', entry_submitted:'📋', checklist_overdue:'⚠', offline_synced:'↻', gps_exception:'⚠', weekly_digest:'📊', query_responded:'💬' };
const TYPE_COLOR = { entry_queried:'var(--amber-bg)', entry_approved:'var(--green-bg)', entry_submitted:'var(--blue-bg)', checklist_overdue:'var(--red-bg)', offline_synced:'var(--blue-bg)', default:'var(--surface2)' };
const TYPE_TEXT  = { entry_queried:'var(--amber-text)', entry_approved:'var(--green-text)', entry_submitted:'var(--blue-text)', checklist_overdue:'var(--red-text)', offline_synced:'var(--blue-text)', default:'var(--text2)' };

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey:['notifications'], queryFn:()=>notifsAPI.list().then(r=>r.data) });
  const readAll = useMutation({ mutationFn:()=>notifsAPI.readAll(), onSuccess:()=>qc.invalidateQueries({queryKey:['notifications']}) });
  const notifs = data?.notifications || [];
  const unread = data?.unread || 0;

  if (isLoading) return <div className="loading-center"><div className="spinner"/></div>;

  return (<div>
    <div className="page-header">
      <div className="page-title">Notifications</div>
      <div className="page-sub">{unread} unread</div>
    </div>
    {unread > 0 && (<div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
      <button className="btn btn-secondary btn-sm" onClick={()=>readAll.mutate()}>Mark all read</button>
    </div>)}
    {notifs.length === 0 ? (<div style={{textAlign:'center',padding:'40px 0',color:'var(--text3)'}}>No notifications</div>) :
      notifs.map(n => (<div key={n.id} style={{display:'flex',gap:14,padding:'14px 16px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,marginBottom:10,opacity:n.is_read?0.7:1}}>
        <div style={{width:36,height:36,borderRadius:8,background:TYPE_COLOR[n.event]||TYPE_COLOR.default,color:TYPE_TEXT[n.event]||TYPE_TEXT.default,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
          {TYPE_ICON[n.event]||'🔔'}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
            <div style={{fontSize:13,fontWeight:n.is_read?400:600}}>{n.title}{!n.is_read&&<span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:'var(--blue)',marginLeft:5,verticalAlign:'middle'}}/>}</div>
            <div style={{fontSize:11,color:'var(--text3)',whiteSpace:'nowrap',flexShrink:0}}>{formatDistanceToNow(new Date(n.sent_at),{addSuffix:true})}</div>
          </div>
          <div style={{fontSize:12,color:'var(--text2)',marginTop:3,lineHeight:1.5}}>{n.body}</div>
        </div>
      </div>))
    }
  </div>);
}