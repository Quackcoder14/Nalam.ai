'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, FileText, BellRing, Heart, Activity, Watch, Download, Eye, Clock, EyeOff, Network, Database, CheckCircle, XCircle, SkipForward, ScanLine, Upload } from 'lucide-react';

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

interface InterventionData {
  riskLevel: string;
  detectedPattern: string;
  suggestedIntervention: string;
  actionPlan: string;
  glassBox?: GlassBoxEntry[];
}

interface AuditEntry {
  patientId: string;
  clinician: string;
  reason: string;
  timestamp: string;
}

interface OcrResult {
  rawText: string;
  medications: string[];
  diagnoses: string[];
  labValues: Record<string, string>;
  structuredSummary: string;
  confidence: number;
  durationMs: number;
}

function timeAgo(isoString: string): string {
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

// Animated Wearable Metric Card
function VitalCard({ label, value, unit, color, icon: Icon, pulse }: {
  label: string; value: string | number; unit: string; color: string; icon: any; pulse?: boolean;
}) {
  return (
    <div style={{
      background: `rgba(${color}, 0.06)`,
      border: `1px solid rgba(${color}, 0.25)`,
      borderRadius: 12, padding: '0.85rem 1rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      transition: 'transform 0.2s'
    }}
      onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.02)')}
      onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: `rgba(${color}, 0.15)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: pulse ? 'heartbeat 1.4s ease-in-out infinite' : 'none'
      }}>
        <Icon size={18} color={`rgb(${color})`} />
      </div>
      <div>
        <div style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1, color: 'var(--deep-blue)' }}>
          {value}<span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--charcoal)', marginLeft: 3 }}>{unit}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--charcoal)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// Circular step ring
function StepRing({ percent }: { percent: number }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(0,82,165,0.12)" strokeWidth="8" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke="var(--primary)" strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          style={{ transition: 'stroke-dashoffset 1.5s ease' }}
        />
        <text x="40" y="45" textAnchor="middle" fill="#1A2B4A" fontSize="13" fontWeight="700">
          {Math.round(percent)}%
        </text>
      </svg>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--deep-blue)' }}>8,472</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--charcoal)' }}>steps today</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: 2, fontWeight: 600 }}>Goal: 10,000</div>
      </div>
    </div>
  );
}

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
      background: '#0d1117', border: '1px solid rgba(165,216,255,0.12)', borderRadius: 12,
      fontFamily: '"Courier New", Courier, monospace', overflow: 'hidden',
    }}>
      <div style={{ background: '#161b22', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ marginLeft: '0.75rem', color: '#94a3b8', fontSize: '0.78rem' }}>nalam-agent-console — glass-box-view</span>
      </div>
      <div style={{ padding: '0.75rem' }}>
        <div style={{ color: '#4ade80', fontSize: '0.78rem', marginBottom: '0.75rem', padding: '0.25rem 0' }}>
          <span style={{ color: '#94a3b8' }}>$ </span>nalam-orchestrator --trace-agents --verbose
        </div>
        {entries.map((entry, i) => (
          <div key={i} className="slide-up" style={{
            marginBottom: '0.5rem', border: `1px solid rgba(${entry.status === 'success' ? '74,222,128' : entry.status === 'error' ? '239,68,68' : '100,116,139'},0.15)`,
            borderRadius: 8, overflow: 'hidden', animationDelay: `${i * 0.08}s`,
          }}>
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: 'none', padding: '0.6rem 0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}
            >
              <span style={{ color: '#475569', fontSize: '0.75rem', minWidth: 24 }}>#{entry.step}</span>
              {statusIcon(entry.status)}
              <span style={{ color: statusColor(entry.status), fontSize: '0.82rem', fontWeight: 600, flex: 1 }}>{entry.agentName}</span>
              <span style={{ color: '#475569', fontSize: '0.72rem', marginRight: '0.5rem' }}>{entry.model}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#64748b', fontSize: '0.72rem' }}><Clock size={11} />{entry.durationMs}ms</span>
            </button>
            {expanded === i && (
              <div style={{ padding: '0.75rem 0.85rem', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', color: '#475569' }}>Executed at: {new Date(entry.timestamp).toLocaleTimeString()}</div>
                <div><div style={{ color: '#a5d8ff', fontSize: '0.72rem', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>► Input Features</div><pre style={{ color: '#94a3b8', fontSize: '0.72rem', overflow: 'auto', maxHeight: 140, lineHeight: 1.6, margin: 0 }}>{JSON.stringify(entry.inputSummary, null, 2)}</pre></div>
                <div><div style={{ color: statusColor(entry.status), fontSize: '0.72rem', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>◄ Output</div><pre style={{ color: '#cbd5e1', fontSize: '0.72rem', overflow: 'auto', maxHeight: 140, lineHeight: 1.6, margin: 0 }}>{typeof entry.output === 'string' ? entry.output : JSON.stringify(entry.output, null, 2)}</pre></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── OCR Scanner Component ────────────────────────────────────────────────────
function OcrScanner({ onImported }: { onImported: () => void }) {
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<string | null>(null);
  const [scanning, setScanning]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult]       = useState<OcrResult | null>(null);
  const [dragOver, setDragOver]   = useState(false);
  const [imported, setImported]   = useState(false);
  const [ocrError, setOcrError]   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, filename: file?.name || 'document' }),
      });
      const data = await res.json();
      if (data.error) { setOcrError(data.error); }
      else { setResult(data); }
    } catch { setOcrError('Network error — check your connection.'); }
    finally { setScanning(false); }
  };

  const importToVault = async () => {
    if (!result) return;
    setImporting(true);
    try {
      const diagText  = result.diagnoses.join(', ');
      const labText   = Object.entries(result.labValues).map(([k,v]) => `${k}:${v}`).join(', ');
      const notesText = result.structuredSummary || result.rawText.slice(0, 300);
      const medText   = result.medications.length ? `Medications: ${result.medications.join(', ')}.` : '';
      const res = await fetch('/api/patient/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId:  'P001',
          type:       'Document Scan',
          provider:   'nalam.ai OCR Engine',
          diagnosis:  diagText,
          notes:      `${medText} ${notesText}`.trim(),
          labResults: labText,
        }),
      });
      const data = await res.json();
      if (data.success) { setImported(true); onImported(); }
      else { setOcrError(`Import failed: ${data.error}`); }
    } catch { setOcrError('Import failed — network error.'); }
    finally { setImporting(false); }
  };

  return (
    <section className="glass-panel slide-up" style={{ marginBottom: '1.5rem', borderColor: 'rgba(199,210,254,0.2)' }}>
      <div className="flex-between" style={{ marginBottom: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-purple)' }}>
          <ScanLine size={20} /> Document Scanner
        </h3>
        <span className="badge purple">OCR + AI Structuring</span>
      </div>
      <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
        Scan handwritten prescriptions, lab reports, or discharge summaries to automatically extract medications, diagnoses, and lab values.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: preview ? '1fr 1fr' : '1fr', gap: '1.25rem' }}>
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--primary)' : 'rgba(199,210,254,0.25)'}`,
            borderRadius: 12, padding: '2rem', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
            cursor: 'pointer', transition: 'all 0.3s',
            background: dragOver ? 'rgba(199,210,254,0.04)' : 'transparent', minHeight: 160,
          }}
        >
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(199,210,254,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={20} color="var(--accent-purple)" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>Drop document or click to upload</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>JPG, PNG, TIFF — prescriptions, lab reports, discharge notes</div>
          </div>
          {file && <div style={{ fontSize: '0.8rem', color: 'var(--accent-purple)', fontWeight: 600 }}>📄 {file.name}</div>}
        </div>

        {/* Preview + scan button */}
        {preview && (
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(199,210,254,0.15)', minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
            <img src={preview} alt="Document preview" style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: 200 }} />
            <button
              onClick={e => { e.stopPropagation(); scan(); }}
              disabled={scanning}
              className="glass-button"
              style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)' }}
            >
              {scanning
                ? <><div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--accent-purple)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> Scanning...</>
                : <><ScanLine size={14} /> Scan Document</>}
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {ocrError && (
        <div className="fade-in" style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', borderLeft: '4px solid var(--accent-red)', borderRadius: 8, color: '#fca5a5', fontSize: '0.85rem' }}>
          ⚠ {ocrError}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="slide-up" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Stats bar */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>OCR Confidence: <strong style={{ color: result.confidence > 70 ? '#4ade80' : '#fca5a5' }}>{result.confidence}%</strong></span>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Inference: <strong style={{ color: '#a5d8ff' }}>{result.durationMs}ms</strong></span>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Medications found: <strong style={{ color: '#a5d8ff' }}>{result.medications.length}</strong></span>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Lab values found: <strong style={{ color: '#a5d8ff' }}>{Object.keys(result.labValues).length}</strong></span>
          </div>

          {/* Structured cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {result.medications.length > 0 && (
              <div style={{ background: 'rgba(165,216,255,0.05)', borderLeft: '3px solid var(--primary)', padding: '0.75rem', borderRadius: 8 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>💊 Medications</div>
                {result.medications.map((m, i) => <div key={i} style={{ fontSize: '0.83rem', color: '#cbd5e1', padding: '0.15rem 0' }}>{m}</div>)}
              </div>
            )}
            {result.diagnoses.length > 0 && (
              <div style={{ background: 'rgba(252,165,165,0.05)', borderLeft: '3px solid var(--accent-amber)', padding: '0.75rem', borderRadius: 8 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>🏥 Diagnoses</div>
                {result.diagnoses.map((d, i) => <div key={i} style={{ fontSize: '0.83rem', color: '#cbd5e1', padding: '0.15rem 0' }}>{d}</div>)}
              </div>
            )}
            {Object.keys(result.labValues).length > 0 && (
              <div style={{ background: 'rgba(199,210,254,0.05)', borderLeft: '3px solid var(--accent-purple)', padding: '0.75rem', borderRadius: 8 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>🧪 Lab Values</div>
                {Object.entries(result.labValues).map(([k, v]) => <div key={k} style={{ fontSize: '0.83rem', color: '#cbd5e1', padding: '0.15rem 0' }}>{k}: <strong>{v}</strong></div>)}
              </div>
            )}
          </div>

          {/* AI Summary */}
          {result.structuredSummary && (
            <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: 8 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>🤖 AI Clinical Summary (Groq)</div>
              <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.7, margin: 0 }}>{result.structuredSummary}</p>
            </div>
          )}

          {/* Raw text */}
          <details>
            <summary style={{ fontSize: '0.8rem', color: '#64748b', cursor: 'pointer', userSelect: 'none' }}>View raw extracted text</summary>
            <pre style={{ background: 'var(--background)', padding: '0.75rem', borderRadius: 8, fontSize: '0.73rem', color: '#94a3b8', overflow: 'auto', maxHeight: 160, marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{result.rawText || 'No text extracted.'}</pre>
          </details>

          <button
            onClick={importToVault}
            disabled={imported || importing}
            className="glass-button"
            style={{ background: imported ? 'var(--accent-green-bg)' : 'var(--primary-light)', borderColor: imported ? 'var(--accent-green)' : 'var(--primary)', color: imported ? 'var(--accent-green)' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 600 }}
          >
            {importing ? <><div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> Saving...</> : imported ? '✓ Added to Longitudinal Timeline' : '+ Import to Memory Vault'}
          </button>
        </div>
      )}
    </section>
  );
}

export default function PatientDashboard() {
  const [patient, setPatient] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [intervention, setIntervention] = useState<InterventionData | null>(null);
  const [loadingIntervention, setLoadingIntervention] = useState(false);
  const [consent, setConsent] = useState({ emergency: false, specialist: false, research: false });
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [heartRate, setHeartRate] = useState(72);
  const [showAudit, setShowAudit] = useState(false);
  const [showGlassBox, setShowGlassBox] = useState(false);
  const [agentLogs, setAgentLogs] = useState<GlassBoxEntry[]>([]);

  // Simulate live HR fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setHeartRate(prev => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(65, Math.min(85, prev + delta));
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchAuditLog = useCallback(async () => {
    try {
      const res = await fetch('/api/audit?patientId=P001');
      const data = await res.json();
      setAuditLog(data.entries || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchPatientData('P001');
    fetchAuditLog();
    const interval = setInterval(fetchAuditLog, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [fetchAuditLog]);

  const fetchPatientData = async (id: string) => {
    try {
      const res = await fetch(`/api/patient?id=${id}`);
      const data = await res.json();
      setPatient(data.patient);
      setRecords(data.records);
      setConsent({
        emergency: data.patient.consent_emergency === 'true',
        specialist: data.patient.consent_specialist === 'true',
        research: data.patient.consent_research === 'true',
      });
      generateBiographerSummary(data.patient, data.records);
      generateInterventionData(data.patient, data.records);
    } catch (e) { console.error(e); }
  };

  const generateBiographerSummary = async (patientData: any, recordsData: any[]) => {
    setLoadingSummary(true);
    try {
      const res = await fetch('/api/agents/biographer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient: patientData, records: recordsData }),
      });
      const data = await res.json();
      setSummary(data.summary);
      if (data.glassBox) setAgentLogs(prev => [...prev, ...data.glassBox]);
    } catch { setSummary('Failed to generate summary.'); }
    finally { setLoadingSummary(false); }
  };

  const generateInterventionData = async (patientData: any, recordsData: any[]) => {
    setLoadingIntervention(true);
    try {
      const res = await fetch('/api/agents/intervention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient: patientData, records: recordsData }),
      });
      const data = await res.json();
      setIntervention(data);
      if (data.glassBox) setAgentLogs(prev => [...prev, ...data.glassBox]);
    } catch { /* silent */ }
    finally { setLoadingIntervention(false); }
  };

  const toggleConsent = async (type: keyof typeof consent) => {
    const newConsent = { ...consent, [type]: !consent[type] };
    setConsent(newConsent);
    await fetch('/api/patient/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: patient?.id, ...newConsent }),
    });
  };

  const exportVault = () => {
    const vault = {
      exportedAt: new Date().toISOString(),
      exportedBy: 'Sentinel-Health Memory Layer v1.0',
      identity: {
        patientId: patient?.id,
        name: patient?.name,
        dob: patient?.dob,
        gender: patient?.gender,
        contact: patient?.contact,
      },
      smartConsentRules: {
        emergencyAccess: consent.emergency,
        specialistAccess: consent.specialist,
        researchParticipation: consent.research,
      },
      longitudinalRecords: records.map(r => ({
        recordId: r.record_id,
        date: r.date,
        type: r.type,
        provider: r.provider,
        diagnosis: r.diagnosis,
        notes: r.notes,
        labResults: r.lab_results,
      })),
      auditLog,
      metadata: {
        totalRecords: records.length,
        encryptionStandard: 'AES-256-GCM (simulated)',
        dataStandard: 'HL7 FHIR R4 (MVP)',
      },
    };
    const blob = new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel_encrypted_vault_${patient?.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRiskHexColor = (level: string) => {
    if (level === 'High') return 'var(--accent-red)';
    if (level === 'Medium') return 'var(--accent-amber)';
    return 'var(--accent-teal)';
  };
  const getRiskColorClass = (level: string) => {
    if (level === 'High') return 'red';
    if (level === 'Medium') return 'amber';
    return 'teal';
  };

  if (!patient) return (
    <div className="container flex-center" style={{ minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ color: 'var(--primary)' }}>Loading Identity Vault...</span>
    </div>
  );

  return (
    <div className="container fade-in">
      {/* Header Row */}
      <div className="slide-up stagger-1 flex-between" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Welcome, {patient.name}</h2>
          <p style={{ color: 'var(--accent-teal)' }}>Self-Sovereign Identity Verified • {patient.id}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {agentLogs.length > 0 && (
            <button
              className="glass-button"
              onClick={() => setShowGlassBox(p => !p)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: showGlassBox ? '#4ade80' : 'var(--primary)', color: showGlassBox ? '#4ade80' : 'var(--primary)' }}
            >
              {showGlassBox ? <EyeOff size={16} /> : <Eye size={16} />}
              {showGlassBox ? 'Hide' : 'View'} Glass Box
              <span style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', borderRadius: 9999, padding: '0 6px', fontSize: '0.75rem' }}>
                {agentLogs.length}
              </span>
            </button>
          )}
          <button
            onClick={() => { setShowAudit(p => !p); fetchAuditLog(); }}
            className="glass-button"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Clock size={16} /> {showAudit ? 'Hide' : 'Show'} Audit Log
          </button>
          <button
            onClick={exportVault}
            className="glass-button"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: '#a5d8ff', background: 'rgba(165,216,255,0.12)' }}
          >
            <Download size={16} /> Export FHIR-Compliant Vault
          </button>
        </div>
      </div>

      {/* Glass Box Panel */}
      {showGlassBox && agentLogs.length > 0 && (
        <div className="slide-up" style={{ marginBottom: '1.5rem' }}>
          <GlassBoxPanel entries={agentLogs} />
        </div>
      )}

      {/* OCR Document Scanner */}
      <OcrScanner onImported={() => fetchPatientData('P001')} />

      {/* Audit Log */}
      {showAudit && (
        <section className="glass-panel slide-up" style={{ marginBottom: '1.5rem', borderColor: 'rgba(199,210,254,0.2)' }}>
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-purple)' }}>
              <Clock size={18} /> Zero-Trust Audit Log
            </h3>
            <span className="badge purple">{auditLog.length} access event{auditLog.length !== 1 ? 's' : ''}</span>
          </div>
          {auditLog.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No access events recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {auditLog.map((entry, i) => (
                <div key={i} className="slide-up" style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 10,
                  borderLeft: '3px solid var(--accent-purple)',
                  animationDelay: `${i * 0.05}s`
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(199,210,254,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Eye size={16} color="var(--accent-purple)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{entry.clinician}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{entry.reason}</div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {timeAgo(entry.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="grid-2">
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Smart Consent Module */}
          <section className="glass-panel slide-up stagger-2">
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={20} color="var(--primary)" /> Smart Consent Rules
              </h3>
              <span className="badge teal">Master Key Active</span>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '1.5rem' }}>
              You control who accesses your longitudinal data. Toggle to grant or revoke real-time access.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <ConsentToggle label="Emergency Room Access" desc="Auto-share full history during ER admissions." active={consent.emergency} onToggle={() => toggleConsent('emergency')} />
              <ConsentToggle label="Specialist Access (Cardiology)" desc="Share only relevant cardiovascular history." active={consent.specialist} onToggle={() => toggleConsent('specialist')} />
              <ConsentToggle label="Research (Anonymized)" desc="Allow AI-driven longitudinal studies." active={consent.research} onToggle={() => toggleConsent('research')} />
            </div>
          </section>

          {/* Connected Institutional Silos */}
          <section className="glass-panel slide-up stagger-2">
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Network size={20} color="var(--accent-purple)" /> Connected EHR Silos
              </h3>
              <span className="badge purple pulse-glow">Interoperability Active</span>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '1.5rem' }}>
              Aggregating disjointed medical records across institutions into a single unified timeline.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <EhrIntegrationCard name="Epic Systems" location="Mayo Clinic" status="Synced" icon={Database} color="var(--primary)" />
              <EhrIntegrationCard name="Cerner Health" location="Mount Sinai" status="Synced" icon={Database} color="var(--accent-teal)" />
              <EhrIntegrationCard name="Apple HealthKit" location="Wearables" status="Live Stream" icon={Activity} color="var(--accent-amber)" />
            </div>
          </section>

          {/* Intervention Engine */}
          <section className="glass-panel slide-up stagger-3" style={{
            borderColor: intervention ? `rgba(${intervention.riskLevel === 'High' ? '239,68,68' : intervention.riskLevel === 'Medium' ? '252,165,165' : '165,216,255'}, 0.3)` : 'var(--glass-border)'
          }}>
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: intervention ? getRiskHexColor(intervention.riskLevel) : 'var(--primary)' }}>
                <BellRing size={20} /> Intervention Engine
              </h3>
              {intervention && <span className={`badge ${getRiskColorClass(intervention.riskLevel)} pulse-glow`}>{intervention.riskLevel} Risk</span>}
            </div>
            {loadingIntervention ? (
              <div className="flex-center" style={{ height: '100px', color: 'var(--primary)', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  Analyzing vitals and history patterns...
                </div>
              </div>
            ) : intervention ? (
              <div className="fade-in" style={{
                background: `rgba(${intervention.riskLevel === 'High' ? '239,68,68' : intervention.riskLevel === 'Medium' ? '252,165,165' : '165,216,255'}, 0.05)`,
                padding: '1rem', borderRadius: 8,
                borderLeft: `4px solid ${getRiskHexColor(intervention.riskLevel)}`
              }}>
                <h4 style={{ marginBottom: '0.4rem', fontSize: '0.95rem' }}>Detected Pattern</h4>
                <p style={{ fontSize: '0.88rem', color: '#cbd5e1', marginBottom: '1rem' }}>{intervention.detectedPattern}</p>
                <h4 style={{ marginBottom: '0.4rem', fontSize: '0.95rem' }}>Action Plan</h4>
                <p style={{ fontSize: '0.88rem', color: '#cbd5e1', marginBottom: '1rem' }}>{intervention.actionPlan}</p>
                <button className="glass-button" style={{ width: '100%', borderColor: getRiskHexColor(intervention.riskLevel), color: getRiskHexColor(intervention.riskLevel) }}>
                  {intervention.suggestedIntervention}
                </button>
              </div>
            ) : null}
          </section>

          {/* Wearable Telemetry */}
          <section className="glass-panel slide-up stagger-3">
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a5d8ff' }}>
                <Watch size={20} /> Live Wearable Telemetry
              </h3>
              <span className="badge teal" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'pulseGlow 1.5s infinite' }} />
                Syncing
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <VitalCard label="Heart Rate" value={heartRate} unit="BPM" color="252,165,165" icon={Heart} pulse />
              <VitalCard label="Blood Oxygen" value="98" unit="SpO₂" color="165,216,255" icon={Activity} />
              <VitalCard label="Sleep" value="7h 24m" unit="" color="199,210,254" icon={Watch} />
              <VitalCard label="Resting BP" value="142/88" unit="mmHg" color="252,165,165" icon={Activity} />
            </div>
            <div style={{ background: 'var(--background)', borderRadius: 10, padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <StepRing percent={84.72} />
            </div>
          </section>

        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Biographer Agent */}
          <section className="glass-panel slide-up stagger-2" style={{ flex: 1 }}>
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-purple)' }}>
                <FileText size={20} /> Biographer Agent Synthesis
              </h3>
              <span className="badge purple">AI Generated</span>
            </div>
            <div style={{ background: 'var(--background)', padding: '1.5rem', borderRadius: 8, minHeight: '200px' }}>
              {loadingSummary ? (
                <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '0.75rem', color: 'var(--accent-purple)', minHeight: 180 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--accent-purple)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  Synthesizing decades of records...
                </div>
              ) : (
                <div className="fade-in" style={{ whiteSpace: 'pre-wrap', fontSize: '0.93rem', color: '#f8fafc', lineHeight: 1.75 }}>
                  {summary}
                </div>
              )}
            </div>
          </section>

          {/* Recent Medical Timeline */}
          <section className="glass-panel slide-up stagger-3">
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a5d8ff' }}>
                <Activity size={20} /> Longitudinal Timeline
              </h3>
              <span className="badge teal">{records.length} records</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {records.map((r, i) => (
                <div key={r.record_id} className="slide-up" style={{ animationDelay: `${0.05 * i}s`, display: 'flex', gap: '0.75rem', paddingBottom: '1rem', position: 'relative' }}>
                  {/* Timeline line */}
                  {i < records.length - 1 && (
                    <div style={{ position: 'absolute', left: 11, top: 24, bottom: 0, width: 2, background: 'rgba(165,216,255,0.1)' }} />
                  )}
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(165,216,255,0.15)', border: '2px solid rgba(165,216,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{r.diagnosis || r.type}</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.date}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 2 }}>{r.provider}</div>
                    {r.notes && <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 3 }}>{r.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

function ConsentToggle({ label, desc, active, onToggle }: { label: string; desc: string; active: boolean; onToggle: () => void }) {
  return (
    <div className="flex-between" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, transition: 'background 0.2s' }}
      onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
      onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
    >
      <div>
        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{label}</div>
        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{desc}</div>
      </div>
      <button onClick={onToggle} style={{
        width: 48, height: 24, borderRadius: 12,
        background: active ? 'var(--primary)' : '#374151',
        border: 'none', position: 'relative', cursor: 'pointer',
        transition: 'background 0.3s', flexShrink: 0
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 3, left: active ? 27 : 3, transition: 'left 0.3s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
        }} />
      </button>
    </div>
  );
}

function EhrIntegrationCard({ name, location, status, icon: Icon, color }: { name: string, location: string, status: string, icon: any, color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `rgba(255,255,255,0.05)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{name}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{location}</div>
        </div>
      </div>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
        ✓ {status}
      </div>
    </div>
  );
}
