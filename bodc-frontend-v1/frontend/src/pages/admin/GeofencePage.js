import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sitesAPI } from '../../api/client';

export default function GeofencePage() {
  const [selectedSite, setSelectedSite] = useState(null);
  const { data } = useQuery({ queryKey:['sites'], queryFn:()=>sitesAPI.list().then(r=>r.data) });
  const sites = data?.sites || [];
  const site  = selectedSite ? sites.find(s=>s.id===selectedSite) : sites[0];

  return (<div>
    <div className="page-header"><div className="page-title">Geofence editor</div></div>
    <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
      <div style={{width:200,flexShrink:0}}>
        <div className="card" style={{padding:12}}>
          <div className="card-title">Sites</div>
          {sites.map(s=>(<div key={s.id} onClick={()=>setSelectedSite(s.id)}
            style={{padding:'9px 11px',borderRadius:8,cursor:'pointer',marginBottom:4,fontSize:13,background:s.id===(selectedSite||sites[0]?.id)?'var(--blue-bg)':'transparent',color:s.id===(selectedSite||sites[0]?.id)?'var(--blue-text)':'var(--text2)',fontWeight:s.id===(selectedSite||sites[0]?.id)?600:400}}>
            {s.name}
          </div>))}
        </div>
      </div>
      <div style={{flex:1,minWidth:300}}>
        {site && (<div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={{fontWeight:600,fontSize:14}}>{site.name}</div>
            <div style={{display:'flex',gap:6}}>
              <button className="btn btn-secondary btn-sm">Draw boundary</button>
              <button className="btn btn-primary btn-sm" onClick={()=>alert('Boundary saved')}>Save</button>
            </div>
          </div>
          <div style={{background:'#deeaf7',borderRadius:8,height:280,position:'relative',overflow:'hidden',marginBottom:16}}>
            <svg style={{position:'absolute',top:0,left:0,width:'100%',height:'100%'}} viewBox="0 0 500 280" preserveAspectRatio="none">
              <defs><pattern id="gg" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(26,109,201,0.07)" strokeWidth="1"/></pattern></defs>
              <rect width="500" height="280" fill="url(#gg)"/>
              <polygon points="150,55 340,45 380,170 300,230 120,220 80,135" fill="rgba(26,109,201,0.1)" stroke="#1a6dc9" strokeWidth="2" strokeDasharray="7,3"/>
              <circle cx="150" cy="55" r="5" fill="white" stroke="#1a6dc9" strokeWidth="2"/>
              <circle cx="340" cy="45" r="5" fill="white" stroke="#1a6dc9" strokeWidth="2"/>
              <circle cx="380" cy="170" r="5" fill="white" stroke="#1a6dc9" strokeWidth="2"/>
              <circle cx="300" cy="230" r="5" fill="white" stroke="#1a6dc9" strokeWidth="2"/>
              <circle cx="120" cy="220" r="5" fill="white" stroke="#1a6dc9" strokeWidth="2"/>
              <circle cx="80" cy="135" r="5" fill="white" stroke="#1a6dc9" strokeWidth="2"/>
              <circle cx="195" cy="135" r="8" fill="#1a6dc9" opacity="0.9"/>
              <text x="195" y="153" textAnchor="middle" fontSize="9" fill="#0f4a8a">Worker</text>
            </svg>
            <div style={{position:'absolute',bottom:8,left:8}}><span className="gps-ok">Boundary active</span></div>
          </div>
          <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
            <div className="form-group" style={{flex:'0 0 160px'}}><label className="form-label">Enforcement mode</label>
              <select defaultValue={site.enforcement_mode||'log_flag'}><option value="warn">Warn only</option><option value="log_flag">Log & flag</option><option value="block">Block timer start</option></select>
            </div>
            <div className="form-group" style={{flex:'0 0 120px'}}><label className="form-label">Alert threshold (min)</label><input type="number" defaultValue={site.alert_threshold_minutes||15}/></div>
          </div>
        </div>)}
      </div>
    </div>
  </div>);
}