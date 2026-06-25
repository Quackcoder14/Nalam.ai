'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Activity, BellRing, Network, Heart, Clock, Eye, ChevronDown, ChevronUp, Zap, Brain, AlertTriangle, CheckCircle, Bell, BellOff, X, Link2, ShieldCheck, Calendar, ClipboardList, MessageSquare, PhoneCall, MoreHorizontal } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import VoiceTriage from '../components/VoiceTriage';
import { apiFetch } from '@/lib/apiFetch';

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
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/notify/subscribe`, {
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
    <div className="flex-between" style={{ padding: '0.7rem 0.9rem', background: active ? 'var(--primary-light)' : 'var(--surface-muted)', borderRadius: 10, border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`, transition: 'all 0.25s', gap: '0.75rem' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--deep-blue)' }}>{label}</div>
        <div style={{ fontSize: '0.73rem', color: 'var(--charcoal)', marginTop: 1, lineHeight: 1.35 }}>{desc}</div>
      </div>
      <button onClick={onToggle} style={{ width: 44, height: 24, borderRadius: 12, background: active ? 'var(--primary)' : '#CBD5E0', border: 'none', position: 'relative', cursor: 'pointer', transition: 'background 0.3s', flexShrink: 0 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: active ? 23 : 3, transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
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
  const [patientAlerts, setPatientAlerts] = useState<any[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [intervention, setIntervention] = useState<any>(null);
  const [fhirData, setFhirData] = useState<any>(null);
  const [fhirLoading, setFhirLoading] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [dismissedPopups, setDismissedPopups] = useState<Set<string>>(new Set());

  const [abha, setAbha] = useState<{ verified: boolean; masked: string | null }>({ verified: false, masked: null });
  const [showAbhaModal, setShowAbhaModal] = useState(false);
  const [abhaInput, setAbhaInput] = useState('');
  const [showAmbulanceModal, setShowAmbulanceModal] = useState(false);
  const [callingAmbulance, setCallingAmbulance] = useState(false);
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
      const patientId = localStorage.getItem('nalamPatientId') || 'P001';
      const payload = { heart_rate: currentVitals.hr, spo2: currentVitals.spo2, resp: currentVitals.resp, temp: currentVitals.temp, sys: currentVitals.sys, dia: currentVitals.dia, lang, patientId };
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/anomaly`, { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json();
      setAnomaly(data);
      anomalyRef.current = data;
      if (data.is_anomaly && data.severity === 'critical') setShowPopup(true);
      if (data.is_anomaly && pushEnabled) {
        let alertTitle = data.severity === 'critical' ? '🚨 Critical Vital Anomaly' : '⚠️ Vital Anomaly Detected';
        if (lang === 'ta') alertTitle = data.severity === 'critical' ? '🚨 முக்கியமான முக்கிய முரண்பாடு' : '⚠️ முக்கிய முரண்பாடு கண்டறியப்பட்டது';
        const vSnap = vitalsRef.current;
        const vitalsTag = ` | hr=${vSnap.hr} spo2=${vSnap.spo2} resp=${vSnap.resp} temp=${vSnap.temp} sys=${vSnap.sys} dia=${vSnap.dia}`;
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/notify/send`, {
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
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/audit?patientId=P001`);
      if (!r.ok) return;
      const d = await r.json();
      setAuditLog(d.entries || []);
      const unRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat/unread?patientId=P001&role=patient`);
      if (unRes.ok) { const unData = await unRes.json(); setChatUnread(unData.unreadCount || 0); }
      const alRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/notify/alerts?lang=${lang}`);
      if (alRes.ok) {
        const alData = await alRes.json();
        const ptAlerts = (alData.alerts || []).filter((a: any) => a.patient_id === 'P001');
        setPatientAlerts(ptAlerts);
      }
    } catch { }
  }, [lang]);

  useEffect(() => {
    const role = localStorage.getItem('nalamRole');
    if (!role) { router.push('/'); return; }
    if (role === 'clinician') { router.push('/clinician'); return; }
    (async () => {
      try {
        const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/patient?id=P001&lang=${lang}`);
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        const data = await res.json();
        setPatient(data.patient);
        setRecords(data.records || []);
        setConsent({ emergency: data.patient.consent_emergency === 'true', specialist: data.patient.consent_specialist === 'true', research: data.patient.consent_research === 'true' });
        const ir = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/agents/intervention`, { method: 'POST', body: JSON.stringify({ patient: data.patient, records: data.records, lang }) });
        if (ir.ok) setIntervention(await ir.json());
        const ar = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/abha?patientId=P001`);
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
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/patient/consent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'P001', ...next }) });
  };

  if (!patient) return (
    <div className="container flex-center" style={{ minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem' }}>{t('dashboard.loading')}</span>
    </div>
  );

  const riskColor = intervention?.riskLevel === 'High' ? 'var(--accent-red)' : intervention?.riskLevel === 'Medium' ? 'var(--accent-amber)' : 'var(--accent-teal)';

  return (
    <div className="container fade-in">
      {/* ── Critical Anomaly Popup ── */}
      {showPopup && (
        <div onClick={explainAnomaly}
          style={{ position: 'fixed', bottom: 80, right: 12, left: 12, zIndex: 9999, background: 'var(--accent-red-bg)', border: '2px solid var(--accent-red)', borderRadius: 14, padding: '0.9rem 1rem', boxShadow: '0 8px 32px rgba(239,68,68,0.3)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', animation: 'slideUp 0.4s ease', cursor: 'pointer' }}
        >
          <AlertTriangle size={22} color="var(--accent-red)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: 'var(--accent-red)', fontSize: '0.95rem', marginBottom: '0.2rem' }}>{t('dashboard.criticalAnomaly')}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--foreground)', lineHeight: 1.4 }}>{anomaly?.flags?.[0]?.message || t('dashboard.criticalDesc')}</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-red)', marginTop: '0.3rem' }}>{t('dashboard.tapXAI')}</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setShowPopup(false); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Notification Popups (Bottom) ── */}
      <div style={{ position: 'fixed', bottom: 80, right: 12, left: 12, zIndex: 9998, display: 'flex', flexDirection: 'column', gap: '0.5rem', pointerEvents: 'none' }}>
        {patientAlerts.filter(a => !dismissedPopups.has(a.id)).slice(0, 3).map(alert => (
          <div key={alert.id} style={{ background: '#E0F2FE', borderLeft: '4px solid #0EA5E9', borderRadius: 12, padding: '0.85rem 1rem', boxShadow: '0 8px 32px rgba(14,165,233,0.2)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', animation: 'slideUp 0.4s ease', pointerEvents: 'auto' }}>
            <Bell size={20} color="#0EA5E9" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: '#0369A1', fontSize: '0.9rem', marginBottom: '0.1rem' }}>{alert.title}</div>
              <div style={{ fontSize: '0.82rem', color: '#0C4A6E', lineHeight: 1.4 }}>{alert.message}</div>
            </div>
            <button onClick={(e) => {
              e.stopPropagation();
              setDismissedPopups(prev => new Set(prev).add(alert.id));
            }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#0284C7', flexShrink: 0 }}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* ── Notifications Modal ── */}
      {showNotificationsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }}>
          <div className="glass-panel slide-up" style={{ width: '100%', maxWidth: '500px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: 'var(--background)', padding: 0, overflow: 'hidden' }}>
            <div className="flex-between" style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--deep-blue)', fontSize: '1.1rem', margin: 0 }}>
                <Bell size={20} color="var(--primary)" /> Notifications
              </h3>
              <button onClick={() => setShowNotificationsModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {patientAlerts.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--foreground-muted)', padding: '2rem 0' }}>No new notifications</div>
              ) : patientAlerts.map(alert => (
                <div key={alert.id} style={{ padding: '0.85rem 1rem', background: '#E0F2FE', borderLeft: '4px solid #0EA5E9', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                  <Bell size={16} color="#0EA5E9" style={{ marginTop: 3 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#0369A1', fontSize: '0.9rem', marginBottom: '0.2rem' }}>{alert.title}</div>
                    <div style={{ fontSize: '0.85rem', color: '#0C4A6E', lineHeight: 1.4 }}>{alert.message}</div>
                  </div>
                  <button onClick={async () => {
                    // mark read permanently
                    try {
                      await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/notify/alerts`, { method: 'PATCH', body: JSON.stringify({ id: alert.id }), headers: { 'Content-Type': 'application/json' } });
                      setPatientAlerts(prev => prev.filter(a => a.id !== alert.id));
                    } catch {}
                  }} style={{ background: 'rgba(2,132,199,0.1)', padding: '0.35rem 0.65rem', borderRadius: 6, border: 'none', cursor: 'pointer', color: '#0284C7', fontSize: '0.75rem', fontWeight: 600 }}>
                    Clear
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showAbhaModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel slide-up" style={{ width: '100%', maxWidth: 440, background: 'var(--background)' }}>
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--deep-blue)', fontSize: '1rem' }}>
                <ShieldCheck size={18} color="var(--primary)" /> {t('abha.modalTitle')}
              </h3>
              <button onClick={() => { setShowAbhaModal(false); setAbhaError(null); setAbhaInput(''); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--charcoal)', marginBottom: '1rem', lineHeight: 1.6 }}>{t('abha.modalDesc')}</p>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: '0.4rem' }}>{t('abha.label')}</label>
            <input type="text" placeholder="91-1234-5678-0000" value={abhaInput} onChange={e => { setAbhaInput(e.target.value); setAbhaError(null); }} maxLength={19}
              style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: 10, border: `1.5px solid ${abhaError ? 'var(--accent-red)' : 'var(--border)'}`, background: 'var(--surface)', color: 'var(--foreground)', fontSize: '1rem', fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none', marginBottom: '0.5rem' }}
            />
            {abhaError && <p style={{ fontSize: '0.78rem', color: 'var(--accent-red)', marginBottom: '0.75rem' }}>{abhaError}</p>}
            <p style={{ fontSize: '0.73rem', color: 'var(--foreground-muted)', marginBottom: '1rem' }}>{t('abha.formatHint')}</p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAbhaModal(false); setAbhaError(null); setAbhaInput(''); }} className="glass-button">{t('abha.cancel')}</button>
              <button disabled={abhaSaving || abhaInput.replace(/[^0-9]/g, '').length !== 14}
                onClick={async () => {
                  setAbhaSaving(true); setAbhaError(null);
                  try {
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/abha`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId: 'P001', abha_id: abhaInput }) });
                    const data = await res.json();
                    if (!res.ok) { setAbhaError(data.error || t('abha.error')); return; }
                    setAbha({ verified: true, masked: data.masked });
                    setShowAbhaModal(false); setAbhaInput('');
                  } catch { setAbhaError(t('abha.error')); }
                  finally { setAbhaSaving(false); }
                }}
                style={{ padding: '0.6rem 1.25rem', borderRadius: 10, background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.88rem', cursor: abhaInput.replace(/[^0-9]/g, '').length !== 14 ? 'not-allowed' : 'pointer', opacity: abhaInput.replace(/[^0-9]/g, '').length !== 14 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {abhaSaving ? <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> : <ShieldCheck size={14} />}
                {abhaSaving ? t('abha.saving') : t('abha.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FHIR Modal ── */}
      {fhirData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }}>
          <div className="glass-panel slide-up" style={{ width: '100%', maxWidth: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
            <div className="flex-between" style={{ paddingBottom: '0.85rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--deep-blue)', fontSize: '1rem' }}>
                <Network size={18} color="var(--primary)" /> {t('dashboard.fhirReady')}
              </h3>
              <button onClick={() => setFhirData(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--charcoal)', margin: '0.85rem 0' }}>{t('dashboard.fhirDesc')}</p>
            <div style={{ flex: 1, overflow: 'hidden', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)' }}>
              <pre style={{ width: '100%', height: '100%', overflow: 'auto', padding: '0.85rem', fontSize: '0.75rem', color: 'var(--foreground)', margin: 0, fontFamily: 'monospace' }}>
                {JSON.stringify(fhirData, null, 2)}
              </pre>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border)', justifyContent: 'flex-end' }}>
              <button onClick={() => setFhirData(null)} className="glass-button">{t('dashboard.cancelFHIR')}</button>
              <button onClick={() => {
                const blob = new Blob([JSON.stringify(fhirData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob); const a = document.createElement('a');
                a.href = url; a.download = `ABDM_FHIR_Bundle_${patient.id}.json`; a.click();
                URL.revokeObjectURL(url); setFhirData(null);
              }} className="glass-button" style={{ background: 'var(--primary)', color: 'white', border: 'none' }}>
                {t('dashboard.downloadFHIR')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="slide-up stagger-1" style={{ marginBottom: '1rem' }}>
        {/* Name row */}
        {/* Name row */}
        <div className="flex-between" style={{ marginBottom: '0.6rem', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '0.1rem', lineHeight: 1.25 }}>{t('dashboard.welcome')} {patient.name} 👋</h2>
            <p style={{ color: 'var(--accent-teal)', fontWeight: 600, fontSize: '0.8rem' }}>{t('dashboard.verified')} · {patient.id}</p>
          </div>
          {/* ABHA chip */}
          {abha.verified ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.22rem 0.65rem', borderRadius: 20, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', fontSize: '0.75rem', fontWeight: 700, color: '#16a34a' }}>
                <ShieldCheck size={12} /> {abha.masked}
              </div>
              <button onClick={() => { if (confirm('Unlink ABHA ID?')) setAbha({ verified: false, masked: null }); }} style={{ padding: '0.22rem 0.6rem', background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', fontSize: '0.72rem', fontWeight: 700, borderRadius: 8, cursor: 'pointer' }}>
                Unlink
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAbhaModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.22rem 0.65rem', borderRadius: 20, background: 'rgba(0,82,165,0.08)', border: '1px dashed var(--primary)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}>
              <Link2 size={11} /> {t('abha.link')}
            </button>
          )}
        </div>

        {/* Action Buttons — horizontally scrollable on mobile */}
        <div className="action-row" style={{ gap: '0.4rem' }}>
          <button className="glass-button" onClick={() => router.push('/dashboard/chat')} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.35rem', background: chatUnread > 0 ? 'var(--primary)' : 'var(--primary-light)', color: chatUnread > 0 ? 'white' : 'var(--primary)', borderColor: 'var(--primary)', flexShrink: 0 }}>
            <MessageSquare size={13} /> Chat
            {chatUnread > 0 && (
              <span style={{ background: 'var(--accent-red)', color: 'white', fontSize: '0.62rem', fontWeight: 800, padding: '0.08rem 0.35rem', borderRadius: 10, border: '2px solid white', minWidth: 16, textAlign: 'center' }}>
                {chatUnread}
              </span>
            )}
          </button>
          <button className="glass-button" onClick={() => router.push('/appointments/book')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
            <Calendar size={13} /> Book Appt
          </button>
          <button className="glass-button" onClick={() => router.push('/xai')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
            <Brain size={13} /> AI Insights
          </button>
          <button className="glass-button" onClick={() => router.push('/appointments/requests')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
            <ClipboardList size={13} /> Requests
          </button>
          <button className="glass-button" onClick={() => setShowNotificationsModal(true)} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0, background: patientAlerts.length > 0 ? 'var(--primary-light)' : 'var(--surface)', color: patientAlerts.length > 0 ? 'var(--primary)' : 'var(--foreground)' }}>
            <Bell size={13} /> Notifications
            {patientAlerts.length > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, background: 'var(--accent-red)', borderRadius: '50%', border: '2px solid white' }} />
            )}
          </button>
          <button className="glass-button" onClick={() => { setShowMoreActions(p => !p); }} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
            <MoreHorizontal size={13} /> More
          </button>
        </div>

        {/* Expanded "More" options */}
        {showMoreActions && (
          <div className="fade-in" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem', padding: '0.6rem', background: 'var(--surface-muted)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <button className="glass-button" onClick={async () => {
              if (fhirLoading) return; setFhirLoading(true);
              try { const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/patient/export?id=${patient.id}`); setFhirData(await res.json()); }
              catch (e) { console.error(e); } finally { setFhirLoading(false); }
            }} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {fhirLoading ? <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> : <Network size={13} />}
              {fhirLoading ? 'Downloading…' : t('dashboard.exportFHIR')}
            </button>
            <button className="glass-button" onClick={() => { setShowAudit(p => !p); fetchAudit(); setShowMoreActions(false); }} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={13} /> {t('dashboard.auditLog')}
            </button>
            <button
              id="push-toggle"
              disabled={pushLoading}
              onClick={async () => {
                if (pushEnabled) { setPushEnabled(false); return; }
                setPushLoading(true);
                const ok = await subscribePush('P001');
                setPushEnabled(ok); setPushLoading(false);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', borderRadius: 8, border: `1px solid ${pushEnabled ? 'var(--accent-green)' : 'var(--border)'}`, background: pushEnabled ? 'var(--accent-green-bg)' : 'var(--surface)', color: pushEnabled ? 'var(--accent-green)' : 'var(--foreground-muted)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', opacity: pushLoading ? 0.6 : 1, fontFamily: 'inherit' }}>
              {pushEnabled ? <Bell size={13} /> : <BellOff size={13} />}
              {pushEnabled ? 'Alerts On' : 'Enable Alerts'}
            </button>
          </div>
        )}
      </div>

      {/* ── LIVE VITALS ── */}
      <section className="glass-panel slide-up stagger-1" style={{ marginBottom: '1rem' }}>
        <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-teal)', fontSize: '0.95rem' }}>
            <Activity size={17} /> {t('dashboard.liveVitals')}
          </h3>
          <span className="badge teal" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulseGlow 1.4s infinite' }} /> {t('dashboard.syncing')}
          </span>
        </div>
        <div className="vitals-grid">
          {[
            { label: t('dashboard.heartRate'), value: `${vitals.hr}`, unit: 'BPM', color: '#FCA5A5', icon: Heart, pulse: true },
            { label: t('dashboard.spo2'), value: `${vitals.spo2}`, unit: '%', color: '#A5D8FF', icon: Activity, pulse: false },
            { label: 'Resp', value: `${vitals.resp}`, unit: 'bpm', color: '#86EFAC', icon: Activity, pulse: false },
            { label: 'Temp', value: `${vitals.temp}`, unit: '°C', color: '#FDE68A', icon: Activity, pulse: false },
            { label: 'BP', value: `${vitals.sys}/${vitals.dia}`, unit: 'mmHg', color: '#C7D2FE', icon: Activity, pulse: false },
          ].map(({ label, value, unit, color, icon: Icon, pulse }) => (
            <div key={label} className="vital-card" style={{ background: `${color}1A`, border: `1px solid ${color}55`, animation: pulse ? 'pulseGlow 1.5s infinite' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={14} color={color} />
                </div>
                <div>
                  <div className="vital-value">{value}<span className="vital-unit">{unit}</span></div>
                </div>
              </div>
              <div className="vital-label">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── VOICE TRIAGE ── */}
      <VoiceTriage />

      {/* ── BOOK APPOINTMENT ── */}
      <section className="glass-panel slide-up stagger-2" style={{ marginBottom: '1rem', background: 'linear-gradient(135deg, rgba(0,82,165,0.05) 0%, rgba(92,53,161,0.05) 100%)', border: '1.5px solid rgba(0,82,165,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(0,82,165,0.3)' }}>
            <Calendar size={22} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.15rem', color: 'var(--deep-blue)' }}>Book an Appointment</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--charcoal)', lineHeight: 1.45, marginBottom: '0.75rem' }}>
              Consult with Dr. Dhanush or Dr. Monissha. Vitals auto-attached.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => router.push('/appointments/requests')} className="glass-button" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}>
                <ClipboardList size={13} /> My Requests
              </button>
              <button onClick={() => router.push('/appointments/book')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.1rem', borderRadius: 10, background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,82,165,0.28)' }}>
                <Calendar size={14} /> Book Now
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── AUDIT LOG ── */}
      {showAudit && (
        <section className="glass-panel slide-up" style={{ marginBottom: '1rem' }}>
          <div className="flex-between" style={{ marginBottom: '0.85rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-purple)', fontSize: '0.92rem' }}>
              <Eye size={16} /> {t('dashboard.auditTitle')}
            </h3>
            <span className="badge purple">{auditLog.length} {t('dashboard.auditEvents')}</span>
          </div>
          {auditLog.length === 0 ? (
            <p style={{ color: 'var(--charcoal)', fontSize: '0.85rem' }}>{t('dashboard.noAudit')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {auditLog.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.55rem 0.75rem', background: 'var(--surface-muted)', borderRadius: 8, borderLeft: '3px solid var(--accent-purple)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--deep-blue)' }}>{e.clinician}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--charcoal)', marginTop: 1 }}>{e.reason}</div>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--charcoal-light)', whiteSpace: 'nowrap' }}>{timeAgo(e.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── MAIN CONTENT GRID ── */}
      <div className="grid-2">
        {/* LEFT — Anomaly + Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Anomaly Monitor */}
          <section className="glass-panel slide-up stagger-2" style={{ borderColor: anomaly?.is_anomaly ? (anomaly.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)') : 'var(--glass-border)' }}>
            <div className="flex-between" style={{ marginBottom: '0.7rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: anomaly?.is_anomaly ? (anomaly.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)') : 'var(--accent-green)', fontSize: '0.92rem' }}>
                <Zap size={16} /> {t('dashboard.anomalyMonitor')}
              </h3>
              <span style={{ padding: '0.18rem 0.55rem', borderRadius: 50, fontSize: '0.72rem', fontWeight: 700, background: anomaly?.is_anomaly ? (anomaly.severity === 'critical' ? 'var(--accent-red-bg)' : 'var(--accent-amber-bg)') : 'var(--accent-green-bg)', color: anomaly?.is_anomaly ? (anomaly.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)') : 'var(--accent-green)' }}>
                {anomalyLoading ? t('dashboard.checking') : anomaly?.is_anomaly ? `⚠ ${anomaly.severity?.toUpperCase()}` : t('dashboard.normal')}
              </span>
            </div>

            {anomaly?.flags?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.65rem' }}>
                {anomaly.flags.map((f: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', padding: '0.5rem 0.65rem', borderRadius: 8, background: f.severity === 'critical' ? 'var(--accent-red-bg)' : 'var(--accent-amber-bg)', borderLeft: `3px solid ${f.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)'}` }}>
                    <AlertTriangle size={13} color={f.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)'} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--foreground)', lineHeight: 1.4 }}>{f.message}</span>
                  </div>
                ))}
              </div>
            ) : anomaly && !anomaly.is_anomaly ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.65rem', borderRadius: 8, background: 'var(--accent-green-bg)', marginBottom: '0.65rem' }}>
                <CheckCircle size={13} color="var(--accent-green)" />
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 600 }}>{t('dashboard.allVitalsNormal')}</span>
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button id="anomaly-check" onClick={() => checkAnomaly(vitals)} disabled={anomalyLoading} className="glass-button" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', opacity: anomalyLoading ? 0.6 : 1, fontSize: '0.8rem' }}>
                <Zap size={12} /> {t('dashboard.checkNow')}
              </button>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <select value={demoScenario || ''} onChange={(e) => runDemo(e.target.value)}
                  style={{ appearance: 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.38rem 1.8rem 0.38rem 0.7rem', fontSize: '0.78rem', color: 'var(--foreground)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
                  <option value="" disabled>{t('dashboard.simulateDemo')}</option>
                  <option value="normal">{t('dashboard.normalVitals')}</option>
                  <option value="tachycardia">{t('dashboard.tachycardia')}</option>
                  <option value="hypoxemia">{t('dashboard.hypoxemia')}</option>
                  <option value="hypertension">{t('dashboard.hypertension')}</option>
                </select>
                <ChevronDown size={12} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--foreground-muted)' }} />
              </div>
              <button className="glass-button" onClick={explainAnomaly} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}>
                <Brain size={12} /> {t('dashboard.explain')}
              </button>
            </div>
          </section>

          {/* Medical Timeline */}
          <section className="glass-panel slide-up stagger-3">
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontSize: '0.92rem' }}>
                <Activity size={16} /> {t('dashboard.timeline')}
              </h3>
              <span className="badge blue">{records.length} {t('dashboard.records')}</span>
            </div>
            <div style={{ position: 'relative', paddingLeft: '1.25rem' }}>
              <div style={{ position: 'absolute', left: '4px', top: 0, bottom: 0, width: 2, background: 'linear-gradient(to bottom, var(--powder-blue), var(--border))' }} />
              {records.slice(0, parseInt(process.env.NEXT_PUBLIC_TIMELINE_LIMIT || '10', 10)).map((r, i) => (
                <div key={r.record_id}
                  className={`timeline-entry${expandedRecord === r.record_id ? ' expanded' : ''}`}
                  style={{ position: 'relative', marginBottom: '0.4rem', animationDelay: `${i * 0.05}s` }}
                  onClick={() => setExpandedRecord(expandedRecord === r.record_id ? null : r.record_id)}
                >
                  <div className="timeline-dot" style={{ position: 'absolute', left: '-1.25rem', top: '0.2rem', width: 10, height: 10, borderRadius: '50%', background: expandedRecord === r.record_id ? 'var(--primary)' : 'var(--powder-blue-dark)', border: '2px solid var(--primary)', boxShadow: '0 0 0 3px rgba(165,216,255,0.25)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: expandedRecord === r.record_id ? '0.4rem' : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--deep-blue)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.diagnosis || r.type}</span>
                      <ChevronDown size={12} color="var(--charcoal)" style={{ transform: expandedRecord === r.record_id ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s', flexShrink: 0 }} />
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--charcoal-light)', whiteSpace: 'nowrap', marginLeft: '0.4rem', flexShrink: 0 }}>{r.date}</span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--charcoal)' }}>{r.provider}</div>
                  {expandedRecord === r.record_id && (
                    <div className="fade-in" style={{ background: 'white', borderRadius: 8, padding: '0.6rem 0.75rem', marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {r.notes && <p style={{ fontSize: '0.79rem', color: 'var(--charcoal)', lineHeight: 1.5 }}><strong>{t('dashboard.notes')}</strong> {r.notes}</p>}
                      {r.lab_results && <p style={{ fontSize: '0.79rem', color: 'var(--primary)', fontWeight: 600 }}><strong style={{ color: 'var(--charcoal)' }}>{t('dashboard.labs')}</strong> {r.lab_results}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT — Consent + EHR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Consent */}
          <section className="glass-panel slide-up stagger-2">
            <div className="flex-between" style={{ marginBottom: '0.85rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.92rem' }}>
                <Shield size={16} color="var(--primary)" /> {t('dashboard.smartConsent')}
              </h3>
              <span className="badge teal">{t('dashboard.masterKey')}</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--charcoal)', marginBottom: '1rem', lineHeight: 1.5 }}>{t('dashboard.consentDesc')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <ConsentToggle label={t('dashboard.emergencyAccess')} desc={t('dashboard.emergencyDesc')} active={consent.emergency} onToggle={() => toggleConsent('emergency')} />
              <ConsentToggle label={t('dashboard.specialistAccess')} desc={t('dashboard.specialistDesc')} active={consent.specialist} onToggle={() => toggleConsent('specialist')} />
              <ConsentToggle label={t('dashboard.researchAccess')} desc={t('dashboard.researchDesc')} active={consent.research} onToggle={() => toggleConsent('research')} />
            </div>
          </section>

          {/* EHR Silos */}
          <section className="glass-panel slide-up stagger-2">
            <div className="flex-between" style={{ marginBottom: '0.85rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.92rem' }}>
                <Network size={16} color="var(--accent-purple)" /> {t('dashboard.connectedEHR')}
              </h3>
              <span className="badge purple pulse-glow">{t('dashboard.live')}</span>
            </div>
            {[
              { name: 'Epic Systems', loc: 'Apollo Hospital Chennai', color: 'var(--primary)' },
              { name: 'Cerner Health', loc: 'AIIMS Delhi', color: 'var(--accent-teal)' },
              { name: 'Apple HealthKit', loc: 'Wearables · Live Stream', color: 'var(--accent-amber)' },
            ].map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.75rem', background: 'var(--surface-muted)', borderRadius: 8, borderLeft: `3px solid ${s.color}`, marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--deep-blue)' }}>{s.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--charcoal)' }}>{s.loc}</div>
                </div>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-green)', background: 'var(--accent-green-bg)', padding: '0.15rem 0.5rem', borderRadius: 6, flexShrink: 0 }}>{t('dashboard.synced')}</span>
              </div>
            ))}
          </section>
        </div>
      </div>

      {/* ── INTERVENTION ENGINE ── */}
      {intervention && (
        <section className="glass-panel slide-up stagger-3" style={{ borderColor: `${riskColor}44`, marginTop: '1rem' }}>
          <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: riskColor, fontSize: '0.92rem' }}>
              <BellRing size={16} /> {t('dashboard.interventionEngine')}
            </h3>
            <span className="badge amber pulse-glow">{intervention.riskLevel} {t('dashboard.riskLevel')}</span>
          </div>
          <div style={{ background: `${riskColor}0D`, borderLeft: `4px solid ${riskColor}`, padding: '0.75rem 0.85rem', borderRadius: 8 }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--deep-blue)', marginBottom: '0.25rem' }}>{t('dashboard.detectedPattern')}</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--charcoal)', marginBottom: '0.65rem', lineHeight: 1.55 }}>{intervention.detectedPattern}</p>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--deep-blue)', marginBottom: '0.25rem' }}>{t('dashboard.actionPlan')}</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--charcoal)', lineHeight: 1.55 }}>{intervention.actionPlan}</p>
          </div>
        </section>
      )}

      <style>{`
        @keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes slideUpRight { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── AMBULANCE BUTTON ── */}
      <button
        onDoubleClick={() => setShowAmbulanceModal(true)}
        style={{
          position: 'fixed', bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 1rem)', right: '1rem', zIndex: 9000,
          background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', border: 'none', borderRadius: '50%',
          width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)', cursor: 'pointer', animation: 'pulseGlow 2s infinite'
        }}
        title="Double Click to Call Ambulance"
      >
        <PhoneCall size={24} />
      </button>

      {/* ── AMBULANCE MODAL ── */}
      {showAmbulanceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: 20, maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', animation: 'slideUp 0.3s ease' }}>
            {callingAmbulance ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'heartbeat 1s infinite' }}>
                  <PhoneCall size={36} color="#DC2626" />
                </div>
                <h2 style={{ fontSize: '1.3rem', color: '#1A2B4A', fontWeight: 800 }}>Calling Ambulance...</h2>
                <p style={{ color: '#64748B', fontSize: '0.88rem' }}>Connecting to emergency services</p>
              </div>
            ) : (
              <>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                  <AlertTriangle size={28} color="#DC2626" />
                </div>
                <h2 style={{ fontSize: '1.3rem', color: '#1A2B4A', fontWeight: 800, marginBottom: '0.4rem' }}>Emergency Services</h2>
                <p style={{ color: '#64748B', marginBottom: '1.5rem', fontSize: '0.88rem' }}>Are you sure you want to call an ambulance?</p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => setShowAmbulanceModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>Cancel</button>
                  <button onClick={() => {
                    setCallingAmbulance(true);
                    const audio = new Audio('/ringing.mp3'); audio.loop = true; audio.play().catch(() => {});
                    setTimeout(() => { audio.pause(); setCallingAmbulance(false); setShowAmbulanceModal(false); }, 5000);
                  }} style={{ flex: 1, padding: '0.75rem', background: '#DC2626', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}>Proceed</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
