import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { orgsAPI } from '../../api/client';
import { useNavigate } from 'react-router-dom';

const STEPS = ['Details','Plan & features','Admin user','Review'];

export default function OnboardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name:'',slug:'',industry:'Mining',country:'Australia',state:'QLD',plan:'trial',max_users:25,admin_email:'',admin_first_name:'',admin_last_name:'',feature_gps:true,feature_checklist:true,feature_2fa:true,feature_offline:true });

  const createMutation = useMutation({
    mutationFn: () => orgsAPI.create(form),
    onSuccess: () => { alert(`Organisation "${form.name}" created! Invitation sent to ${form.admin_email}`); navigate('/orgs'); },
    onError: (err) => alert(err.response?.data?.error||'Failed to create'),
  });

  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const FEATS = [['feature_gps','GPS enforcement'],['feature_checklist','Pre-start checklist'],['feature_2fa','Two-factor auth'],['feature_offline','Offline capture']];

  const stepContent = [
    (<div key="s0">
      <div className="form-group" style={{marginBottom:14}}><label className="form-label">Organisation name</label><input value={form.name} onChange={e=>f('name',e.target.value)} placeholder="BuildCo NSW Pty Ltd"/></div>
      <div className="form-group" style={{marginBottom:14}}><label className="form-label">Slug (subdomain)</label><div style={{display:'flex',gap:6,alignItems:'center'}}><input value={form.slug} onChange={e=>f('slug',e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))} placeholder="buildco-nsw" style={{maxWidth:180}}/><span style={{fontSize:13,color:'var(--text2)'}}>.bodc.app</span></div></div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Industry</label><select value={form.industry} onChange={e=>f('industry',e.target.value)}><option>Mining</option><option>Construction</option><option>Field services</option><option>Civil</option></select></div>
        <div className="form-group"><label className="form-label">State</label><select value={form.state} onChange={e=>f('state',e.target.value)}><option>QLD</option><option>NSW</option><option>VIC</option><option>WA</option><option>SA</option></select></div>
      </div>
    </div>),
    (<div key="s1">
      <div className="form-row" style={{marginBottom:14}}>
        <div className="form-group"><label className="form-label">Plan</label><select value={form.plan} onChange={e=>f('plan',e.target.value)}><option value="trial">Trial (30 days)</option><option value="standard">Standard</option><option value="enterprise">Enterprise</option></select></div>
        <div className="form-group"><label className="form-label">Max users</label><input type="number" value={form.max_users} onChange={e=>f('max_users',parseInt(e.target.value))}/></div>
      </div>
      <div style={{fontSize:12,fontWeight:600,color:'var(--text2)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.04em'}}>Default features</div>
      {FEATS.map(([k,l])=>(<div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
        <span style={{fontSize:13,fontWeight:500}}>{l}</span>
        <button className={`toggle ${form[k]?'on':''}`} onClick={()=>f(k,!form[k])}/>
      </div>))}
    </div>),
    (<div key="s2">
      <div className="form-row">
        <div className="form-group"><label className="form-label">First name</label><input value={form.admin_first_name} onChange={e=>f('admin_first_name',e.target.value)}/></div>
        <div className="form-group"><label className="form-label">Last name</label><input value={form.admin_last_name} onChange={e=>f('admin_last_name',e.target.value)}/></div>
      </div>
      <div className="form-group"><label className="form-label">Email address</label><input type="email" value={form.admin_email} onChange={e=>f('admin_email',e.target.value)} placeholder="admin@company.com"/></div>
      <div className="alert alert-info" style={{marginTop:14}}>An invitation email will be sent to this address to set up their password and 2FA.</div>
    </div>),
    (<div key="s3">
      <div className="card" style={{background:'var(--bg)',border:'1px solid var(--border)'}}>
        {[['Organisation',form.name],['Slug',form.slug+'.bodc.app'],['Industry',form.industry+' — '+form.state],['Plan',form.plan],['Max users',form.max_users],['Admin',form.admin_first_name+' '+form.admin_last_name+' <'+form.admin_email+'>']].map(([k,v])=>(
          <div key={k} style={{display:'flex',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
            <span style={{width:140,color:'var(--text2)'}}>{k}</span>
            <span style={{fontWeight:500}}>{v}</span>
          </div>
        ))}
      </div>
      <div className="alert alert-success" style={{marginTop:12}}>Once created, the organisation is immediately active and the admin receives their setup email.</div>
    </div>),
  ];

  return (<div style={{maxWidth:600}}>
    <div className="page-header"><div className="page-title">Onboard new organisation</div></div>
    <div style={{display:'flex',alignItems:'center',marginBottom:24}}>
      {STEPS.map((s,i)=>(<React.Fragment key={s}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,flex:1}}>
          <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:600,background:i===step?'var(--blue)':i<step?'var(--green)':'var(--surface2)',color:i<=step?'white':'var(--text3)',border:`2px solid ${i===step?'var(--blue)':i<step?'var(--green)':'var(--border2)'}`}}>
            {i<step?'✓':i+1}
          </div>
          <div style={{fontSize:10,fontWeight:i===step?600:400,color:i===step?'var(--blue)':'var(--text3)'}}>{s}</div>
        </div>
        {i<STEPS.length-1&&<div style={{flex:1,height:2,background:i<step?'var(--green)':'var(--border)',marginBottom:14}}/>}
      </React.Fragment>))}
    </div>
    <div className="card">{stepContent[step]}</div>
    <div style={{display:'flex',gap:8,marginTop:4}}>
      {step>0&&<button className="btn btn-secondary" onClick={()=>setStep(s=>s-1)}>Back</button>}
      {step<STEPS.length-1
        ?<button className="btn btn-primary" onClick={()=>setStep(s=>s+1)}>Continue</button>
        :<button className="btn btn-primary" onClick={()=>createMutation.mutate()} disabled={createMutation.isPending}>{createMutation.isPending?'Creating...':'Create organisation'}</button>
      }
    </div>
  </div>);
}