import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workCodesAPI } from '../../api/client';

export default function WorkCodesPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({code:'',name:'',category:''});
  const { data } = useQuery({ queryKey:['work-codes'], queryFn:()=>workCodesAPI.list().then(r=>r.data) });
  const createMutation = useMutation({
    mutationFn:()=>workCodesAPI.create(form),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['work-codes']});setShowAdd(false);setForm({code:'',name:'',category:''});},
  });
  const codes = data?.work_codes||[];
  return (<div>
    <div className="page-header"><div className="page-title">Work codes</div></div>
    <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}><button className="btn btn-primary" onClick={()=>setShowAdd(v=>!v)}>+ Add code</button></div>
    {showAdd && (<div className="card" style={{maxWidth:480,marginBottom:16}}>
      <div className="card-title">Add work code</div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Code</label><input value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value}))} placeholder="EX-01"/></div>
        <div className="form-group"><label className="form-label">Name</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Excavation"/></div>
        <div className="form-group"><label className="form-label">Category</label><input value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="Civil"/></div>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button className="btn btn-primary" onClick={()=>createMutation.mutate()} disabled={!form.code||!form.name}>Add</button>
        <button className="btn btn-secondary" onClick={()=>setShowAdd(false)}>Cancel</button>
      </div>
    </div>)}
    <div className="card"><div className="table-wrap"><table>
      <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Status</th></tr></thead>
      <tbody>{codes.map(c=>(<tr key={c.id}>
        <td style={{fontFamily:'monospace',fontWeight:600,fontSize:12}}>{c.code}</td>
        <td>{c.name}</td><td style={{fontSize:12,color:'var(--text2)'}}>{c.category}</td>
        <td><span className={`pill ${c.is_active?'pill-approved':'pill-draft'}`}>{c.is_active?'Active':'Inactive'}</span></td>
      </tr>))}</tbody>
    </table></div></div>
  </div>);
}