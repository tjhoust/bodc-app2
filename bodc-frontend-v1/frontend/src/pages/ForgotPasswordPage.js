import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../api/client';
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false); const [err, setErr] = useState('');
  async function handle(e) {
    e.preventDefault(); setLoading(true);
    try { await authAPI.forgotPassword(email); setSent(true); } catch { setErr('Something went wrong'); }
    finally { setLoading(false); }
  }
  return (<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)',padding:16}}>
    <div className="card" style={{width:'100%',maxWidth:400,padding:'32px 28px'}}>
      <h1 style={{fontSize:20,fontWeight:700,marginBottom:8}}>Reset password</h1>
      {sent ? <div className="alert alert-success">Check your email for a reset link.</div> : (<>
        {err && <div className="alert alert-danger">{err}</div>}
        <form onSubmit={handle}>
          <div className="form-group" style={{marginBottom:20}}><label className="form-label">Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Sending...' : 'Send reset link'}</button>
        </form>
      </>)}
      <div style={{marginTop:16,textAlign:'center'}}><Link to="/login" style={{fontSize:13,color:'var(--blue)'}}>Back to login</Link></div>
    </div>
  </div>);
}