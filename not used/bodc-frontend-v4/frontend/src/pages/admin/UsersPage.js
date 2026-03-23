/* eslint-disable */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersAPI, sitesAPI } from '../../api/client';

export default function UsersPage() {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email:'', first_name:'', last_name:'', role:'worker', capture_mode:'timer' });
  const [inviteErr, setInviteErr] = useState('');

  const { data } = useQuery({ queryKey:['users'], queryFn:()=>usersAPI.list().then(r=>r.data) });
  const { data: sitesData } = useQuery({ queryKey:['sites'], queryFn:()=>sitesAPI.list().then(r=>r.data) });

  const inviteMutation = useMutation({
    mutationFn: () => usersAPI.invite(form),
    onSuccess: () => { qc.invalidateQueries({queryKey:['users']}); setShowInvite(false); setForm({email:'',first_name:'',last_name:'',role:'worker',capture_mode:'timer'}); },
    onError: (err) => setInviteErr(err.response?.data?.error||'Invite failed'),
  });

  const users = data?.users || [];

  return (<div>
    <div className="page-header"><div className="page-title">Users</div></div>
    <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
      <div style={{display:'flex',gap:8}}><input type="text" placeholder="Search..." style={{width:180}}/></div>
      <button className="btn btn-primary" onClick={()=>setShowInvite(v=>!v)}>+ Invite user</button>
    </div>
    {showInvite && (<div className="card" style={{maxWidth:500,marginBottom:16}}>
      <div className="card-title">Invite new user</div>
      {inviteErr && <div className="alert alert-danger">{inviteErr}</div>}
      <div className="form-row">
        <div className="form-group"><label className="form-label">First name</label><input value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))}/></div>
        <div className="form-group"><label className="form-label">Last name</label><input value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))}/></div>
      </div>
      <div className="form-group" style={{marginBottom:12}}><label className="form-label">Email</label><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Role</label><select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}><option value="worker">Worker</option><option value="approver">Approver</option><option value="org_admin">Admin</option></select></div>
        <div className="form-group"><label className="form-label">Capture mode</label><select value={form.capture_mode} onChange={e=>setForm(f=>({...f,capture_mode:e.target.value}))}><option value="timer">Timer</option><option value="manual">Manual</option><option value="both">Both</option></select></div>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button className="btn btn-primary" onClick={()=>inviteMutation.mutate()} disabled={inviteMutation.isPending||!form.email}>Send invitation</button>
        <button className="btn btn-secondary" onClick={()=>setShowInvite(false)}>Cancel</button>
      </div>
    </div>)}
    <div className="card"><div className="table-wrap"><table>
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Mode</th><th>Status</th><th>Last login</th></tr></thead>
      <tbody>{users.map(u=>(<tr key={u.id}>
        <td style={{fontWeight:500}}>{u.first_name} {u.last_name}</td>
        <td style={{fontSize:12,color:'var(--text2)'}}>{u.email}</td>
        <td><span className="pill pill-submitted" style={{fontSize:10}}>{u.role.replace('_',' ')}</span></td>
        <td style={{fontSize:12}}>{u.capture_mode}</td>
        <td><span className={`pill ${u.is_active?'pill-approved':'pill-draft'}`}>{u.is_active?'Active':'Inactive'}</span></td>
        <td style={{fontSize:11,color:'var(--text3)'}}>{u.last_login_at?new Date(u.last_login_at).toLocaleDateString():'Never'}</td>
      </tr>))}</tbody>
    </table></div></div>
  </div>);
}