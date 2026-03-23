import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';
export default function ResetPasswordPage() {
  const [params] = useSearchParams(); const navigate = useNavigate();
  const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
  async function handle(e) {
    e.preventDefault(); setLoading(true);
    try { await authAPI.resetPassword(params.get('token'), pw); navigate('/login?reset=1'); }
    catch(err) { setErr(err.response?.data?.error || 'Reset failed'); }
    finally { setLoading(false); }
  }
  return (<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)',padding:16}}>
    <div className="card" style={{width:'100%',maxWidth:400,padding:'32px 28px'}}>
      <h1 style={{fontSize:20,fontWeight:700,marginBottom:8}}>Set new password</h1>
      {err && <div className="alert alert-danger">{err}</div>}
      <form onSubmit={handle}>
        <div className="form-group" style={{marginBottom:20}}><label className="form-label">New password</label><input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Min 8 characters" required /></div>
        <button type="submit" className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Saving...' : 'Set password'}</button>
      </form>
    </div>
  </div>);
}