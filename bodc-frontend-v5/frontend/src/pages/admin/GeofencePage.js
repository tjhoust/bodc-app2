/* eslint-disable */
import React, { useState } from 'react';
import { GeofenceMap } from '../../components/MapView';
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
          <GeofenceMap site={site} onBoundaryChange={(changes) => console.log('Boundary updated:', changes)} />
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