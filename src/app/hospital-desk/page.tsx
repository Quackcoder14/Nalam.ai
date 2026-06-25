'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ScanLine, ArrowLeft, Upload, CheckCircle, XCircle, Search, Bell, AlertTriangle, Download, Activity, Clock, ChevronDown, X, ShieldCheck, Link2, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { apiFetch } from '@/lib/apiFetch';

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
  const hrMatch   = message.match(/hr\s*=\s*([\d.]+)/i);
  const spo2Match = message.match(/spo2\s*=\s*([\d.]+)/i);
  const respMatch = message.match(/resp\s*=\s*([\d.]+)/i);
  const tempMatch = message.match(/temp\s*=\s*([\d.]+)/i);
  const sysMatch  = message.match(/sys\s*=\s*([\d.]+)/i);
  const diaMatch  = message.match(/dia\s*=\s*([\d.]+)/i);
  if (hrMatch)   params.heart_rate = hrMatch[1];
  if (spo2Match) params.spo2       = spo2Match[1];
  if (respMatch) params.resp       = respMatch[1];
  if (tempMatch) params.temp       = tempMatch[1];
  if (sysMatch)  params.sys        = sysMatch[1];
  if (diaMatch)  params.dia        = diaMatch[1];
  return params;
}

function extractVitalsDisplay(message: string): { hr?: string; spo2?: string; resp?: string; temp?: string; sys?: string; dia?: string } {
  const hrMatch   = message.match(/hr=(\d+)/i);
  const spo2Match = message.match(/spo2=(\d+)/i);
  const respMatch = message.match(/resp=(\d+)/i);
  const tempMatch = message.match(/temp=([\d.]+)/i);
  const sysMatch  = message.match(/sys=(\d+)/i);
  const diaMatch  = message.match(/dia=(\d+)/i);
  return {
    hr:   hrMatch?.[1],
    spo2: spo2Match?.[1],
    resp: respMatch?.[1],
    temp: tempMatch?.[1],
    sys:  sysMatch?.[1],
    dia:  diaMatch?.[1],
  };
}

export default function HospitalDeskPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [patientId, setPatientId] = useState('P001');
  const [patientData, setPatientData] = useState<any>(null);
  const [patientRecords, setPatientRecords] = useState<any[]>([]);
  const [abhaStatus, setAbhaStatus] = useState<{ verified: boolean; masked: string | null }>({ verified: false, masked: null });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [criticalPopupAlert, setCriticalPopupAlert] = useState<any>(null);
  const notifiedAlertsRef = useRef<Set<string>>(new Set());
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scanner' | 'timeline'>('scanner');
  const [appointments, setAptList] = useState<any[]>([]);
  const [aptExpanded, setAptExpanded] = useState<string | null>(null);
  const [aptNote, setAptNote] = useState<Record<string, string>>({});
  const [aptProcessing, setAptProcessing] = useState<string | null>(null);
  const [chatUnread, setChatUnread] = useState(0);

  const fetchAllAppointments = useCallback(async () => {
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/appointments?all=true`);
      if (res.ok) setAptList(await res.json());
    } catch {}
  }, []);

  const handleAptAction = async (id: string, status: string) => {
    setAptProcessing(id);
    try {
      await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/appointments`, {
        method: 'PATCH',
        body: JSON.stringify({ id, status, hdeskNote: aptNote[id] || '' }),
      });
      await fetchAllAppointments();
      setAptExpanded(null);
    } finally { setAptProcessing(null); }
  };

  const exportVault = () => {
    const blob = new Blob([JSON.stringify({ patient: patientData, records: patientRecords, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `nalam_vault_${patientId}.json` });
    a.click();
  };

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [mismatchWarning, setMismatchWarning] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const TIMELINE_LIMIT = parseInt(process.env.NEXT_PUBLIC_TIMELINE_LIMIT || '10', 10);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/notify/alerts?lang=${lang}`);
      if (res.ok) {
        const data = await res.json();
        const incoming = data.alerts || [];
        setAlerts(incoming);
        for (const a of incoming) {
          if (a.severity === 'critical' && !notifiedAlertsRef.current.has(a.id)) {
            setCriticalPopupAlert(a);
            notifiedAlertsRef.current.add(a.id);
            break;
          }
        }
      }
    } catch {}
  }, [lang]);

  useEffect(() => {
    const role = localStorage.getItem('nalamRole');
    const branch = localStorage.getItem('nalamHdeskBranch') || 'Apollo Hospitals';
    if (role !== 'hdesk') router.push('/');
    fetchAlerts();
    
    const fetchUnread = async () => {
      try {
        const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat/unread?role=desk&hospital=${encodeURIComponent(branch)}`);
        if (res.ok) {
          const data = await res.json();
          setChatUnread(data.unreadCount || 0);
        }
      } catch {}
    };
    fetchUnread();
    
    const iv = setInterval(() => {
      fetchAlerts();
      fetchUnread();
    }, 10000);
    fetchAllAppointments();
    return () => clearInterval(iv);
  }, [router, fetchAlerts, fetchAllAppointments]);

  const loadPatient = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!patientId.trim()) return;
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/patient?id=${patientId}&lang=${lang}`);
      if (res.ok) {
        const data = await res.json();
        setPatientData(data.patient);
        setPatientRecords(data.records || []);
        setResult(null); setImported(false); setPreview(null); setFile(null); setOcrError(null); setMismatchWarning(null);
        // Fetch ABHA status for this patient
        const ar = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/abha?patientId=${patientId}`);
        if (ar.ok) setAbhaStatus(await ar.json());
        else setAbhaStatus({ verified: false, masked: null });
      } else {
        setPatientData(null);
        setPatientRecords([]);
        setAbhaStatus({ verified: false, masked: null });
        alert(t('hdesk.patientNotFound'));
      }
    } catch {}
  }, [patientId, lang, t]);

  useEffect(() => {
    if (patientData && patientId.trim()) {
      loadPatient();
    }
  }, [lang, loadPatient]);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) return;
    setFile(f); setResult(null); setImported(false); setOcrError(null);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const scan = async () => {
    if (!preview || !patientData) return;
    setScanning(true); setOcrError(null); setMismatchWarning(null);
    try {
      const base64 = preview.split(',')[1];
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/ocr`, { method: 'POST', body: JSON.stringify({ image: base64, filename: file?.name || 'doc' }) });
      const data = await res.json();
      if (data.error) {
        setOcrError(data.error);
      } else {
        setResult(data);
        
        // Mismatch logic
        if (data.patientName) {
          const docName = data.patientName.toLowerCase();
          const pName = patientData.name.toLowerCase();
          // Extremely basic fuzzy matching just for MVP
          if (!docName.includes(pName.split(' ')[0]) && !pName.includes(docName.split(' ')[0])) {
            setMismatchWarning(`Patient name mismatch: Document says "${data.patientName}" but profile is "${patientData.name}".`);
          }
        }
      }
    } catch { setOcrError('Network error — please try again.'); }
    finally { setScanning(false); }
  };

  const importToVault = async () => {
    if (!result || !patientId) return;
    setImporting(true);
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/patient/record`, {
        method: 'POST',
        body: JSON.stringify({ patientId, type: 'Document Scan', provider: 'Hospital Desk OCR', diagnosis: result.diagnoses.join(', '), notes: result.structuredSummary || result.rawText.slice(0, 300), labResults: Object.entries(result.labValues).map(([k, v]) => `${k}:${v}`).join(', ') }),
      });
      const data = await res.json();
      if (data.success) { setImported(true); await loadPatient(); }
      else setOcrError(`Import failed: ${data.error}`);
    } catch { setOcrError('Import failed — network error.'); }
    finally { setImporting(false); }
  };

  const handleAlertClick = async (a: any) => {
    try {
      await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/notify/alerts`, { method: 'PATCH', body: JSON.stringify({ id: a.id }) });
      setAlerts(prev => prev.filter(x => x.id !== a.id));
      setPatientId(a.patient_id);
      loadPatient();
    } catch {}
  };

  const displayedRecords = patientRecords.slice(0, TIMELINE_LIMIT);

  return (
    <div className="container fade-in">
      {/* Critical Popup */}
      {criticalPopupAlert && (
        <div
          onClick={() => {
            const parsed = parseVitalsFromMessage(criticalPopupAlert.message);
            parsed.patientId = criticalPopupAlert.patient_id;
            router.push(`/xai?${new URLSearchParams(parsed).toString()}`);
          }}
          style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 40px)', zIndex: 9999, background: 'var(--accent-red-bg)', border: '2px solid var(--accent-red)', borderRadius: 12, padding: '1rem 1.2rem', boxShadow: '0 8px 32px rgba(239,68,68,0.3)', display: 'flex', alignItems: 'flex-start', gap: '1rem', maxWidth: '400px', animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)', cursor: 'pointer' }}
        >
          <AlertTriangle size={24} color="var(--accent-red)" style={{ flexShrink: 0, marginTop: 4 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: 'var(--accent-red)', fontSize: '1.05rem', marginBottom: '0.2rem' }}>
              {t('hdesk.critical')} — {criticalPopupAlert.patient_id}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.5, marginBottom: '0.5rem' }}>
              {criticalPopupAlert.message}
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-red)' }}>{t('hdesk.tapXAI')}</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setCriticalPopupAlert(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', padding: '0.2rem', marginLeft: '-0.5rem' }}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex-between slide-up" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', color: 'var(--deep-blue)' }}>{t('hdesk.title')}</h2>
          <p style={{ color: 'var(--charcoal)', fontSize: '0.95rem' }}>{t('hdesk.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button className="glass-button" onClick={() => router.push('/search')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Search size={15} /> {t('hdesk.searchRecords')}
          </button>
          <button onClick={() => router.push('/hospital-desk/chat')} className="glass-button" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--primary-light)', color: 'var(--primary)', borderColor: 'var(--primary)', position: 'relative' }}>
            <MessageSquare size={15} /> Patient Chat
            {chatUnread > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -6, background: 'var(--accent-red)', color: 'white', fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: 10, border: '2px solid white', animation: 'pulseGlow 2s infinite' }}>
                {chatUnread}
              </span>
            )}
          </button>
          {patientData && (
            <button className="glass-button" onClick={exportVault} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: 'var(--powder-blue-dark)' }}>
              <Download size={15} /> {t('hdesk.exportFHIR')}
            </button>
          )}
        </div>
      </div>

      {/* Patient Lookup */}
      <section className="glass-panel slide-up stagger-1" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>
          <Search size={18} /> {t('hdesk.patientLookup')}
        </h3>
        <form onSubmit={loadPatient} style={{ display: 'flex', gap: '0.5rem' }}>
          <input type="text" value={patientId} onChange={e => setPatientId(e.target.value)} placeholder={t('hdesk.enterID')}
            style={{ flex: 1, padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }} />
          <button type="submit" className="glass-button" style={{ background: 'var(--primary)', color: 'white' }}>{t('hdesk.load')}</button>
        </form>

        {patientData && (
          <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--primary-light)', borderRadius: 10, borderLeft: '3px solid var(--primary)', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--deep-blue)' }}>{patientData.name}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)', marginTop: 2 }}>ID: {patientData.id}</div>
              {/* ABHA Badge */}
              {abhaStatus.verified ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem', padding: '0.2rem 0.6rem', borderRadius: 20, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', fontSize: '0.75rem', fontWeight: 700, color: '#16a34a' }}>
                  <ShieldCheck size={12} /> ABHA: {abhaStatus.masked}
                </div>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem', padding: '0.2rem 0.6rem', borderRadius: 20, background: 'rgba(251,191,36,0.12)', border: '1px dashed rgba(251,191,36,0.6)', fontSize: '0.75rem', fontWeight: 700, color: '#d97706' }}>
                  <Link2 size={12} /> {t('abha.notLinked')}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)' }}>{t('hdesk.dob')} <strong>{patientData.dob}</strong></div>
              <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)' }}>{t('hdesk.gender')} <strong>{patientData.gender}</strong></div>
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)' }}>{t('hdesk.bloodType')} <strong>{patientData.blood_type || t('hdesk.na')}</strong></div>
              <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)' }}>{t('hdesk.allergies')} <strong>{patientData.allergies || t('hdesk.none')}</strong></div>
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)' }}>{t('hdesk.lastVisit')} <strong>{patientRecords[0]?.date || t('hdesk.na')}</strong></div>
              <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)' }}>{t('hdesk.totalRecords')} <strong>{patientRecords.length}</strong></div>
            </div>
          </div>
        )}
      </section>

      {/* Active Notifications */}
      <section className="glass-panel slide-up stagger-2" style={{ marginBottom: '1.5rem' }}>
        <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-red)' }}>
            <Bell size={18} /> {t('hdesk.notifications')}
          </h3>
          <span className="badge red pulse-glow">{alerts.length} {t('hdesk.new')}</span>
        </div>

        {alerts.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--charcoal)', background: 'var(--surface-muted)', borderRadius: 10 }}>
            <CheckCircle size={32} color="var(--accent-green)" style={{ margin: '0 auto 0.5rem' }} />
            <div style={{ fontWeight: 600 }}>{t('hdesk.allClear')}</div>
            <div style={{ fontSize: '0.85rem' }}>{t('hdesk.noAnomalies')}</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {alerts.map((a: any) => {
              const snap = extractVitalsDisplay(a.message || '');
              const cleanMsg = (a.message || '').replace(/\s*\|.*$/, ''); // strip vitals tag
              const hasSnap = snap.hr || snap.spo2 || snap.resp || snap.temp || snap.sys;
              return (
              <div key={a.id} className="fade-in"
                onClick={() => {
                  const parsed = parseVitalsFromMessage(a.message);
                  parsed.patientId = a.patient_id;
                  router.push(`/xai?${new URLSearchParams(parsed).toString()}`);
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
                <p style={{ fontSize: '0.82rem', color: 'var(--charcoal)', marginBottom: hasSnap ? '0.5rem' : '0.75rem', lineHeight: 1.5 }}>{cleanMsg}</p>
                {hasSnap && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    {snap.hr   && <span style={{ padding: '0.2rem 0.55rem', borderRadius: 20, background: 'rgba(252,165,165,0.25)', border: '1px solid rgba(252,165,165,0.5)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--deep-blue)' }}>❤️ {snap.hr} BPM</span>}
                    {snap.spo2 && <span style={{ padding: '0.2rem 0.55rem', borderRadius: 20, background: 'rgba(165,216,255,0.25)', border: '1px solid rgba(165,216,255,0.5)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--deep-blue)' }}>🫁 {snap.spo2}% SpO₂</span>}
                    {snap.resp && <span style={{ padding: '0.2rem 0.55rem', borderRadius: 20, background: 'rgba(134,239,172,0.25)', border: '1px solid rgba(134,239,172,0.5)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--deep-blue)' }}>💨 {snap.resp} bpm</span>}
                    {snap.temp && <span style={{ padding: '0.2rem 0.55rem', borderRadius: 20, background: 'rgba(253,230,138,0.25)', border: '1px solid rgba(253,230,138,0.5)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--deep-blue)' }}>🌡️ {snap.temp}°C</span>}
                    {snap.sys  && <span style={{ padding: '0.2rem 0.55rem', borderRadius: 20, background: 'rgba(199,210,254,0.25)', border: '1px solid rgba(199,210,254,0.5)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--deep-blue)' }}>🩸 {snap.sys}/{snap.dia} mmHg</span>}
                  </div>
                )}
                <button onClick={(e) => { e.stopPropagation(); handleAlertClick(a); }} className="glass-button" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                  {t('hdesk.markRead')}
                </button>
              </div>
            );
            })}
          </div>
        )}
      </section>

      {/* General Appointments Module */}
      <section className="glass-panel slide-up stagger-2" style={{ marginBottom: '1.5rem' }}>
        <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>📅 Appointment Requests</h3>
          <button onClick={fetchAllAppointments} className="glass-button" style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}>↻ Refresh</button>
        </div>
        {appointments.length === 0 ? (
          <p style={{ color: 'var(--charcoal)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>No appointment requests yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {appointments.map(apt => {
              const urgColors: Record<string, {color:string;bg:string}> = { Routine:{color:'#0097A7',bg:'#E0F7FA'}, Urgent:{color:'#C07A00',bg:'#FFF8E1'}, Emergency:{color:'#C62828',bg:'#FFEBEE'} };
              const uc = urgColors[apt.urgency] || urgColors.Routine;
              const stColor = apt.status === 'approved' ? '#0052A5' : apt.status === 'scheduled' ? '#2E7D32' : apt.status === 'rejected' ? '#C62828' : apt.status === 'cancelled' ? '#71717A' : apt.status === 'pending_reschedule' ? '#C07A00' : '#C07A00';
              const stBg    = apt.status === 'approved' ? '#EBF3FF' : apt.status === 'scheduled' ? '#E8F5E9' : apt.status === 'rejected' ? '#FFEBEE' : apt.status === 'cancelled' ? '#F4F4F5' : apt.status === 'pending_reschedule' ? '#FFF8E1' : '#FFF8E1';
              const isEx = aptExpanded === apt.id;
              return (
                <div key={apt.id} style={{ borderRadius: 12, border: `1.5px solid ${isEx ? 'var(--primary)' : 'var(--border)'}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                  <div onClick={() => setAptExpanded(isEx ? null : apt.id)} style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', background: isEx ? 'var(--primary-light)' : 'var(--surface)', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--deep-blue)' }}>{apt.patientName}</span>
                        <span style={{ fontSize: '0.73rem', padding: '0.15rem 0.55rem', borderRadius: 20, background: uc.bg, color: uc.color, fontWeight: 700, border: `1px solid ${uc.color}44` }}>{apt.urgency}</span>
                        <span style={{ fontSize: '0.73rem', padding: '0.15rem 0.55rem', borderRadius: 20, background: stBg, color: stColor, fontWeight: 700 }}>{apt.status.charAt(0).toUpperCase()+apt.status.slice(1)}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--charcoal)' }}>→ {apt.doctorName} · {new Date(apt.date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)' }}>{new Date(apt.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                  {isEx && (
                    <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div><div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--charcoal)', marginBottom: 3 }}>PATIENT</div><div style={{ fontWeight: 700 }}>{apt.patientName} · <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontSize: '0.85rem' }}>{apt.patientId}</span></div></div>
                        <div><div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--charcoal)', marginBottom: 3 }}>DOCTOR</div><div style={{ fontWeight: 700 }}>{apt.doctorName}</div><div style={{ fontSize: '0.78rem', color: 'var(--charcoal)' }}>{apt.doctorSpecialty}</div></div>
                      </div>
                      <div style={{ marginBottom: '0.75rem' }}><div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--charcoal)', marginBottom: 4 }}>PATIENT REASON</div><div style={{ fontSize: '0.88rem', lineHeight: 1.6, padding: '0.6rem 0.85rem', background: 'var(--surface-muted)', borderRadius: 8 }}>{apt.reason}</div></div>
                      <div style={{ marginBottom: '0.75rem' }}><div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--charcoal)', marginBottom: 4 }}>AI CLINICAL SUMMARY</div><div style={{ fontSize: '0.85rem', lineHeight: 1.6, padding: '0.6rem 0.85rem', background: 'rgba(0,82,165,0.05)', border: '1px solid rgba(0,82,165,0.15)', borderRadius: 8 }}>{apt.aiSummary || '—'}</div></div>
                      {apt.vitalsSnapshot && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--charcoal)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>⚡ VITALS AT SUBMISSION</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {[['❤️','HR',`${apt.vitalsSnapshot.hr} BPM`,'#FCA5A5'],['🫁','SpO₂',`${apt.vitalsSnapshot.spo2}%`,'#A5D8FF'],['💨','Resp',`${apt.vitalsSnapshot.resp} bpm`,'#86EFAC'],['🌡️','Temp',`${apt.vitalsSnapshot.temp}°C`,'#FDE68A'],['🩸','BP',`${apt.vitalsSnapshot.sys}/${apt.vitalsSnapshot.dia}`,'#C7D2FE']].map(([em,lb,vl,cl]) => (
                              <span key={lb as string} style={{ padding: '0.25rem 0.6rem', borderRadius: 8, background: `${cl}22`, border: `1px solid ${cl}66`, fontSize: '0.77rem', fontWeight: 700 }}>{em} {lb}: {vl}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {apt.attachments?.length > 0 && (
                        <div style={{ marginBottom: '0.75rem' }}><div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--charcoal)', marginBottom: 4 }}>ATTACHMENTS</div><div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>{apt.attachments.map((a:any, i:number) => <span key={i} style={{ padding: '0.2rem 0.6rem', borderRadius: 8, background: 'var(--surface-muted)', border: '1px solid var(--border)', fontSize: '0.78rem' }}>{a.type === 'image' ? '🖼' : '📄'} {a.name}</span>)}</div></div>
                      )}
                      {apt.status === 'pending' && (
                        <>
                          <div style={{ marginBottom: '0.75rem' }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--charcoal)', display: 'block', marginBottom: 4 }}>Note to Patient (optional)</label>
                            <textarea value={aptNote[apt.id] || ''} onChange={e => setAptNote(p => ({...p, [apt.id]: e.target.value}))} rows={2} placeholder="Add a note or instructions for the patient…" style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                            <button disabled={aptProcessing === apt.id} onClick={() => handleAptAction(apt.id, 'rejected')} style={{ padding: '0.5rem 1.1rem', borderRadius: 8, background: '#FFEBEE', border: '1px solid rgba(198,40,40,0.3)', color: '#C62828', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                              {aptProcessing === apt.id ? '…' : '✕ Reject'}
                            </button>
                            <button disabled={aptProcessing === apt.id} onClick={() => handleAptAction(apt.id, 'approved')} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 3px 10px rgba(0,82,165,0.25)' }}>
                              {aptProcessing === apt.id ? '…' : '✓ Approve & Route to Doctor'}
                            </button>
                          </div>
                        </>
                      )}
                      {apt.status === 'pending_reschedule' && (
                        <>
                          <div style={{ marginBottom: '0.75rem', padding: '1rem', background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 8 }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#C07A00', marginBottom: '0.5rem' }}>DOCTOR PROPOSED RESCHEDULE</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <div><span style={{ fontSize: '0.75rem', color: 'var(--charcoal)' }}>New Date:</span> <span style={{ fontWeight: 600 }}>{apt.rescheduleProposedDate}</span></div>
                              <div><span style={{ fontSize: '0.75rem', color: 'var(--charcoal)' }}>New Time:</span> <span style={{ fontWeight: 600 }}>{apt.rescheduleProposedTime}</span></div>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--foreground)' }}><strong>Reason:</strong> {apt.rescheduleReason}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                            <button disabled={aptProcessing === apt.id} onClick={() => handleAptAction(apt.id, 'reschedule_rejected')} style={{ padding: '0.5rem 1.1rem', borderRadius: 8, background: '#FFEBEE', border: '1px solid rgba(198,40,40,0.3)', color: '#C62828', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                              {aptProcessing === apt.id ? '…' : '✕ Reject Proposal'}
                            </button>
                            <button disabled={aptProcessing === apt.id} onClick={() => handleAptAction(apt.id, 'reschedule_approved')} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, background: 'var(--accent-green)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 3px 10px rgba(34,197,94,0.3)' }}>
                              {aptProcessing === apt.id ? '…' : '✓ Approve New Time'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {patientData && (
            <>
              {/* Tab switcher */}
              {/* Header Tabs */}
              <div className="slide-up" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <button onClick={() => setActiveTab('scanner')} className="glass-button" style={{ background: activeTab === 'scanner' ? 'var(--primary)' : 'transparent', color: activeTab === 'scanner' ? 'white' : 'var(--charcoal)', border: activeTab === 'scanner' ? 'none' : '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                  <ScanLine size={16} /> {t('hdesk.recordScanner')}
                </button>
                <button onClick={() => setActiveTab('timeline')} className="glass-button" style={{ background: activeTab === 'timeline' ? 'var(--primary)' : 'transparent', color: activeTab === 'timeline' ? 'white' : 'var(--charcoal)', border: activeTab === 'timeline' ? 'none' : '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                  <Activity size={16} /> Patient Timeline
                </button>
              </div>

              {/* Document Scanner */}
              {activeTab === 'scanner' && (
                <section className="glass-panel slide-up stagger-2">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--accent-purple)' }}>
                    <ScanLine size={18} /> {t('hdesk.scanner').replace('📷 ', '')}
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
                    <div style={{ fontWeight: 600, color: 'var(--deep-blue)', fontSize: '0.9rem' }}>{t('hdesk.dropDoc')}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--charcoal)' }}>{t('hdesk.docFormats')}</div>
                  </div>

                  {preview && (
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', marginTop: '1rem' }}>
                      <img src={preview} alt="Preview" style={{ maxHeight: 150, borderRadius: 10, border: '1px solid var(--border)', objectFit: 'contain' }} />
                      <button className="glass-button" onClick={scan} disabled={scanning} style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {scanning ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> {t('hdesk.scanning')}</> : <><ScanLine size={15} /> {t('hdesk.scanGroq')}</>}
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
                        <h4 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><CheckCircle size={16} /> {t('hdesk.extractedData')}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--charcoal)' }}>{t('hdesk.confidence')} {Math.round((result.confidence || 0) * 100)}%</span>
                      </div>
                      {result.structuredSummary && <p style={{ fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.6, marginBottom: '1rem' }}>{result.structuredSummary}</p>}
                      {result.diagnoses?.length > 0 && (
                        <div style={{ marginBottom: '0.6rem' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>{t('hdesk.diagnoses')}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                            {result.diagnoses.map((d, i) => <span key={i} style={{ padding: '0.2rem 0.6rem', borderRadius: 20, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600 }}>{d}</span>)}
                          </div>
                        </div>
                      )}
                  {mismatchWarning && !imported && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#B91C1C', fontWeight: 700, marginBottom: '0.5rem' }}>
                        <AlertTriangle size={20} /> ⚠️ PATIENT MISMATCH
                      </div>
                      <p style={{ color: '#991B1B', fontSize: '0.9rem', marginBottom: '1rem' }}>{mismatchWarning}</p>
                      <button onClick={() => setMismatchWarning(null)} style={{ padding: '0.5rem 1rem', background: '#DC2626', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                        Acknowledge & Proceed Anyway
                      </button>
                    </div>
                  )}
                  {result && !imported && !mismatchWarning && (
                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={importToVault} disabled={importing} className="primary-button" style={{ padding: '0.75rem 1.5rem', opacity: importing ? 0.7 : 1, width: '100%' }}>
                        {importing ? t('hdesk.importing') : t('hdesk.importToVault')}
                      </button>
                    </div>
                  )}
                    </div>
                  )}
                </section>
              )}

              {/* Timeline */}
              {activeTab === 'timeline' && (
                <section className="glass-panel slide-up stagger-2">
                  <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                      <Activity size={18} /> {t('hdesk.longitudinal')}
                    </h3>
                    <span className="badge blue">{patientRecords.length} {t('hdesk.total')} {displayedRecords.length}</span>
                  </div>
                  <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
                    <div style={{ position: 'absolute', left: '5px', top: 0, bottom: 0, width: 2, background: 'linear-gradient(to bottom, var(--powder-blue), var(--border))' }} />
                    {displayedRecords.length === 0
                      ? <p style={{ color: 'var(--charcoal)', fontSize: '0.9rem' }}>{t('hdesk.noRecords')}</p>
                      : displayedRecords.map((r, i) => (
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
                      ))
                    }
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes slideUpRight { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
