'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Activity, BellRing, Network, Heart, Clock, Eye, ChevronDown, Zap, Brain, AlertTriangle, CheckCircle, Bell, BellOff, X, Link2, ShieldCheck, Calendar, ClipboardList, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import VoiceTriage from '../components/VoiceTriage';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

async function subscribePush(patientId: string) {
  if (!('serviceWorker' in navigator) || !VAPID_PUBLIC) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
    await fetch('/api/notify/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), patientId, role: 'patient' }),
    });
    return true;
  } catch { return false; }
}

function urlBase64ToUint8Array(base64: string) {
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

interface ConsentState { emergency: boolean; specialist: boolean; research: boolean; }
interface AuditEntry { clinician: string; reason: string; timestamp: string; }

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.round(d)}s ago`;
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

function ConsentToggle({ label, desc, active, onToggle }: { label: string; desc: string; active: boolean; onToggle: () => void }) {
  return (
    <div className="flex-between" style={{ padding: '0.75rem', background: active ? 'var(--primary-light)' : 'var(--surface-muted)', borderRadius: 10, border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`, transition: 'all 0.25s' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--deep-blue)' }}>{label}</div>
        <div style={{ fontSize: '0.76rem', color: 'var(--charcoal)', marginTop: 2 }}>{desc}</div>
      </div>
      <button onClick={onToggle} style={{ width: 48, height: 26, borderRadius: 13, background: active ? 'var(--primary)' : '#CBD5E0', border: 'none', position: 'relative', cursor: 'pointer', transition: 'background 0.3s', flexShrink: 0 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: active ? 25 : 3, transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}

export default function PatientDashboard() {
  const { t, lang } = useLanguage();
  const [patient, setPatient] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [consent, setConsent] = useState<ConsentState>({ emergency: false, specialist: false, research: false });
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [intervention, setIntervention] = useState<any>(null);
  const [fhirData, setFhirData] = useState<any>(null);
  const [fhirLoading, setFhirLoading] = useState(false);

  // ABHA ID state
  const [abha, setAbha] = useState<{ verified: boolean; masked: string | null }>({ verified: false, masked: null });
  const [showAbhaModal, setShowAbhaModal] = useState(false);
  const [abhaInput, setAbhaInput] = useState('');
  const [abhaSaving, setAbhaSaving] = useState(false);
  const [abhaError, setAbhaError] = useState<string | null>(null);

  const [baseVitals, setBaseVitals] = useState({ hr: 72, spo2: 98, resp: 16, temp: 36.6, sys: 120, dia: 80 });
  const [vitals, setVitals] = useState({ hr: 72, spo2: 98, resp: 16, temp: 36.6, sys: 120, dia: 80 });
  const vitalsRef = useRef(vitals);

  const [anomaly, setAnomaly] = useState<any>(null);
  const [anomalyLoading, setAL] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [demoScenario, setDemoScenario] = useState<string | null>(null);
  const [chatUnread, setChatUnread] = useState(0);
  const anomalyRef = useRef<any>(null);
  const router = useRouter();

  useEffect(() => { vitalsRef.current = vitals; }, [vitals]);

  useEffect(() => {
    const iv = setInterval(() => {
      setVitals({
        hr: Math.max(45, Math.min(200, baseVitals.hr + Math.floor(Math.random() * 5) - 2)),
        spo2: Math.max(88, Math.min(100, baseVitals.spo2 + (Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : -1) : 0))),
        resp: Math.max(10, Math.min(40, baseVitals.resp + Math.floor(Math.random() * 3) - 1)),
        temp: parseFloat(Math.max(35, Math.min(41, baseVitals.temp + (Math.random() * 0.2 - 0.1))).toFixed(1)),
        sys: Math.max(70, Math.min(250, baseVitals.sys + Math.floor(Math.random() * 5) - 2)),
        dia: Math.max(40, Math.min(150, baseVitals.dia + Math.floor(Math.random() * 4) - 2)),
      });
    }, 2000);
    return () => clearInterval(iv);
  }, [baseVitals]);

  const checkAnomaly = useCallback(async (currentVitals: typeof vitals) => {
    setAL(true);
    try {
      const payload = { heart_rate: currentVitals.hr, spo2: currentVitals.spo2, resp: currentVitals.resp, temp: currentVitals.temp, sys: currentVitals.sys, dia: currentVitals.dia, lang };
      const res = await fetch('/api/anomaly', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      setAnomaly(data);
      anomalyRef.current = data;
      if (data.is_anomaly && data.severity === 'critical') setShowPopup(true);
      if (data.is_anomaly && pushEnabled) {
        let alertTitle = data.severity === 'critical' ? '🚨 Critical Vital Anomaly' : '⚠️ Vital Anomaly Detected';
        if (lang === 'ta') {
          alertTitle = data.severity === 'critical' ? '🚨 முக்கியமான முக்கிய முரண்பாடு (Critical Vital Anomaly)' : '⚠️ முக்கிய முரண்பாடு கண்டறியப்பட்டது';
        }
        // Embed vitals snapshot so hospital desk can display them
        const vSnap = vitalsRef.current;
        const vitalsTag = ` | hr=${vSnap.hr} spo2=${vSnap.spo2} resp=${vSnap.resp} temp=${vSnap.temp} sys=${vSnap.sys} dia=${vSnap.dia}`;
        await fetch('/api/notify/send', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId: 'P001', title: alertTitle, message: (data.flags?.[0]?.message || 'An anomaly was detected in your vitals.') + vitalsTag, severity: data.severity }),
        });
      }
    } catch { }
    finally { setAL(false); }
  }, [pushEnabled, lang]);

  useEffect(() => {
    if (!demoScenario) {
      checkAnomaly(vitalsRef.current);
      const iv = setInterval(() => checkAnomaly(vitalsRef.current), 30000);
      return () => clearInterval(iv);
    }
  }, [checkAnomaly, demoScenario]);

  const runDemo = (scenario: string) => {
    setDemoScenario(scenario);
    let newBase = { hr: 72, spo2: 98, resp: 16, temp: 36.6, sys: 120, dia: 80 };
    if (scenario === 'tachycardia') newBase = { hr: 135, spo2: 97, resp: 22, temp: 37.1, sys: 125, dia: 82 };
    if (scenario === 'hypoxemia') newBase = { hr: 95, spo2: 91, resp: 28, temp: 37.2, sys: 130, dia: 85 };
    if (scenario === 'hypertension') newBase = { hr: 88, spo2: 98, resp: 18, temp: 36.9, sys: 185, dia: 115 };
    setBaseVitals(newBase); setVitals(newBase); checkAnomaly(newBase);
  };

  const explainAnomaly = () => {
    const q = new URLSearchParams({ heart_rate: vitals.hr.toString(), spo2: vitals.spo2.toString(), resp: vitals.resp.toString(), temp: vitals.temp.toString(), sys: vitals.sys.toString(), dia: vitals.dia.toString() });
    router.push(`/xai?${q.toString()}`);
  };

  const fetchAudit = useCallback(async () => {
    try {
      const r = await fetch('/api/audit?patientId=P001');
      if (!r.ok) return;
      const d = await r.json();
      setAuditLog(d.entries || []);

      const unRes = await fetch('/api/chat/unread?patientId=P001&role=patient');
      if (unRes.ok) {
        const unData = await unRes.json();
        setChatUnread(unData.unreadCount || 0);
      }
    } catch { }
  }, []);

  useEffect(() => {
    const role = localStorage.getItem('nalamRole');
    if (!role) { router.push('/'); return; }
    if (role === 'clinician') { router.push('/clinician'); return; }
    (async () => {
      try {
        const res = await fetch(`/api/patient?id=P001&lang=${lang}`);
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        const data = await res.json();
        setPatient(data.patient);
        setRecords(data.records || []);
        setConsent({ emergency: data.patient.consent_emergency === 'true', specialist: data.patient.consent_specialist === 'true', research: data.patient.consent_research === 'true' });
        const ir = await fetch('/api/agents/intervention', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patient: data.patient, records: data.records, lang }) });
        if (ir.ok) setIntervention(await ir.json());
        // Fetch ABHA ID status
        const ar = await fetch('/api/abha?patientId=P001');
        if (ar.ok) setAbha(await ar.json());
      } catch (e) { console.error(e); }
    })();
    fetchAudit();
    const iv = setInterval(fetchAudit, 12000);
    return () => clearInterval(iv);
  }, [fetchAudit, router, lang]);

  const toggleConsent = async (type: keyof ConsentState) => {
    const next = { ...consent, [type]: !consent[type] };
    setConsent(next);
    await fetch('/api/patient/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'P001', ...next }) });
  };

  if (!patient) return (
    <div className="container flex-center" style={{ minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{t('dashboard.loading')}</span>
    </div>
  );

  const riskColor = intervention?.riskLevel === 'High' ? 'var(--accent-red)' : intervention?.riskLevel === 'Medium' ? 'var(--accent-amber)' : 'var(--accent-teal)';

  return (
    <div className="container fade-in">
      {/* Severe Anomaly Popup */}
      {showPopup && (
        <div onClick={explainAnomaly}
          style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, background: 'var(--accent-red-bg)', border: '2px solid var(--accent-red)', borderRadius: 12, padding: '1rem 1.5rem', boxShadow: '0 8px 32px rgba(239,68,68,0.3)', display: 'flex', alignItems: 'flex-start', gap: '1rem', minWidth: 320, maxWidth: '400px', animation: 'slideUpRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)', cursor: 'pointer' }}
        >
          <AlertTriangle size={24} color="var(--accent-red)" style={{ flexShrink: 0, marginTop: 4 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: 'var(--accent-red)', fontSize: '1.05rem', marginBottom: '0.2rem' }}>{t('dashboard.criticalAnomaly')}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.5, marginBottom: '0.5rem' }}>
              {anomaly?.flags?.[0]?.message || t('dashboard.criticalDesc')}
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-red)' }}>{t('dashboard.tapXAI')}</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setShowPopup(false); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', padding: '0.2rem', marginLeft: '-0.5rem' }}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* ABHA Link Modal */}
      {showAbhaModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel slide-up" style={{ width: '100%', maxWidth: 460, background: 'var(--background)', padding: '2rem' }}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--deep-blue)' }}>
                <ShieldCheck size={20} color="var(--primary)" /> {t('abha.modalTitle')}
              </h3>
              <button onClick={() => { setShowAbhaModal(false); setAbhaError(null); setAbhaInput(''); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', marginBottom: '1.25rem', lineHeight: 1.6 }}>{t('abha.modalDesc')}</p>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: '0.4rem' }}>{t('abha.label')}</label>
              <input
                type="text"
                placeholder="91-1234-5678-0000"
                value={abhaInput}
                onChange={e => { setAbhaInput(e.target.value); setAbhaError(null); }}
                maxLength={19}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 10, border: `1.5px solid ${abhaError ? 'var(--accent-red)' : 'var(--border)'}`, background: 'var(--surface)', color: 'var(--foreground)', fontSize: '1rem', fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none' }}
              />
              {abhaError && <p style={{ fontSize: '0.8rem', color: 'var(--accent-red)', marginTop: '0.4rem' }}>{abhaError}</p>}
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--foreground-muted)', marginBottom: '1.25rem' }}>{t('abha.formatHint')}</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAbhaModal(false); setAbhaError(null); setAbhaInput(''); }} className="glass-button">{t('abha.cancel')}</button>
              <button
                disabled={abhaSaving || abhaInput.replace(/[^0-9]/g, '').length !== 14}
                onClick={async () => {
                  setAbhaSaving(true); setAbhaError(null);
                  try {
                    const res = await fetch('/api/abha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId: 'P001', abha_id: abhaInput }) });
                    const data = await res.json();
                    if (!res.ok) { setAbhaError(data.error || t('abha.error')); return; }
                    setAbha({ verified: true, masked: data.masked });
                    setShowAbhaModal(false); setAbhaInput('');
                  } catch { setAbhaError(t('abha.error')); }
                  finally { setAbhaSaving(false); }
                }}
                style={{ padding: '0.65rem 1.5rem', borderRadius: 10, background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: abhaInput.replace(/[^0-9]/g, '').length !== 14 ? 'not-allowed' : 'pointer', opacity: abhaInput.replace(/[^0-9]/g, '').length !== 14 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {abhaSaving ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> : <ShieldCheck size={15} />}
                {abhaSaving ? t('abha.saving') : t('abha.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FHIR Export Modal */}
      {fhirData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }}>
          <div className="glass-panel slide-up" style={{ width: '100%', maxWidth: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
            <div className="flex-between" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--deep-blue)' }}>
                <Network size={20} color="var(--primary)" /> {t('dashboard.fhirReady')}
              </h3>
              <button onClick={() => setFhirData(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', marginTop: '1rem', marginBottom: '1rem' }}>{t('dashboard.fhirDesc')}</p>

            <div style={{ flex: 1, overflow: 'hidden', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)' }}>
              <pre style={{ width: '100%', height: '100%', overflow: 'auto', padding: '1rem', fontSize: '0.8rem', color: 'var(--foreground)', margin: 0, fontFamily: 'monospace' }}>
                {JSON.stringify(fhirData, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', justifyContent: 'flex-end' }}>
              <button onClick={() => setFhirData(null)} className="glass-button" style={{ color: 'var(--charcoal)' }}>{t('dashboard.cancelFHIR')}</button>
              <button onClick={() => {
                const blob = new Blob([JSON.stringify(fhirData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ABDM_FHIR_Bundle_${patient.id}.json`;
                a.click();
                URL.revokeObjectURL(url);
                setFhirData(null);
              }} className="glass-button" style={{ background: 'var(--primary)', color: 'white', border: 'none' }}>
                {t('dashboard.downloadFHIR')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="slide-up stagger-1 flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.2rem' }}>{t('dashboard.welcome')} {patient.name} 👋</h2>
          <p style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>{t('dashboard.verified')} · {patient.id}</p>
          {/* ABHA ID status chip */}
          {abha.verified ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', padding: '0.25rem 0.75rem', borderRadius: 20, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', fontSize: '0.8rem', fontWeight: 700, color: '#16a34a' }}>
              <ShieldCheck size={14} /> ABHA: {abha.masked}
            </div>
          ) : (
            <button onClick={() => setShowAbhaModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem', padding: '0.25rem 0.75rem', borderRadius: 20, background: 'rgba(0,82,165,0.08)', border: '1px dashed var(--primary)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}>
              <Link2 size={13} /> {t('abha.link')}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button className="glass-button" onClick={() => router.push('/appointments/requests')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ClipboardList size={15} /> View Requests
          </button>
          <button className="glass-button" onClick={async () => {
            if (fhirLoading) return;
            setFhirLoading(true);
            try {
              const res = await fetch(`/api/patient/export?id=${patient.id}`);
              const data = await res.json();
              setFhirData(data);
            } catch (e) { console.error(e); }
            finally { setFhirLoading(false); }
          }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
            {fhirLoading ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> : <Network size={15} />}
            {fhirLoading ? t('dashboard.downloading') : t('dashboard.exportFHIR')}
          </button>
          <button className="glass-button" onClick={() => router.push('/xai')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Brain size={15} /> {t('dashboard.aiInsights')}
          </button>
          <button className="glass-button" onClick={() => { setShowAudit(p => !p); fetchAudit(); }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={15} /> {t('dashboard.auditLog')}
          </button>
          <button className="glass-button" onClick={() => router.push('/dashboard/chat')} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: 'var(--primary)', color: 'var(--primary)', background: 'var(--primary-light)' }}>
            <MessageSquare size={15} /> Chat with us
            {chatUnread > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -6, background: 'var(--accent-red)', color: 'white', fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: 10, border: '2px solid white', animation: 'pulseGlow 2s infinite' }}>
                {chatUnread}
              </span>
            )}
          </button>
          <button
            id="push-toggle"
            disabled={pushLoading}
            onClick={async () => {
              if (pushEnabled) { setPushEnabled(false); return; }
              setPushLoading(true);
              const ok = await subscribePush('P001');
              setPushEnabled(ok);
              setPushLoading(false);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: 8, border: `1px solid ${pushEnabled ? 'var(--accent-green)' : 'var(--border)'}`, background: pushEnabled ? 'var(--accent-green-bg)' : 'var(--surface)', color: pushEnabled ? 'var(--accent-green)' : 'var(--foreground-muted)', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer', opacity: pushLoading ? 0.6 : 1 }}
          >
            {pushEnabled ? <Bell size={15} /> : <BellOff size={15} />}
            {pushEnabled ? t('dashboard.alertsOn') : t('dashboard.enableAlerts')}
          </button>
        </div>
      </div>

      {/* Live Vitals */}
      <section className="glass-panel slide-up stagger-1" style={{ marginBottom: '1.5rem' }}>
        <div className="flex-between" style={{ marginBottom: '1rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-teal)' }}><Activity size={19} /> {t('dashboard.liveVitals')}</h3>
          <span className="badge teal" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulseGlow 1.4s infinite' }} /> {t('dashboard.syncing')}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          {[
            { label: t('dashboard.heartRate'), value: `${vitals.hr}`, unit: 'BPM', color: '#FCA5A5', icon: Heart, pulse: true },
            { label: t('dashboard.spo2'), value: `${vitals.spo2}`, unit: '%', color: '#A5D8FF', icon: Activity, pulse: false },
            { label: 'Resp Rate', value: `${vitals.resp}`, unit: 'bpm', color: '#86EFAC', icon: Activity, pulse: false },
            { label: 'Temperature', value: `${vitals.temp}`, unit: '°C', color: '#FDE68A', icon: Activity, pulse: false },
            { label: 'Blood Pressure', value: `${vitals.sys}/${vitals.dia}`, unit: 'mmHg', color: '#C7D2FE', icon: Activity, pulse: false },
          ].map(({ label, value, unit, color, icon: Icon, pulse }) => (
            <div key={label} style={{ background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 11, padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: pulse ? 'pulseGlow 1.5s infinite' : 'none' }}>
                <Icon size={20} color={color} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--foreground)' }}>{value}<span style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--foreground-muted)', marginLeft: 3 }}>{unit}</span></div>
                <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)' }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Voice First Input Triage */}
      <VoiceTriage />

      {/* Book Appointment Module */}
      <section className="glass-panel slide-up stagger-2" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(0,82,165,0.06) 0%, rgba(92,53,161,0.06) 100%)', border: '1.5px solid rgba(0,82,165,0.18)' }}>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 16px rgba(0,82,165,0.3)' }}>
              <Calendar size={26} color="white" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '0.15rem', color: 'var(--deep-blue)' }}>Book an Appointment</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--charcoal)', lineHeight: 1.5 }}>Request a consultation with Dr. Dhanush or Dr. Monissha.<br />Your live vitals will be automatically attached to the request.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexShrink: 0 }}>
            <button onClick={() => router.push('/appointments/requests')} className="glass-button" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ClipboardList size={15} /> My Requests
            </button>
            <button onClick={() => router.push('/appointments/book')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.4rem', borderRadius: 10, background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,82,165,0.28)', transition: 'all 0.2s ease' }}>
              <Calendar size={16} /> Book Now
            </button>
          </div>
        </div>
      </section>

      {/* Audit Log */}
      {showAudit && (
        <section className="glass-panel slide-up" style={{ marginBottom: '1.5rem' }}>
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-purple)' }}><Eye size={18} /> {t('dashboard.auditTitle')}</h3>
            <span className="badge purple">{auditLog.length} {t('dashboard.auditEvents')}</span>
          </div>
          {auditLog.length === 0 ? <p style={{ color: 'var(--charcoal)', fontSize: '0.9rem' }}>{t('dashboard.noAudit')}</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {auditLog.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.65rem 0.9rem', background: 'var(--surface-muted)', borderRadius: 9, borderLeft: '3px solid var(--accent-purple)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--deep-blue)' }}>{e.clinician}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--charcoal)' }}>{e.reason}</div>
                  </div>
                  <span style={{ fontSize: '0.76rem', color: 'var(--charcoal-light)', whiteSpace: 'nowrap' }}>{timeAgo(e.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="grid-2">
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Anomaly Monitor */}
          <section className="glass-panel slide-up stagger-2" style={{ borderColor: anomaly?.is_anomaly ? (anomaly.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)') : 'var(--glass-border)' }}>
            <div className="flex-between" style={{ marginBottom: '0.85rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: anomaly?.is_anomaly ? (anomaly.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)') : 'var(--accent-green)' }}>
                <Zap size={18} /> {t('dashboard.anomalyMonitor')}
              </h3>
              <span style={{ padding: '0.2rem 0.65rem', borderRadius: 50, fontSize: '0.75rem', fontWeight: 700, background: anomaly?.is_anomaly ? (anomaly.severity === 'critical' ? 'var(--accent-red-bg)' : 'var(--accent-amber-bg)') : 'var(--accent-green-bg)', color: anomaly?.is_anomaly ? (anomaly.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)') : 'var(--accent-green)' }}>
                {anomalyLoading ? t('dashboard.checking') : anomaly?.is_anomaly ? `⚠ ${anomaly.severity?.toUpperCase()}` : t('dashboard.normal')}
              </span>
            </div>

            {anomaly?.flags?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                {anomaly.flags.map((f: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.55rem 0.75rem', borderRadius: 8, background: f.severity === 'critical' ? 'var(--accent-red-bg)' : 'var(--accent-amber-bg)', borderLeft: `3px solid ${f.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)'}` }}>
                    <AlertTriangle size={14} color={f.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)'} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.83rem', color: 'var(--foreground)', lineHeight: 1.5 }}>{f.message}</span>
                  </div>
                ))}
              </div>
            ) : anomaly && !anomaly.is_anomaly ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 8, background: 'var(--accent-green-bg)', marginBottom: '0.75rem' }}>
                <CheckCircle size={15} color="var(--accent-green)" />
                <span style={{ fontSize: '0.83rem', color: 'var(--accent-green)', fontWeight: 600 }}>{t('dashboard.allVitalsNormal')}</span>
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button id="anomaly-check" onClick={() => checkAnomaly(vitals)} disabled={anomalyLoading} className="glass-button" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', opacity: anomalyLoading ? 0.6 : 1 }}>
                <Zap size={13} /> {t('dashboard.checkNow')}
              </button>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <select value={demoScenario || ''} onChange={(e) => runDemo(e.target.value)}
                  style={{ appearance: 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 2rem 0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--foreground)', cursor: 'pointer', outline: 'none', boxShadow: 'var(--shadow-sm)' }}
                >
                  <option value="" disabled>{t('dashboard.simulateDemo')}</option>
                  <option value="normal">{t('dashboard.normalVitals')}</option>
                  <option value="tachycardia">{t('dashboard.tachycardia')}</option>
                  <option value="hypoxemia">{t('dashboard.hypoxemia')}</option>
                  <option value="hypertension">{t('dashboard.hypertension')}</option>
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--foreground-muted)' }} />
              </div>
              <button className="glass-button" onClick={explainAnomaly} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Brain size={13} /> {t('dashboard.explain')}
              </button>
            </div>
          </section>

          {/* Timeline */}
          <section className="glass-panel slide-up stagger-3">
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}><Activity size={19} /> {t('dashboard.timeline')}</h3>
              <span className="badge blue">{records.length} {t('dashboard.records')}</span>
            </div>
            <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
              <div style={{ position: 'absolute', left: '5px', top: 0, bottom: 0, width: 2, background: 'linear-gradient(to bottom, var(--powder-blue), var(--border))' }} />
              {records.slice(0, parseInt(process.env.NEXT_PUBLIC_TIMELINE_LIMIT || '10', 10)).map((r, i) => (
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
                      {r.notes && <p style={{ fontSize: '0.82rem', color: 'var(--charcoal)', lineHeight: 1.6 }}><strong>{t('dashboard.notes')}</strong> {r.notes}</p>}
                      {r.lab_results && <p style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}><strong style={{ color: 'var(--charcoal)' }}>{t('dashboard.labs')}</strong> {r.lab_results}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Consent */}
          <section className="glass-panel slide-up stagger-2">
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Shield size={19} color="var(--primary)" /> {t('dashboard.smartConsent')}</h3>
              <span className="badge teal">{t('dashboard.masterKey')}</span>
            </div>
            <p style={{ fontSize: '0.87rem', color: 'var(--charcoal)', marginBottom: '1.25rem' }}>{t('dashboard.consentDesc')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <ConsentToggle label={t('dashboard.emergencyAccess')} desc={t('dashboard.emergencyDesc')} active={consent.emergency} onToggle={() => toggleConsent('emergency')} />
              <ConsentToggle label={t('dashboard.specialistAccess')} desc={t('dashboard.specialistDesc')} active={consent.specialist} onToggle={() => toggleConsent('specialist')} />
              <ConsentToggle label={t('dashboard.researchAccess')} desc={t('dashboard.researchDesc')} active={consent.research} onToggle={() => toggleConsent('research')} />
            </div>
          </section>

          {/* EHR Silos */}
          <section className="glass-panel slide-up stagger-2">
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Network size={19} color="var(--accent-purple)" /> {t('dashboard.connectedEHR')}</h3>
              <span className="badge purple pulse-glow">{t('dashboard.live')}</span>
            </div>
            {[
              { name: 'Epic Systems', loc: 'Apollo Hospital Chennai', color: 'var(--primary)' },
              { name: 'Cerner Health', loc: 'AIIMS Delhi', color: 'var(--accent-teal)' },
              { name: 'Apple HealthKit', loc: 'Wearables · Live Stream', color: 'var(--accent-amber)' },
            ].map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', background: 'var(--surface-muted)', borderRadius: 9, borderLeft: `3px solid ${s.color}`, marginBottom: '0.6rem' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--deep-blue)' }}>{s.name}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--charcoal)' }}>{s.loc}</div>
                </div>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-green)', background: 'var(--accent-green-bg)', padding: '0.18rem 0.55rem', borderRadius: 6 }}>{t('dashboard.synced')}</span>
              </div>
            ))}
          </section>
        </div>
      </div>

      {/* Intervention Engine */}
      {intervention && (
        <section className="glass-panel slide-up stagger-3" style={{ borderColor: `${riskColor}44`, marginTop: '1.5rem' }}>
          <div className="flex-between" style={{ marginBottom: '0.85rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: riskColor }}><BellRing size={19} /> {t('dashboard.interventionEngine')}</h3>
            <span className="badge amber pulse-glow">{intervention.riskLevel} {t('dashboard.riskLevel')}</span>
          </div>
          <div style={{ background: `${riskColor}0D`, borderLeft: `4px solid ${riskColor}`, padding: '0.9rem', borderRadius: 8 }}>
            <div style={{ fontWeight: 700, fontSize: '0.87rem', color: 'var(--deep-blue)', marginBottom: '0.3rem' }}>{t('dashboard.detectedPattern')}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', marginBottom: '0.75rem', lineHeight: 1.6 }}>{intervention.detectedPattern}</p>
            <div style={{ fontWeight: 700, fontSize: '0.87rem', color: 'var(--deep-blue)', marginBottom: '0.3rem' }}>{t('dashboard.actionPlan')}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', lineHeight: 1.6 }}>{intervention.actionPlan}</p>
          </div>
        </section>
      )}

      <style>{`
        @keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes slideUpRight { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
