'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import {
  Brain, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Info, ChevronDown, ChevronUp, Loader2, MessageCircle, PhoneCall,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

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
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 1rem', boxShadow: 'var(--shadow-md)', maxWidth: 260 }}>
      <p style={{ fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.3rem' }}>{d.label}</p>
      <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', marginBottom: '0.5rem' }}>{d.description}</p>
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.82rem' }}>
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
    <div className="glass-panel" style={{ padding: '1rem 1.25rem', cursor: 'pointer', userSelect: 'none' }} onClick={() => setExpanded(e => !e)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: rank <= 3 ? statusColor : 'var(--surface-muted)', color: rank <= 3 ? 'white' : 'var(--foreground-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, flexShrink: 0 }}>
          {rank}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--foreground)' }}>{feat.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: statusColor }}>
                {feat.value} <span style={{ fontWeight: 400, color: 'var(--foreground-subtle)' }}>{feat.unit}</span>
              </span>
              {feat.direction === 'up'     && <TrendingUp   size={14} color="var(--accent-red)" />}
              {feat.direction === 'down'   && <TrendingDown  size={14} color="var(--accent-amber)" />}
              {feat.direction === 'normal' && <Minus         size={14} color="var(--accent-green)" />}
            </div>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-muted)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(Math.max(pct * 4, 4), 100)}%`, borderRadius: 3, background: `linear-gradient(90deg, ${RISK_COLORS[feat.risk]}, ${RISK_COLORS[feat.risk]}88)`, transition: 'width 0.6s ease' }} />
          </div>
        </div>
        <div style={{ color: 'var(--foreground-subtle)', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{t('xai.influenceScore')}</p>
            <p style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '1rem' }}>{pct}%</p>
          </div>
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{t('xai.normalRange')}</p>
            <p style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--foreground)' }}>{feat.normal_range.low}–{feat.normal_range.high} {feat.unit}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{t('xai.riskDirection')}</p>
            <p style={{ fontWeight: 600, fontSize: '0.88rem', color: RISK_COLORS[feat.risk], textTransform: 'capitalize' }}>
              {feat.risk === 'harmful' ? t('xai.harmful') : feat.risk === 'protective' ? t('xai.protective') : t('xai.neutral')}
            </p>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', lineHeight: 1.5 }}>{feat.description}</p>
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
  const [showAmbulanceModal, setShowAmbulanceModal] = useState(false);
  const [callingAmbulance, setCallingAmbulance] = useState(false);

  const patientId = searchParams.get('patientId');

  useEffect(() => {
    if (patientId) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/patient?id=${patientId}&lang=${lang}`)
        .then(res => res.json())
        .then(data => { if (data.patient) setPatient(data.patient); })
        .catch(() => {});
    }
  }, [patientId]);

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

  useEffect(() => { fetchExplanation(vitals); }, []);

  const vitalLabels: Record<string, string> = {
    heart_rate:   t('xai.heartRate'),
    sys:          t('xai.systolicBP'),
    dia:          t('xai.diastolicBP'),
    spo2:         t('xai.spo2'),
    temp:         t('xai.temperature'),
    resp:         'Respiratory Rate',
  };

  // Add the feature names directly to `t()` by extending them in the components memory
  // Wait, I can just map the `vitalLabels` into `features` dynamically below.
  const translatedFeatures = features.map(f => ({
    ...f,
    label: vitalLabels[f.feature] || f.label,
    description: (t as any)(`xai.desc.${f.feature}`) || f.description,
  }));

  const chartData = translatedFeatures.slice(0, 8).map(f => ({ ...f, pct: Math.round(f.importance * 100) }));

  return (
    <div style={{ maxWidth: 1100, margin: '2rem auto', padding: '0 1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Brain size={26} color="var(--accent-purple)" /> {t('xai.title')}
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{t('xai.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['bar', 'radar'] as const).map(tp => (
            <button key={tp} id={`chart-${tp}`} onClick={() => setChartType(tp)}
              style={{ padding: '0.45rem 1rem', borderRadius: 8, border: '1px solid var(--border)', background: chartType === tp ? 'var(--primary)' : 'var(--surface)', color: chartType === tp ? 'white' : 'var(--foreground-muted)', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer' }}>
              {tp === 'bar' ? t('xai.bar') : t('xai.radar')}
            </button>
          ))}
          <button id="xai-refresh" onClick={() => fetchExplanation(vitals)} disabled={loading}
            style={{ padding: '0.45rem 1rem', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {loading ? <Loader2 size={14} className="spin" /> : '↻'} {t('xai.analyse')}
          </button>
        </div>
      </div>

      {/* Patient WhatsApp Panel */}
      {patient && (
        <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderLeft: '4px solid var(--accent-green)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--deep-blue)' }}>{patient.name} <span style={{ fontSize: '0.85rem', color: 'var(--charcoal)', fontWeight: 400 }}>(ID: {patient.id})</span></div>
            <div style={{ fontSize: '0.85rem', color: 'var(--charcoal)', marginTop: '0.2rem' }}>{t('xai.mobile')} <strong>{patient.mobile || t('xai.notAvailable')}</strong></div>
          </div>
          {patient.mobile && (
            <a href={`https://wa.me/${patient.mobile.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(t('xai.whatsappMsg'))}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: 8, background: '#25D366', color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem', transition: 'opacity 0.2s' }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
              onMouseOut={e => e.currentTarget.style.opacity = '1'}>
              <MessageCircle size={18} /> {t('xai.sendAlert')}
            </a>
          )}
        </div>
      )}

      {/* Vital inputs */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <p className="section-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Info size={16} color="var(--primary)" /> {t('xai.adjustVitals')}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          {Object.entries(vitals).map(([key, val]) => (
            <div key={key}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.3rem' }}>
                {vitalLabels[key] || key}
              </label>
              <input id={`vital-${key}`} type="number" value={val} step={key === 'temperature' ? 0.1 : 1}
                onChange={e => setVitals(v => ({ ...v, [key]: parseFloat(e.target.value) || 0 }))}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)', color: 'var(--foreground)', fontSize: '0.95rem' }} />
            </div>
          ))}
        </div>
        <button id="xai-run" onClick={() => fetchExplanation(vitals)} disabled={loading}
          style={{ marginTop: '1rem', padding: '0.6rem 1.5rem', borderRadius: 8, background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {loading ? <Loader2 size={15} className="spin" /> : <Brain size={15} />} {t('xai.runAnalysis')}
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: 10, background: 'var(--accent-red-bg)', color: 'var(--accent-red)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {features.length > 0 && (
        <>
          {topDriver && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', borderRadius: 12, background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red)', marginBottom: '1.5rem' }}>
              <AlertTriangle size={20} color="var(--accent-red)" />
              <div>
                <p style={{ fontWeight: 800, color: 'var(--foreground)', fontSize: '0.95rem' }}>
                  {t('xai.topDriver')} <span style={{ color: 'var(--accent-red)' }}>{topDriver}</span>
                </p>
                <p style={{ fontSize: '0.83rem', color: 'var(--foreground-muted)', marginTop: '0.1rem' }}>{t('xai.topDriverDesc')}</p>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '1.5rem', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.25rem' }}>{t('xai.featureRankings')}</h2>
              {translatedFeatures.map((f, i) => <FeatureCard key={f.feature} feat={f} rank={i + 1} />)}
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem', position: 'sticky', top: 80 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '1rem' }}>
                {chartType === 'bar' ? t('xai.importanceBar') : t('xai.radarOverview')}
              </h2>
              {chartType === 'bar' ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: 'var(--foreground-muted)' }} />
                    <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11, fill: 'var(--foreground-muted)' }} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="pct" radius={[0, 6, 6, 0]}>
                      {chartData.map((entry, i) => <Cell key={i} fill={RISK_COLORS[entry.risk]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={chartData}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--foreground-muted)' }} />
                    <Radar dataKey="pct" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', justifyContent: 'center' }}>
                {[['harmful', t('xai.harmful')], ['protective', t('xai.protective')], ['neutral', t('xai.neutral')]].map(([k, label]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--foreground-muted)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: RISK_COLORS[k] }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      
      {/* ── CALL AMBULANCE BUTTON ── */}
      <button
        onDoubleClick={() => setShowAmbulanceModal(true)}
        style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9000,
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          color: 'white', border: 'none', borderRadius: '50%',
          width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)', cursor: 'pointer',
          animation: 'pulseGlow 2s infinite'
        }}
        title="Double Click to Call Ambulance"
      >
        <PhoneCall size={28} />
      </button>

      {/* ── AMBULANCE MODAL ── */}
      {showAmbulanceModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
        }}>
          <div style={{ background: 'white', padding: '2.5rem', borderRadius: 24, maxWidth: 400, width: '90%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', animation: 'slideUp 0.3s ease' }}>
            {callingAmbulance ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'heartbeat 1s infinite' }}>
                  <PhoneCall size={40} color="#DC2626" />
                </div>
                <h2 style={{ fontSize: '1.5rem', color: '#1A2B4A', fontWeight: 800 }}>Calling Ambulance...</h2>
                <p style={{ color: '#64748B' }}>Connecting to emergency services</p>
              </div>
            ) : (
              <>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                  <AlertTriangle size={32} color="#DC2626" />
                </div>
                <h2 style={{ fontSize: '1.5rem', color: '#1A2B4A', fontWeight: 800, marginBottom: '0.5rem' }}>Emergency Services</h2>
                <p style={{ color: '#64748B', marginBottom: '2rem' }}>Are you sure you want to call an ambulance?</p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => setShowAmbulanceModal(false)} style={{ flex: 1, padding: '0.8rem', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => {
                    setCallingAmbulance(true);
                    const audio = new Audio('/ringing.mp3');
                    audio.loop = true;
                    audio.play().catch(() => {});
                    setTimeout(() => {
                      audio.pause();
                      setCallingAmbulance(false);
                      setShowAmbulanceModal(false);
                    }, 5000);
                  }} style={{ flex: 1, padding: '0.8rem', background: '#DC2626', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)' }}>Proceed</button>
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
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{t('xai.loading')}</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <XAIDashboardInner />
    </Suspense>
  );
}
