import React, { useState } from 'react';
export default function ChecklistAdminPage() {
  const [items, setItems] = useState([
    {id:1,q:'I have read today\'s safety briefing',type:'acknowledgement',req:true},
    {id:2,q:'I am fit for work',type:'declaration',req:true},
    {id:3,q:'Vehicle pre-start complete',type:'acknowledgement',req:true},
    {id:4,q:'PPE check',type:'photo',req:false},
    {id:5,q:'Aware of exclusion zones',type:'acknowledgement',req:true},
    {id:6,q:'Evacuation procedure understood',type:'declaration',req:true},
  ]);
  const [nextId, setNextId] = useState(7);
  function addItem(){setItems(prev=>[...prev,{id:nextId,q:'',type:'acknowledgement',req:true}]);setNextId(n=>n+1);}
  function removeItem(id){setItems(prev=>prev.filter(i=>i.id!==id));}
  function updateItem(id,field,val){setItems(prev=>prev.map(i=>i.id===id?{...i,[field]:val}:i));}
  return (<div>
    <div className="page-header"><div className="page-title">Checklist templates</div></div>
    <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
      <div style={{flex:1,minWidth:300}}>
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
            <div className="card-title" style={{marginBottom:0}}>Items</div>
            <button className="btn btn-primary btn-sm" onClick={addItem}>+ Add item</button>
          </div>
          {items.map(item=>(<div key={item.id} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
            <div style={{flex:1}}>
              <input value={item.q} onChange={e=>updateItem(item.id,'q',e.target.value)} placeholder="Enter checklist item..." style={{marginBottom:6}}/>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <select value={item.type} onChange={e=>updateItem(item.id,'type',e.target.value)} style={{width:'auto',fontSize:11,padding:'3px 8px'}}>
                  <option value="acknowledgement">Acknowledgement</option>
                  <option value="declaration">Declaration</option>
                  <option value="photo">Photo upload</option>
                  <option value="text_response">Text response</option>
                </select>
                <label style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'var(--text2)',cursor:'pointer'}}>
                  <input type="checkbox" checked={item.req} onChange={e=>updateItem(item.id,'req',e.target.checked)} style={{width:'auto'}}/>Required
                </label>
              </div>
            </div>
            <button onClick={()=>removeItem(item.id)} style={{border:'none',background:'transparent',cursor:'pointer',color:'var(--text3)',fontSize:18,padding:2,lineHeight:1}}>✕</button>
          </div>))}
        </div>
      </div>
      <div style={{width:260,flexShrink:0}}>
        <div className="card"><div className="card-title">Settings</div>
          <div className="form-group" style={{marginBottom:12}}><label className="form-label">Template name</label><input defaultValue="Daily pre-start — Mining"/></div>
          <div className="form-group" style={{marginBottom:12}}><label className="form-label">Assign to</label><select><option>All sites</option></select></div>
          <div className="form-group" style={{marginBottom:12}}><label className="form-label">Frequency</label><select><option>Once per shift (daily)</option><option>Each timer start</option></select></div>
          <button className="btn btn-primary btn-full" onClick={()=>alert('Template saved as new version')}>Save new version</button>
        </div>
      </div>
    </div>
  </div>);
}