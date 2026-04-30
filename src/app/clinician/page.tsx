'use client';

import { useState, useEffect } from 'react';
import { Lock, Unlock, Database, Cpu, Stethoscope, AlertTriangle, FlaskConical, Eye, EyeOff, CheckCircle, XCircle, SkipForward, Clock, FileText, Activity, ChevronDown } from 'lucide-react';

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

function buildPrediction(history: any[], intervention: string) {
  if (!history.length) return [];
  const last = history[history.length - 1];
  const lastYear = parseInt(last.date.split('-')[0]);
  const lastSystolic = last.systolic!;
  const isPositive = /amlodipine|lisinopril|losartan|ramipril|beta|arb|ccb/i.test(intervention);
  const slope = isPositive ? -4 : -1;
  return [
    { date: `${lastYear + 1}`, predicted: Math.round(lastSystolic + slope) },
    { date: `${lastYear + 2}`, predicted: Math.round(lastSystolic + slope * 2) },
    { date: `${lastYear + 3}`, predicted: Math.round(lastSystolic + slope * 3) },
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
};

// ─── Glass Box Panel ──────────────────────────────────────────────────────────
function GlassBoxPanel({ entries }: { entries: GlassBoxEntry[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

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
                  Executed at: {new Date(entry.timestamp).toLocaleTimeString()}
                </div>
                {/* Input */}
                <div>
                  <div style={{ color: '#a5d8ff', fontSize: '0.72rem', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>► Input Features</div>
                  <pre style={{ color: '#94a3b8', fontSize: '0.72rem', overflow: 'auto', maxHeight: 140, lineHeight: 1.6, margin: 0 }}>
                    {JSON.stringify(entry.inputSummary, null, 2)}
                  </pre>
                </div>
                {/* Output */}
                <div>
                  <div style={{ color: statusColor(entry.status), fontSize: '0.72rem', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>◄ Output</div>
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
            ✓ Agent swarm completed · Total: {entries.reduce((s, e) => s + e.durationMs, 0).toFixed(0)}ms ·{' '}
            {entries.filter(e => e.status === 'success').length}/{entries.length} agents succeeded
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClinicianView() {
  const [patientId, setPatientId]         = useState('P001');
  const [role, setRole]                       = useState('specialist');
  const [allPatients, setAllPatients]         = useState<any[]>([]);
  const [data, setData]                       = useState<any>(null);
  const [error, setError]                     = useState<string | null>(null);
  const [simulation, setSimulation]           = useState<PrecisionData | null>(null);
  const [biography, setBiography]             = useState<string>('');
  const [loadingBio, setLoadingBio]           = useState(false);
  const [loadingContext, setLoadingContext]    = useState(false);
  const [loadingSimulation, setLoadingSimulation] = useState(false);
  const [showGlassBox, setShowGlassBox]       = useState(false);
  const [glassBoxLogs, setGlassBoxLogs]       = useState<GlassBoxEntry[]>([]);
  const [selectedMed, setSelectedMed]         = useState('');
  const [selectedDosage, setSelectedDosage]   = useState('');
  const [manualMed, setManualMed]             = useState('');
  const [expandedRecord, setExpandedRecord]   = useState<string | null>(null);

  const selectedMedObj = MEDICATIONS.find(m => m.name === selectedMed);
  const medicationInput = selectedMed === 'Other (type below)' ? manualMed
    : (selectedMed && selectedDosage) ? `${selectedMed} ${selectedDosage}` : manualMed;

  useEffect(() => {
    fetch('/api/patient?id=ALL')
      .then(r => r.json())
      .then(d => { if (d.patients) setAllPatients(d.patients); })
      .catch(() => {});
  }, []);

  const requestContext = async () => {
    setError(null); setData(null); setSimulation(null); setGlassBoxLogs([]); setBiography('');
    setLoadingContext(true);
    let clinicianName = 'Dr. Monissha (Cardiology)';
    if (role === 'emergency') clinicianName = 'Dr. Sinha (ER Attending)';
    if (role === 'research')  clinicianName = 'BioPharm Research Lab';
    try {
      const res = await fetch(`/api/clinician/request-context?id=${patientId}&contextType=${role}&clinician=${encodeURIComponent(clinicianName)}`);
      const result = await res.json();
      if (!res.ok) { setError(result.error); }
      else {
        setData(result.data);
        setLoadingBio(true);
        try {
          const br = await fetch('/api/agents/biographer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patient: result.data.patient, records: result.data.records }) });
          const bd = await br.json();
          setBiography(bd.summary || '');
          if (bd.glassBox) setGlassBoxLogs(prev => [...prev, ...bd.glassBox]);
        } catch { setBiography('Unable to generate synthesis.'); }
        finally { setLoadingBio(false); }
      }
    } catch { setError('Failed to communicate with Patient Memory Layer.'); }
    finally { setLoadingContext(false); }
  };

  const runSimulation = async () => {
    if (!data || !medicationInput.trim()) return;
    setLoadingSimulation(true);
    try {
      const res = await fetch('/api/agents/twin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient: data.patient, records: data.records, intervention: medicationInput }),
      });
      const result = await res.json();
      setSimulation(result);
      if (result.glassBox) setGlassBoxLogs(prev => [...prev, ...result.glassBox]);
    } catch { setSimulation(null); }
    finally { setLoadingSimulation(false); }
  };

  const bpHistory = data ? buildBpHistory(data.records) : [];
  const bpPrediction = simulation ? buildPrediction(bpHistory, medicationInput) : [];
  const allChartData = [
    ...bpHistory.map(d => ({ date: d.date.substring(0, 4), systolic: d.systolic, predicted: undefined })),
    ...(bpPrediction.length > 0 && bpHistory.length > 0
      ? [{ date: bpHistory[bpHistory.length - 1].date.substring(0, 4), systolic: bpHistory[bpHistory.length - 1].systolic, predicted: bpHistory[bpHistory.length - 1].systolic }]
      : []),
    ...bpPrediction.map(d => ({ date: d.date, systolic: undefined, predicted: d.predicted })),
  ];

  return (
    <div className="container fade-in">
      {/* Page Header */}
      <div className="slide-up stagger-1 flex-between" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Clinician Portal</h2>
          <p style={{ color: 'var(--accent-teal)' }}>Zero-Knowledge Context Retrieval & Precision Medicine Engine</p>
        </div>
        {glassBoxLogs.length > 0 && (
          <button
            className="glass-button"
            onClick={() => setShowGlassBox(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: showGlassBox ? '#4ade80' : 'var(--primary)', color: showGlassBox ? '#4ade80' : 'var(--primary)' }}
          >
            {showGlassBox ? <EyeOff size={16} /> : <Eye size={16} />}
            {showGlassBox ? 'Hide' : 'View'} Glass Box
            <span style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', borderRadius: 9999, padding: '0 6px', fontSize: '0.75rem' }}>
              {glassBoxLogs.length}
            </span>
          </button>
        )}
      </div>

      {/* Glass Box Panel */}
      {showGlassBox && glassBoxLogs.length > 0 && (
        <div className="slide-up" style={{ marginBottom: '1.5rem' }}>
          <GlassBoxPanel entries={glassBoxLogs} />
        </div>
      )}

      <div className="grid-2">
        {/* Context Request */}
        <section className="glass-panel slide-up stagger-2" style={{ height: 'fit-content' }}>
          <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={20} color="var(--primary)" /> Context Request
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <select
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              style={{ flex: 1, padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)', color: 'var(--foreground)', outline: 'none', minWidth: '180px', fontFamily: 'inherit' }}
            >
              {allPatients.length > 0
                ? allPatients.map((p: any) => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)
                : ['P001','P002','P003','P004','P005','P006','P007','P008','P009','P010','P011','P012'].map(id => <option key={id} value={id}>{id}</option>)
              }
            </select>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)', color: 'var(--foreground)', outline: 'none', minWidth: '200px', fontFamily: 'inherit' }}
            >
              <option value="specialist">Dr. Monissha (Specialist)</option>
              <option value="emergency">Dr. Smith (Emergency)</option>
              <option value="research">BioPharm (Research)</option>
            </select>
            <button className="glass-button" onClick={requestContext} disabled={loadingContext}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
              {loadingContext
                ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> Requesting...</>
                : 'Request Access'}
            </button>
          </div>

          {error && (
            <div className="fade-in" style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid var(--accent-red)', borderRadius: 8, color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={16} /> {error}
            </div>
          )}

          {data && (
            <div className="slide-up" style={{ padding: '1rem', background: 'rgba(165,216,255,0.05)', borderLeft: '4px solid var(--accent-teal)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--accent-teal)' }}>
                <Unlock size={16} /> Context Granted — Decrypted Locally
              </div>
              <h4 style={{ marginBottom: '0.25rem' }}>{data.patient.name}</h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--charcoal)', marginBottom: '1rem' }}>DOB: {data.patient.dob} &nbsp;|&nbsp; {data.patient.gender}</p>
              <h5 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Recent Clinical Events</h5>
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
            </div>
          )}
        </section>

        {/* Twin Simulation */}
        <section className="glass-panel slide-up stagger-3" style={{
          opacity: data ? 1 : 0.45,
          pointerEvents: data ? 'auto' : 'none',
          transition: 'opacity 0.5s ease',
        }}>
          <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-purple)' }}>
              <Cpu size={20} /> Twin Simulation
            </h3>
            <span className="badge purple pulse-glow">ML + Groq Pipeline</span>
          </div>

          <p style={{ fontSize: '0.88rem', color: 'var(--charcoal)', marginBottom: '1rem' }}>
            Proposes an intervention through the sklearn Medication Effectiveness model, then synthesizes precision narratives via Groq.
          </p>

          {/* Medicine Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Select Medicine</label>
            <select value={selectedMed} onChange={e => { setSelectedMed(e.target.value); setSelectedDosage(''); }}
              style={{ width: '100%', padding: '0.7rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)', color: 'var(--foreground)', outline: 'none', fontFamily: 'inherit' }}>
              <option value="">— Choose a medicine —</option>
              {MEDICATIONS.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
            </select>

            {selectedMedObj && selectedMedObj.dosages.length > 0 && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.4rem' }}>Dosage</label>
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
                placeholder="Type intervention e.g. Add Amlodipine 10mg"
                style={{ width: '100%', padding: '0.7rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)', color: 'var(--foreground)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            )}

            {medicationInput && (
              <div style={{ padding: '0.5rem 0.85rem', background: 'var(--primary-light)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, border: '1px solid var(--glass-border)' }}>
                Simulating: <strong>{medicationInput}</strong>
              </div>
            )}

            <button className="glass-button" onClick={runSimulation} disabled={loadingSimulation || !medicationInput.trim()}
              style={{ borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {loadingSimulation
                ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--accent-purple)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> Simulating...</>
                : '⚗️ Run Twin Simulation'}
            </button>
          </div>

          {!simulation && !loadingSimulation && (
            <div className="flex-center" style={{ height: 120, background: 'var(--background)', borderRadius: 8, color: '#475569', fontSize: '0.88rem' }}>
              Enter an intervention and click Simulate
            </div>
          )}

          {simulation && simulation.treatmentDecision && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="slide-up stagger-1" style={{ background: 'rgba(165,216,255,0.05)', borderLeft: '4px solid var(--primary)', padding: '0.9rem', borderRadius: 8, transition: 'transform 0.2s' }}
                onMouseOver={e => (e.currentTarget.style.transform = 'translateX(4px)')} onMouseOut={e => (e.currentTarget.style.transform = 'translateX(0)')}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', marginBottom: '0.4rem', fontSize: '0.92rem' }}>
                  <Stethoscope size={16} /> Better Treatment Decisions
                </h4>
                <p style={{ fontSize: '0.86rem', color: 'var(--foreground)', lineHeight: 1.65 }}>{simulation.treatmentDecision}</p>
              </div>

              <div className="slide-up stagger-2" style={{ background: 'var(--accent-amber-bg)', borderLeft: '4px solid var(--accent-amber)', padding: '0.9rem', borderRadius: 8, transition: 'transform 0.2s' }}
                onMouseOver={e => (e.currentTarget.style.transform = 'translateX(4px)')} onMouseOut={e => (e.currentTarget.style.transform = 'translateX(0)')}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-amber)', marginBottom: '0.4rem', fontSize: '0.92rem' }}>
                  <AlertTriangle size={16} /> Risk Prediction
                </h4>
                <p style={{ fontSize: '0.86rem', color: 'var(--foreground)', lineHeight: 1.65 }}>{simulation.riskPrediction}</p>
              </div>

              <div className="slide-up stagger-3" style={{ background: 'var(--accent-teal-bg)', borderLeft: '4px solid var(--accent-teal)', padding: '0.9rem', borderRadius: 8, transition: 'transform 0.2s' }}
                onMouseOver={e => (e.currentTarget.style.transform = 'translateX(4px)')} onMouseOut={e => (e.currentTarget.style.transform = 'translateX(0)')}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-teal)', marginBottom: '0.4rem', fontSize: '0.92rem' }}>
                  <FlaskConical size={16} /> Personalized Care
                </h4>
                <p style={{ fontSize: '0.86rem', color: 'var(--foreground)', lineHeight: 1.65 }}>{simulation.personalizedCare}</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* BP Trajectory Chart */}
      {bpHistory.length > 0 && (
        <section className="glass-panel slide-up" style={{ marginTop: '1.5rem' }}>
          <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
              Blood Pressure Trajectory
            </h3>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', alignItems: 'center' }}>
              <span style={{ color: '#a5d8ff', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 16, height: 2, background: '#a5d8ff', display: 'inline-block', borderRadius: 2 }} /> Historical
              </span>
              {bpPrediction.length > 0 && (
                <span style={{ color: '#c7d2fe', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 16, height: 2, background: '#c7d2fe', display: 'inline-block', borderRadius: 2 }} /> Predicted
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
              <ReferenceLine y={120} stroke="rgba(74,222,128,0.3)" strokeDasharray="4 4" label={{ value: 'Normal', fill: '#4ade80', fontSize: 11 }} />
              <ReferenceLine y={140} stroke="rgba(252,165,165,0.3)" strokeDasharray="4 4" label={{ value: 'Stage 2 HTN', fill: '#fca5a5', fontSize: 11 }} />
              <Line type="monotone" dataKey="systolic" name="Systolic BP" stroke="#a5d8ff" strokeWidth={2.5} dot={{ r: 5, fill: '#a5d8ff', strokeWidth: 0 }} connectNulls={false} activeDot={{ r: 7 }} />
              {bpPrediction.length > 0 && (
                <Line type="monotone" dataKey="predicted" name="Predicted BP" stroke="#c7d2fe" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 5, fill: '#c7d2fe', strokeWidth: 0 }} connectNulls={false} activeDot={{ r: 7 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
          {!bpPrediction.length && (
            <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.82rem', marginTop: '0.5rem' }}>
              Run a Twin Simulation above to see the predicted BP trajectory
            </p>
          )}
        </section>
      )}

      {/* Biographer Agent Synthesis — full width below grid */}
      {(biography || loadingBio) && (
        <section className="glass-panel slide-up" style={{ marginTop: '1.5rem', borderLeft: '4px solid var(--accent-purple)' }}>
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-purple)' }}>
              <FileText size={20} /> Biographer Agent Synthesis
            </h3>
            <span className="badge purple">AI Generated · Groq</span>
          </div>
          <div style={{ background: 'var(--surface-muted)', padding: '1.25rem', borderRadius: 10, minHeight: 100 }}>
            {loadingBio ? (
              <div className="flex-center" style={{ flexDirection: 'column', gap: '0.6rem', color: 'var(--accent-purple)', minHeight: 80 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--accent-purple)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                Synthesizing patient history...
              </div>
            ) : (
              <div className="fade-in" style={{ whiteSpace: 'pre-wrap', fontSize: '0.93rem', color: 'var(--foreground)', lineHeight: 1.8 }}>
                {biography}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
