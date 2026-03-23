import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { orgsAPI } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export default function OrgsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey:['orgs'], queryFn:()=>orgsAPI.list().then(r=>r.data) });
  const orgs = data?.organisations||[];
  if(isLoading)return<div className="loading-center"><div className="spinner"/></div>;
  const total = orgs.length;
  const active = orgs.filter(o=>o.status==='active').length;
  const users  = orgs.reduce((s,o)=>s+parseInt(o.user_count||0),0);
  return (<div>
    <div className="page-header"><div className="page-title">Organisations</div><div className="page-sub">Platform-wide — all tenants</div></div>
    <div className="stat-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
      <div className="stat-card"><div className="stat-label">Total orgs</div><div className="stat-value">{total}</div></div>
      <div className="stat-card"><div className="stat-label">Active</div><div className="stat-value" style={{color:'var(--green)'}}>{active}</div></div>
      <div className="stat-card"><div className="stat-label">Total users</div><div className="stat-value">{users}</div></div>
    </div>
    <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}><button className="btn btn-primary" onClick={()=>navigate('/onboard')}>+ Onboard organisation</button></div>
    {orgs.map(o=>(<div key={o.id} className="card" style={{display:'flex',alignItems:'center',gap:14}}>
      <div style={{width:40,height:40,borderRadius:8,background:'var(--blue-bg)',color:'var(--blue-text)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,flexShrink:0}}>
        {o.name.slice(0,2).toUpperCase()}
      </div>
      <div style={{flex:1}}>
        <div style={{fontWeight:600,fontSize:14}}>{o.name}</div>
        <div style={{fontSize:12,color:'var(--text2)'}}>{o.user_count||0} users &bull; {o.plan} &bull; Created {format(new Date(o.created_at),'MMM yyyy')}</div>
      </div>
      <span className={`pill ${o.status==='active'?'pill-approved':o.status==='trial'?'pill-queried':'pill-draft'}`}>{o.status}</span>
      <button className="btn btn-secondary btn-sm">Manage</button>
    </div>))}
  </div>);
}