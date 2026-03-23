import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { usersAPI, authAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name||'');
  const [lastName, setLastName]   = useState(user?.last_name||'');
  const [saved, setSaved]         = useState(false);
  const [qrCode, setQrCode]       = useState(null);
  const [totpCode, setTotpCode]   = useState('');
  const [totp2FAEnabled, setTotp2FAEnabled] = useState(user?.totp_enabled||false);

  const updateMutation = useMutation({
    mutationFn: () => usersAPI.updateProfile({ first_name: firstName, last_name: lastName }),
    onSuccess: (res) => { updateUser(res.data.user); setSaved(true); setTimeout(()=>setSaved(false),2500); },
  });

  async function setup2FA() {
    const { data } = await authAPI.setup2FA();
    setQrCode(data.qr_code);
  }

  async function verify2FA() {
    try { await authAPI.verify2FA(totpCode); setTotp2FAEnabled(true); setQrCode(null); updateUser({ totp_enabled: true }); }
    catch { alert('Invalid code, try again'); }
  }

  const initials = `${(user?.first_name||'')[0]}${(user?.last_name||'')[0]}`.toUpperCase();

  return (<div style={{maxWidth:480}}>
    <div className="page-header"><div className="page-title">My profile</div></div>
    <div className="card">
      <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}>
        <div className="avatar avatar-lg avatar-blue">{initials}</div>
        <div><div style={{fontWeight:700,fontSize:16}}>{user?.first_name} {user?.last_name}</div><div style={{fontSize:12,color:'var(--text2)'}}>{user?.role?.replace('_',' ')} — {user?.org?.name}</div></div>
      </div>
      {saved && <div className="alert alert-success" style={{marginBottom:12}}>Profile saved</div>}
      <div className="form-row">
        <div className="form-group"><label className="form-label">First name</label><input type="text" value={firstName} onChange={e=>setFirstName(e.target.value)}/></div>
        <div className="form-group"><label className="form-label">Last name</label><input type="text" value={lastName} onChange={e=>setLastName(e.target.value)}/></div>
      </div>
      <div className="form-group" style={{marginBottom:16}}><label className="form-label">Email</label><input type="text" value={user?.email||''} disabled style={{background:'var(--bg)',color:'var(--text2)'}}/></div>
      <button className="btn btn-primary" onClick={()=>updateMutation.mutate()} disabled={updateMutation.isPending}>Save changes</button>
    </div>
    <div className="card">
      <div className="card-title">Two-factor authentication</div>
      {totp2FAEnabled ? (<>
        <div className="alert alert-success" style={{marginBottom:12}}>2FA is enabled on your account.</div>
        <button className="btn btn-secondary">Manage 2FA</button>
      </>) : (<>
        <div className="alert alert-warning" style={{marginBottom:12}}>2FA is not enabled. We recommend enabling it for security.</div>
        {!qrCode ? (<button className="btn btn-primary" onClick={setup2FA}>Set up 2FA</button>) : (<>
          <div style={{marginBottom:12}}><img src={qrCode} alt="2FA QR code" style={{width:180,height:180,border:'1px solid var(--border)',borderRadius:8}}/></div>
          <div className="form-group" style={{marginBottom:12}}><label className="form-label">Enter 6-digit code from your app</label><input type="text" value={totpCode} onChange={e=>setTotpCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" inputMode="numeric" style={{letterSpacing:'0.3em',fontSize:20,textAlign:'center',maxWidth:180}}/></div>
          <button className="btn btn-primary" onClick={verify2FA} disabled={totpCode.length!==6}>Verify and enable</button>
        </>)}
      </>)}
    </div>
  </div>);
}