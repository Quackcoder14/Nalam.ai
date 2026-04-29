'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Activity, BellRing, Network, Database, Heart, Watch, Rss, Clock, Eye, Download, ChevronDown, ChevronRight } from 'lucide-react';

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
  const [patient, setPatient] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [consent, setConsent] = useState<ConsentState>({ emergency: false, specialist: false, research: false });
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [heartRate, setHeartRate] = useState(72);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [intervention, setIntervention] = useState<any>(null);
  const router = useRouter();

  // Live HR simulation
  useEffect(() => {
    const iv = setInterval(() => setHeartRate(p => Math.max(65, Math.min(88, p + Math.floor(Math.random() * 5) - 2))), 2000);
    return () => clearInterval(iv);
  }, []);

  const fetchAudit = useCallback(async () => {
    try {
      const r = await fetch('/api/audit?patientId=P001');
      const d = await r.json();
      setAuditLog(d.entries || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    // Auth guard
    const role = localStorage.getItem('nalamRole');
    if (!role) { router.push('/'); return; }
    if (role === 'clinician') { router.push('/clinician'); return; }

    (async () => {
      try {
        const res = await fetch('/api/patient?id=P001');
        const data = await res.json();
        setPatient(data.patient);
        setRecords(data.records || []);
        setConsent({
          emergency: data.patient.consent_emergency === 'true',
          specialist: data.patient.consent_specialist === 'true',
          research: data.patient.consent_research === 'true',
        });
        // Fetch intervention
        const ir = await fetch('/api/agents/intervention', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patient: data.patient, records: data.records }) });
        setIntervention(await ir.json());
      } catch (e) { console.error(e); }
    })();
    fetchAudit();
    const iv = setInterval(fetchAudit, 12000);
    return () => clearInterval(iv);
  }, [fetchAudit, router]);

  const toggleConsent = async (type: keyof ConsentState) => {
    const next = { ...consent, [type]: !consent[type] };
    setConsent(next);
    await fetch('/api/patient/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'P001', ...next }) });
  };

  const exportVault = () => {
    const blob = new Blob([JSON.stringify({ patient, records, auditLog, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `nalam_vault_P001.json` });
    a.click();
  };

  if (!patient) return (
    <div className="container flex-center" style={{ minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Loading your Health Vault...</span>
    </div>
  );

  const riskColor = intervention?.riskLevel === 'High' ? 'var(--accent-red)' : intervention?.riskLevel === 'Medium' ? 'var(--accent-amber)' : 'var(--accent-teal)';

  return (
    <div className="container fade-in">
      {/* Header */}
      <div className="slide-up stagger-1 flex-between" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.2rem' }}>Welcome, {patient.name} 👋</h2>
          <p style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>Identity Verified · {patient.id}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button className="glass-button" onClick={() => { setShowAudit(p => !p); fetchAudit(); }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={15} /> Audit Log
          </button>
          <button className="glass-button" onClick={exportVault} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: 'var(--powder-blue-dark)' }}>
            <Download size={15} /> Export FHIR Vault
          </button>
        </div>
      </div>

      {/* Feed Input Module CTA */}
      <div className="slide-up stagger-1" style={{ marginBottom: '1.5rem' }}>
        <button className="feed-card" onClick={() => router.push('/feed')} style={{ background: 'linear-gradient(135deg,#EBF4FF 0%,#E0F7FA 100%)', borderColor: 'var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg,#0052A5,#0097A7)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,82,165,0.25)', flexShrink: 0 }}>
              <Rss size={26} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--deep-blue)', marginBottom: '0.2rem' }}>Feed Input</div>
              <div style={{ fontSize: '0.87rem', color: 'var(--charcoal)' }}>Upload documents & view live wearable data — tap to open</div>
            </div>
            <ChevronRight size={22} color="var(--primary)" />
          </div>
        </button>
      </div>

      {/* Audit Log */}
      {showAudit && (
        <section className="glass-panel slide-up" style={{ marginBottom: '1.5rem' }}>
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-purple)' }}><Eye size={18} /> Zero-Trust Audit Log</h3>
            <span className="badge purple">{auditLog.length} events</span>
          </div>
          {auditLog.length === 0 ? <p style={{ color: 'var(--charcoal)', fontSize: '0.9rem' }}>No access events yet.</p> : (
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

          {/* Consent */}
          <section className="glass-panel slide-up stagger-2">
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Shield size={19} color="var(--primary)" /> Smart Consent</h3>
              <span className="badge teal">Master Key Active</span>
            </div>
            <p style={{ fontSize: '0.87rem', color: 'var(--charcoal)', marginBottom: '1.25rem' }}>Control who can access your longitudinal health data in real time.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <ConsentToggle label="Emergency Room Access" desc="Auto-share full history during ER admissions." active={consent.emergency} onToggle={() => toggleConsent('emergency')} />
              <ConsentToggle label="Specialist Access" desc="Share relevant history with your cardiologist." active={consent.specialist} onToggle={() => toggleConsent('specialist')} />
              <ConsentToggle label="Research (Anonymized)" desc="Contribute to AI-driven longitudinal studies." active={consent.research} onToggle={() => toggleConsent('research')} />
            </div>
          </section>

          {/* EHR Silos */}
          <section className="glass-panel slide-up stagger-2">
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Network size={19} color="var(--accent-purple)" /> Connected EHR Silos</h3>
              <span className="badge purple pulse-glow">Live</span>
            </div>
            {[{ name: 'Epic Systems', loc: 'Apollo Hospital Chennai', color: 'var(--primary)' }, { name: 'Cerner Health', loc: 'AIIMS Delhi', color: 'var(--accent-teal)' }, { name: 'Apple HealthKit', loc: 'Wearables · Live Stream', color: 'var(--accent-amber)' }].map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', background: 'var(--surface-muted)', borderRadius: 9, borderLeft: `3px solid ${s.color}`, marginBottom: '0.6rem' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--deep-blue)' }}>{s.name}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--charcoal)' }}>{s.loc}</div>
                </div>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-green)', background: 'var(--accent-green-bg)', padding: '0.18rem 0.55rem', borderRadius: 6 }}>✓ Synced</span>
              </div>
            ))}
          </section>

          {/* Intervention Engine */}
          {intervention && (
            <section className="glass-panel slide-up stagger-3" style={{ borderColor: `${riskColor}44` }}>
              <div className="flex-between" style={{ marginBottom: '0.85rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: riskColor }}><BellRing size={19} /> Intervention Engine</h3>
                <span className="badge amber pulse-glow">{intervention.riskLevel} Risk</span>
              </div>
              <div style={{ background: `${riskColor}0D`, borderLeft: `4px solid ${riskColor}`, padding: '0.9rem', borderRadius: 8 }}>
                <div style={{ fontWeight: 700, fontSize: '0.87rem', color: 'var(--deep-blue)', marginBottom: '0.3rem' }}>Detected Pattern</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', marginBottom: '0.75rem', lineHeight: 1.6 }}>{intervention.detectedPattern}</p>
                <div style={{ fontWeight: 700, fontSize: '0.87rem', color: 'var(--deep-blue)', marginBottom: '0.3rem' }}>Action Plan</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', lineHeight: 1.6 }}>{intervention.actionPlan}</p>
              </div>
            </section>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Live Vitals (preview) */}
          <section className="glass-panel slide-up stagger-2">
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-teal)' }}><Watch size={19} /> Live Vitals Preview</h3>
              <span className="badge teal" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulseGlow 1.4s infinite' }} /> Syncing
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              {[{ label: 'Heart Rate', value: `${heartRate} BPM`, color: '#FCA5A5', icon: Heart, pulse: true }, { label: 'SpO₂', value: '98%', color: '#A5D8FF', icon: Activity }, { label: 'Resting BP', value: '142/88', color: '#FCA5A5', icon: Activity }, { label: 'Sleep', value: '7h 24m', color: '#C7D2FE', icon: Watch }].map(({ label, value, color, icon: Icon, pulse }) => (
                <div key={label} style={{ background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 11, padding: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: pulse ? 'pulseGlow 1.5s infinite' : 'none' }}>
                    <Icon size={17} color={color.replace('18', '')} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--deep-blue)' }}>{value}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--charcoal)' }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="glass-button" onClick={() => router.push('/feed')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <Rss size={14} /> Open Full Feed Input
            </button>
          </section>

          {/* Longitudinal Timeline */}
          <section className="glass-panel slide-up stagger-3">
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}><Activity size={19} /> Longitudinal Timeline</h3>
              <span className="badge blue">{records.length} records</span>
            </div>
            <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
              {/* Vertical line */}
              <div style={{ position: 'absolute', left: '5px', top: 0, bottom: 0, width: 2, background: 'linear-gradient(to bottom, var(--powder-blue), var(--border))' }} />
              {records.map((r, i) => (
                <div key={r.record_id}
                  className={`timeline-entry${expandedRecord === r.record_id ? ' expanded' : ''}`}
                  style={{ marginBottom: '0.5rem', animationDelay: `${i * 0.05}s` }}
                  onClick={() => setExpandedRecord(expandedRecord === r.record_id ? null : r.record_id)}
                >
                  {/* Dot */}
                  <div className="timeline-dot" style={{ position: 'absolute', left: 0, top: '0.9rem', width: 12, height: 12, borderRadius: '50%', background: expandedRecord === r.record_id ? 'var(--primary)' : 'var(--powder-blue-dark)', border: '2px solid var(--primary)', boxShadow: '0 0 0 3px rgba(165,216,255,0.25)' }} />
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
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
