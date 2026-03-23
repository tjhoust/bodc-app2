import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { orgsAPI } from '../../api/client';

export default function BrandingPage() {
  const { data } = useQuery({ queryKey:['org-me'], queryFn:()=>orgsAPI.me().then(r=>r.data) });
  const org = data?.organisation;
  const [form, setForm] = useState(null);
  React.useEffect(()=>{if(org)setForm({app_name:org.app_name,primary_colour:org.primary_colour,accent_colour:org.accent_colour,custom_domain:org.custom_domain||''});},[org]);
  const saveMutation = useMutation({ mutationFn:()=>orgsAPI.updateBranding(form), onSuccess:()=>alert('Branding saved') });
  if(!form)return<div className="loading-center"><div className="spinner"/></div>;
  return (<div>
    <div className="page-header"><div className="page-title">Branding</div></div>
    <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
      <div style={{flex:1,minWidth:280}}>
        <div className="card">
          <div className="form-group" style={{marginBottom:14}}><label className="form-label">App name</label><input value={form.app_name} onChange={e=>setForm(f=>({...f,app_name:e.target.value}))}/></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Primary colour</label><div style={{display:'flex',gap:8}}><input type="color" value={form.primary_colour} onChange={e=>setForm(f=>({...f,primary_colour:e.target.value}))} style={{width:44,height:42,padding:2,borderRadius:8,cursor:'pointer'}}/><input value={form.primary_colour} onChange={e=>setForm(f=>({...f,primary_colour:e.target.value}))} style={{width:100}}/></div></div>
            <div className="form-group"><label className="form-label">Accent colour</label><div style={{display:'flex',gap:8}}><input type="color" value={form.accent_colour} onChange={e=>setForm(f=>({...f,accent_colour:e.target.value}))} style={{width:44,height:42,padding:2,borderRadius:8,cursor:'pointer'}}/><input value={form.accent_colour} onChange={e=>setForm(f=>({...f,accent_colour:e.target.value}))} style={{width:100}}/></div></div>
          </div>
          <div className="form-group" style={{marginBottom:16}}><label className="form-label">Custom domain</label><div style={{display:'flex',gap:6,alignItems:'center'}}><input value={form.custom_domain} onChange={e=>setForm(f=>({...f,custom_domain:e.target.value}))} style={{maxWidth:160}}/><span style={{fontSize:13,color:'var(--text2)'}}>.bodc.app</span></div></div>
          <button className="btn btn-primary" onClick={()=>saveMutation.mutate()} disabled={saveMutation.isPending}>Save branding</button>
        </div>
      </div>
      <div style={{width:240,flexShrink:0}}>
        <div className="card"><div className="card-title">Preview</div>
          <div style={{border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
            <div style={{background:form.primary_colour,padding:'10px 12px',display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:22,height:22,background:'rgba(255,255,255,0.22)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2"><circle cx="8" cy="8" r="5"/><path d="M8 5v3l2 1.5"/></svg></div>
              <span style={{color:'white',fontWeight:600,fontSize:13}}>{form.app_name}</span>
            </div>
            <div style={{background:'var(--bg)',padding:12}}>
              <div style={{background:'white',borderRadius:8,padding:12,marginBottom:8,border:'1px solid var(--border)'}}>
                <div style={{fontSize:28,fontWeight:700,letterSpacing:-1,marginBottom:8}}>00:00:00</div>
                <div style={{background:form.primary_colour,color:'white',borderRadius:7,padding:'8px 0',textAlign:'center',fontSize:12,fontWeight:600}}>Start timer</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>);
}