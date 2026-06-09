'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import {
  Brain, TrendingUp, TrendingDown, Minus, AlertTriangle,
  CheckCircle, Info, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';

interface XAIFeature {
  feature: string;
  label: string;
  value: number;
  unit: string;
  importance: number;
  direction: 'up' | 'down' | 'normal';
  risk: 'harmful' | 'protective' | 'neutral';
  description: string;
  normal_range: { low: number; high: number };
  status: 'normal' | 'warning' | 'critical';
}

const STATUS_COLORS: Record<string, string> = {
  critical:   'var(--accent-red)',
  warning:    'var(--accent-amber)',
  normal:     'var(--accent-green)',
};

const RISK_COLORS: Record<string, string> = {
  harmful:    '#ef4444',
  protective: '#22c55e',
  neutral:    '#94a3b8',
};

// Custom bar tooltip
function CustomBarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as XAIFeature;
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '0.75rem 1rem',
      boxShadow: 'var(--shadow-md)',
      maxWidth: 260,
    }}>
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
  const pct = Math.round(feat.importance * 100);
  const statusColor = STATUS_COLORS[feat.status];

  return (
    <div
      className="glass-panel"
      style={{ padding: '1rem 1.25rem', cursor: 'pointer', userSelect: 'none' }}
      onClick={() => setExpanded(e => !e)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Rank badge */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: rank <= 3 ? statusColor : 'var(--surface-muted)',
          color: rank <= 3 ? 'white' : 'var(--foreground-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.78rem', fontWeight: 800, flexShrink: 0,
        }}>
          {rank}
        </div>

        {/* Label & bar */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--foreground)' }}>{feat.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: statusColor }}>
                {feat.value} <span style={{ fontWeight: 400, color: 'var(--foreground-subtle)' }}>{feat.unit}</span>
              </span>
              {feat.direction === 'up'   && <TrendingUp  size={14} color="var(--accent-red)" />}
              {feat.direction === 'down' && <TrendingDown size={14} color="var(--accent-amber)" />}
              {feat.direction === 'normal' && <Minus size={14} color="var(--accent-green)" />}
            </div>
          </div>
          {/* Importance bar */}
          <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-muted)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.max(pct * 4, 4)}%`, // scale so 25% fills bar
              maxWidth: '100%',
              borderRadius: 3,
              background: `linear-gradient(90deg, ${RISK_COLORS[feat.risk]}, ${RISK_COLORS[feat.risk]}88)`,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>

        <div style={{ color: 'var(--foreground-subtle)', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          marginTop: '0.75rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '0.75rem',
        }}>
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Influence Score</p>
            <p style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '1rem' }}>{pct}%</p>
          </div>
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Normal Range</p>
            <p style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--foreground)' }}>{feat.normal_range.low}–{feat.normal_range.high} {feat.unit}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Risk Direction</p>
            <p style={{ fontWeight: 600, fontSize: '0.88rem', color: RISK_COLORS[feat.risk], textTransform: 'capitalize' }}>{feat.risk}</p>
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
  const [vitals, setVitals] = useState({
    heart_rate: parseFloat(searchParams.get('heart_rate') || '92'),
    systolic_bp: parseFloat(searchParams.get('systolic_bp') || '165'),
    diastolic_bp: parseFloat(searchParams.get('diastolic_bp') || '98'),
    spo2: parseFloat(searchParams.get('spo2') || '96'),
    temperature: parseFloat(searchParams.get('temperature') || '37.8'),
    glucose: parseFloat(searchParams.get('glucose') || '180')
  });
  const [features, setFeatures]     = useState<XAIFeature[]>([]);
  const [topDriver, setTopDriver]   = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [chartType, setChartType]   = useState<'bar' | 'radar'>('bar');

  const fetchExplanation = useCallback(async (vals: typeof vitals) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/xai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vals),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setFeatures(data.explanations || []);
      setTopDriver(data.top_driver || '');
    } catch (e: any) {
      setError(e.message || 'XAI service unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchExplanation(vitals); }, []);

  const chartData = features.slice(0, 8).map(f => ({
    ...f,
    pct: Math.round(f.importance * 100),
  }));

  return (
    <div style={{ maxWidth: 1100, margin: '2rem auto', padding: '0 1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Brain size={26} color="var(--accent-purple)" /> Explainable AI Dashboard
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Understand <em>why</em> the AI flags your vitals — ranked by clinical importance.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['bar', 'radar'] as const).map(t => (
            <button
              key={t}
              id={`chart-${t}`}
              onClick={() => setChartType(t)}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: chartType === t ? 'var(--primary)' : 'var(--surface)',
                color: chartType === t ? 'white' : 'var(--foreground-muted)',
                fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer',
              }}
            >
              {t === 'bar' ? '📊 Bar' : '🕸️ Radar'}
            </button>
          ))}
          <button
            id="xai-refresh"
            onClick={() => fetchExplanation(vitals)}
            disabled={loading}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: 8,
              border: 'none',
              background: 'var(--primary)',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}
          >
            {loading ? <Loader2 size={14} className="spin" /> : '↻'} Analyse
          </button>
        </div>
      </div>

      {/* Vital inputs */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <p className="section-title" style={{ marginBottom: '1rem' }}>
          <Info size={16} color="var(--primary)" /> Adjust Vitals
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          {Object.entries(vitals).map(([key, val]) => {
            const labels: Record<string, string> = {
              heart_rate: 'Heart Rate (BPM)',
              systolic_bp: 'Systolic BP (mmHg)',
              diastolic_bp: 'Diastolic BP (mmHg)',
              spo2: 'SpO₂ (%)',
              temperature: 'Temperature (°C)',
              glucose: 'Glucose (mg/dL)',
            };
            return (
              <div key={key}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.3rem' }}>
                  {labels[key] || key}
                </label>
                <input
                  id={`vital-${key}`}
                  type="number"
                  value={val}
                  step={key === 'temperature' ? 0.1 : 1}
                  onChange={e => setVitals(v => ({ ...v, [key]: parseFloat(e.target.value) || 0 }))}
                  style={{
                    width: '100%', padding: '0.5rem 0.75rem',
                    borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--surface-muted)', color: 'var(--foreground)',
                    fontSize: '0.95rem',
                  }}
                />
              </div>
            );
          })}
        </div>
        <button
          id="xai-run"
          onClick={() => fetchExplanation(vitals)}
          disabled={loading}
          style={{
            marginTop: '1rem', padding: '0.6rem 1.5rem', borderRadius: 8,
            background: 'var(--primary)', color: 'white', border: 'none',
            fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1,
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          {loading ? <Loader2 size={15} className="spin" /> : <Brain size={15} />} Run Analysis
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: 10, background: 'var(--accent-red-bg)', color: 'var(--accent-red)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {features.length > 0 && (
        <>
          {/* Top driver banner */}
          {topDriver && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '1rem 1.25rem', borderRadius: 12,
              background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red)',
              marginBottom: '1.5rem',
            }}>
              <AlertTriangle size={20} color="var(--accent-red)" />
              <div>
                <p style={{ fontWeight: 800, color: 'var(--foreground)', fontSize: '0.95rem' }}>
                  Top Risk Driver: <span style={{ color: 'var(--accent-red)' }}>{topDriver}</span>
                </p>
                <p style={{ fontSize: '0.83rem', color: 'var(--foreground-muted)', marginTop: '0.1rem' }}>
                  This vital has the highest deviation from the normal range and contributes most to risk scoring.
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '1.5rem', alignItems: 'start' }}>
            {/* Feature cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.25rem' }}>
                Feature Influence Rankings
              </h2>
              {features.map((f, i) => (
                <FeatureCard key={f.feature} feat={f} rank={i + 1} />
              ))}
            </div>

            {/* Chart */}
            <div className="glass-panel" style={{ padding: '1.25rem', position: 'sticky', top: 80 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '1rem' }}>
                {chartType === 'bar' ? 'Importance Bar Chart' : 'Radar Overview'}
              </h2>
              {chartType === 'bar' ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: 'var(--foreground-muted)' }} />
                    <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11, fill: 'var(--foreground-muted)' }} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="pct" radius={[0, 6, 6, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={RISK_COLORS[entry.risk]} />
                      ))}
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
              {/* Legend */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', justifyContent: 'center' }}>
                {Object.entries(RISK_COLORS).map(([k, c]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--foreground-muted)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                    {k.charAt(0).toUpperCase() + k.slice(1)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function XAIDashboard() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Loading XAI...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <XAIDashboardInner />
    </Suspense>
  );
}
