'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import {
  Brain, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Info, ChevronDown, ChevronUp, Loader2, MessageCircle, PhoneCall, CheckCircle, X,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { apiFetch } from '@/lib/apiFetch';

interface XAIFeature {
  feature: string; label: string; value: number; unit: string;
  importance: number; direction: 'up' | 'down' | 'normal';
  risk: 'harmful' | 'protective' | 'neutral'; description: string;
  normal_range: { low: number; high: number };
  status: 'normal' | 'warning' | 'critical';
}

const STATUS_COLORS: Record<string, string> = {
  critical: 'var(--accent-red)', warning: 'var(--accent-amber)', normal: 'var(--accent-green)',
};
const RISK_COLORS: Record<string, string> = {
  harmful: '#ef4444', protective: '#22c55e', neutral: '#94a3b8',
};

function CustomBarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as XAIFeature;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.65rem 0.85rem', boxShadow: 'var(--shadow-md)', maxWidth: 220 }}>
      <p style={{ fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.25rem', fontSize: '0.88rem' }}>{d.label}</p>
      <p style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)', marginBottom: '0.4rem' }}>{d.description}</p>
      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem' }}>
        <span><strong style={{ color: 'var(--foreground)' }}>Value:</strong> {d.value} {d.unit}</span>
        <span><strong style={{ color: 'var(--foreground)' }}>Normal:</strong> {d.normal_range.low}–{d.normal_range.high}</span>
      </div>
    </div>
  );
}

function FeatureCard({ feat, rank }: { feat: XAIFeature; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLanguage();
  const pct = Math.round(feat.importance * 100);
  const statusColor = STATUS_COLORS[feat.status];
  return (
    <div className="glass-panel" style={{ padding: '0.85rem 1rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => setExpanded(e => !e)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: rank <= 3 ? statusColor : 'var(--surface-muted)', color: rank <= 3 ? 'white' : 'var(--foreground-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>
          {rank}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{feat.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0, marginLeft: '0.4rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: statusColor }}>
                {feat.value} <span style={{ fontWeight: 400, color: 'var(--foreground-subtle)', fontSize: '0.72rem' }}>{feat.unit}</span>
              </span>
              {feat.direction === 'up'     && <TrendingUp   size={13} color="var(--accent-red)" />}
              {feat.direction === 'down'   && <TrendingDown  size={13} color="var(--accent-amber)" />}
              {feat.direction === 'normal' && <Minus         size={13} color="var(--accent-green)" />}
            </div>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'var(--surface-muted)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(Math.max(pct * 4, 4), 100)}%`, borderRadius: 3, background: `linear-gradient(90deg, ${RISK_COLORS[feat.risk]}, ${RISK_COLORS[feat.risk]}88)`, transition: 'width 0.6s ease' }} />
          </div>
        </div>
        <div style={{ color: 'var(--foreground-subtle)', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
          <div>
            <p style={{ fontSize: '0.68rem', color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>{t('xai.influenceScore')}</p>
            <p style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '0.95rem' }}>{pct}%</p>
          </div>
          <div>
            <p style={{ fontSize: '0.68rem', color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>{t('xai.normalRange')}</p>
            <p style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--foreground)' }}>{feat.normal_range.low}–{feat.normal_range.high} {feat.unit}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.68rem', color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>{t('xai.riskDirection')}</p>
            <p style={{ fontWeight: 600, fontSize: '0.82rem', color: RISK_COLORS[feat.risk], textTransform: 'capitalize' }}>
              {feat.risk === 'harmful' ? t('xai.harmful') : feat.risk === 'protective' ? t('xai.protective') : t('xai.neutral')}
            </p>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', lineHeight: 1.5 }}>{feat.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function XAIDashboardInner() {
  const searchParams = useSearchParams();
  const { t, lang } = useLanguage();
  const [vitals, setVitals] = useState({
    heart_rate:    parseFloat(searchParams.get('heart_rate')    || '92'),
    sys:           parseFloat(searchParams.get('sys')           || '165'),
    dia:           parseFloat(searchParams.get('dia')           || '98'),
    spo2:          parseFloat(searchParams.get('spo2')          || '96'),
    temp:          parseFloat(searchParams.get('temp')          || '37.8'),
    resp:          parseFloat(searchParams.get('resp')          || '26'),
  });
  const [features, setFeatures]   = useState<XAIFeature[]>([]);
  const [topDriver, setTopDriver] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [chartType, setChartType] = useState<'bar' | 'radar'>('bar');
  const [patient, setPatient]     = useState<any>(null);
  const [showChart, setShowChart] = useState(false);
  const [showAmbulanceModal, setShowAmbulanceModal] = useState(false);
  const [callingAmbulance, setCallingAmbulance] = useState(false);
  const [showAckPopup, setShowAckPopup] = useState(false);
  const [currentAckAlert, setCurrentAckAlert] = useState<any>(null);

  const patientId = searchParams.get('patientId');

  useEffect(() => {
    if (patientId) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/patient?id=${patientId}&lang=${lang}`)
        .then(res => res.json())
        .then(data => { if (data.patient) setPatient(data.patient); })
        .catch(() => {});
    }
  }, [patientId]);

  // Check for pending acknowledgment alert from sessionStorage
  useEffect(() => {
    const pendingAlert = sessionStorage.getItem('pendingAckAlert');
    if (pendingAlert) {
      try {
        const alert = JSON.parse(pendingAlert);
        setCurrentAckAlert(alert);
        setShowAckPopup(true);
        sessionStorage.removeItem('pendingAckAlert');
      } catch {}
    }
  }, []);

  const handleAcknowledge = async (acknowledged: boolean) => {
    if (!currentAckAlert) return;
    
    const branch = sessionStorage.getItem('nalamHdeskBranch') || localStorage.getItem('nalamHdeskBranch') || 'Hospital Desk';
    
    if (acknowledged) {
      try {
        await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/notify/alerts`, {
          method: 'PATCH',
          body: JSON.stringify({
            id: currentAckAlert.id,
            acknowledged: true,
            acknowledgedBy: branch,
          }),
        });
      } catch {}
    }
    
    setShowAckPopup(false);
    setCurrentAckAlert(null);
  };

  const fetchExplanation = useCallback(async (vals: typeof vitals) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/xai/explain`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vals) });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setFeatures(data.explanations?.map((f: any) => ({
        ...f,
        label: (t as any)(`xai.${f.feature}`) || f.label,
        description: (t as any)(`xai.desc.${f.feature}`) || f.description,
      })) || []);
      setTopDriver(data.top_driver || '');
    } catch (e: any) {
      setError(e.message || 'XAI service unavailable');
    } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchExplanation(vitals); }, []);

  const vitalLabels: Record<string, string> = {
    heart_rate:   t('xai.heartRate'),
    sys:          t('xai.systolicBP'),
    dia:          t('xai.diastolicBP'),
    spo2:         t('xai.spo2'),
    temp:         t('xai.temperature'),
    resp:         'Respiratory Rate',
  };

  const translatedFeatures = features.map(f => ({
    ...f,
    label: vitalLabels[f.feature] || f.label,
    description: (t as any)(`xai.desc.${f.feature}`) || f.description,
  }));

  const chartData = translatedFeatures.slice(0, 8).map(f => ({ ...f, pct: Math.round(f.importance * 100) }));

  return (
    <div className="container fade-in">
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '0.45rem', lineHeight: 1.2 }}>
            <Brain size={22} color="var(--accent-purple)" /> {t('xai.title')}
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>{t('xai.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {(['bar', 'radar'] as const).map(tp => (
            <button key={tp} id={`chart-${tp}`} onClick={() => { setChartType(tp); setShowChart(true); }}
              style={{ padding: '0.4rem 0.85rem', borderRadius: 8, border: '1px solid var(--border)', background: chartType === tp && showChart ? 'var(--primary)' : 'var(--surface)', color: chartType === tp && showChart ? 'white' : 'var(--foreground-muted)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              {tp === 'bar' ? t('xai.bar') : t('xai.radar')}
            </button>
          ))}
          <button id="xai-refresh" onClick={() => fetchExplanation(vitals)} disabled={loading}
            style={{ padding: '0.4rem 0.85rem', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'inherit' }}>
            {loading ? <Loader2 size={13} className="spin" /> : '↻'} {t('xai.analyse')}
          </button>
        </div>
      </div>

      {/* ── Patient WhatsApp Panel ── */}
      {patient && (
        <div className="glass-panel" style={{ marginBottom: '1rem', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderLeft: '4px solid var(--accent-green)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--deep-blue)' }}>{patient.name} <span style={{ fontSize: '0.8rem', color: 'var(--charcoal)', fontWeight: 400 }}>(ID: {patient.id})</span></div>
            <div style={{ fontSize: '0.8rem', color: 'var(--charcoal)', marginTop: '0.15rem' }}>{t('xai.mobile')} <strong>{patient.mobile || t('xai.notAvailable')}</strong></div>
          </div>
          {patient.mobile && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <a href={`tel:${patient.mobile.replace(/[^0-9]/g, '')}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: 8, background: 'var(--primary)', color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: '0.84rem' }}>
                <PhoneCall size={16} /> {t('xai.call')}
              </a>
              <a href={`https://wa.me/${patient.mobile.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(t('xai.whatsappMsg'))}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: 8, background: '#25D366', color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: '0.84rem' }}>
                <MessageCircle size={16} /> {t('xai.sendAlert')}
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── Vital Inputs ── */}
      <div className="glass-panel" style={{ marginBottom: '1rem' }}>
        <p className="section-title">
          <Info size={15} color="var(--primary)" /> {t('xai.adjustVitals')}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.7rem', marginBottom: '0.85rem' }}>
          {Object.entries(vitals).map(([key, val]) => (
            <div key={key}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.25rem' }}>
                {vitalLabels[key] || key}
              </label>
              <input id={`vital-${key}`} type="number" value={val} step={key === 'temperature' ? 0.1 : 1}
                onChange={e => setVitals(v => ({ ...v, [key]: parseFloat(e.target.value) || 0 }))}
                style={{ width: '100%', padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)', color: 'var(--foreground)', fontSize: '0.92rem', fontFamily: 'inherit', outline: 'none' }} />
            </div>
          ))}
        </div>
        <button id="xai-run" onClick={() => fetchExplanation(vitals)} disabled={loading}
          style={{ padding: '0.6rem 1.25rem', borderRadius: 8, background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', fontFamily: 'inherit' }}>
          {loading ? <Loader2 size={14} className="spin" /> : <Brain size={14} />} {t('xai.runAnalysis')}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ padding: '0.65rem 0.85rem', borderRadius: 10, background: 'var(--accent-red-bg)', color: 'var(--accent-red)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem' }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {features.length > 0 && (
        <>
          {/* Top Driver alert */}
          {topDriver && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.85rem 1rem', borderRadius: 12, background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red)', marginBottom: '1rem' }}>
              <AlertTriangle size={18} color="var(--accent-red)" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 800, color: 'var(--foreground)', fontSize: '0.88rem' }}>
                  {t('xai.topDriver')} <span style={{ color: 'var(--accent-red)' }}>{topDriver}</span>
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)', marginTop: '0.1rem' }}>{t('xai.topDriverDesc')}</p>
              </div>
            </div>
          )}

          {/* Chart (collapsible on mobile) */}
          {showChart && (
            <div className="glass-panel fade-in" style={{ marginBottom: '1rem' }}>
              <div className="flex-between" style={{ marginBottom: '0.85rem' }}>
                <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  {chartType === 'bar' ? t('xai.importanceBar') : t('xai.radarOverview')}
                </h2>
                <button onClick={() => setShowChart(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--charcoal)', fontSize: '0.8rem', fontFamily: 'inherit', fontWeight: 600 }}>
                  Hide ✕
                </button>
              </div>
              {chartType === 'bar' ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16 }}>
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: 'var(--foreground-muted)' }} />
                    <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 10, fill: 'var(--foreground-muted)' }} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="pct" radius={[0, 5, 5, 0]}>
                      {chartData.map((entry, i) => <Cell key={i} fill={RISK_COLORS[entry.risk]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={chartData}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--foreground-muted)' }} />
                    <Radar dataKey="pct" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
              <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.65rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                {[['harmful', t('xai.harmful')], ['protective', t('xai.protective')], ['neutral', t('xai.neutral')]].map(([k, label]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                    <div style={{ width: 9, height: 9, borderRadius: 2, background: RISK_COLORS[k] }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feature Rankings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div className="flex-between" style={{ marginBottom: '0.1rem' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>{t('xai.featureRankings')}</h2>
              {!showChart && (
                <button onClick={() => setShowChart(true)} style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--charcoal)', fontSize: '0.78rem', fontFamily: 'inherit', fontWeight: 600, padding: '0.3rem 0.7rem', borderRadius: 8 }}>
                  Show Chart
                </button>
              )}
            </div>
            {translatedFeatures.map((f, i) => <FeatureCard key={f.feature} feat={f} rank={i + 1} />)}
          </div>
        </>
      )}

      <style>{`
        .spin { animation: spin 1s linear infinite; } 
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .ambulance-button-mobile {
            bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 5.75rem) !important;
            right: 0.75rem !important;
          }
        }
      `}</style>

      {/* ── ACKNOWLEDGMENT POPUP ── */}
      {showAckPopup && currentAckAlert && (
        <div
          style={{
            position: 'fixed',
            bottom: '1rem',
            right: '1rem',
            zIndex: 9999,
            background: 'var(--surface)',
            border: '2px solid var(--primary)',
            borderRadius: 12,
            padding: '1.2rem 1.5rem',
            boxShadow: '0 8px 32px rgba(0,82,165,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            maxWidth: '350px',
            animation: 'pulseGlow 2s infinite',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={20} color="var(--accent-amber)" />
            <div style={{ fontWeight: 700, color: 'var(--deep-blue)', fontSize: '0.95rem' }}>
              Is this taken care of?
            </div>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--charcoal)', lineHeight: 1.5 }}>
            {currentAckAlert.title}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              onClick={() => handleAcknowledge(true)}
              style={{
                flex: 1,
                padding: '0.6rem 1rem',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Yes
            </button>
            <button
              onClick={() => handleAcknowledge(false)}
              style={{
                flex: 1,
                padding: '0.6rem 1rem',
                background: 'var(--surface-muted)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              No
            </button>
          </div>
        </div>
      )}

      {/* ── AMBULANCE BUTTON ── */}
      <button
        className="ambulance-button-mobile"
        onDoubleClick={() => setShowAmbulanceModal(true)}
        style={{
          position: 'fixed', bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 8.75rem)', right: '1.5rem', zIndex: 90,
          background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', border: 'none', borderRadius: '50%',
          width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)', cursor: 'pointer', animation: 'pulseGlow 2s infinite'
        }}
        title="Double Click to Call Ambulance"
      >
        <PhoneCall size={22} />
      </button>

      {/* ── AMBULANCE MODAL ── */}
      {showAmbulanceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div style={{ background: 'var(--surface)', padding: '2rem', borderRadius: 20, maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', animation: 'slideUp 0.3s ease' }}>
            {callingAmbulance ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'var(--accent-red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'heartbeat 1s infinite' }}>
                  <PhoneCall size={34} color="var(--accent-red)" />
                </div>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--foreground)', fontWeight: 800 }}>Calling Ambulance...</h2>
                <p style={{ color: 'var(--charcoal)', fontSize: '0.85rem' }}>Connecting to emergency services</p>
              </div>
            ) : (
              <>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--accent-red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                  <AlertTriangle size={26} color="var(--accent-red)" />
                </div>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--foreground)', fontWeight: 800, marginBottom: '0.4rem' }}>Emergency Services</h2>
                <p style={{ color: 'var(--charcoal)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>Are you sure you want to call an ambulance?</p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => setShowAmbulanceModal(false)} style={{ flex: 1, padding: '0.75rem', background: 'var(--surface-muted)', color: 'var(--foreground)', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => {
                    setCallingAmbulance(true);
                    const audio = new Audio('/ringing.mp3'); audio.loop = true; audio.play().catch(() => {});
                    setTimeout(() => { audio.pause(); setCallingAmbulance(false); setShowAmbulanceModal(false); }, 5000);
                  }} style={{ flex: 1, padding: '0.75rem', background: 'var(--accent-red)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}>Proceed</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function XAIDashboard() {
  const { t } = useLanguage();
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem' }}>{t('xai.loading')}</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <XAIDashboardInner />
    </Suspense>
  );
}
