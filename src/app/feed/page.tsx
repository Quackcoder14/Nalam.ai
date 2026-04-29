'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Watch, ScanLine, ArrowLeft, Heart, Activity, Upload, CheckCircle, XCircle } from 'lucide-react';

interface OcrResult {
  rawText: string; medications: string[]; diagnoses: string[];
  labValues: Record<string, string>; structuredSummary: string;
  confidence: number; durationMs: number;
}

type ActiveModule = null | 'wearables' | 'scanner';

export default function FeedInputPage() {
  const router = useRouter();
  const [active, setActive] = useState<ActiveModule>(null);
  const [heartRate, setHeartRate] = useState(72);

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
    if (!role) router.push('/');
  }, [router]);

  useEffect(() => {
    const iv = setInterval(() => setHeartRate(p => Math.max(65, Math.min(88, p + Math.floor(Math.random() * 5) - 2))), 2000);
    return () => clearInterval(iv);
  }, []);

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
    if (!result) return;
    setImporting(true);
    try {
      const res = await fetch('/api/patient/record', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: 'P001', type: 'Document Scan', provider: 'nalam.ai OCR Engine', diagnosis: result.diagnoses.join(', '), notes: result.structuredSummary || result.rawText.slice(0, 300), labResults: Object.entries(result.labValues).map(([k, v]) => `${k}:${v}`).join(', ') }),
      });
      const data = await res.json();
      if (data.success) setImported(true); else setOcrError(`Import failed: ${data.error}`);
    } catch { setOcrError('Import failed — network error.'); }
    finally { setImporting(false); }
  };

  const vitals = [
    { label: 'Heart Rate', value: `${heartRate}`, unit: 'BPM', color: '#FCA5A5', icon: Heart, live: true },
    { label: 'Blood Oxygen', value: '98', unit: 'SpO₂', color: '#A5D8FF', icon: Activity },
    { label: 'Resting BP', value: '142/88', unit: 'mmHg', color: '#FCA5A5', icon: Activity },
    { label: 'Steps Today', value: '8,472', unit: 'steps', color: '#A7F3D0', icon: Activity },
    { label: 'Sleep', value: '7h 24m', unit: '', color: '#C7D2FE', icon: Watch },
    { label: 'HRV', value: '42', unit: 'ms', color: '#FDE68A', icon: Heart },
  ];

  return (
    <div className="container fade-in">
      {/* Header */}
      <div className="flex-between slide-up" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {active && (
            <button onClick={() => setActive(null)} className="glass-button" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ArrowLeft size={15} /> Back
            </button>
          )}
          <div>
            <h2 style={{ fontSize: '1.9rem' }}>{active === 'wearables' ? '⌚ Live Wearables' : active === 'scanner' ? '🔍 Document Scanner' : '📡 Feed Input'}</h2>
            <p style={{ color: 'var(--charcoal)', fontSize: '0.9rem' }}>
              {active === 'wearables' ? 'Real-time health metrics from your devices' : active === 'scanner' ? 'Upload a medical document to extract and store data' : 'Choose a module below'}
            </p>
          </div>
        </div>
        <button onClick={() => router.push('/dashboard')} className="glass-button" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={15} /> Dashboard
        </button>
      </div>

      {/* Module Picker */}
      {!active && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '1.5rem', animation: 'slideUp 0.4s ease' }}>
          {/* Wearables Card */}
          <button className="feed-card" onClick={() => setActive('wearables')}>
            <div style={{ width: 60, height: 60, background: 'linear-gradient(135deg,#0097A7,#00BCD4)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', boxShadow: '0 4px 16px rgba(0,151,167,0.3)' }}>
              <Watch size={30} color="white" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--deep-blue)', marginBottom: '0.5rem' }}>Live Wearables</h3>
            <p style={{ color: 'var(--charcoal)', fontSize: '0.875rem', lineHeight: 1.65, marginBottom: '1rem' }}>
              View real-time vitals from your connected Apple Watch, Fitbit, or other health devices. Heart rate, SpO₂, HRV, sleep and more.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['Heart Rate', 'SpO₂', 'Sleep', 'HRV'].map(t => <span key={t} className="badge teal" style={{ fontSize: '0.72rem' }}>{t}</span>)}
            </div>
          </button>

          {/* Document Scanner Card */}
          <button className="feed-card" onClick={() => setActive('scanner')}>
            <div style={{ width: 60, height: 60, background: 'linear-gradient(135deg,#0052A5,#5C35A1)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', boxShadow: '0 4px 16px rgba(0,82,165,0.3)' }}>
              <ScanLine size={30} color="white" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--deep-blue)', marginBottom: '0.5rem' }}>Document Scanner</h3>
            <p style={{ color: 'var(--charcoal)', fontSize: '0.875rem', lineHeight: 1.65, marginBottom: '1rem' }}>
              Scan prescriptions, lab reports, discharge summaries, or any medical document. AI extracts diagnoses, medications, and lab values automatically.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['Groq Vision AI', 'OCR', 'Auto-Extract', 'FHIR'].map(t => <span key={t} className="badge purple" style={{ fontSize: '0.72rem' }}>{t}</span>)}
            </div>
          </button>
        </div>
      )}

      {/* Wearables Module */}
      {active === 'wearables' && (
        <div className="fade-in">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {vitals.map(({ label, value, unit, color, icon: Icon, live }) => (
              <div key={label} style={{ background: `${color}22`, border: `1.5px solid ${color}55`, borderRadius: 14, padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', transition: 'transform 0.2s' }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: live ? 'pulseGlow 1.5s infinite' : 'none' }}>
                    <Icon size={18} color={color.slice(0, 7)} />
                  </div>
                  {live && <span style={{ fontSize: '0.68rem', color: '#22c55e', fontWeight: 700, background: '#dcfce7', padding: '0.15rem 0.4rem', borderRadius: 4 }}>LIVE</span>}
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--deep-blue)', lineHeight: 1 }}>
                  {value}<span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--charcoal)', marginLeft: 4 }}>{unit}</span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--charcoal)', fontWeight: 500 }}>{label}</div>
              </div>
            ))}
          </div>
          <section className="glass-panel">
            <h4 style={{ color: 'var(--primary)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>ℹ️ Wearable Integration</h4>
            <p style={{ color: 'var(--charcoal)', fontSize: '0.87rem', lineHeight: 1.65 }}>Heart rate updates live every 2 seconds. In production, this connects directly to Apple HealthKit, Fitbit, or Garmin APIs via OAuth. All data is encrypted and stored in your longitudinal vault.</p>
          </section>
        </div>
      )}

      {/* Document Scanner Module */}
      {active === 'scanner' && (
        <div className="fade-in">
          <section className="glass-panel" style={{ marginBottom: '1.5rem' }}>
            {/* Drop zone */}
            <div
              style={{ border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 14, padding: '2rem', textAlign: 'center', background: dragOver ? 'var(--primary-light)' : 'var(--surface-muted)', transition: 'all 0.2s', cursor: 'pointer', marginBottom: preview ? '1rem' : 0 }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => inputRef.current?.click()}
            >
              <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <Upload size={36} color="var(--primary)" style={{ margin: '0 auto 0.75rem' }} />
              <div style={{ fontWeight: 600, color: 'var(--deep-blue)', marginBottom: '0.3rem' }}>Drop a medical document here</div>
              <div style={{ fontSize: '0.83rem', color: 'var(--charcoal)' }}>or click to browse · PNG, JPG, WEBP supported</div>
            </div>

            {preview && (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <img src={preview} alt="Preview" style={{ maxHeight: 200, borderRadius: 10, border: '1px solid var(--border)', objectFit: 'contain' }} />
                <button className="glass-button" onClick={scan} disabled={scanning} style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {scanning ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> Scanning...</> : <><ScanLine size={15} /> Scan with Groq AI</>}
                </button>
              </div>
            )}
          </section>

          {ocrError && (
            <div className="fade-in" style={{ background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red)', borderRadius: 10, padding: '0.9rem 1.1rem', color: 'var(--accent-red)', display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
              <XCircle size={16} /> {ocrError}
            </div>
          )}

          {result && (
            <section className="glass-panel fade-in">
              <div className="flex-between" style={{ marginBottom: '1rem' }}>
                <h3 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={18} /> Extracted Data</h3>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--charcoal)' }}>
                  <span>Confidence: <strong style={{ color: result.confidence > 70 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{result.confidence}%</strong></span>
                  <span>Time: <strong style={{ color: 'var(--primary)' }}>{result.durationMs}ms</strong></span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                {result.medications.length > 0 && (
                  <div style={{ background: 'var(--primary-light)', borderLeft: '3px solid var(--primary)', padding: '0.75rem', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 700 }}>💊 Medications</div>
                    {result.medications.map((m, i) => <div key={i} style={{ fontSize: '0.83rem', color: 'var(--deep-blue)', padding: '0.12rem 0' }}>{m}</div>)}
                  </div>
                )}
                {result.diagnoses.length > 0 && (
                  <div style={{ background: 'var(--accent-amber-bg)', borderLeft: '3px solid var(--accent-amber)', padding: '0.75rem', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 700 }}>🏥 Diagnoses</div>
                    {result.diagnoses.map((d, i) => <div key={i} style={{ fontSize: '0.83rem', color: 'var(--deep-blue)', padding: '0.12rem 0' }}>{d}</div>)}
                  </div>
                )}
                {Object.keys(result.labValues).length > 0 && (
                  <div style={{ background: 'var(--accent-purple-bg)', borderLeft: '3px solid var(--accent-purple)', padding: '0.75rem', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 700 }}>🧪 Lab Values</div>
                    {Object.entries(result.labValues).map(([k, v]) => <div key={k} style={{ fontSize: '0.83rem', color: 'var(--deep-blue)', padding: '0.12rem 0' }}>{k}: <strong>{v}</strong></div>)}
                  </div>
                )}
              </div>
              {result.structuredSummary && (
                <div style={{ background: 'var(--surface-muted)', padding: '0.9rem', borderRadius: 8, marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', fontWeight: 700 }}>🤖 AI Clinical Summary</div>
                  <p style={{ fontSize: '0.87rem', color: 'var(--foreground)', lineHeight: 1.7, margin: 0 }}>{result.structuredSummary}</p>
                </div>
              )}
              <button onClick={importToVault} disabled={imported || importing} className="glass-button"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: imported ? 'var(--accent-green-bg)' : 'var(--primary-light)', borderColor: imported ? 'var(--accent-green)' : 'var(--primary)', color: imported ? 'var(--accent-green)' : 'var(--primary)', fontWeight: 700 }}>
                {importing ? <><div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> Saving...</> : imported ? '✓ Added to Longitudinal Timeline' : '+ Import to Memory Vault'}
              </button>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
