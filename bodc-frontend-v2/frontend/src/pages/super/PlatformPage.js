import React, { useState } from 'react';
export default function PlatformPage() {
  const [cfg, setCfg] = useState({gps:true,twofa:true,audit:true,retention:'7 years'});
  return (<div>
    <div className="page-header"><div className="page-title">Platform configuration</div><div className="page-sub">Global defaults for all organisations</div></div>
    <div className="card" style={{maxWidth:500,marginBottom:16}}>
      <div className="card-title">Default feature set</div>
      {[['gps','GPS enforcement default','New organisations start with GPS on'],['twofa','Force 2FA for org admins','Cannot be disabled by org admins'],['audit','Immutable audit logs','Entries cannot be silently edited']].map(([k,l,d])=>(
        <div key={k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
          <div><div style={{fontSize:13,fontWeight:500}}>{l}</div><div style={{fontSize:11,color:'var(--text2)'}}>{d}</div></div>
          <button className={`toggle ${cfg[k]?'on':''}`} onClick={()=>setCfg(c=>({...c,[k]:!c[k]}))}/>
        </div>
      ))}
    </div>
    <div className="card" style={{maxWidth:500}}>
      <div className="card-title">Data retention</div>
      <div className="form-group" style={{marginBottom:14}}><label className="form-label">Default retention period</label>
        <select value={cfg.retention} onChange={e=>setCfg(c=>({...c,retention:e.target.value}))}><option>7 years</option><option>5 years</option><option>3 years</option></select>
      </div>
      <button className="btn btn-primary" onClick={()=>alert('Platform config saved')}>Save changes</button>
    </div>
  </div>);
}