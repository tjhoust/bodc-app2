import React, { useState } from 'react';
import { entriesAPI } from '../../api/client';
import { format, subDays } from 'date-fns';

export default function ExportPage() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(),30),'yyyy-MM-dd'));
  const [endDate,   setEndDate]   = useState(format(new Date(),'yyyy-MM-dd'));
  const [status,    setStatus]    = useState('approved');
  const [loading,   setLoading]   = useState(false);

  async function doExport() {
    setLoading(true);
    try {
      const res = await entriesAPI.exportCsv({ start_date: startDate, end_date: endDate, status });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `bodc-export-${Date.now()}.csv`; a.click();
      window.URL.revokeObjectURL(url);
    } catch { alert('Export failed'); }
    finally { setLoading(false); }
  }

  return (<div style={{maxWidth:480}}>
    <div className="page-header"><div className="page-title">Export data</div></div>
    <div className="card">
      <div className="form-row"><div className="form-group"><label className="form-label">From</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></div>
        <div className="form-group"><label className="form-label">To</label><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></div></div>
      <div className="form-group" style={{marginBottom:16}}><label className="form-label">Status</label>
        <select value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="approved">Approved only</option><option value="submitted">Submitted</option>
        </select></div>
      <button className="btn btn-primary" onClick={doExport} disabled={loading}>{loading?'Exporting...':'Export CSV'}</button>
    </div>
  </div>);
}