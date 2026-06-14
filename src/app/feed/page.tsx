'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Watch, ScanLine, ArrowLeft, Heart, Activity, Upload, CheckCircle, XCircle } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

interface OcrResult {
  rawText: string; medications: string[]; diagnoses: string[];
  labValues: Record<string, string>; structuredSummary: string;
  confidence: number; durationMs: number;
}

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

type ActiveModule = null | 'wearables';

function FeedInputInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, lang } = useLanguage();
  const [active, setActive] = useState<ActiveModule>(searchParams.get('module') === 'wearables' ? 'wearables' : null);
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
      const res = await fetch('/api/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64, filename: file?.name || 'doc', lang }) });
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
    { label: t('feed.heartRate'), value: `${heartRate}`, unit: 'BPM', color: '#FCA5A5', icon: Heart, live: true },
    { label: t('feed.bloodOxygen'), value: '98', unit: 'SpO₂', color: '#A5D8FF', icon: Activity },
    { label: t('feed.restingBP'), value: '142/88', unit: 'mmHg', color: '#FCA5A5', icon: Activity },
    { label: t('feed.stepsToday'), value: '8,472', unit: 'steps', color: '#A7F3D0', icon: Activity },
    { label: t('feed.sleep'), value: '7h 24m', unit: '', color: '#C7D2FE', icon: Watch },
    { label: t('feed.hrv'), value: '42', unit: 'ms', color: '#FDE68A', icon: Heart },
  ];

  return (
    <div className="container fade-in">
      {/* Header */}
      <div className="flex-between slide-up" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {active && (
            <button onClick={() => setActive(null)} className="glass-button" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ArrowLeft size={15} /> {t('feed.back')}
            </button>
          )}
          <div>
            <h2 style={{ fontSize: '1.9rem' }}>{active === 'wearables' ? t('feed.liveWearables') : t('feed.feedInput')}</h2>
            <p style={{ color: 'var(--charcoal)', fontSize: '0.9rem' }}>
              {active === 'wearables' ? t('feed.realtimeMetrics') : t('feed.chooseModule')}
            </p>
          </div>
        </div>
        <button onClick={() => router.push('/dashboard')} className="glass-button" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={15} /> {t('feed.dashboard')}
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
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--deep-blue)', marginBottom: '0.5rem' }}>{t('feed.liveWearablesCardTitle')}</h3>
            <p style={{ color: 'var(--charcoal)', fontSize: '0.875rem', lineHeight: 1.65, marginBottom: '1rem' }}>
              {t('feed.liveWearablesCardDesc')}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[t('feed.heartRate'), t('feed.spo2'), t('feed.sleep'), t('feed.hrv')].map(tag => <span key={tag} className="badge teal" style={{ fontSize: '0.72rem' }}>{tag}</span>)}
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
                  {live && <span style={{ fontSize: '0.68rem', color: '#22c55e', fontWeight: 700, background: '#dcfce7', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{t('feed.live')}</span>}
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--deep-blue)', lineHeight: 1 }}>
                  {value}<span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--charcoal)', marginLeft: 4 }}>{unit}</span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--charcoal)', fontWeight: 500 }}>{label}</div>
              </div>
            ))}
          </div>
          <section className="glass-panel">
            <h4 style={{ color: 'var(--primary)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>{t('feed.wearableIntegration')}</h4>
            <p style={{ color: 'var(--charcoal)', fontSize: '0.87rem', lineHeight: 1.65 }}>{t('feed.wearableIntegrationDesc')}</p>
          </section>
        </div>
      )}
    </div>
  );
}

export default function FeedInputPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <FeedInputInner />
    </Suspense>
  );
}
