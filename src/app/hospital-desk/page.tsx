'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ScanLine, ArrowLeft, Upload, CheckCircle, XCircle, Search, Bell, AlertTriangle, Download, Database, Activity, Clock, ChevronDown, User, X } from 'lucide-react';

interface OcrResult {
  rawText: string; medications: string[]; diagnoses: string[];
  labValues: Record<string, string>; structuredSummary: string;
  confidence: number; durationMs: number;
}

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.round(d)}s ago`;
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

function parseVitalsFromMessage(message: string) {
  const params: Record<string, string> = {};
  const hrMatch = message.match(/hr\s*=\s*([\d.]+)/i);
  const sysMatch = message.match(/sys\s*=\s*([\d.]+)/i);
  const diaMatch = message.match(/dia\s*=\s*([\d.]+)/i);
  const spo2Match = message.match(/spo2\s*=\s*([\d.]+)/i);
  const tempMatch = message.match(/temp\s*=\s*([\d.]+)/i);
  
  if (hrMatch) params.heart_rate = hrMatch[1];
  if (sysMatch) params.systolic_bp = sysMatch[1];
  if (diaMatch) params.diastolic_bp = diaMatch[1];
  if (spo2Match) params.spo2 = spo2Match[1];
  if (tempMatch) params.temperature = tempMatch[1];
  
  return params;
}

export default function HospitalDeskPage() {
  const router = useRouter();
  const [patientId, setPatientId] = useState('P001');
  const [patientData, setPatientData] = useState<any>(null);
  const [patientRecords, setPatientRecords] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [criticalPopupAlert, setCriticalPopupAlert] = useState<any>(null);
  const notifiedAlertsRef = useRef<Set<string>>(new Set());
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scanner' | 'timeline'>('scanner');

  // FHIR export
  const exportVault = () => {
    const blob = new Blob([JSON.stringify({ patient: patientData, records: patientRecords, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `nalam_vault_${patientId}.json` });
    a.click();
  };

  // OCR state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Timeline limit: configurable via env var NEXT_PUBLIC_TIMELINE_LIMIT, default 10
  const TIMELINE_LIMIT = parseInt(process.env.NEXT_PUBLIC_TIMELINE_LIMIT || '10', 10);

  useEffect(() => {
    const role = localStorage.getItem('nalamRole');
    if (role !== 'hdesk') router.push('/');
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 10000);
    return () => clearInterval(iv);
  }, [router]);

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/notify/alerts');
      if (res.ok) {
        const data = await res.json();
        const incoming = data.alerts || [];
        setAlerts(incoming);
        
        for (const a of incoming) {
          if (a.severity === 'critical' && !notifiedAlertsRef.current.has(a.id)) {
            setCriticalPopupAlert(a);
            notifiedAlertsRef.current.add(a.id);
            break; // Show one at a time
          }
        }
      }
    } catch {}
  };

  const loadPatient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!patientId.trim()) return;
    try {
      const res = await fetch(`/api/patient?id=${patientId}`);
      if (res.ok) {
        const data = await res.json();
        setPatientData(data.patient);
        setPatientRecords(data.records || []);
        setResult(null); setImported(false); setPreview(null); setFile(null); setOcrError(null);
      } else {
        setPatientData(null);
        setPatientRecords([]);
        alert('Patient not found');
      }
    } catch {}
  };

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) return;
    setFile(f); setResult(null); setImported(false); setOcrError(null);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const scan = async () => {
    if (!preview) return;
    setScanning(true); setOcrError(null);
    try {
      const base64 = preview.split(',')[1];
      const res = await fetch('/api/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64, filename: file?.name || 'doc' }) });
      const data = await res.json();
      if (data.error) setOcrError(data.error); else setResult(data);
    } catch { setOcrError('Network error — please try again.'); }
    finally { setScanning(false); }
  };

  const importToVault = async () => {
    if (!result || !patientId) return;
    setImporting(true);
    try {
      const res = await fetch('/api/patient/record', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, type: 'Document Scan', provider: 'Hospital Desk OCR', diagnosis: result.diagnoses.join(', '), notes: result.structuredSummary || result.rawText.slice(0, 300), labResults: Object.entries(result.labValues).map(([k, v]) => `${k}:${v}`).join(', ') }),
      });
      const data = await res.json();
      if (data.success) {
        setImported(true);
        // Reload patient records to reflect in timeline
        await loadPatient();
      } else {
        setOcrError(`Import failed: ${data.error}`);
      }
    } catch { setOcrError('Import failed — network error.'); }
    finally { setImporting(false); }
  };

  const markAlertRead = async (id: string) => {
    try {
      await fetch('/api/notify/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      fetchAlerts();
    } catch {}
  };

  const displayedRecords = patientRecords.slice(0, TIMELINE_LIMIT);

  return (
    <div className="container fade-in">
      {/* Severe Anomaly Popup */}
      {criticalPopupAlert && (
        <div 
          onClick={() => {
            const parsed = parseVitalsFromMessage(criticalPopupAlert.message);
            const q = new URLSearchParams(parsed);
            router.push(`/xai?${q.toString()}`);
          }}
          style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, background: 'var(--accent-red-bg)', border: '2px solid var(--accent-red)', borderRadius: 12, padding: '1rem 1.5rem', boxShadow: '0 8px 32px rgba(239,68,68,0.3)', display: 'flex', alignItems: 'flex-start', gap: '1rem', minWidth: 320, maxWidth: '400px', animation: 'slideUpRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)', cursor: 'pointer' }}
        >
          <AlertTriangle size={24} color="var(--accent-red)" style={{ flexShrink: 0, marginTop: 4 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: 'var(--accent-red)', fontSize: '1.05rem', marginBottom: '0.2rem' }}>Patient {criticalPopupAlert.patient_id} - Critical Anomaly</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.5, marginBottom: '0.5rem' }}>
              {criticalPopupAlert.message}
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-red)' }}>Tap to view Explainable AI breakdown →</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setCriticalPopupAlert(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', padding: '0.2rem', marginLeft: '-0.5rem' }}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex-between slide-up" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', color: 'var(--deep-blue)' }}>🏥 Hospital Desk</h2>
          <p style={{ color: 'var(--charcoal)', fontSize: '0.95rem' }}>Manage patient data, document scanning, timeline, and active clinical alerts</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button className="glass-button" onClick={() => router.push('/search')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Search size={15} /> Search Records
          </button>
          {patientData && (
            <button className="glass-button" onClick={exportVault} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: 'var(--powder-blue-dark)' }}>
              <Download size={15} /> Export FHIR Vault
            </button>
          )}
        </div>
      </div>

      {/* Patient Lookup — always visible */}
      <section className="glass-panel slide-up stagger-1" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>
          <Search size={18} /> Patient Lookup
        </h3>
        <form onSubmit={loadPatient} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={patientId}
            onChange={e => setPatientId(e.target.value)}
            placeholder="Enter Patient ID (e.g. P001)"
            style={{ flex: 1, padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
          />
          <button type="submit" className="glass-button" style={{ background: 'var(--primary)', color: 'white' }}>Load</button>
        </form>

        {patientData && (
          <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--primary-light)', borderRadius: 10, borderLeft: '3px solid var(--primary)', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--deep-blue)' }}>{patientData.name}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)', marginTop: 2 }}>ID: {patientData.id}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)' }}>DOB: <strong>{patientData.dob}</strong></div>
              <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)' }}>Gender: <strong>{patientData.gender}</strong></div>
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)' }}>Blood Type: <strong>{patientData.blood_type || 'N/A'}</strong></div>
              <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)' }}>Allergies: <strong>{patientData.allergies || 'None'}</strong></div>
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)' }}>Last Visit: <strong>{patientRecords[0]?.date || 'N/A'}</strong></div>
              <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)' }}>Total Records: <strong>{patientRecords.length}</strong></div>
            </div>
          </div>
        )}
      </section>

      {/* Active Notifications (Wide Bottom of top section) */}
      <section className="glass-panel slide-up stagger-2" style={{ marginBottom: '1.5rem' }}>
        <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-red)' }}>
            <Bell size={18} /> Active Notifications
          </h3>
          <span className="badge red pulse-glow">{alerts.length} New</span>
        </div>

        {alerts.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--charcoal)', background: 'var(--surface-muted)', borderRadius: 10 }}>
            <CheckCircle size={32} color="var(--accent-green)" style={{ margin: '0 auto 0.5rem' }} />
            <div style={{ fontWeight: 600 }}>All Clear</div>
            <div style={{ fontSize: '0.85rem' }}>No active anomalies requiring attention.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {alerts.map((a: any) => (
              <div 
                key={a.id} 
                className="fade-in" 
                onClick={() => {
                  const parsed = parseVitalsFromMessage(a.message);
                  const q = new URLSearchParams(parsed);
                  router.push(`/xai?${q.toString()}`);
                }}
                style={{ padding: '1rem', background: a.severity === 'critical' ? 'var(--accent-red-bg)' : 'var(--accent-amber-bg)', borderLeft: `4px solid ${a.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)'}`, borderRadius: 8, cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseOut={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <div className="flex-between" style={{ marginBottom: '0.4rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--deep-blue)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertTriangle size={15} color={a.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)'} />
                    Patient {a.patient_id}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--charcoal)' }}>{timeAgo(a.created_at)}</span>
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600, marginBottom: '0.2rem' }}>{a.title}</div>
                <p style={{ fontSize: '0.82rem', color: 'var(--charcoal)', marginBottom: '0.75rem', lineHeight: 1.5 }}>{a.message}</p>
                <button onClick={(e) => { e.stopPropagation(); markAlertRead(a.id); }} className="glass-button" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                  Mark as Read
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr' }}>
        {/* Left Column: Scanner + Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {patientData && (
            <>
              {/* Tab switcher */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['scanner', 'timeline'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    style={{ padding: '0.45rem 1rem', borderRadius: 8, border: `1.5px solid ${activeTab === tab ? 'var(--primary)' : 'var(--border)'}`, background: activeTab === tab ? 'var(--primary-light)' : 'var(--surface)', color: activeTab === tab ? 'var(--primary)' : 'var(--foreground-muted)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s', textTransform: 'capitalize' }}>
                    {tab === 'scanner' ? '📷 Document Scanner' : '📋 Patient Timeline'}
                  </button>
                ))}
              </div>

              {/* Document Scanner */}
              {activeTab === 'scanner' && (
                <section className="glass-panel slide-up stagger-2">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--accent-purple)' }}>
                    <ScanLine size={18} /> Document Scanner
                  </h3>

                  <div
                    style={{ border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 14, padding: '1.5rem', textAlign: 'center', background: dragOver ? 'var(--primary-light)' : 'var(--surface-muted)', transition: 'all 0.2s', cursor: 'pointer', marginBottom: preview ? '1rem' : 0 }}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                    onClick={() => inputRef.current?.click()}
                  >
                    <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                    <Upload size={28} color="var(--primary)" style={{ margin: '0 auto 0.5rem' }} />
                    <div style={{ fontWeight: 600, color: 'var(--deep-blue)', fontSize: '0.9rem' }}>Drop document here or click to browse</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--charcoal)' }}>PNG, JPG, WEBP — Powered by Groq AI OCR</div>
                  </div>

                  {preview && (
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', marginTop: '1rem' }}>
                      <img src={preview} alt="Preview" style={{ maxHeight: 150, borderRadius: 10, border: '1px solid var(--border)', objectFit: 'contain' }} />
                      <button className="glass-button" onClick={scan} disabled={scanning} style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {scanning ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> Scanning...</> : <><ScanLine size={15} /> Scan with Groq AI</>}
                      </button>
                    </div>
                  )}

                  {ocrError && (
                    <div className="fade-in" style={{ background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red)', borderRadius: 10, padding: '0.9rem 1.1rem', color: 'var(--accent-red)', display: 'flex', gap: '0.5rem', margin: '1rem 0', alignItems: 'center' }}>
                      <XCircle size={16} /> {ocrError}
                    </div>
                  )}

                  {result && (
                    <div className="fade-in" style={{ marginTop: '1rem', background: 'var(--surface)', padding: '1rem', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                        <h4 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><CheckCircle size={16} /> Extracted Data</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--charcoal)' }}>Confidence: {Math.round((result.confidence || 0) * 100)}%</span>
                      </div>
                      {result.structuredSummary && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.6, marginBottom: '1rem' }}>{result.structuredSummary}</p>
                      )}
                      {result.diagnoses?.length > 0 && (
                        <div style={{ marginBottom: '0.6rem' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>Diagnoses</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                            {result.diagnoses.map((d, i) => <span key={i} style={{ padding: '0.2rem 0.6rem', borderRadius: 20, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600 }}>{d}</span>)}
                          </div>
                        </div>
                      )}
                      <button onClick={importToVault} disabled={imported || importing} className="glass-button"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: imported ? 'var(--accent-green-bg)' : 'var(--primary-light)', borderColor: imported ? 'var(--accent-green)' : 'var(--primary)', color: imported ? 'var(--accent-green)' : 'var(--primary)', fontWeight: 700 }}>
                        {importing ? <><div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> Saving...</> : imported ? '✓ Added to Patient Timeline' : '+ Import to Patient Memory'}
                      </button>
                    </div>
                  )}
                </section>
              )}

              {/* Patient Timeline */}
              {activeTab === 'timeline' && (
                <section className="glass-panel slide-up stagger-2">
                  <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                      <Activity size={18} /> Longitudinal Timeline
                    </h3>
                    <span className="badge blue">{patientRecords.length} total · showing {displayedRecords.length}</span>
                  </div>
                  <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
                    <div style={{ position: 'absolute', left: '5px', top: 0, bottom: 0, width: 2, background: 'linear-gradient(to bottom, var(--powder-blue), var(--border))' }} />
                    {displayedRecords.length === 0 ? (
                      <p style={{ color: 'var(--charcoal)', fontSize: '0.9rem' }}>No records found for this patient.</p>
                    ) : displayedRecords.map((r, i) => (
                      <div key={r.record_id}
                        className={`timeline-entry${expandedRecord === r.record_id ? ' expanded' : ''}`}
                        style={{ position: 'relative', marginBottom: '0.5rem', animationDelay: `${i * 0.05}s`, cursor: 'pointer' }}
                        onClick={() => setExpandedRecord(expandedRecord === r.record_id ? null : r.record_id)}
                      >
                        <div className="timeline-dot" style={{ position: 'absolute', left: '-1.5rem', top: '0.2rem', width: 12, height: 12, borderRadius: '50%', background: expandedRecord === r.record_id ? 'var(--primary)' : 'var(--powder-blue-dark)', border: '2px solid var(--primary)', boxShadow: '0 0 0 3px rgba(165,216,255,0.25)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: expandedRecord === r.record_id ? '0.5rem' : 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--deep-blue)' }}>{r.diagnosis || r.type}</span>
                            <ChevronDown size={14} color="var(--charcoal)" style={{ transform: expandedRecord === r.record_id ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }} />
                          </div>
                          <span style={{ fontSize: '0.73rem', color: 'var(--charcoal-light)', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>{r.date}</span>
                        </div>
                        <div style={{ fontSize: '0.79rem', color: 'var(--charcoal)', marginBottom: expandedRecord === r.record_id ? '0.4rem' : 0 }}>{r.provider}</div>
                        {expandedRecord === r.record_id && (
                          <div className="fade-in" style={{ background: 'white', borderRadius: 8, padding: '0.75rem', marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {r.notes && <p style={{ fontSize: '0.82rem', color: 'var(--charcoal)', lineHeight: 1.6 }}><strong>Notes:</strong> {r.notes}</p>}
                            {r.lab_results && <p style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}><strong style={{ color: 'var(--charcoal)' }}>Labs:</strong> {r.lab_results}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {patientRecords.length > TIMELINE_LIMIT && (
                    <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--charcoal)' }}>
                      Showing {TIMELINE_LIMIT} of {patientRecords.length} records. Use the Search page to find specific records.
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes slideUpRight { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
