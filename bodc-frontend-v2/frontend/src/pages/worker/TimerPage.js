/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { sitesAPI, workCodesAPI, entriesAPI } from '../../api/client';
import { useOffline } from '../../context/OfflineContext';
import { useAuth } from '../../context/AuthContext';

// ── GPS hook ──────────────────────────────────────────────────
function useGPS() {
  const [position, setPosition] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle'); // idle | getting | ok | error | denied

  const getPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS not available on this device');
      setGpsStatus('error');
      return null;
    }
    return new Promise((resolve) => {
      setGpsStatus('getting');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          setPosition(coords);
          setGpsStatus('ok');
          setGpsError(null);
          resolve(coords);
        },
        (err) => {
          const msg = err.code === 1 ? 'Location access denied' : 'Could not get GPS location';
          setGpsError(msg);
          setGpsStatus(err.code === 1 ? 'denied' : 'error');
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    });
  }, []);

  return { position, gpsError, gpsStatus, getPosition };
}

// ── Timer hook ────────────────────────────────────────────────
function useTimer() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  function start() {
    startTimeRef.current = Date.now() - seconds * 1000;
    setRunning(true);
  }
  function stop() { setRunning(false); }
  function reset() { setSeconds(0); setRunning(false); startTimeRef.current = null; }

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  function formatTime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  return { seconds, running, start, stop, reset, formatted: formatTime(seconds), startTimeRef };
}

// ── Main component ────────────────────────────────────────────
export default function TimerPage() {
  const { user } = useAuth();
  const { createEntry, isOnline } = useOffline();
  const qc = useQueryClient();
  const timer = useTimer();
  const gps   = useGPS();

  const [siteId, setSiteId]           = useState('');
  const [workCodeId, setWorkCodeId]   = useState('');
  const [notes, setNotes]             = useState('');
  const [timerStartData, setTimerStartData] = useState(null);
  const [activeBreak, setActiveBreak] = useState(null);
  const [todayEntries, setTodayEntries] = useState([]);
  const [statusMsg, setStatusMsg]     = useState({ text: 'Ready to start', color: 'var(--text2)' });
  const [manualHours, setManualHours] = useState('');
  const [manualDate, setManualDate]   = useState(format(new Date(), 'yyyy-MM-dd'));
  const [manualCode, setManualCode]   = useState('');
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState(null);

  const { data: sitesData }     = useQuery({ queryKey: ['sites'], queryFn: () => sitesAPI.list().then(r => r.data) });
  const { data: codesData }     = useQuery({ queryKey: ['work-codes'], queryFn: () => workCodesAPI.list().then(r => r.data) });
  const { data: entriesData }   = useQuery({
    queryKey: ['entries-today'],
    queryFn: () => entriesAPI.list({ start_date: format(new Date(), 'yyyy-MM-dd'), end_date: format(new Date(), 'yyyy-MM-dd') }).then(r => r.data),
  });

  useEffect(() => { if (entriesData?.entries) setTodayEntries(entriesData.entries); }, [entriesData]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Start timer ───────────────────────────────────────────
  async function handleStartTimer() {
    if (!siteId || !workCodeId) {
      showToast('Please select a site and work code first', 'error');
      return;
    }
    const coords = await gps.getPosition();
    timer.start();
    setTimerStartData({ startedAt: new Date().toISOString(), startLat: coords?.lat, startLng: coords?.lng, startAccuracy: coords?.accuracy });
    setStatusMsg({ text: coords ? 'Running — GPS captured at start' : 'Running — GPS unavailable', color: coords ? 'var(--green)' : 'var(--amber)' });
  }

  // ── Stop timer ────────────────────────────────────────────
  async function handleStopTimer() {
    timer.stop();
    setSaving(true);
    const stopCoords = await gps.getPosition();

    const totalMins = Math.round(timer.seconds / 60);

    try {
      const result = await createEntry({
        site_id: siteId,
        work_code_id: workCodeId,
        entry_date: format(new Date(), 'yyyy-MM-dd'),
        started_at: timerStartData?.startedAt,
        stopped_at: new Date().toISOString(),
        total_minutes: totalMins,
        break_minutes: activeBreak ? 0 : 0,
        start_lat: timerStartData?.startLat,
        start_lng: timerStartData?.startLng,
        start_accuracy: timerStartData?.startAccuracy,
        stop_lat: stopCoords?.lat,
        stop_lng: stopCoords?.lng,
        stop_accuracy: stopCoords?.accuracy,
        is_timer: true,
        notes,
      });

      timer.reset();
      setTimerStartData(null);
      setNotes('');
      setStatusMsg({ text: 'Stopped — entry saved as draft', color: 'var(--text2)' });
      qc.invalidateQueries({ queryKey: ['entries-today'] });

      if (result.offline) {
        showToast('Saved offline — will sync when connected', 'warning');
      } else {
        showToast(`${Math.floor(totalMins/60)}h ${totalMins%60}m saved as draft`);
      }
    } catch (err) {
      showToast('Failed to save entry', 'error');
      timer.start();
    } finally {
      setSaving(false);
    }
  }

  // ── Break ─────────────────────────────────────────────────
  function toggleBreak() {
    if (!activeBreak) {
      setActiveBreak({ startedAt: new Date() });
      setStatusMsg({ text: 'On break', color: 'var(--amber)' });
    } else {
      setActiveBreak(null);
      setStatusMsg({ text: 'Running', color: 'var(--green)' });
    }
  }

  // ── Manual entry ──────────────────────────────────────────
  const addManualEntry = useMutation({
    mutationFn: () => createEntry({
      site_id: siteId,
      work_code_id: manualCode || workCodeId,
      entry_date: manualDate,
      total_minutes: Math.round(parseFloat(manualHours) * 60),
      is_timer: false,
      notes,
    }),
    onSuccess: (result) => {
      setManualHours('');
      setNotes('');
      qc.invalidateQueries({ queryKey: ['entries-today'] });
      showToast(result.offline ? 'Saved offline' : 'Entry added as draft');
    },
    onError: () => showToast('Failed to add entry', 'error'),
  });

  const sites     = sitesData?.sites || [];
  const workCodes = codesData?.work_codes || [];
  const today     = format(new Date(), 'EEEE d MMM');

  return (
    <div>
      {toast && (
        <div style={{ ...toastStyle, background: toast.type === 'error' ? 'var(--red)' : toast.type === 'warning' ? 'var(--amber)' : 'var(--green)' }}>
          {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div className="page-title">Time capture</div>
        <div className="page-sub">{user?.org?.name || 'Your organisation'}</div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Left column */}
        <div style={{ flex: 1, minWidth: 280 }}>
          {/* Timer card */}
          <div className="card">
            <div style={{ textAlign: 'center', padding: '20px 0 16px' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {today}
              </div>
              <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: -2, marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
                {timer.formatted}
              </div>
              <div style={{ fontSize: 13, color: statusMsg.color, marginBottom: 20 }}>
                {statusMsg.text}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {!timer.running ? (
                  <button
                    className="btn btn-lg"
                    style={{ background: 'var(--green)', color: 'white', minWidth: 160 }}
                    onClick={handleStartTimer}
                    disabled={saving}
                  >
                    Start timer
                  </button>
                ) : (
                  <>
                    <button
                      className="btn btn-lg"
                      style={{ background: 'var(--red)', color: 'white', minWidth: 140 }}
                      onClick={handleStopTimer}
                      disabled={saving}
                    >
                      {saving ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> : 'Stop timer'}
                    </button>
                    <button
                      className={`btn btn-lg ${activeBreak ? 'btn-warning' : ''}`}
                      style={{ background: 'var(--amber-bg)', color: 'var(--amber-text)', border: '1px solid rgba(184,106,10,0.2)' }}
                      onClick={toggleBreak}
                    >
                      {activeBreak ? 'End break' : 'Break'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="divider" />

            {/* Entry fields */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Work code</label>
                <select value={workCodeId} onChange={e => setWorkCodeId(e.target.value)} disabled={timer.running}>
                  <option value="">Select code...</option>
                  {workCodes.filter(c => c.is_active).map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Site</label>
                <select value={siteId} onChange={e => setSiteId(e.target.value)} disabled={timer.running}>
                  <option value="">Select site...</option>
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. North section, machine 4..." />
            </div>
          </div>

          {/* Manual entry card */}
          <div className="card">
            <div className="card-title">Manual entry</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Total hours</label>
                <input type="number" value={manualHours} onChange={e => setManualHours(e.target.value)} placeholder="8.5" step="0.5" min="0" max="24" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Work code</label>
                <select value={manualCode} onChange={e => setManualCode(e.target.value)}>
                  <option value="">Select code...</option>
                  {workCodes.filter(c => c.is_active).map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                onClick={() => addManualEntry.mutate()}
                disabled={addManualEntry.isPending || !manualHours || !manualDate}
              >
                Add entry
              </button>
              <button className="btn btn-secondary">Save draft</button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ flex: 1, minWidth: 260 }}>
          {/* GPS card */}
          <div className="card">
            <div className="card-title">Location</div>
            <GpsMap position={gps.position} status={gps.gpsStatus} />
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {gps.gpsStatus === 'ok' && <span className="gps-ok">GPS active</span>}
              {gps.gpsStatus === 'getting' && <span className="gps-warn">Getting location...</span>}
              {gps.gpsStatus === 'error' && <span className="gps-err">GPS unavailable</span>}
              {gps.gpsStatus === 'denied' && <span className="gps-err">Location access denied</span>}
              {gps.position && (
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>
                  {gps.position.lat.toFixed(4)}, {gps.position.lng.toFixed(4)}
                  {gps.position.accuracy && ` ±${Math.round(gps.position.accuracy)}m`}
                </span>
              )}
            </div>
          </div>

          {/* Today's entries */}
          <div className="card">
            <div className="card-title">Today's entries</div>
            {todayEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: 13 }}>
                No entries today yet
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Time</th><th>Code</th><th>Hrs</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {todayEntries.map(e => (
                      <tr key={e.id}>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                          {e.started_at ? format(new Date(e.started_at), 'HH:mm') : '—'}–
                          {e.stopped_at ? format(new Date(e.stopped_at), 'HH:mm') : '—'}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{e.work_code}</td>
                        <td>{(e.total_minutes / 60).toFixed(1)}</td>
                        <td><span className={`pill pill-${e.status}`}>{e.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── GPS visual map ────────────────────────────────────────────
function GpsMap({ position, status }) {
  return (
    <div style={{ background: '#deeaf7', borderRadius: 8, height: 160, position: 'relative', overflow: 'hidden' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 300 160" preserveAspectRatio="none">
        <defs>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(26,109,201,0.07)" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="300" height="160" fill="url(#grid)"/>
        {status === 'ok' ? (
          <>
            <circle cx="150" cy="80" r="40" fill="rgba(26,109,201,0.1)" stroke="#1a6dc9" strokeWidth="1.5" strokeDasharray="5,3"/>
            <circle cx="150" cy="80" r="24" fill="rgba(26,109,201,0.06)" stroke="#1a6dc9" strokeWidth="0.5"/>
            <circle cx="158" cy="73" r="6" fill="#1a6dc9" opacity="0.9"/>
            <circle cx="158" cy="73" r="12" fill="rgba(26,109,201,0.2)" />
          </>
        ) : (
          <text x="150" y="86" textAnchor="middle" fontSize="12" fill="#9e9e99">
            {status === 'getting' ? 'Getting location...' : 'Location unavailable'}
          </text>
        )}
      </svg>
      {status === 'ok' && (
        <div style={{ position: 'absolute', bottom: 8, left: 8 }}>
          <span className="gps-ok">Inside boundary</span>
        </div>
      )}
    </div>
  );
}

const toastStyle = {
  position: 'fixed',
  bottom: 80,
  left: '50%',
  transform: 'translateX(-50%)',
  color: 'white',
  padding: '10px 20px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  zIndex: 999,
  whiteSpace: 'nowrap',
  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
};
