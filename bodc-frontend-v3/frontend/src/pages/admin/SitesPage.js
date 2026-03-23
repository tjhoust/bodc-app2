import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sitesAPI } from '../../api/client';

export default function SitesPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name:'', centre_lat:'', centre_lng:'', radius_metres:200, enforcement_mode:'log_flag', gps_required:true });

  const { data } = useQuery({ queryKey:['sites'], queryFn:()=>sitesAPI.list().then(r=>r.data) });
  const createMutation = useMutation({
    mutationFn: () => sitesAPI.create({ ...form, centre_lat:parseFloat(form.centre_lat), centre_lng:parseFloat(form.centre_lng) }),
    onSuccess: () => { qc.invalidateQueries({queryKey:['sites']}); setShowAdd(false); },
  });
  const sites = data?.sites || [];

  return (<div>
    <div className="page-header"><div className="page-title">Sites</div></div>
    <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
      <button className="btn btn-primary" onClick={()=>setShowAdd(v=>!v)}>+ Add site</button>
    </div>
    {showAdd && (<div className="card" style={{maxWidth:500,marginBottom:16}}>
      <div className="card-title">Add site</div>
      <div className="form-group" style={{marginBottom:12}}><label className="form-label">Site name</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Centre latitude</label><input type="number" value={form.centre_lat} onChange={e=>setForm(f=>({...f,centre_lat:e.target.value}))} placeholder="-27.4698"/></div>
        <div className="form-group"><label className="form-label">Centre longitude</label><input type="number" value={form.centre_lng} onChange={e=>setForm(f=>({...f,centre_lng:e.target.value}))} placeholder="153.0251"/></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Boundary radius (m)</label><input type="number" value={form.radius_metres} onChange={e=>setForm(f=>({...f,radius_metres:parseInt(e.target.value)}))} /></div>
        <div className="form-group"><label className="form-label">Enforcement</label><select value={form.enforcement_mode} onChange={e=>setForm(f=>({...f,enforcement_mode:e.target.value}))}><option value="warn">Warn only</option><option value="log_flag">Log & flag</option><option value="block">Block timer</option></select></div>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button className="btn btn-primary" onClick={()=>createMutation.mutate()} disabled={createMutation.isPending||!form.name}>Create site</button>
        <button className="btn btn-secondary" onClick={()=>setShowAdd(false)}>Cancel</button>
      </div>
    </div>)}
    <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
      {sites.map(s=>(<div key={s.id} className="card" style={{flex:'1 1 280px',maxWidth:400}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
          <div style={{fontWeight:600,fontSize:14}}>{s.name}</div>
          <span className={`pill ${s.is_active?'pill-approved':'pill-draft'}`}>{s.is_active?'Active':'Inactive'}</span>
        </div>
        <div style={{fontSize:12,color:'var(--text2)',lineHeight:2}}>
          <div>Boundary: <strong>{s.radius_metres}m radius</strong></div>
          <div>GPS enforcement: <strong style={{color:s.gps_required?'var(--green)':'var(--text2)'}}>{s.gps_required?'On':'Off'}</strong></div>
          <div>Enforcement mode: <strong>{s.enforcement_mode?.replace('_',' ')}</strong></div>
          <div>Workers: <strong>{s.worker_count||0}</strong></div>
        </div>
        <button className="btn btn-secondary btn-sm" style={{marginTop:10}}>Edit</button>
      </div>))}
    </div>
  </div>);
}