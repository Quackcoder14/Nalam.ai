'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ScanLine, ArrowLeft, Upload, CheckCircle, XCircle, Search, Bell, AlertTriangle } from 'lucide-react';

interface OcrResult {
  rawText: string; medications: string[]; diagnoses: string[];
  labValues: Record<string, string>; structuredSummary: string;
  confidence: number; durationMs: number;
}

export default function HospitalDeskPage() {
  const router = useRouter();
  const [patientId, setPatientId] = useState('P001');
  const [patientData, setPatientData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

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
        setAlerts(data.alerts || []);
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
      } else {
        setPatientData(null);
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
      if (data.success) setImported(true); else setOcrError(`Import failed: ${data.error}`);
    } catch { setOcrError('Import failed — network error.'); }
    finally { setImporting(false); }
  };

  const markAlertRead = async (id: string) => {
    try {
      await fetch('/api/notify/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      fetchAlerts();
    } catch {}
  };

  return (
    <div className="container fade-in">
      <div className="flex-between slide-up" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', color: 'var(--deep-blue)' }}>Hospital Desk</h2>
          <p style={{ color: 'var(--charcoal)', fontSize: '0.95rem' }}>Manage patient triage and active clinical alerts</p>
        </div>
      </div>

      <div className="grid-2">
        {/* Left Column: Patient Lookup & Document Scanner */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <section className="glass-panel slide-up stagger-1">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>
              <Search size={18} /> Patient Lookup
            </h3>
            <form onSubmit={loadPatient} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={patientId}
                onChange={e => setPatientId(e.target.value)}
                placeholder="Enter Patient ID (e.g. P001)"
                style={{ flex: 1, padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}
              />
              <button type="submit" className="glass-button" style={{ background: 'var(--primary)', color: 'white' }}>Load</button>
            </form>

            {patientData && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--primary-light)', borderRadius: 8, borderLeft: '3px solid var(--primary)' }}>
                <div style={{ fontWeight: 700, color: 'var(--deep-blue)' }}>{patientData.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--charcoal)' }}>DOB: {patientData.dob} | Gender: {patientData.gender}</div>
              </div>
            )}
          </section>

          {patientData && (
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
                <div style={{ fontWeight: 600, color: 'var(--deep-blue)', fontSize: '0.9rem' }}>Drop document here</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--charcoal)' }}>PNG, JPG, WEBP</div>
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
                  </div>
                  {result.structuredSummary && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.6, marginBottom: '1rem' }}>{result.structuredSummary}</p>
                  )}
                  <button onClick={importToVault} disabled={imported || importing} className="glass-button"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: imported ? 'var(--accent-green-bg)' : 'var(--primary-light)', borderColor: imported ? 'var(--accent-green)' : 'var(--primary)', color: imported ? 'var(--accent-green)' : 'var(--primary)', fontWeight: 700 }}>
                    {importing ? <><div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> Saving...</> : imported ? '✓ Added to Patient Timeline' : '+ Import to Patient Memory'}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right Column: Active Notifications */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section className="glass-panel slide-up stagger-3" style={{ height: '100%' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {alerts.map((a: any) => (
                  <div key={a.id} className="fade-in" style={{ padding: '1rem', background: a.severity === 'critical' ? 'var(--accent-red-bg)' : 'var(--accent-amber-bg)', borderLeft: `4px solid ${a.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)'}`, borderRadius: 8 }}>
                    <div className="flex-between" style={{ marginBottom: '0.4rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--deep-blue)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <AlertTriangle size={15} color={a.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)'} />
                        Patient {a.patient_id}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--charcoal)' }}>{new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600, marginBottom: '0.2rem' }}>{a.title}</div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--charcoal)', marginBottom: '0.75rem', lineHeight: 1.5 }}>{a.message}</p>
                    <button onClick={() => markAlertRead(a.id)} className="glass-button" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                      Mark as Read
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
