import React from 'react';
export default function CustomFieldsPage() {
  const fields = [{n:'Cost centre',t:'Dropdown',a:'Entry',r:true},{n:'Shift type',t:'Dropdown',a:'Entry',r:true},{n:'Billable',t:'Boolean',a:'Entry',r:false},{n:'Contractor ID',t:'Text',a:'User',r:false}];
  return (<div>
    <div className="page-header"><div className="page-title">Custom fields</div></div>
    <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}><button className="btn btn-primary">+ Add field</button></div>
    <div className="card"><div className="table-wrap"><table>
      <thead><tr><th>Field</th><th>Type</th><th>Applies to</th><th>Required</th></tr></thead>
      <tbody>{fields.map(f=>(<tr key={f.n}><td style={{fontWeight:500}}>{f.n}</td><td>{f.t}</td><td>{f.a}</td><td><span className={`pill ${f.r?'pill-approved':'pill-draft'}`}>{f.r?'Yes':'No'}</span></td></tr>))}</tbody>
    </table></div></div>
  </div>);
}