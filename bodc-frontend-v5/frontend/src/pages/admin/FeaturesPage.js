import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { orgsAPI } from '../../api/client';

export default function FeaturesPage() {
  const { data } = useQuery({ queryKey:['org-me'], queryFn:()=>orgsAPI.me().then(r=>r.data) });
  const org = data?.organisation;
  const [features, setFeatures] = useState(null);
  React.useEffect(()=>{if(org)setFeatures({feature_gps:org.feature_gps,feature_manual_only:org.feature_manual_only,feature_checklist:org.feature_checklist,feature_map:org.feature_map,feature_2fa:org.feature_2fa,feature_offline:org.feature_offline});},[org]);
  const saveMutation = useMutation({ mutationFn:()=>orgsAPI.updateFeatures(features), onSuccess:()=>alert('Features saved') });
  const FEATS = [['feature_gps','GPS enforcement','Require GPS on all entries'],['feature_manual_only','Manual entry only','Disable timer, allow manual hours only'],['feature_checklist','Pre-start checklist','Require declaration before work starts'],['feature_map','Map interface','Show site map and worker location'],['feature_2fa','Two-factor auth','Enforce 2FA for all users'],['feature_offline','Offline capture','Allow offline entries with sync']];
  if(!features)return<div className="loading-center"><div className="spinner"/></div>;
  return (<div>
    <div className="page-header"><div className="page-title">Feature flags</div><div className="page-sub">{org?.name}</div></div>
    <div className="card" style={{maxWidth:500}}>
      {FEATS.map(([k,label,desc])=>(<div key={k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
        <div><div style={{fontSize:13,fontWeight:500}}>{label}</div><div style={{fontSize:11,color:'var(--text2)'}}>{desc}</div></div>
        <button className={`toggle ${features[k]?'on':''}`} onClick={()=>setFeatures(f=>({...f,[k]:!f[k]}))}/>
      </div>))}
      <div style={{marginTop:14}}><button className="btn btn-primary" onClick={()=>saveMutation.mutate()} disabled={saveMutation.isPending}>Save changes</button></div>
    </div>
  </div>);
}