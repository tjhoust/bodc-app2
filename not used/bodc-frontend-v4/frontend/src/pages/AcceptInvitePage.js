import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';
export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
  async function handle(e) {
    e.preventDefault(); setErr('');
    if (pw !== pw2) return setErr('Passwords do not match');
    if (pw.length < 8) return setErr('Password must be at least 8 characters');
    setLoading(true);
    try { await authAPI.acceptInvite(params.get('token'), pw); navigate('/login?activated=1'); }
    catch(err) { setErr(err.response?.data?.error || 'Invalid or expired invitation'); }
    finally { setLoading(false); }
  }
  return (<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)',padding:16}}>
    <div className="card" style={{width:'100%',maxWidth:400,padding:'32px 28px'}}>
      <h1 style={{fontSize:20,fontWeight:700,marginBottom:8}}>Activate your account</h1>
      <p style={{fontSize:13,color:'var(--text2)',marginBottom:20}}>Set a password to complete your account setup.</p>
      {err && <div className="alert alert-danger">{err}</div>}
      <form onSubmit={handle}>
        <div className="form-group" style={{marginBottom:14}}><label className="form-label">Password</label><input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Min 8 characters" required /></div>
        <div className="form-group" style={{marginBottom:20}}><label className="form-label">Confirm password</label><input type="password" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="Repeat password" required /></div>
        <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>{loading ? 'Activating...' : 'Activate account'}</button>
      </form>
    </div>
  </div>);
}