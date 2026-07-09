'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Cpu, Stethoscope, AlertTriangle, Activity, Eye, EyeOff, Database, Clock, Lock, Unlock, FlaskConical, FileText, CheckCircle, XCircle, SkipForward, ChevronDown, ArrowUpDown, Bell, BellRing, X, ClipboardList } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import WhatsAppButton from '@/app/components/WhatsAppButton';
import PrescriptionTable from '@/app/components/PrescriptionTable';
import Chatbot from '@/app/components/Chatbot';
// import BodyVisualizer from '../components/BodyVisualizer';
// import BodyVisualizer from '../components/BodyVisualizer';
// import { GlassBoxPanel, type GlassBoxEntry } from '../components/GlassBox';
import { apiFetch } from '@/lib/apiFetch';
import { AVAILABLE_TIME_SLOTS } from '@/lib/doctors';
import { RecordsOtpModal } from '../components/RecordsOtpModal';
import { ContextOtpModal } from '../components/ContextOtpModal';

/* ── Reschedule Modal with live slot availability ────────────────────────── */
function RescheduleModal({ apt, processing, onCancel, onSubmit }: {
  apt: any;
  processing: boolean;
  onCancel: () => void;
  onSubmit: (date: string, time: string, reason: string) => void;
}) {
  const { t } = useLanguage();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Set min date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  useEffect(() => {
    if (!date || !apt?.doctorId) return;
    setLoadingSlots(true);
    setTime('');
    fetch(`/api/appointments/availability?doctorId=${apt.doctorId}&date=${date}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setBookedSlots(d.bookedSlots || []))
      .catch(() => {})
      .finally(() => setLoadingSlots(false));
  }, [date, apt?.doctorId]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
      <div className="glass-panel slide-up" style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', padding: '1.5rem', borderRadius: 16, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--deep-blue)' }}>{t("clinician.rescheduleTitle")}</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--charcoal)', marginBottom: '1.25rem' }}>
          {t("clinician.rescheduleFor")} <strong>{apt.patientName}</strong> — {t("clinician.rescheduleOriginal")} {apt.date} {t("clinician.rescheduleAt")} {apt.time}
        </p>

        <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>{t("clinician.newDate")}</label>
        <input type="date" min={minDate} value={date} onChange={e => setDate(e.target.value)}
          style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border)', marginBottom: '1.25rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />

        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
          {t("clinician.newTime")} {!date && <span style={{ fontWeight: 400, color: 'var(--charcoal)', fontSize: '0.78rem' }}>{t("clinician.pickDateFirst")}</span>}
          {loadingSlots && <span style={{ fontWeight: 400, color: 'var(--primary)', fontSize: '0.78rem', marginLeft: 8 }}>{t("clinician.loadingSlots")}</span>}
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
          {AVAILABLE_TIME_SLOTS.map(slot => {
            const isBooked = bookedSlots.includes(slot);
            return (
              <button key={slot} onClick={() => !isBooked && date && setTime(slot)} disabled={isBooked || !date}
                title={isBooked ? t("clinician.alreadyBooked") : !date ? t("clinician.selectDateFirst") : undefined}
                style={{
                  padding: '0.4rem 0.85rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
                  border: `1.5px solid ${isBooked ? '#E2E8F0' : time === slot ? 'var(--primary)' : 'var(--border)'}`,
                  background: isBooked ? '#F1F5F9' : time === slot ? 'var(--primary)' : 'var(--surface)',
                  color: isBooked ? '#94A3B8' : time === slot ? 'white' : !date ? 'var(--foreground-muted)' : 'var(--foreground)',
                  cursor: (isBooked || !date) ? 'not-allowed' : 'pointer',
                  opacity: isBooked ? 0.5 : !date ? 0.4 : 1,
                  transition: 'all 0.15s',
                }}>
                {slot}{isBooked ? ' ✗' : ''}
              </button>
            );
          })}
        </div>
        {date && bookedSlots.length > 0 && <p style={{ fontSize: '0.73rem', color: 'var(--charcoal)', marginBottom: '1rem', marginTop: '-1rem' }}>{t("clinician.bookedByAnother")}</p>}

        <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>{t("clinician.rescheduleReason")}</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
          placeholder={t("clinician.rescheduleReasonPlaceholder")}
          style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border)', marginBottom: '1.5rem', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '0.55rem 1.1rem', borderRadius: 8, border: 'none', background: 'var(--surface-muted)', fontWeight: 600, cursor: 'pointer' }}>{t("clinician.cancel")}</button>
          <button disabled={!date || !time || !reason || processing}
            onClick={() => onSubmit(date, time, reason)}
            style={{ padding: '0.55rem 1.1rem', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 600, cursor: (!date || !time || !reason) ? 'not-allowed' : 'pointer', opacity: (!date || !time || !reason) ? 0.6 : 1 }}>
            {processing ? t("clinician.submitting") : t("clinician.submitProposal")}
          </button>
        </div>
      </div>
    </div>
  );
}


const MEDICATIONS = [
  { name: 'Amlodipine',          dosages: ['2.5mg', '5mg', '10mg'] },
  { name: 'Metoprolol',          dosages: ['25mg', '50mg', '100mg', '200mg'] },
  { name: 'Lisinopril',          dosages: ['5mg', '10mg', '20mg', '40mg'] },
  { name: 'Atorvastatin',        dosages: ['10mg', '20mg', '40mg', '80mg'] },
  { name: 'Losartan',            dosages: ['25mg', '50mg', '100mg'] },
  { name: 'Ramipril',            dosages: ['2.5mg', '5mg', '10mg'] },
  { name: 'Bisoprolol',          dosages: ['2.5mg', '5mg', '10mg'] },
  { name: 'Furosemide',          dosages: ['20mg', '40mg', '80mg'] },
  { name: 'Carvedilol',          dosages: ['3.125mg', '6.25mg', '12.5mg', '25mg'] },
  { name: 'Hydrochlorothiazide', dosages: ['12.5mg', '25mg', '50mg'] },
  { name: 'Spironolactone',      dosages: ['25mg', '50mg', '100mg'] },
  { name: 'Telmisartan',         dosages: ['20mg', '40mg', '80mg'] },
  { name: 'Rosuvastatin',        dosages: ['5mg', '10mg', '20mg', '40mg'] },
  { name: 'Aspirin',             dosages: ['75mg', '100mg', '325mg'] },
  { name: 'Other (type below)',  dosages: [] },
];

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface PrecisionData {
  treatmentDecision: string;
  riskPrediction: string;
  personalizedCare: string;
  glassBox?: GlassBoxEntry[];
}

interface GlassBoxEntry {
  step: number;
  agentName: string;
  model: string;
  inputSummary: Record<string, any>;
  output: any;
  durationMs: number;
  status: 'success' | 'error' | 'skipped';
  timestamp: string;
}

function parseSystolic(labResults: string): number | null {
  const match = labResults?.match(/BP[:\s]*(\d+)\/\d+/i);
  return match ? parseInt(match[1]) : null;
}

function buildBpHistory(records: any[]) {
  return records
    .filter(r => r.lab_results && /BP/i.test(r.lab_results))
    .map(r => ({ date: r.date, systolic: parseSystolic(r.lab_results) }))
    .filter(r => r.systolic !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildPrediction(history: any[], intervention: string, t: any) {
  if (!history.length) return [];
  const last = history[history.length - 1];
  const lastSystolic = last.systolic!;
  const isPositive = /amlodipine|lisinopril|losartan|ramipril|beta|arb|ccb/i.test(intervention);
  const slope = isPositive ? -4 : -1;
  return [
    { date: `${t('clinician.day')} 7`,    predicted: Math.round(lastSystolic + slope * 0.08) },
    { date: `${t('clinician.day')} 30`,   predicted: Math.round(lastSystolic + slope * 0.33) },
    { date: `${t('clinician.day')} 90`,   predicted: Math.round(lastSystolic + slope * 0.75) },
    { date: `${t('clinician.day')} 365`,  predicted: Math.round(lastSystolic + slope) },
    { date: `${t('clinician.day')} 730`,  predicted: Math.round(lastSystolic + slope * 2) },
    { date: `${t('clinician.day')} 1095`, predicted: Math.round(lastSystolic + slope * 3) },
  ];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1e293b', border: '1px solid rgba(165,216,255,0.2)', borderRadius: 8, padding: '0.75rem 1rem' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 4 }}>{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} style={{ color: entry.color, fontSize: '0.9rem', fontWeight: 600 }}>
            {entry.name}: {entry.value} mmHg
          </p>
        ))}
      </div>
    );
  }
  return null;
}

// ─── Medication → Body-Part Effects ─────────────────────────────────────────
function getMedEffects(medication: string): Record<string, { effect: 'good' | 'bad' | 'none', short: string }> {
  const m = medication.toLowerCase();
  const fx: Record<string, { effect: 'good' | 'bad' | 'none', short: string }> = {};
  if (/lisinopril|ramipril|enalapril|perindopril/.test(m))            { fx.heart = { effect: 'good', short: 'Reduces cardiac strain' }; fx.kidneys = { effect: 'good', short: 'Protects against nephropathy' }; fx.vessels = { effect: 'good', short: 'Dilates blood vessels' }; fx.lungs = { effect: 'bad', short: 'May cause dry cough' }; }
  if (/losartan|valsartan|telmisartan|olmesartan|irbesartan/.test(m)) { fx.heart = { effect: 'good', short: 'Improves heart function' }; fx.kidneys = { effect: 'good', short: 'Reduces kidney damage' }; fx.vessels = { effect: 'good', short: 'Lowers blood pressure' }; }
  if (/amlodipine|nifedipine|diltiazem|verapamil/.test(m))           { fx.heart = { effect: 'good', short: 'Decreases oxygen demand' }; fx.vessels = { effect: 'good', short: 'Relaxes smooth muscle' }; }
  if (/metoprolol|bisoprolol|carvedilol|atenolol|propranolol/.test(m)){ fx.heart = { effect: 'good', short: 'Lowers heart rate' }; fx.lungs = { effect: 'bad', short: 'Can cause bronchospasm' }; }
  if (/atorvastatin|rosuvastatin|simvastatin|pravastatin/.test(m))   { fx.heart = { effect: 'good', short: 'Prevents plaque buildup' }; fx.liver = { effect: 'bad', short: 'May elevate enzymes' }; fx.muscles = { effect: 'bad', short: 'Risk of myopathy' }; }
  if (/furosemide|bumetanide|torsemide/.test(m))                     { fx.heart = { effect: 'good', short: 'Reduces fluid overload' }; fx.kidneys = { effect: 'bad', short: 'Can cause dehydration' }; }
  if (/hydrochlorothiazide|chlorthalidone|indapamide/.test(m))       { fx.heart = { effect: 'good', short: 'Lowers blood pressure' }; fx.kidneys = { effect: 'good', short: 'Increases sodium excretion' }; }
  if (/spironolactone|eplerenone/.test(m))                           { fx.heart = { effect: 'good', short: 'Prevents fibrosis' }; fx.kidneys = { effect: 'good', short: 'Potassium sparing diuresis' }; }
  if (/aspirin/.test(m))                                             { fx.heart = { effect: 'good', short: 'Prevents clotting' }; fx.brain = { effect: 'good', short: 'Reduces stroke risk' }; fx.stomach = { effect: 'bad', short: 'Risk of ulceration' }; }
  return fx;
}

function getBodyPartInfo(part: string, t: any) {
  const info: Record<string, { label: string; desc: string }> = {
    brain:   { label: t('clinician.brain'),         desc: t('clinician.brainDesc') },
    heart:   { label: t('clinician.heart'),         desc: t('clinician.heartDesc') },
    lungs:   { label: t('clinician.lungs'),         desc: t('clinician.lungsDesc') },
    liver:   { label: t('clinician.liver'),         desc: t('clinician.liverDesc') },
    stomach: { label: t('clinician.stomach'),       desc: t('clinician.stomachDesc') },
    kidneys: { label: t('clinician.kidneys'),       desc: t('clinician.kidneysDesc') },
    bladder: { label: t('clinician.bladder'),       desc: t('clinician.bladderDesc') },
    vessels: { label: t('clinician.vessels'),       desc: t('clinician.vesselsDesc') },
    muscles: { label: t('clinician.muscles'),       desc: t('clinician.musclesDesc') },
    nerves:  { label: t('clinician.nerves'),        desc: t('clinician.nervesDesc') },
  };
  return info[part];
}

// ─── 3-D Body Visualiser ─────────────────────────────────────────────────────
function BodyVisualizer({ effects, medication, dosage, patient, records }: { 
  effects: Record<string, { effect: 'good' | 'bad' | 'none', short: string }>; 
  medication: string; 
  dosage?: string;
  patient?: any;
  records?: any[];
}) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [clickedRegion, setClickedRegion] = useState<string | null>(null);
  const [organExplanation, setOrganExplanation] = useState<string | null>(null);
  const [loadingOrgan, setLoadingOrgan] = useState(false);
  const [loadingEffects, setLoadingEffects] = useState(false);
  const [aiEffects, setAiEffects] = useState<Record<string, { effect: 'good' | 'bad', short: string }> | null>(null);
  const { t, lang } = useLanguage();

  // Fetch AI-generated effects when medication changes
  useEffect(() => {
    const fetchAiEffects = async () => {
      if (!medication) return;
      setLoadingEffects(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/agents/drug-effects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ medication, dosage, patient, records, lang }),
        });
        const data = await res.json();
        if (data.effects && Object.keys(data.effects).length > 0) {
          setAiEffects(data.effects);
        }
      } catch (e) {
        console.error('Failed to fetch AI effects:', e);
      } finally {
        setLoadingEffects(false);
      }
    };

    fetchAiEffects();
  }, [medication, dosage, patient, records, lang]);

  // Use AI effects if available, otherwise fall back to hardcoded effects
  const currentEffects = aiEffects || effects;

  const getRegionEffect = (id: string) => currentEffects[id]?.effect || null;
  const getRegionShort = (id: string) => currentEffects[id]?.short || null;

  const fetchOrganDetail = async (organ: string) => {
    if (!medication) return;
    setClickedRegion(organ);
    setOrganExplanation(null);
    setLoadingOrgan(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/agents/organ-detail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organ, medication, dosage, effect: getRegionEffect(organ), lang }),
      });
      const data = await res.json();
      setOrganExplanation(data.explanation || '');
    } catch {
      setOrganExplanation('Unable to load explanation.');
    } finally {
      setLoadingOrgan(false);
    }
  };

  const regionFill = (id: string) => {
    const e = getRegionEffect(id);
    const h = hoveredRegion === id;
    if (!e || e === 'none') return h ? 'rgba(203,213,225,0.6)' : 'rgba(148,163,184,0.2)';
    if (e === 'good') return h ? 'rgba(34,197,94,0.8)' : 'rgba(34,197,94,0.55)';
    return h ? 'rgba(239,68,68,0.8)' : 'rgba(239,68,68,0.55)';
  };

  const regionStroke = (id: string) => {
    const e = getRegionEffect(id);
    const h = hoveredRegion === id;
    if (!e || e === 'none') return h ? 'rgba(148,163,184,0.9)' : 'rgba(148,163,184,0.5)';
    if (e === 'good') return h ? '#4ade80' : '#22c55e';
    return h ? '#f87171' : '#ef4444';
  };

  const hp = (id: string) => {
    const e = getRegionEffect(id);
    const h = hoveredRegion === id;
    const isAffected = e && e !== 'none';
    return {
      onMouseEnter: () => setHoveredRegion(id),
      onMouseLeave: () => setHoveredRegion(null),
      onClick: () => fetchOrganDetail(id),
      style: { 
        cursor: 'pointer', 
        transition: 'all 0.25s',
        filter: isAffected 
          ? `drop-shadow(0 0 10px ${e === 'good' ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)'})` 
          : (h ? 'drop-shadow(0 0 6px rgba(255,255,255,0.4))' : 'none')
      } as React.CSSProperties,
      fill: regionFill(id),
      stroke: regionStroke(id),
      strokeWidth: h ? 3 : (isAffected ? 2.5 : 1.5),
      strokeLinejoin: 'round' as const,
      strokeLinecap: 'round' as const,
    };
  };

  const noEffects = Object.keys(effects).length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '1rem 0.5rem', width: '100%' }}>
      {/* Mobile: stacked. Desktop: row layout done via flex-wrap */}
      <style>{`@media (min-width: 640px) { .body-viz-row { flex-direction: row !important; gap: 2rem !important; align-items: flex-start !important; } .body-viz-svg { order: -1; } }`}</style>
      
      {loadingEffects && (
        <div style={{ 
          width: '100%', 
          padding: '1.5rem', 
          textAlign: 'center', 
          background: 'var(--surface-muted)', 
          borderRadius: 10,
          border: '1px solid var(--border)'
        }}>
          <div style={{ 
            width: 24, 
            height: 24, 
            borderRadius: '50%', 
            border: '3px solid var(--primary)', 
            borderTopColor: 'transparent', 
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 0.75rem'
          }} />
          <p style={{ fontSize: '0.9rem', color: 'var(--foreground-muted)', margin: 0 }}>
            {t("clinician.analyzingDrugEffects")}
          </p>
        </div>
      )}

      <div className="body-viz-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%', opacity: loadingEffects ? 0.5 : 1, transition: 'opacity 0.3s' }}>

      {/* ── Legend & Summary ── */}
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>{t('clinician.legend')}</div>
          {[['#22c55e', t('clinician.beneficialEffect')], ['#ef4444', t('clinician.sideEffectRisk')], ['rgba(148,163,184,0.4)', t('clinician.unaffected')]].map(([c, lbl]) => (
            <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', color: 'var(--foreground-muted)' }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: c, flexShrink: 0, boxShadow: !c.startsWith('rgba') ? `0 0 8px ${c}88` : 'none' }} />
              {lbl}
            </div>
          ))}
        </div>

        {/* Hover Detail Card */}
        <div style={{
          background: 'var(--surface-muted)', borderRadius: 10, padding: '1rem', minHeight: 96,
          border: `1px solid ${clickedRegion
            ? getRegionEffect(clickedRegion) === 'good' ? 'rgba(34,197,94,0.4)'
            : getRegionEffect(clickedRegion) === 'bad'  ? 'rgba(239,68,68,0.4)'
            : 'var(--border)'
            : hoveredRegion
            ? getRegionEffect(hoveredRegion) === 'good' ? 'rgba(34,197,94,0.4)'
            : getRegionEffect(hoveredRegion) === 'bad'  ? 'rgba(239,68,68,0.4)'
            : 'var(--border)'
            : 'var(--border)'}`,
          transition: 'border-color 0.25s',
        }}>
          {clickedRegion && getBodyPartInfo(clickedRegion, t) ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: getRegionEffect(clickedRegion) ? (getRegionEffect(clickedRegion) === 'good' ? '#22c55e' : '#ef4444') : 'var(--foreground)' }}>
                  {getBodyPartInfo(clickedRegion, t).label} {getRegionEffect(clickedRegion) === 'good' ? '✓' : getRegionEffect(clickedRegion) === 'bad' ? '⚠' : ''}
                </div>
                <button onClick={() => { setClickedRegion(null); setOrganExplanation(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--charcoal)', fontSize: '1rem' }}>✕</button>
              </div>
              {loadingOrgan ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--charcoal)', fontSize: '0.85rem' }}>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  {t("clinician.aiAnalyzing")}
                </div>
              ) : organExplanation ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.6 }}>
                  {organExplanation.split('\n').map((line, i) => {
                    if (!line.trim()) return <div key={i} style={{ height: 4 }} />;
                    const parts = line.split(/(\*\*.*?\*\*)/g);
                    return (
                      <div key={i} style={{ marginBottom: '0.4rem', paddingLeft: line.startsWith('-') ? '0.5rem' : 0 }}>
                        {parts.map((p, j) => p.startsWith('**') && p.endsWith('**') ? <strong key={j} style={{ color: 'var(--primary)' }}>{p.slice(2, -2)}</strong> : p)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--charcoal)', lineHeight: 1.5 }}>{getBodyPartInfo(clickedRegion, t).desc}</div>
              )}
            </div>
          ) : hoveredRegion && getBodyPartInfo(hoveredRegion, t) ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: getRegionEffect(hoveredRegion) ? (getRegionEffect(hoveredRegion) === 'good' ? '#22c55e' : '#ef4444') : 'var(--foreground)' }}>
                  {getBodyPartInfo(hoveredRegion, t).label} {getRegionEffect(hoveredRegion) === 'good' ? '✓' : getRegionEffect(hoveredRegion) === 'bad' ? '⚠' : ''}
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--charcoal)', lineHeight: 1.5 }}>
                {getRegionShort(hoveredRegion) || getBodyPartInfo(hoveredRegion, t).desc}
              </div>
              {getRegionEffect(hoveredRegion) && (
                <div style={{
                  marginTop: '0.7rem', display: 'inline-block', fontSize: '0.75rem', fontWeight: 700,
                  padding: '0.25rem 0.75rem', borderRadius: 20,
                  background: getRegionEffect(hoveredRegion) === 'good' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                  color: getRegionEffect(hoveredRegion) === 'good' ? '#22c55e' : '#ef4444',
                  border: `1px solid ${getRegionEffect(hoveredRegion) === 'good' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
                }}>
                  {getRegionEffect(hoveredRegion) === 'good' ? t('clinician.beneficialForOrgan') : t('clinician.monitorOrganClosely')}
                </div>
              )}
              {!getRegionEffect(hoveredRegion) && (
                <div style={{
                  marginTop: '0.7rem', display: 'inline-block', fontSize: '0.75rem', fontWeight: 600,
                  padding: '0.25rem 0.75rem', borderRadius: 20,
                  background: 'rgba(148,163,184,0.1)',
                  color: 'var(--foreground-muted)',
                }}>
                  {t('clinician.unaffectedBy')} {medication || t('clinician.currentRegimen')}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.35rem', color: 'var(--charcoal)', fontSize: '0.8rem', textAlign: 'center', minHeight: 72 }}>
              <span style={{ fontSize: '1.5rem' }}>🫀</span>
              {t('clinician.hoverOrgan')} {' '}
              <strong style={{ color: 'var(--foreground)' }}>{medication || t('clinician.intervention')}</strong>
            </div>
          )}
        </div>

        {!noEffects && (
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>{t('clinician.drugImpactMap')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {Object.entries(effects).map(([part, fx]) => (
                <div key={part} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.8rem', borderRadius: 8, background: fx.effect === 'good' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${fx.effect === 'good' ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)'}` }}>
                  <span style={{ fontSize: '0.9rem' }}>{fx.effect === 'good' ? '✓' : '⚠'}</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: fx.effect === 'good' ? '#22c55e' : '#ef4444' }}>{getBodyPartInfo(part, t)?.label || part}</span>
                    {fx.short && <span style={{ fontSize: '0.75rem', color: 'var(--charcoal)' }}>{fx.short}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Mannequin SVG ── */}
      <div className="body-viz-svg" style={{ position: 'relative' }}>
        <svg viewBox="0 0 200 500" width="180" height="450" style={{ filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.12))', overflow: 'visible' }}>
          
          {/* Continuous Body Outline Background */}
          <path d="M 100 15
                   C 115 15, 122 25, 122 40
                   C 122 55, 115 65, 110 70
                   C 125 72, 140 78, 145 90
                   L 155 240
                   C 156 250, 145 255, 140 245
                   L 130 130
                   C 132 180, 125 220, 130 260
                   L 135 480
                   C 136 490, 120 490, 115 480
                   L 105 300
                   L 100 290
                   L 95 300
                   L 85 480
                   C 80 490, 64 490, 65 480
                   L 70 260
                   C 75 220, 68 180, 70 130
                   L 60 245
                   C 55 255, 44 250, 45 240
                   L 55 90
                   C 60 78, 75 72, 90 70
                   C 85 65, 78 55, 78 40
                   C 78 25, 85 15, 100 15 Z"
                fill="rgba(148,163,184,0.04)" stroke="rgba(148,163,184,0.3)" strokeWidth="1.5" />

          {/* Brain */}
          <ellipse cx="100" cy="38" rx="14" ry="17" {...hp('brain')} />

          {/* Nervous System (Spine & Nerves) */}
          <g {...hp('nerves')}>
            <path d="M 100 55 L 100 280" fill="none" strokeWidth="2" strokeDasharray="3 3" />
            <path d="M 100 110 L 115 120 M 100 110 L 85 120 M 100 160 L 120 170 M 100 160 L 80 170" fill="none" strokeWidth="1.5" />
          </g>

          {/* Lungs */}
          <g {...hp('lungs')}>
            <path d="M 95 85 C 70 80, 65 110, 70 135 C 85 140, 95 125, 95 110 Z" />
            <path d="M 105 85 C 130 80, 135 110, 130 135 C 115 140, 105 125, 105 110 Z" />
          </g>

          {/* Heart */}
          <path d="M 100 105 C 110 95, 120 105, 110 115 L 100 125 L 90 115 C 80 105, 90 95, 100 105 Z" {...hp('heart')} />

          {/* Liver */}
          <path d="M 75 140 C 75 130, 105 130, 115 140 C 120 150, 105 160, 75 155 Z" {...hp('liver')} />

          {/* Stomach */}
          <path d="M 115 145 C 130 140, 135 150, 125 165 C 110 175, 105 160, 115 145 Z" {...hp('stomach')} />

          {/* Kidneys */}
          <g {...hp('kidneys')}>
            <path d="M 85 170 C 85 155, 95 155, 95 170 C 95 185, 85 185, 85 170 Z" />
            <path d="M 105 170 C 105 155, 115 155, 115 170 C 115 185, 105 185, 105 170 Z" />
          </g>

          {/* Bladder */}
          <path d="M 100 230 C 115 230, 115 245, 100 250 C 85 245, 85 230, 100 230 Z" {...hp('bladder')} />

          {/* Vessels */}
          <g {...hp('vessels')}>
            {/* Arms */}
            <path d="M 115 105 L 125 150 L 140 220" fill="none" strokeWidth="2" strokeLinecap="round" />
            <path d="M 85 105 L 75 150 L 60 220" fill="none" strokeWidth="2" strokeLinecap="round" />
            {/* Legs */}
            <path d="M 105 280 L 115 360 L 122 450" fill="none" strokeWidth="2" strokeLinecap="round" />
            <path d="M 95 280 L 85 360 L 78 450" fill="none" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Muscles (Thighs and Biceps representation) */}
          <g {...hp('muscles')}>
            <ellipse cx="120" cy="330" rx="8" ry="30" />
            <ellipse cx="80" cy="330" rx="8" ry="30" />
            <ellipse cx="132" cy="140" rx="5" ry="15" />
            <ellipse cx="68" cy="140" rx="5" ry="15" />
          </g>
          
        </svg>

        {noEffects && (
          <p style={{ position: 'absolute', bottom: -30, left: '50%', transform: 'translateX(-50%)', fontSize: '0.8rem', color: 'var(--charcoal)', whiteSpace: 'nowrap' }}>
            {t('clinician.noRecognisedDrug')}
          </p>
        )}
      </div>
      </div>
    </div>
  );
}

// ─── Glass Box Panel ──────────────────────────────────────────────────────────
function GlassBoxPanel({ entries }: { entries: GlassBoxEntry[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const { t } = useLanguage();

  const statusIcon = (s: string) => {
    if (s === 'success') return <CheckCircle size={14} color="#4ade80" />;
    if (s === 'error')   return <XCircle size={14} color="#ef4444" />;
    return <SkipForward size={14} color="#94a3b8" />;
  };
  const statusColor = (s: string) => s === 'success' ? '#4ade80' : s === 'error' ? '#ef4444' : '#94a3b8';

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid rgba(165,216,255,0.12)',
      borderRadius: 12,
      fontFamily: '"Courier New", Courier, monospace',
      overflow: 'hidden',
    }}>
      {/* Terminal header bar */}
      <div style={{ background: '#161b22', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ marginLeft: '0.75rem', color: '#94a3b8', fontSize: '0.78rem' }}>nalam-agent-console — glass-box-view</span>
      </div>

      <div style={{ padding: '0.75rem' }}>
        {/* Boot line */}
        <div style={{ color: '#4ade80', fontSize: '0.78rem', marginBottom: '0.75rem', padding: '0.25rem 0' }}>
          <span style={{ color: '#94a3b8' }}>$ </span>
          nalam-orchestrator --trace-agents --verbose
        </div>

        {entries.map((entry, i) => (
          <div key={i} className="slide-up" style={{
            marginBottom: '0.5rem',
            border: `1px solid rgba(${entry.status === 'success' ? '74,222,128' : entry.status === 'error' ? '239,68,68' : '100,116,139'},0.15)`,
            borderRadius: 8,
            overflow: 'hidden',
            animationDelay: `${i * 0.08}s`,
          }}>
            {/* Entry header */}
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.02)', border: 'none',
                padding: '0.6rem 0.85rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left',
              }}
            >
              <span style={{ color: '#475569', fontSize: '0.75rem', minWidth: 24 }}>#{entry.step}</span>
              {statusIcon(entry.status)}
              <span style={{ color: statusColor(entry.status), fontSize: '0.82rem', fontWeight: 600, flex: 1 }}>
                {entry.agentName}
              </span>
              <span style={{ color: '#475569', fontSize: '0.72rem', marginRight: '0.5rem' }}>
                {entry.model}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#64748b', fontSize: '0.72rem' }}>
                <Clock size={11} />
                {entry.durationMs}ms
              </span>
            </button>

            {/* Expanded details */}
            {expanded === i && (
              <div style={{ padding: '0.75rem 0.85rem', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Timestamp */}
                <div style={{ fontSize: '0.7rem', color: '#475569' }}>
                  {t('clinician.executedAt')} {new Date(entry.timestamp).toLocaleTimeString()}
                </div>
                {/* Input */}
                <div>
                  <div style={{ color: '#a5d8ff', fontSize: '0.72rem', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>► {t('clinician.inputFeatures')}</div>
                  <pre style={{ color: '#94a3b8', fontSize: '0.72rem', overflow: 'auto', maxHeight: 140, lineHeight: 1.6, margin: 0 }}>
                    {JSON.stringify(entry.inputSummary, null, 2)}
                  </pre>
                </div>
                {/* Output */}
                <div>
                  <div style={{ color: statusColor(entry.status), fontSize: '0.72rem', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>◄ {t('clinician.output')}</div>
                  <pre style={{ color: '#cbd5e1', fontSize: '0.72rem', overflow: 'auto', maxHeight: 140, lineHeight: 1.6, margin: 0 }}>
                    {typeof entry.output === 'string' ? entry.output : JSON.stringify(entry.output, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Footer timing summary */}
        {entries.length > 0 && (
          <div style={{ marginTop: '0.5rem', color: '#4ade80', fontSize: '0.75rem', padding: '0.25rem 0' }}>
            ✓ {t('clinician.agentSwarmCompleted')} · {t('clinician.total')}: {entries.reduce((s, e) => s + e.durationMs, 0).toFixed(0)}ms ·{' '}
            {entries.filter(e => e.status === 'success').length}/{entries.length} {t('clinician.agentsSucceeded')}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClinicianPortal() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [patientId, setPatientId]         = useState('');
  const [patientSearchInput, setPatientSearchInput] = useState('');
  const [patientSearchError, setPatientSearchError] = useState<string | null>(null);
  const [role, setRole]                   = useState<'specialist' | 'emergency' | 'research'>('specialist');
  const [doctorId, setDoctorId]           = useState<string>('');
  const [doctorName, setDoctorName]       = useState<string>('');
  const [allPatients, setAllPatients]     = useState<any[]>([]);
  const [data, setData]                       = useState<any>(null);
  const [error, setError]                     = useState<string | null>(null);
  const [simulation, setSimulation]           = useState<any>(null);
  const [biography, setBiography]             = useState<string>('');
  const [loadingBio, setLoadingBio]           = useState(false);
  const [loadingContext, setLoadingContext]    = useState(false);
  const [loadingSimulation, setLoadingSimulation] = useState(false);
  const [showGlassBox, setShowGlassBox]       = useState(false);
  const [glassBoxLogs, setGlassBoxLogs]       = useState<GlassBoxEntry[]>([]);
  const [selectedMed, setSelectedMed]         = useState('');
  const [selectedDosage, setSelectedDosage]   = useState('');
  const [manualMed, setManualMed]             = useState('');
  const [simTab, setSimTab]                   = useState<'data' | 'visual'>('data');
  
  // Appointments State
  const [showAppointments, setShowAppointments] = useState(false);
  const [appointments, setAppointments]         = useState<any[]>([]);
  const [aptLoading, setAptLoading]             = useState(false);
  const [aptProcessing, setAptProcessing]       = useState<string | null>(null);
  const [sortApt, setSortApt]                   = useState<'newest' | 'oldest' | 'upcoming' | 'past'>('newest');

  const [rescheduleApt, setRescheduleApt] = useState<any>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);
  
  const [showContextOtpModal, setShowContextOtpModal] = useState(false);
  const [pendingContextPatientId, setPendingContextPatientId] = useState('');
  const [savingSession, setSavingSession] = useState(false);

  // Intake State
  const [routedIntakes, setRoutedIntakes] = useState<any[]>([]);
  const [intakeDetailOpen, setIntakeDetailOpen] = useState(false);
  const [selectedIntake, setSelectedIntake] = useState<any>(null);
  const [intakeDetailLoading, setIntakeDetailLoading] = useState<string | false>(false);
  const [intakeProcessing, setIntakeProcessing] = useState<string | null>(null);
  const [intakeToast, setIntakeToast] = useState<any | null>(null);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [pastIntakes, setPastIntakes] = useState<any[]>([]);
  const knownRoutedIds = useRef<Set<string>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRoutedIntakes = useCallback(async () => {
    try {
      const docId = sessionStorage.getItem('nalamStaffId') || localStorage.getItem('nalamStaffId') || '';
      if (!docId) return;
      const [activeRes, pastRes] = await Promise.all([
        apiFetch(`/api/intake?role=doctor&doctorId=${docId}`, { skipCache: true }),
        apiFetch(`/api/intake?role=doctor&doctorId=${docId}&past=1`, { skipCache: true }),
      ]);
      if (activeRes.ok) {
        const data = await activeRes.json();
        const intakes: any[] = Array.isArray(data) ? data : [];
        // Detect newly routed intakes and show toast
        intakes.forEach(intake => {
          if (!knownRoutedIds.current.has(intake.id)) {
            knownRoutedIds.current.add(intake.id);
            // Only show toast for intakes that aren't freshly loaded (i.e., after bootstrap)
            if (knownRoutedIds.current.size > 1 || routedIntakes.length === 0) {
              setIntakeToast(intake);
              if (toastTimer.current) clearTimeout(toastTimer.current);
              toastTimer.current = setTimeout(() => setIntakeToast(null), 12000);
            }
          }
        });
        setRoutedIntakes(intakes);
      }
      if (pastRes.ok) {
        const pastData = await pastRes.json();
        setPastIntakes(Array.isArray(pastData) ? pastData : []);
      }
    } catch {}
  }, [routedIntakes.length]);

  // Bootstrap known IDs on first load without showing toast
  const bootstrapRef = useRef(false);
  useEffect(() => {
    const bootstrap = async () => {
      const docId = sessionStorage.getItem('nalamStaffId') || localStorage.getItem('nalamStaffId') || '';
      if (!docId) return;
      const res = await apiFetch(`/api/intake?role=doctor&doctorId=${docId}`, { skipCache: true });
      if (res.ok) {
        const data = await res.json();
        const intakes: any[] = Array.isArray(data) ? data : [];
        intakes.forEach(i => knownRoutedIds.current.add(i.id));
        setRoutedIntakes(intakes);
      }
      const pastRes = await apiFetch(`/api/intake?role=doctor&doctorId=${docId}&past=1`, { skipCache: true });
      if (pastRes.ok) {
        const pastData = await pastRes.json();
        setPastIntakes(Array.isArray(pastData) ? pastData : []);
      }
      bootstrapRef.current = true;
      // Start polling after bootstrap
      const iv = setInterval(async () => {
        const docId2 = sessionStorage.getItem('nalamStaffId') || localStorage.getItem('nalamStaffId') || '';
        if (!docId2) return;
        const [r, pr] = await Promise.all([
          apiFetch(`/api/intake?role=doctor&doctorId=${docId2}`, { skipCache: true }),
          apiFetch(`/api/intake?role=doctor&doctorId=${docId2}&past=1`, { skipCache: true }),
        ]);
        if (r.ok) {
          const d = await r.json();
          const active: any[] = Array.isArray(d) ? d : [];
          active.forEach(intake => {
            if (!knownRoutedIds.current.has(intake.id)) {
              knownRoutedIds.current.add(intake.id);
              setIntakeToast(intake);
              if (toastTimer.current) clearTimeout(toastTimer.current);
              toastTimer.current = setTimeout(() => setIntakeToast(null), 12000);
            }
          });
          setRoutedIntakes(active);
        }
        if (pr.ok) {
          const pd = await pr.json();
          setPastIntakes(Array.isArray(pd) ? pd : []);
        }
      }, 5000);
      return () => clearInterval(iv);
    };
    bootstrap();
  }, []);

  const clearIntake = async (id: string, patientId: string) => {
    setIntakeProcessing(id);
    try {
      await apiFetch(`/api/intake/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'clear' }) });
      await fetchRoutedIntakes();
      setPatientSearchInput(patientId);
      requestContext(); // auto-load the patient Context
      setIntakeDetailOpen(false);
    } finally { setIntakeProcessing(null); }
  };

  // Fetch decrypted intake detail before opening the modal
  const viewIntakeDetails = async (intakeOrId: any) => {
    const id = typeof intakeOrId === 'string' ? intakeOrId : intakeOrId.id;
    setIntakeDetailLoading(id);
    try {
      const res = await apiFetch(`/api/intake/${id}`, { skipCache: true });
      if (res.ok) {
        const decrypted = await res.json();
        setSelectedIntake(decrypted);
      } else {
        // Fallback: use raw list item (will show encrypted, but better than nothing)
        if (typeof intakeOrId === 'object') setSelectedIntake(intakeOrId);
      }
    } catch {
      if (typeof intakeOrId === 'object') setSelectedIntake(intakeOrId);
    }
    setIntakeDetailLoading(false);
    setIntakeDetailOpen(true);
  };

  const fetchAppointments = useCallback(async () => {
    setAptLoading(true);
    try {
      // Only use nalamStaffId if the stored role is clinician — prevents stale P001 patient ID
      const storedRole = sessionStorage.getItem('nalamRole') || localStorage.getItem('nalamRole');
      const docId = storedRole === 'clinician'
        ? (sessionStorage.getItem('nalamStaffId') || localStorage.getItem('nalamStaffId') || '')
        : '';
      if (!docId) { setAptLoading(false); return; }
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/appointments?doctorId=${docId}`);
      if (res.ok) setAppointments(await res.json());
    } catch {} finally { setAptLoading(false); }
  }, [role]);

  const handleAptAction = async (id: string, status: string, payload?: any) => {
    setAptProcessing(id);
    try {
      await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/appointments`, {
        method: 'PATCH',
        body: JSON.stringify({ id, status, ...payload }),
      });
      await fetchAppointments();
      if (status === 'pending_reschedule') setRescheduleApt(null);
    } finally { setAptProcessing(null); }
  };

  // Navigator State
  const [navDisease, setNavDisease]           = useState('');
  const [navManualDisease, setNavManualDisease] = useState('');
  const [navTab, setNavTab]                   = useState<'symptoms' | 'protocol' | 'medicine'>('symptoms');
  const [navResult, setNavResult]             = useState<any>(null);
  const [loadingNav, setLoadingNav]           = useState(false);

  const selectedMedObj = MEDICATIONS.find(m => m.name === selectedMed);
  const medicationInput = selectedMed === 'Other (type below)' ? manualMed
    : (selectedMed && selectedDosage) ? `${selectedMed} ${selectedDosage}` 
    : selectedMed ? selectedMed : manualMed;

  useEffect(() => {
    // Check if session is valid
    apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/me`)
      .then(res => {
        if (!res.ok) {
          router.push('/');
        }
      })
      .catch(() => router.push('/'));

    // Read the logged-in doctor's id, name, and clinician role from sessionStorage or localStorage
    const storedStaffId = sessionStorage.getItem('nalamStaffId') || localStorage.getItem('nalamStaffId') || '';
    const storedDoctorName = sessionStorage.getItem('nalamDoctorName') || localStorage.getItem('nalamDoctorName') || '';
    const storedClinicianRole = (sessionStorage.getItem('nalamClinicianRole') || localStorage.getItem('nalamClinicianRole')) as 'specialist' | 'emergency' | 'research' | null;
    if (storedStaffId) setDoctorId(storedStaffId);
    if (storedDoctorName) setDoctorName(storedDoctorName);
    if (storedClinicianRole) setRole(storedClinicianRole);

    fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/patient?id=ALL`)
      .then(r => r.json())
      .then(d => { if (d.patients) setAllPatients(d.patients); })
      .catch(() => {});
      
    fetchAppointments();
  }, [fetchAppointments]);

  const requestContext = async () => {
    setError(null); setData(null); setSimulation(null); setGlassBoxLogs([]); setBiography('');
    setPatientSearchError(null);
    
    if (!patientSearchInput.trim()) {
      setPatientSearchError(t('clinician.enterPatientId'));
      return;
    }
    
    setLoadingContext(true);
    const clinicianName = role === 'emergency' ? 'Dr. Dhanush (ER Attending)' : role === 'research' ? 'BioPharm Research Lab' : 'Dr. Monissha (Cardiology)';
    
    try {
      // First validate patient exists
      const validateRes = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/patient?id=${patientSearchInput}`);
      if (!validateRes.ok) {
        const errorData = await validateRes.json();
        setPatientSearchError(errorData.error || t('clinician.patientNotFound'));
        setLoadingContext(false);
        return;
      }
      
      const validateData = await validateRes.json();
      if (!validateData.patient) {
        setPatientSearchError(t('clinician.patientNotFound'));
        setLoadingContext(false);
        return;
      }
      
      // Patient exists, proceed with context request
      if (data && patientId && patientId !== patientSearchInput) {
        // Auto-save previous session if switching context
        try {
          await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chatbot/save-conversation`, {
            method: 'POST',
            body: JSON.stringify({ patientId })
          });
        } catch (e) {
          console.error('Failed to auto-save previous session', e);
        }
      }

      setPendingContextPatientId(patientSearchInput);
      setShowContextOtpModal(true);
      setLoadingContext(false);
    } catch { 
      setError(t('clinician.failedToCommunicate'));
      setLoadingContext(false); 
    }
  };

  const fetchContextData = async (targetPatientId: string) => {
    setShowContextOtpModal(false);
    setLoadingContext(true);
    setPatientId(targetPatientId);
    const clinicianName = role === 'emergency' ? 'Dr. Dhanush (ER Attending)' : role === 'research' ? 'BioPharm Research Lab' : 'Dr. Monissha (Cardiology)';

    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/clinician/request-context?id=${targetPatientId}&contextType=${role}&clinician=${encodeURIComponent(clinicianName)}&lang=${lang}`);
      const result = await res.json();
      if (!res.ok) { setError(result.error); }
      else {
        setData(result.data);
        setLoadingBio(true);
        try {
          const br = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/agents/biographer`, { method: 'POST', body: JSON.stringify({ patient: result.data.patient, records: result.data.records, role, lang }) });
          const bd = await br.json();
          setBiography(bd.summary || '');
          if (bd.glassBox) setGlassBoxLogs(prev => [...prev, ...bd.glassBox]);
        } catch { setBiography(t('clinician.unableToGenerateSynth')); }
        finally { setLoadingBio(false); }
      }
    } catch { setError(t('clinician.failedToCommunicate')); }
    finally { setLoadingContext(false); }
  };

  const saveAndCloseSession = async () => {
    if (!data || !patientId) return;
    setSavingSession(true);
    try {
      await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chatbot/save-conversation`, {
        method: 'POST',
        body: JSON.stringify({ patientId })
      });
      alert(t('clinician.sessionSaved'));
      setData(null);
      setPatientId('');
      setPatientSearchInput('');
      setBiography('');
      setSimulation(null);
      setNavDisease('');
      setNavManualDisease('');
      setNavTab('symptoms');
      setNavResult(null);
      setLoadingNav(false);
      clearChatbotContext();
    } catch (e) {
      alert(t('clinician.sessionSaveFailed'));
    } finally {
      setSavingSession(false);
    }
  };

  // Clear chatbot conversation when patient context changes
  const clearChatbotContext = () => {
    // This will be called when a new patient context is approved
    // The chatbot component should handle this by starting a new conversation
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clearChatbotContext'));
    }
  };

  // Notify chatbot of approved patient context
  const notifyChatbotOfPatientContext = (patientId: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('patientContextApproved', { detail: { patientId } }));
    }
  };

  // Call these when patient context is approved
  useEffect(() => {
    if (data) {
      clearChatbotContext();
      notifyChatbotOfPatientContext(patientId);
    }
  }, [data, patientId]);

  const runSimulation = async () => {
    if (!data || !medicationInput.trim()) return;
    try {
      setLoadingSimulation(true);
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/agents/twin`, {
        method: 'POST',
        body: JSON.stringify({ patient: data.patient, records: data.records, intervention: medicationInput, role, lang }),
      });
      if (!res.ok) throw new Error('Simulation failed');
      const result = await res.json();
      setSimulation(result);

      if (result.glassBox) setGlassBoxLogs(prev => [...prev, ...result.glassBox]);
    } catch { setSimulation(null); }
    finally { setLoadingSimulation(false); }
  };

  const runNavigator = async () => {
    const finalDisease = navDisease === 'others' ? navManualDisease : navDisease;
    if (!finalDisease.trim()) return;

    setLoadingNav(true);
    setNavResult(null);
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/agents/disease-navigator`, {
        method: 'POST',
        body: JSON.stringify({
          disease: finalDisease,
          patient: data?.patient || null,
          records: data?.records || null,
          lang
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setNavResult(result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingNav(false);
    }
  };

  const handlePrescriptionUpload = async (prescription: any) => {
    const { t } = useLanguage();
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/prescriptions`, {
        method: 'POST',
        body: JSON.stringify(prescription),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to upload prescription');
      }
      alert(t('clinician.prescriptionUploaded'));
      setShowPrescription(false);
    } catch (error) {
      console.error('Prescription upload error:', error);
      throw error;
    }
  };

    const bpHistory = data ? buildBpHistory(data.records) : [];
  const latestDate = bpHistory.length > 0 ? bpHistory[bpHistory.length - 1].date : '';

  useEffect(() => {
    // If language changes and we already have data loaded, auto-refetch the text-heavy AI calls
    if (data) {
      // Refetch the records timeline
      const clinicianName = role === 'emergency' ? 'Dr. Dhanush (ER Attending)' : role === 'research' ? 'BioPharm Research Lab' : 'Dr. Monissha (Cardiology)';
      apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/clinician/request-context?id=${patientId}&contextType=${role}&clinician=${encodeURIComponent(clinicianName)}&lang=${lang}`)
        .then(r => r.json())
        .then(result => { if (result.data) setData(result.data); })
        .catch(() => {});

      const fetchBio = async () => {
        setLoadingBio(true);
        try {
          const r = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/agents/biographer`, { method: 'POST', body: JSON.stringify({ patient: data.patient, records: data.records, role, lang }) });
          const bd = await r.json();
          setBiography(bd.summary || '');
        } catch {} finally { setLoadingBio(false); }
      };
      fetchBio();
    }
    if (simulation) {
      const fetchSim = async () => {
        setLoadingSimulation(true);
        try {
          const r = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/agents/twin`, {
            method: 'POST',
            body: JSON.stringify({ patient: data.patient, records: data.records, intervention: medicationInput, role, lang }),
          });
          setSimulation(await r.json());
        } catch {} finally { setLoadingSimulation(false); }
      };
      fetchSim();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const getDaysAgo = (dateStr: string) => {
    if (!latestDate || !dateStr) return `${t('clinician.day')} 0`;
    const d1 = new Date(dateStr);
    const d2 = new Date(latestDate);
    const diffTime = d1.getTime() - d2.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 0 ? `${t('clinician.day')} 0` : `${t('clinician.day')} ${diffDays}`;
  };

  const bpPrediction = simulation ? buildPrediction(bpHistory, medicationInput, t) : [];
  const allChartData = [
    ...bpHistory.map(d => ({ date: getDaysAgo(d.date), systolic: d.systolic, predicted: undefined })),
    ...(bpPrediction.length > 0 && bpHistory.length > 0
      ? [{ date: `${t('clinician.day')} 0`, systolic: bpHistory[bpHistory.length - 1].systolic, predicted: bpHistory[bpHistory.length - 1].systolic }]
      : []),
    ...bpPrediction.map(d => ({ date: d.date, systolic: undefined, predicted: d.predicted })),
  ];

  return (
    <>
      <div className="container fade-in">
        {/* Page Header */}
        <div className="slide-up stagger-1" style={{ marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.15rem', lineHeight: 1.2 }}>
            {doctorName ? `${t('clinician.welcome')} ${doctorName}` : t('clinician.title')}
          </h2>
          <p style={{ color: 'var(--accent-teal)', fontSize: '0.82rem' }}>{t('clinician.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {glassBoxLogs.length > 0 && (
          <button
            className="glass-button"
            onClick={() => setShowGlassBox(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: showGlassBox ? '#4ade80' : 'var(--primary)', color: showGlassBox ? '#4ade80' : 'var(--primary)', fontSize: '0.8rem' }}
          >
            {showGlassBox ? <EyeOff size={14} /> : <Eye size={14} />}
            {showGlassBox ? t('clinician.hideGlassBox') : t('clinician.viewGlassBox')}
            <span style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', borderRadius: 9999, padding: '0 5px', fontSize: '0.7rem' }}>
              {glassBoxLogs.length}
            </span>
          </button>
        )}
        {/* Notifications Button */}
        <button
          className="glass-button"
          onClick={() => setShowNotificationsPanel(p => !p)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', position: 'relative', background: showNotificationsPanel ? 'var(--primary)' : 'var(--surface)', color: showNotificationsPanel ? 'white' : 'var(--primary)', fontSize: '0.8rem' }}
        >
          <Bell size={14} /> Notifications
          {routedIntakes.length > 0 && (
            <span style={{ minWidth: 18, height: 18, borderRadius: 9999, background: '#ef4444', color: 'white', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
              {routedIntakes.length}
            </span>
          )}
        </button>
        <button
          className="glass-button"
          onClick={() => { setShowAppointments(p => !p); if (!showAppointments) fetchAppointments(); }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: showAppointments ? 'var(--primary)' : 'var(--surface)', color: showAppointments ? 'white' : 'var(--primary)', fontSize: '0.8rem' }}
        >
          <Clock size={14} /> {showAppointments ? t('clinician.hideApts') : t('clinician.appointments')}
          {appointments.length > 0 && !showAppointments && (
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-orange)' }} />
          )}
        </button>
        </div>
      </div>

      {/* ── Intake Toast Notification (bottom-right) ── */}
      {intakeToast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 10000,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16, padding: '1rem 1.25rem',
          boxShadow: '0 8px 32px rgba(0,82,165,0.4)',
          display: 'flex', alignItems: 'flex-start', gap: '0.85rem',
          maxWidth: 340, animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <div style={{ fontSize: 28, flexShrink: 0 }}>🏥</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: 'var(--foreground)', fontSize: '0.9rem', marginBottom: '0.2rem' }}>New Intake Summary Routed</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)', marginBottom: '0.65rem' }}>
              Patient symptoms have been submitted and routed to you. Tap to review.
            </div>
            <button
              onClick={() => { viewIntakeDetails(intakeToast); setIntakeToast(null); }}
              style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
            >View Intake</button>
          </div>
          <button onClick={() => setIntakeToast(null)} style={{ background: 'none', border: 'none', color: 'var(--foreground-muted)', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Notifications Panel ── */}
      {showNotificationsPanel && (
        <div className="glass-panel slide-up" style={{ marginBottom: '1.5rem', border: '1.5px solid rgba(0,82,165,0.2)', background: 'rgba(0,82,165,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--deep-blue)', fontSize: '0.95rem' }}>
              <BellRing size={16} /> Intake Notifications
            </h3>
            <button onClick={() => setShowNotificationsPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--charcoal)' }}><X size={16} /></button>
          </div>

          {routedIntakes.length === 0 && pastIntakes.length === 0 ? (
            <p style={{ color: 'var(--charcoal)', fontSize: '0.88rem', textAlign: 'center', padding: '1.5rem 0' }}>No intake notifications yet.</p>
          ) : (
            <>
              {routedIntakes.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Active ({routedIntakes.length})</div>
                  {routedIntakes.map(intake => (
                    <div key={intake.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.9rem 1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <ClipboardList size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--deep-blue)' }}>Patient Intake Submitted</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--charcoal)' }}>{new Date(intake.updated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <button
                        onClick={() => { viewIntakeDetails(intake); setShowNotificationsPanel(false); }}
                        style={{ padding: '0.35rem 0.8rem', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                      >{lang === 'ta' ? 'மதிப்பாய்வு' : 'Review'}</button>
                    </div>
                  ))}
                </div>
              )}
              {pastIntakes.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Past / Cleared ({pastIntakes.length})</div>
                  {pastIntakes.map(intake => (
                    <div key={intake.id} style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.9rem 1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: 0.7 }}>
                      <ClipboardList size={20} color="var(--charcoal)" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--foreground)' }}>Intake Cleared</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--charcoal)' }}>{new Date(intake.updated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <button
                        onClick={() => { viewIntakeDetails(intake); setShowNotificationsPanel(false); }}
                        style={{ padding: '0.35rem 0.8rem', borderRadius: 8, background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--charcoal)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}
                      >{lang === 'ta' ? 'மதிப்பாய்வு' : 'Review'}</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Appointments Panel */}
      {showAppointments && (
        <div className="glass-panel slide-up" style={{ marginBottom: '1.5rem', background: 'rgba(0,82,165,0.03)', border: '1.5px solid rgba(0,82,165,0.15)' }}>
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--deep-blue)' }}>{t('clinician.myAppointments')}</h3>
            <button onClick={fetchAppointments} className="glass-button" style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>{t('clinician.refresh')}</button>
          </div>

          {/* Sort Bar */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
            <ArrowUpDown size={14} color="var(--foreground-muted)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground-muted)' }}>{t('clinician.sort')}</span>
            {(['newest', 'oldest', 'upcoming', 'past'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setSortApt(opt)}
                style={{ padding: '0.3rem 0.75rem', borderRadius: 20, border: `1.5px solid ${sortApt === opt ? 'var(--primary)' : 'var(--border)'}`, background: sortApt === opt ? 'var(--primary)' : 'var(--surface)', color: sortApt === opt ? 'white' : 'var(--foreground)', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', textTransform: 'capitalize' }}
              >
                {opt === 'newest' ? t('clinician.newestFirst') : opt === 'oldest' ? t('clinician.oldestFirst') : opt === 'upcoming' ? t('clinician.upcoming') : t('clinician.past')}
              </button>
            ))}
          </div>

          {aptLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--charcoal)' }}>{t('clinician.loadingAppointments')}</div>
          ) : appointments.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--charcoal)' }}>{t('clinician.noAppointments')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                let arr = [...appointments];
                if (sortApt === 'newest') arr.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                else if (sortApt === 'oldest') arr.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                else if (sortApt === 'upcoming') arr = arr.filter(a => a.date >= today).sort((a,b) => a.date.localeCompare(b.date));
                else if (sortApt === 'past') arr = arr.filter(a => a.date < today).sort((a,b) => b.date.localeCompare(a.date));

                if (arr.length === 0) return <p style={{ color: 'var(--charcoal)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>{t('clinician.noSortAppointments').replace('{sortApt}', sortApt)}</p>;

                return arr.map(apt => {
                  const stColors: Record<string, string> = { approved: 'var(--primary)', scheduled: 'var(--accent-green)', reschedule_accepted: 'var(--accent-green)', rejected: 'var(--accent-red)', cancelled: 'var(--foreground-muted)', reschedule_patient_rejected: 'var(--foreground-muted)', pending_reschedule: 'var(--accent-amber)' };
                  const stBgs: Record<string, string> = { approved: 'var(--primary-light)', scheduled: 'rgba(34,197,94,0.12)', reschedule_accepted: 'rgba(34,197,94,0.12)', rejected: 'var(--accent-red-bg)', cancelled: 'var(--surface-muted)', reschedule_patient_rejected: 'var(--surface-muted)', pending_reschedule: 'rgba(251,191,36,0.12)' };
                  const stColor = stColors[apt.status] || 'var(--accent-amber)';
                  const stBg    = stBgs[apt.status] || 'rgba(251,191,36,0.12)';
                  const stLabel = apt.status === 'reschedule_patient_rejected' ? 'RESCHEDULE REJECTED' : apt.status === 'reschedule_accepted' ? 'SCHEDULED' : apt.status.replace('_', ' ').toUpperCase();
                  const isGreyed = ['reschedule_patient_rejected'].includes(apt.status);

                  return (
                    <div key={apt.id} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', opacity: isGreyed ? 0.6 : 1 }}>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: isGreyed ? 'var(--foreground-muted)' : 'var(--deep-blue)' }}>{apt.patientName}</span>
                          <span style={{ fontSize: '0.73rem', padding: '0.15rem 0.6rem', borderRadius: 20, background: apt.urgency==='Emergency'?'var(--accent-red-bg)':apt.urgency==='Urgent'?'rgba(251,191,36,0.12)':'rgba(0,151,167,0.12)', color: apt.urgency==='Emergency'?'var(--accent-red)':apt.urgency==='Urgent'?'var(--accent-amber)':'var(--accent-teal)', fontWeight: 700 }}>{apt.urgency}</span>
                          <span style={{ fontSize: '0.73rem', padding: '0.15rem 0.6rem', borderRadius: 20, background: stBg, color: stColor, fontWeight: 700 }}>{stLabel}</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--charcoal)', marginBottom: '0.75rem' }}>
                          <strong>{t('clinician.date')}</strong> {new Date(apt.date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}
                          {apt.time && <> &nbsp;|&nbsp; <strong>{t('clinician.time')}</strong> {apt.time}</>}
                          &nbsp;| <strong>{t('clinician.ref')}</strong> {apt.id}
                        </div>
                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--charcoal)', marginBottom: 2 }}>{t('clinician.patientReason')}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--foreground)' }}>{apt.reason}</div>
                        </div>
                        {apt.aiSummary && (
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>{t('clinician.aiSummary')}</div>
                            <div style={{ fontSize: '0.85rem', padding: '0.5rem', background: 'var(--primary-light)', borderRadius: 6, color: 'var(--deep-blue)' }}>{apt.aiSummary}</div>
                          </div>
                        )}
                        {apt.vitalsSnapshot && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {[['❤️','HR',`${apt.vitalsSnapshot.hr}`,'#FCA5A5'],['🫁','SpO₂',`${apt.vitalsSnapshot.spo2}%`,'#A5D8FF'],['🩸','BP',`${apt.vitalsSnapshot.sys}/${apt.vitalsSnapshot.dia}`,'#C7D2FE']].map(([em,lb,vl,cl]) => (
                              <span key={lb as string} style={{ padding: '0.2rem 0.5rem', borderRadius: 6, background: `${cl}22`, border: `1px solid ${cl}66`, fontSize: '0.75rem', fontWeight: 700 }}>{lb}: {vl}</span>
                            ))}
                          </div>
                        )}
                        {apt.patientMobile && (
                          <div style={{ marginTop: '0.75rem' }}>
                            <WhatsAppButton
                              phoneNumber={apt.patientMobile}
                              message={t('whatsapp.general')
                                .replace('{name}', apt.patientName)
                                .replace('{message}', `Regarding your appointment on ${new Date(apt.date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}${apt.time ? ` at ${apt.time}` : ''}. Ref: ${apt.id}`)}
                              label={t('clinician.contactPatient')}
                            />
                          </div>
                        )}
                      </div>
                      {apt.status === 'pending_reschedule' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#FFF8E1', padding: '0.5rem 0.85rem', borderRadius: 8, border: '1px solid #FFE082', color: '#C07A00', fontWeight: 600, fontSize: '0.8rem' }}>
                          {t('clinician.rescheduleProposed')}
                        </div>
                      ) : apt.status === 'reschedule_patient_rejected' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#F4F4F5', padding: '0.5rem 0.85rem', borderRadius: 8, border: '1px solid #D4D4D8', color: '#71717A', fontWeight: 600, fontSize: '0.8rem' }}>
                          {t('clinician.patientRejectedReschedule')}
                        </div>
                      ) : (apt.status === 'approved' || apt.status === 'scheduled') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                          {apt.status === 'approved' && (
                            <button disabled={aptProcessing === apt.id} onClick={() => handleAptAction(apt.id, 'scheduled')} style={{ padding: '0.6rem 1.25rem', borderRadius: 8, background: 'var(--accent-green)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 3px 10px rgba(34,197,94,0.3)', width: '100%' }}>
                              {aptProcessing === apt.id ? t('clinician.updating') : t('clinician.markScheduled')}
                            </button>
                          )}
                          <button disabled={aptProcessing === apt.id} onClick={() => { setRescheduleApt(apt); setRescheduleDate(''); setRescheduleTime(''); setRescheduleReason(''); }} style={{ padding: '0.5rem 1rem', borderRadius: 8, background: 'var(--surface-muted)', color: 'var(--charcoal)', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', width: '100%' }}>
                            {t('clinician.proposeReschedule')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* Patient Intakes Panel */}
      {routedIntakes.length > 0 && (
        <div className="glass-panel slide-up" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--accent-orange)' }}>
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--deep-blue)' }}>
              <AlertTriangle size={18} color="var(--accent-orange)" /> Action Required: Patient Intakes
            </h3>
            <span className="badge amber">{routedIntakes.length} Pending</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {routedIntakes.map(intake => (
              <div key={intake.id} style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--deep-blue)', marginBottom: '0.2rem' }}>Patient ID: {intake.patient_id}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--charcoal)' }}>Intake submitted on {new Date(intake.updated_at).toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => viewIntakeDetails(intake)} disabled={intakeDetailLoading === intake.id} className="glass-button" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                    {intakeDetailLoading === intake.id ? (lang === 'ta' ? 'ஏற்றுகிறது...' : 'Loading...') : (lang === 'ta' ? 'விவரங்களை மதிப்பாய்வு செய்க' : 'Review Details')}
                  </button>
                  <button
                    onClick={() => clearIntake(intake.id, intake.patient_id)}
                    disabled={intakeProcessing === intake.id}
                    className="primary-button"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'var(--accent-green)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: intakeProcessing === intake.id ? 'not-allowed' : 'pointer' }}
                  >
                    {intakeProcessing === intake.id ? 'Clearing...' : 'Clear & Load Context'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Intake Detail Modal */}
      {selectedIntake && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }}>
          <div className="glass-panel slide-up" style={{ width: '100%', maxWidth: 500, maxHeight: '85vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 16 }}>
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ color: 'var(--deep-blue)' }}>Intake Details (Patient: {selectedIntake.patient_id})</h3>
              <button onClick={() => setSelectedIntake(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--charcoal)" /></button>
            </div>
            
            <div style={{ background: 'var(--surface-muted)', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--charcoal)', marginBottom: '0.3rem', fontWeight: 600 }}>Raw Symptoms</div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--foreground)' }}>{selectedIntake.symptoms_text || 'None'}</p>
            </div>

            <h4 style={{ fontSize: '0.9rem', color: 'var(--charcoal)', marginBottom: '0.5rem' }}>Questionnaire Responses</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selectedIntake.questionnaire && Object.entries(selectedIntake.questionnaire).map(([q, a]: any, i) => (
                <div key={i} style={{ background: 'var(--surface-muted)', borderRadius: 8, padding: '0.75rem 1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--charcoal)', marginBottom: '0.2rem' }}>{q}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>{a}</div>
                </div>
              ))}
            </div>
            
            {selectedIntake.ai_summary && (
              <div style={{ marginTop: '1.5rem', background: 'rgba(0, 82, 165, 0.05)', border: '1px solid var(--primary)', borderRadius: 8, padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '0.5rem' }}>
                  <span>✨</span> AI Clinical Summary
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.5 }}>
                  {selectedIntake.ai_summary}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {showRecordsModal && data && (
        <RecordsOtpModal
          patientId={patientId}
          patientName={data.patient.name}
          requestorId={doctorId}
          requestorName={role === 'emergency' ? 'Dr. Dhanush (ER)' : 'Dr. Monissha (Cardiology)'}
          onClose={() => setShowRecordsModal(false)}
        />
      )}

      {showContextOtpModal && (
        <ContextOtpModal
          patientId={pendingContextPatientId}
          requestorName={role === 'emergency' ? 'Dr. Dhanush (ER)' : 'Dr. Monissha (Cardiology)'}
          onClose={() => setShowContextOtpModal(false)}
          onSuccess={() => fetchContextData(pendingContextPatientId)}
        />
      )}

      {rescheduleApt && (
        <RescheduleModal
          apt={rescheduleApt}
          processing={aptProcessing === rescheduleApt.id}
          onCancel={() => setRescheduleApt(null)}
          onSubmit={(date, time, reason) => handleAptAction(rescheduleApt.id, 'pending_reschedule', { rescheduleDate: date, rescheduleTime: time, rescheduleReason: reason })}
        />
      )}

      {/* Glass Box Panel */}
      {showGlassBox && glassBoxLogs.length > 0 && (
        <div className="slide-up" style={{ marginBottom: '1.5rem' }}>
          <GlassBoxPanel entries={glassBoxLogs} />
        </div>
      )}

      <div className="grid-2">
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Context Request */}
          <section className="glass-panel slide-up stagger-2" style={{ height: 'fit-content', marginTop: 0 }}>
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.92rem' }}>
              <Database size={16} color="var(--primary)" /> {t('clinician.contextRequest')}
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={patientSearchInput}
              onChange={e => setPatientSearchInput(e.target.value)}
              placeholder={t('clinician.enterPatientIdPlaceholder')}
              style={{ flex: 1, padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)', color: 'var(--foreground)', outline: 'none', minWidth: '180px', fontFamily: 'inherit' }}
              onKeyDown={e => { if(e.key === 'Enter') requestContext(); }}
            />

            <button className="glass-button" onClick={requestContext} disabled={loadingContext || !patientSearchInput.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
              {loadingContext
                ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> {t('clinician.requesting')}</>
                : t('clinician.requestAccess')}
            </button>
          </div>

          {patientSearchError && (
            <div className="fade-in" style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid var(--accent-red)', borderRadius: 8, color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <AlertTriangle size={16} /> {patientSearchError}
            </div>
          )}

          {error && (
            <div className="fade-in" style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid var(--accent-red)', borderRadius: 8, color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={16} /> {error}
            </div>
          )}

          {data && (
            <div className="slide-up" style={{ padding: '1rem', background: 'rgba(165,216,255,0.05)', borderLeft: '4px solid var(--accent-teal)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--accent-teal)' }}>
                <Unlock size={16} /> {t('clinician.contextGranted')}
              </div>
              <h4 style={{ marginBottom: '0.25rem' }}>{data.patient.name}</h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--charcoal)', marginBottom: '1rem' }}>{t('clinician.dob')}: {data.patient.dob} &nbsp;|&nbsp; {data.patient.gender}</p>
              <h5 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>{t('clinician.recentClinicalEvents')}</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {data.records.slice(0, 4).map((r: any) => (
                  <div key={r.record_id} style={{ padding: '0.5rem 0.75rem', background: 'var(--surface-muted)', borderRadius: 8, borderLeft: '2px solid var(--powder-blue)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--deep-blue)' }}>{r.diagnosis || r.type}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--charcoal)' }}>{r.date}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--charcoal)', marginTop: 2 }}>{r.provider}</div>
                    {r.lab_results && <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: 2, fontWeight: 600 }}>{r.lab_results}</div>}
                  </div>
                ))}
              </div>
              {/* View Records Button */}
              <button
                onClick={() => setShowRecordsModal(true)}
                style={{ marginTop: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, padding: '0.55rem 1rem', background: 'linear-gradient(135deg,#0052A5,#0073D9)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', width: '100%', justifyContent: 'center' }}
              >
                {t('clinician.viewPatientRecords')}
              </button>

              {/* Prescription Section */}
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #E2E8F0' }}>
                <button
                  onClick={() => setShowPrescription(!showPrescription)}
                  style={{ 
                    width: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.5rem', 
                    padding: '0.55rem 1rem', 
                    background: showPrescription ? '#F1F5F9' : 'linear-gradient(135deg,#0097A7,#00BCD4)', 
                    color: showPrescription ? '#0052A5' : 'white', 
                    border: '1px solid #E2E8F0', 
                    borderRadius: 10, 
                    fontWeight: 700, 
                    fontSize: '0.82rem', 
                    cursor: 'pointer', 
                    fontFamily: 'inherit' 
                  }}
                >
                  <FileText size={16} />
                  {showPrescription ? t('clinician.hidePrescription') : t('clinician.writePrescription')}
                </button>

                {showPrescription && (
                  <div className="slide-up" style={{ marginTop: '1rem' }}>
                    <PrescriptionTable
                      patientId={patientId}
                      patientName={data?.patient?.name || 'Patient'}
                      onUploadToRecords={handlePrescriptionUpload}
                    />
                  </div>
                )}
              </div>

              {/* Close Session */}
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #E2E8F0' }}>
                <button
                  onClick={saveAndCloseSession}
                  disabled={savingSession}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1rem',
                    background: '#FEF2F2',
                    color: '#DC2626',
                    border: '1px solid #FECACA',
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: savingSession ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  {savingSession ? t('clinician.saving') : t('clinician.saveCloseSession')}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Disease & Protocol Navigator */}
        <section className="glass-panel slide-up" style={{ borderLeft: '4px solid var(--accent-amber)' }}>
          <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--deep-blue)' }}>
                <Activity size={20} color="var(--accent-amber)" /> {t('clinician.diseaseNavigatorTitle')}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--charcoal)', marginTop: '0.2rem' }}>
                {t('clinician.diseaseNavigatorDesc')}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            <select
              value={navDisease}
              onChange={e => { setNavDisease(e.target.value); setNavResult(null); }}
              style={{ width: '100%', padding: '0.7rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)', color: 'var(--foreground)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            >
              <option value="">-- {t('clinician.selectDisease')} --</option>
              <option value="Dengue Fever">{t('disease.dengue')}</option>
              <option value="Chikungunya">{t('disease.chikungunya')}</option>
              <option value="Type-2 Diabetes">{t('disease.t2dm')}</option>
              <option value="Hypertension">{t('disease.hypertension')}</option>
              <option value="others">{t('clinician.others')}</option>
            </select>

            {navDisease === 'others' && (
              <input type="text" value={navManualDisease} onChange={e => setNavManualDisease(e.target.value)}
                placeholder={t('clinician.enterDisease')}
                style={{ width: '100%', padding: '0.7rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)', color: 'var(--foreground)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            )}

            <button className="glass-button" onClick={runNavigator} disabled={loadingNav || (!navDisease || (navDisease === 'others' && !navManualDisease))}
              style={{ borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.6rem' }}>
              {loadingNav
                ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--accent-amber)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> {t('clinician.generatingProtocol')}</>
                : `⚡ ${t('clinician.generateProtocol')}`}
            </button>
          </div>

          {navResult && (
            <div className="fade-in">
              {/* Tab Switcher */}
              <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.9rem', background: 'var(--surface-muted)', borderRadius: 10, padding: '0.28rem' }}>
                {(['symptoms', 'protocol', 'medicine'] as const).map(tab => (
                  <button key={tab} onClick={() => setNavTab(tab)}
                    style={{ flex: 1, padding: '0.42rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem', fontFamily: 'inherit', transition: 'all 0.2s',
                      background: navTab === tab ? 'var(--accent-amber)' : 'transparent',
                      color: navTab === tab ? 'white' : 'var(--foreground-muted)' }}>
                    {tab === 'symptoms' && t('clinician.tabSymptoms')}
                    {tab === 'protocol' && t('clinician.tabProtocol')}
                    {tab === 'medicine' && t('clinician.tabMedicine')}
                  </button>
                ))}
              </div>

              {navTab === 'symptoms' && (
                <div className="slide-up" style={{ background: 'var(--surface-muted)', padding: '0.9rem', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.86rem', color: 'var(--foreground)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                    {(Array.isArray(navResult.symptoms) ? navResult.symptoms.join('\n') : (navResult.symptoms || '')).split('**').map((p: string, i: number) => i % 2 === 1 ? <strong key={i} style={{ color: 'var(--primary)' }}>{p}</strong> : p)}
                  </div>
                </div>
              )}

              {navTab === 'protocol' && (
                <div className="slide-up" style={{ background: 'var(--surface-muted)', padding: '0.9rem', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.86rem', color: 'var(--foreground)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                    {(Array.isArray(navResult.protocol) ? navResult.protocol.join('\n') : (navResult.protocol || '')).split('**').map((p: string, i: number) => i % 2 === 1 ? <strong key={i} style={{ color: 'var(--primary)' }}>{p}</strong> : p)}
                  </div>
                </div>
              )}

              {navTab === 'medicine' && (
                <div className="slide-up" style={{ background: 'var(--surface-muted)', padding: '0.9rem', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.86rem', color: 'var(--foreground)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                    {(Array.isArray(navResult.medicine) ? navResult.medicine.join('\n') : (navResult.medicine || '')).split('**').map((p: string, i: number) => i % 2 === 1 ? <strong key={i} style={{ color: 'var(--primary)' }}>{p}</strong> : p)}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Twin Simulation */}
        <section className="glass-panel slide-up stagger-3" style={{
          marginTop: 0,
          opacity: data ? 1 : 0.45,
          pointerEvents: data ? 'auto' : 'none',
          transition: 'opacity 0.5s ease',
        }}>
          <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-purple)' }}>
              <Cpu size={20} /> {t('clinician.twinSimulation')}
            </h3>
            <span className="badge purple pulse-glow">{t('clinician.mlGroqPipeline')}</span>
          </div>

          <p style={{ fontSize: '0.88rem', color: 'var(--charcoal)', marginBottom: '1rem' }}>
            {t('clinician.simulationDesc')}
          </p>

          {/* Medicine Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('clinician.selectMedicine')}</label>
            <select value={selectedMed} onChange={e => { setSelectedMed(e.target.value); setSelectedDosage(''); }}
              style={{ width: '100%', padding: '0.7rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)', color: 'var(--foreground)', outline: 'none', fontFamily: 'inherit' }}>
              <option value="">— {t('clinician.chooseMedicine')} —</option>
              {MEDICATIONS.map(m => <option key={m.name} value={m.name}>{m.name === 'Other (type below)' ? t('clinician.otherTypeBelow') : m.name}</option>)}
            </select>

            {selectedMedObj && selectedMedObj.dosages.length > 0 && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.4rem' }}>{t('clinician.dosage')}</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {selectedMedObj.dosages.map(d => (
                    <button key={d} onClick={() => setSelectedDosage(d)}
                      style={{ padding: '0.35rem 0.8rem', borderRadius: 20, border: `1.5px solid ${selectedDosage === d ? 'var(--primary)' : 'var(--border)'}`, background: selectedDosage === d ? 'var(--primary-light)' : 'var(--surface-muted)', color: selectedDosage === d ? 'var(--primary)' : 'var(--charcoal)', cursor: 'pointer', fontWeight: 600, fontSize: '0.83rem', transition: 'all 0.18s', fontFamily: 'inherit' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(!selectedMed || selectedMed === 'Other (type below)') && (
              <input type="text" value={manualMed} onChange={e => setManualMed(e.target.value)}
                placeholder={t('clinician.typeInterventionPlaceholder')}
                style={{ width: '100%', padding: '0.7rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)', color: 'var(--foreground)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            )}

            {medicationInput && (
              <div style={{ padding: '0.5rem 0.85rem', background: 'var(--primary-light)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, border: '1px solid var(--glass-border)' }}>
                {t('clinician.simulating')}: <strong>{medicationInput}</strong>
              </div>
            )}

            <button className="glass-button" onClick={runSimulation} disabled={loadingSimulation || !medicationInput.trim()}
              style={{ borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {loadingSimulation
                ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--accent-purple)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> {t('clinician.simulatingLoading')}</>
                : `⚗️ ${t('clinician.runTwinSimulation')}`}
            </button>
          </div>

          {!simulation && !loadingSimulation && (
            <div className="flex-center" style={{ height: 120, background: 'var(--background)', borderRadius: 8, color: '#475569', fontSize: '0.88rem' }}>
              {t('clinician.enterInterventionPrompt')}
            </div>
          )}

          {simulation && simulation.treatmentDecision && (
            <>
              {/* Tab Switcher */}
              <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.9rem', background: 'var(--surface-muted)', borderRadius: 10, padding: '0.28rem' }}>
                {(['data', 'visual'] as const).map(tab => (
                  <button key={tab} onClick={() => setSimTab(tab)}
                    style={{ flex: 1, padding: '0.42rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem', fontFamily: 'inherit', transition: 'all 0.2s',
                      background: simTab === tab ? 'var(--primary)' : 'transparent',
                      color: simTab === tab ? 'white' : 'var(--foreground-muted)' }}>
                    {tab === 'data' ? `📊 ${t('clinician.tabData')}` : `🫀 ${t('clinician.tabVisual')}`}
                  </button>
                ))}
              </div>

              {simTab === 'data' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="slide-up stagger-1" style={{ background: 'rgba(165,216,255,0.05)', borderLeft: '4px solid var(--primary)', padding: '0.9rem', borderRadius: 8, transition: 'transform 0.2s' }}
                    onMouseOver={e => (e.currentTarget.style.transform = 'translateX(4px)')} onMouseOut={e => (e.currentTarget.style.transform = 'translateX(0)')}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', marginBottom: '0.4rem', fontSize: '0.92rem' }}>
                      <Stethoscope size={16} /> {t('clinician.betterTreatmentDecisions')}
                    </h4>
                    <div style={{ fontSize: '0.86rem', color: 'var(--foreground)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{simulation.treatmentDecision}</div>
                  </div>

                  <div className="slide-up stagger-2" style={{ background: 'var(--accent-amber-bg)', borderLeft: '4px solid var(--accent-amber)', padding: '0.9rem', borderRadius: 8, transition: 'transform 0.2s' }}
                    onMouseOver={e => (e.currentTarget.style.transform = 'translateX(4px)')} onMouseOut={e => (e.currentTarget.style.transform = 'translateX(0)')}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-amber)', marginBottom: '0.4rem', fontSize: '0.92rem' }}>
                      <AlertTriangle size={16} /> {t('clinician.riskPrediction')}
                    </h4>
                    <div style={{ fontSize: '0.86rem', color: 'var(--foreground)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{simulation.riskPrediction}</div>
                  </div>

                  <div className="slide-up stagger-3" style={{ background: 'var(--accent-teal-bg)', borderLeft: '4px solid var(--accent-teal)', padding: '0.9rem', borderRadius: 8, transition: 'transform 0.2s' }}
                    onMouseOver={e => (e.currentTarget.style.transform = 'translateX(4px)')} onMouseOut={e => (e.currentTarget.style.transform = 'translateX(0)')}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-teal)', marginBottom: '0.4rem', fontSize: '0.92rem' }}>
                      <FlaskConical size={16} /> {t('clinician.personalizedCare')}
                    </h4>
                    <div style={{ fontSize: '0.86rem', color: 'var(--foreground)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{simulation.personalizedCare}</div>
                  </div>
                </div>
              )}

              {simTab === 'visual' && (
                <div className="slide-up fade-in">
                  <BodyVisualizer 
                    effects={getMedEffects(medicationInput)} 
                    medication={medicationInput} 
                    patient={data?.patient}
                    records={data?.records}
                  />
                </div>
              )}
            </>
          )}
        </section>

        </div>
      </div>

      {/* BP Trajectory Chart */}
      {bpHistory.length > 0 && (
        <section className="glass-panel slide-up" style={{ marginTop: '1rem' }}>
          <div className="flex-between" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontSize: '0.92rem' }}>
              {t('clinician.bpTrajectory')}
            </h3>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', alignItems: 'center' }}>
              <span style={{ color: '#a5d8ff', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 16, height: 2, background: '#a5d8ff', display: 'inline-block', borderRadius: 2 }} /> {t('clinician.historical')}
              </span>
              {bpPrediction.length > 0 && (
                <span style={{ color: '#c7d2fe', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 16, height: 2, background: '#c7d2fe', display: 'inline-block', borderRadius: 2 }} /> {t('clinician.predicted')}
                </span>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={allChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: '#4A5568', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#4A5568', fontSize: 12 }} axisLine={false} tickLine={false} unit=" mmHg" width={80} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={120} stroke="rgba(74,222,128,0.3)" strokeDasharray="4 4" label={{ value: t('clinician.normal'), fill: '#4ade80', fontSize: 11 }} />
              <ReferenceLine y={140} stroke="rgba(252,165,165,0.3)" strokeDasharray="4 4" label={{ value: t('clinician.stage2HTN'), fill: '#fca5a5', fontSize: 11 }} />
              <Line type="monotone" dataKey="systolic" name={t('clinician.systolicBP')} stroke="#a5d8ff" strokeWidth={2.5} dot={{ r: 5, fill: '#a5d8ff', strokeWidth: 0 }} connectNulls={false} activeDot={{ r: 7 }} />
              {bpPrediction.length > 0 && (
                <Line type="monotone" dataKey="predicted" name={t('clinician.predictedBP')} stroke="#c7d2fe" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 5, fill: '#c7d2fe', strokeWidth: 0 }} connectNulls={false} activeDot={{ r: 7 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
          {!bpPrediction.length && (
            <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.82rem', marginTop: '0.5rem' }}>
              {t('clinician.runSimulationToSeeTraj')}
            </p>
          )}
        </section>
      )}

      {/* Biographer Agent Synthesis — full width below grid */}
      {(biography || loadingBio) && (
        <section className="glass-panel slide-up" style={{ marginTop: '1rem', borderLeft: '4px solid var(--accent-purple)' }}>
          <div className="flex-between" style={{ marginBottom: '0.85rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-purple)', fontSize: '0.92rem' }}>
              <FileText size={16} /> {t('clinician.biographerSynthesis')}
            </h3>
            <span className="badge purple">{t('clinician.aiGenerated')}</span>
          </div>
          <div style={{ background: 'var(--surface-muted)', padding: '1.25rem', borderRadius: 10, minHeight: 100 }}>
            {loadingBio ? (
              <div className="flex-center" style={{ flexDirection: 'column', gap: '0.6rem', color: 'var(--accent-purple)', minHeight: 80 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--accent-purple)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                {t('clinician.synthesizingHistory')}
              </div>
            ) : (
              <div className="fade-in" style={{ whiteSpace: 'pre-wrap', fontSize: '0.93rem', color: 'var(--foreground)', lineHeight: 1.8 }}>
                {biography.split('**').map((p: string, i: number) => i % 2 === 1 ? <strong key={i} style={{ color: 'var(--primary)' }}>{p}</strong> : p)}
              </div>
            )}
          </div>
        </section>
      )}
    </div>

    <Chatbot userRole="clinician" />
    </>
  );
}

