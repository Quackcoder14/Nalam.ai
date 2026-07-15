'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Heart, UserPlus, Bell, Activity, ChevronRight, ShieldAlert, X, Shield,
  CheckCircle, Calendar, ChevronDown, RotateCcw, Trash2, KeyRound, RefreshCw,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { apiFetch } from '@/lib/apiFetch';

const PAGE_SIZE = 5;

function VitalBadge({ label, value, unit }: { label: string; value: any; unit: string }) {
  return (
    <div style={{ background: 'var(--surface-muted)', borderRadius: 12, padding: '0.65rem 0.75rem' }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--charcoal)', marginBottom: '0.2rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)' }}>
        {value ?? '--'} <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--charcoal)' }}>{unit}</span>
      </div>
    </div>
  );
}

export default function FamilyDashboard() {
  const [links, setLinks] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertPage, setAlertPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPatientId, setNewPatientId] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [pendingLinkId, setPendingLinkId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [activeOtpLinkId, setActiveOtpLinkId] = useState<string | null>(null);
  const [inlineOtp, setInlineOtp] = useState<Record<string, string>>({});
  const [inlineOtpLoading, setInlineOtpLoading] = useState<string | null>(null);
  const [inlineOtpError, setInlineOtpError] = useState<Record<string, string>>({});
  const [resendLoading, setResendLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);

  const router = useRouter();
  const { t, lang } = useLanguage();
  const familyName = typeof window !== 'undefined'
    ? (sessionStorage.getItem('nalamPatientName') || localStorage.getItem('nalamPatientName'))
    : '';

  useEffect(() => { loadData(); }, []);

  const loadData = async (skipCache = false) => {
    try {
      const res = await apiFetch('/api/family/patients', { skipCache });
      if (res.ok) {
        const data = await res.json();
        setLinks(data.links || []);

        const approvedIds = (data.links || [])
          .filter((l: any) => l.consentStatus === 'approved')
          .map((l: any) => l.patientId);

        if (approvedIds.length > 0) {
          const alertResults = await Promise.all(
            approvedIds.map((pid: string) =>
              apiFetch(`/api/notify/alerts?patientId=${pid}&lang=${lang}`).then(r => r.ok ? r.json() : { alerts: [] })
            )
          );
          const combined = alertResults
            .flatMap((r: any) => r.alerts || [])
            .filter((a: any) => !a.is_read)
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setAlerts(combined);
        }
      }
    } catch (e) {
      console.error('Failed to load family data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPatient = async () => {
    setAddError(null);
    if (!newPatientId.trim()) { setAddError('Patient ID is required'); return; }
    setAddLoading(true);
    try {
      const res = await apiFetch('/api/family/patients', {
        method: 'POST',
        body: JSON.stringify({ patientId: newPatientId.trim(), nickname: newNickname, relation: newRelation }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || 'Failed to add patient');
      } else {
        setAddSuccess(true);
        setPendingLinkId(data.linkId);
        loadData();
      }
    } catch {
      setAddError('Network error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleVerifyOtp = async (linkId: string) => {
    if (otpCode.trim().length !== 6) { setOtpError('Enter the 6-digit code'); return; }
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await apiFetch('/api/patient/family-links', {
        method: 'PATCH',
        body: JSON.stringify({ linkId, action: 'approve_by_code', inviteCode: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setOtpError(data.error || 'Invalid code'); }
      else { setOtpSuccess(true); loadData(true); }
    } catch { setOtpError('Network error'); }
    finally { setOtpLoading(false); }
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setAddSuccess(false);
    setAddError(null);
    setNewPatientId('');
    setNewNickname('');
    setNewRelation('');
    setPendingLinkId(null);
    setOtpCode('');
    setOtpError(null);
    setOtpSuccess(false);
  };

  const handleResend = async (linkId: string) => {
    setResendLoading(linkId);
    try {
      const res = await apiFetch('/api/family/patients/resend', {
        method: 'POST',
        body: JSON.stringify({ linkId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to resend'); }
      else { await loadData(); }
    } catch { alert('Network error'); }
    finally { setResendLoading(null); }
  };

  const handleCancel = async (linkId: string) => {
    if (!confirm('Cancel this request? The patient will no longer see the code.')) return;
    setCancelLoading(linkId);
    try {
      const res = await apiFetch(`/api/patient/family-links?linkId=${linkId}`, { method: 'DELETE' });
      if (res.ok) await loadData();
      else { const d = await res.json(); alert(d.error || 'Failed to cancel'); }
    } catch { alert('Network error'); }
    finally { setCancelLoading(null); }
  };

  const handleInlineVerify = async (linkId: string) => {
    const code = (inlineOtp[linkId] || '').trim();
    if (code.length !== 6) { setInlineOtpError(prev => ({ ...prev, [linkId]: 'Enter the 6-digit code' })); return; }
    setInlineOtpLoading(linkId);
    setInlineOtpError(prev => ({ ...prev, [linkId]: '' }));
    try {
      const res = await apiFetch('/api/patient/family-links', {
        method: 'PATCH',
        body: JSON.stringify({ linkId, action: 'approve_by_code', inviteCode: code }),
      });
      const data = await res.json();
      if (!res.ok) { setInlineOtpError(prev => ({ ...prev, [linkId]: data.error || 'Invalid code' })); }
      else { setActiveOtpLinkId(null); await loadData(true); }
    } catch { setInlineOtpError(prev => ({ ...prev, [linkId]: 'Network error' })); }
    finally { setInlineOtpLoading(null); }
  };

  const getStatusColor = (patient: any) => {
    if (!patient?.vitals) return 'var(--charcoal)';
    const { hr, spo2, sys, temp } = patient.vitals;
    if (hr > 120 || spo2 < 92 || sys > 160 || temp > 38.5) return '#DC2626';
    if (hr > 100 || spo2 < 95 || sys > 140 || temp > 37.8) return '#D97706';
    return '#059669';
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const approvedLinks = links.filter(l => l.consentStatus === 'approved');
  const pendingLinks = links.filter(l => l.consentStatus === 'pending');
  const visibleAlerts = alerts.slice(0, alertPage * PAGE_SIZE);
  const hasMoreAlerts = alerts.length > alertPage * PAGE_SIZE;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', padding: 'max(1.5rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(5rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '0.2rem' }}>
              {t('family.myFamily') || 'My Family'}
            </h1>
            <p style={{ color: 'var(--charcoal)', fontSize: '0.95rem' }}>Welcome back, {familyName}</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'linear-gradient(135deg, #0052A5, #0073D9)',
              color: 'white', border: 'none', borderRadius: 12,
              padding: '0.75rem 1rem', fontSize: '0.9rem', fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,82,165,0.2)',
            }}
          >
            <UserPlus size={16} /> {t('family.addMember') || 'Add Member'}
          </button>
        </div>

        {/* Aggregated Alerts — paginated */}
        {alerts.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={18} color="#D97706" /> Active Alerts
              <span style={{ background: '#FEF3C7', color: '#D97706', borderRadius: 20, padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 800 }}>{alerts.length}</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {visibleAlerts.map(a => {
                const patient = approvedLinks.find(l => l.patientId === a.patient_id);
                const displayName = patient?.nickname || patient?.patient?.name || a.patient_id;
                const isCrit = a.severity === 'critical';
                const isWarn = a.severity === 'warning';
                return (
                  <div key={a.id} style={{
                    background: isCrit ? '#FEF2F2' : isWarn ? '#FFFBEB' : 'var(--surface)',
                    border: `1px solid ${isCrit ? '#FECACA' : isWarn ? '#FDE68A' : 'var(--border)'}`,
                    borderRadius: 16, padding: '1rem 1.25rem',
                    display: 'flex', gap: '1rem', alignItems: 'flex-start',
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: isCrit ? '#FEE2E2' : isWarn ? '#FEF3C7' : 'var(--surface-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isCrit || isWarn
                        ? <ShieldAlert size={19} color={isCrit ? '#DC2626' : '#D97706'} />
                        : <Bell size={19} color="var(--primary)" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isCrit ? '#DC2626' : 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{displayName}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--charcoal)' }}>{new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.15rem' }}>{a.title}</div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', lineHeight: 1.5, margin: 0 }}>{a.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMoreAlerts && (
              <button
                onClick={() => setAlertPage(p => p + 1)}
                style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', cursor: 'pointer', width: '100%', justifyContent: 'center' }}
              >
                <ChevronDown size={16} /> Show More ({alerts.length - alertPage * PAGE_SIZE} remaining)
              </button>
            )}
          </div>
        )}

        {/* Pending Requests */}
        {pendingLinks.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} color="var(--charcoal)" /> Pending Approvals
              <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: '0.75rem', fontWeight: 700, borderRadius: 20, padding: '0.15rem 0.6rem' }}>{pendingLinks.length}</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {pendingLinks.map(l => (
                <div key={l.linkId} style={{ background: 'var(--surface)', border: '1.5px solid #FDE68A', borderRadius: 16, padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '0.95rem' }}>Patient ID: {l.patientId}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--charcoal)', marginTop: 2 }}>
                        {l.relation || 'Family member'} • Requested {new Date(l.requestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', background: '#FEF3C7', color: '#92400E', borderRadius: 8, padding: '0.3rem 0.6rem', display: 'inline-block', fontWeight: 600 }}>
                        ⏳ Waiting for patient to share the code
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#FEF3C7', color: '#D97706', padding: '0.3rem 0.6rem', borderRadius: 8, flexShrink: 0 }}>Pending</span>
                  </div>

                  {/* Inline OTP entry toggle */}
                  {activeOtpLinkId === l.linkId ? (
                    <div style={{ background: 'var(--surface-muted)', borderRadius: 12, padding: '1rem', marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--charcoal)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Enter 6-Digit Code from Patient</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={inlineOtp[l.linkId] || ''}
                        onChange={e => setInlineOtp(prev => ({ ...prev, [l.linkId]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                        placeholder="● ● ● ● ● ●"
                        style={{
                          width: '100%', padding: '0.85rem', border: `2px solid ${inlineOtpError[l.linkId] ? '#FECACA' : 'var(--border)'}`,
                          borderRadius: 10, fontSize: '1.5rem', fontWeight: 800, textAlign: 'center',
                          letterSpacing: '0.4em', background: 'var(--surface)', color: 'var(--foreground)',
                          boxSizing: 'border-box', fontFamily: 'monospace',
                        }}
                      />
                      {inlineOtpError[l.linkId] && <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#B91C1C', fontWeight: 600 }}>⚠️ {inlineOtpError[l.linkId]}</div>}
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button
                          onClick={() => handleInlineVerify(l.linkId)}
                          disabled={inlineOtpLoading === l.linkId || (inlineOtp[l.linkId] || '').length !== 6}
                          style={{ flex: 1, padding: '0.7rem', background: (inlineOtp[l.linkId] || '').length === 6 ? 'linear-gradient(135deg,#059669,#10B981)' : 'var(--surface-muted)', color: (inlineOtp[l.linkId] || '').length === 6 ? 'white' : 'var(--charcoal)', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
                        >
                          {inlineOtpLoading === l.linkId ? 'Verifying…' : 'Confirm Access'}
                        </button>
                        <button onClick={() => setActiveOtpLinkId(null)} style={{ padding: '0.7rem 1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--charcoal)' }}>Cancel</button>
                      </div>
                    </div>
                  ) : null}

                  {/* Action row */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setActiveOtpLinkId(activeOtpLinkId === l.linkId ? null : l.linkId)}
                      style={{ flex: 1, padding: '0.6rem 0.75rem', background: '#EFF6FF', color: '#1D4ED8', border: '1.5px solid #BFDBFE', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                    >
                      <KeyRound size={13} /> Enter Code
                    </button>
                    <button
                      onClick={() => handleResend(l.linkId)}
                      disabled={resendLoading === l.linkId}
                      style={{ flex: 1, padding: '0.6rem 0.75rem', background: 'var(--surface-muted)', color: 'var(--charcoal)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', opacity: resendLoading === l.linkId ? 0.6 : 1 }}
                    >
                      <RotateCcw size={13} /> {resendLoading === l.linkId ? 'Resending…' : 'Resend'}
                    </button>
                    <button
                      onClick={() => handleCancel(l.linkId)}
                      disabled={cancelLoading === l.linkId}
                      style={{ flex: 1, padding: '0.6rem 0.75rem', background: '#FEF2F2', color: '#B91C1C', border: '1.5px solid #FECACA', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', opacity: cancelLoading === l.linkId ? 0.6 : 1 }}
                    >
                      <Trash2 size={13} /> {cancelLoading === l.linkId ? 'Cancelling…' : 'Cancel'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Patient Grid */}
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Heart size={18} color="#DC2626" /> {t('family.members') || 'Family Members'}
          <button onClick={() => loadData(true)} style={{ marginLeft: 'auto', background: 'var(--surface-muted)', border: '1px solid var(--border)', padding: '0.4rem 0.75rem', borderRadius: 10, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Activity size={14}/> Refresh Vitals</button>
        </h2>

        {approvedLinks.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 20, padding: '3rem 2rem', textAlign: 'center' }}>
            <UserPlus size={32} color="var(--charcoal)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.5rem' }}>{t('family.noMembers') || 'No family members yet'}</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--charcoal)', maxWidth: 400, margin: '0 auto' }}>
              Add a patient using their Patient ID to monitor their health records, vitals, and appointments.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {approvedLinks.map(l => {
              const p = l.patient;
              const statusColor = getStatusColor(p);
              const v = p?.vitals;
              return (
                <div key={l.linkId} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, padding: '1.5rem',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden',
                }}>
                  {/* Status strip */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: statusColor, borderRadius: '24px 24px 0 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', marginTop: '0.25rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '0.1rem' }}>
                        {l.nickname || p?.name}
                      </h3>
                      <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)', fontWeight: 500 }}>
                        {l.relation || 'Family Member'} • {p?.id}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      {p?.alertsCount > 0 && (
                        <button
                          onClick={() => router.push(`/family/patient/${p?.id}?tab=alerts`)}
                          title={`${p.alertsCount} unread alerts`}
                          style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #FECACA', cursor: 'pointer', position: 'relative' }}
                        >
                          <Bell size={16} color="#DC2626" />
                          <span style={{ position: 'absolute', top: -4, right: -4, background: '#DC2626', color: 'white', borderRadius: '50%', width: 16, height: 16, fontSize: '0.62rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p.alertsCount}</span>
                        </button>
                      )}
                      {p?.nextAppointment && (
                        <button
                          onClick={() => router.push(`/family/patient/${p?.id}?tab=appointments`)}
                          title={`Next: ${p.nextAppointment.date}`}
                          style={{ width: 36, height: 36, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #BFDBFE', cursor: 'pointer' }}
                        >
                          <Calendar size={16} color="#0052A5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Full vitals grid */}
                  {v ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
                      <VitalBadge label="Heart Rate" value={v.hr} unit="bpm" />
                      <VitalBadge label="SpO₂" value={v.spo2} unit="%" />
                      <VitalBadge label="BP" value={v.sys && v.dia ? `${v.sys}/${v.dia}` : null} unit="mmHg" />
                      <VitalBadge label="Temp" value={v.temp} unit="°C" />
                      <VitalBadge label="Resp" value={v.resp} unit="/min" />
                      <div style={{ background: 'var(--surface-muted)', borderRadius: 12, padding: '0.65rem 0.75rem' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--charcoal)', marginBottom: '0.2rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: statusColor }}>
                          {statusColor === '#DC2626' ? '⚠ Critical' : statusColor === '#D97706' ? '⚠ Warning' : '✓ Normal'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: 'var(--surface-muted)', borderRadius: 12, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Activity size={14} /> No vitals recorded yet
                    </div>
                  )}

                  <button
                    onClick={() => router.push(`/family/patient/${p?.id}`)}
                    style={{
                      width: '100%', background: 'var(--foreground)', color: 'var(--background)',
                      border: 'none', borderRadius: 12, padding: '0.75rem', fontSize: '0.9rem',
                      fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    }}
                  >
                    View Profile <ChevronRight size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--surface)', width: '100%', maxWidth: 420, borderRadius: 24, padding: '2rem', animation: 'slideUp 0.3s ease', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)' }}>Add Family Member</h3>
              <button onClick={closeAddModal} style={{ background: 'var(--surface-muted)', border: 'none', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={18} color="var(--charcoal)" />
              </button>
            </div>

            {addSuccess ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                {otpSuccess ? (
                  <>
                    <CheckCircle size={48} color="#059669" style={{ margin: '0 auto 1rem' }} />
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>Access Granted! 🎉</h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--charcoal)', marginBottom: '1.5rem' }}>You now have full access to this patient's health data.</p>
                    <button onClick={closeAddModal} style={{ padding: '0.75rem 2rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>Done</button>
                  </>
                ) : (
                  <>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                      <Shield size={28} color="#0052A5" />
                    </div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>Request Sent!</h4>
                    <p style={{ fontSize: '0.88rem', color: 'var(--charcoal)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                      Ask the patient to check their <strong>Notifications</strong> in their dashboard — they will see a 6-digit code. Enter it below to activate access.
                    </p>
                    <div style={{ background: 'var(--surface-muted)', borderRadius: 16, padding: '1.25rem', marginBottom: '1rem', textAlign: 'left' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--charcoal)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Enter 6-Digit Code</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="● ● ● ● ● ●"
                        style={{
                          width: '100%', padding: '1rem', border: `2px solid ${otpError ? '#FECACA' : 'var(--border)'}`,
                          borderRadius: 12, fontSize: '1.6rem', fontWeight: 800, textAlign: 'center',
                          letterSpacing: '0.4em', background: 'var(--surface)', color: 'var(--foreground)',
                          boxSizing: 'border-box', fontFamily: 'monospace',
                        }}
                      />
                      {otpError && <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#B91C1C', fontWeight: 600 }}>⚠️ {otpError}</div>}
                    </div>
                    <button
                      onClick={() => pendingLinkId && handleVerifyOtp(pendingLinkId)}
                      disabled={otpLoading || otpCode.length !== 6}
                      style={{ width: '100%', padding: '1rem', background: otpCode.length === 6 ? 'linear-gradient(135deg, #059669, #10B981)' : 'var(--surface-muted)', color: otpCode.length === 6 ? 'white' : 'var(--charcoal)', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: otpCode.length === 6 ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
                    >
                      {otpLoading ? 'Verifying...' : 'Confirm Access'}
                    </button>
                    <button onClick={closeAddModal} style={{ marginTop: '0.75rem', width: '100%', padding: '0.75rem', background: 'none', border: '1px solid var(--border)', borderRadius: 12, fontSize: '0.9rem', fontWeight: 600, color: 'var(--charcoal)', cursor: 'pointer' }}>Do it later</button>
                  </>
                )}
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.9rem', color: 'var(--charcoal)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                  Enter the patient's ID. A one-time code will be sent to their notification panel — share it with them to approve your access.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--charcoal)', marginBottom: '0.4rem' }}>Patient ID *</label>
                    <input type="text" value={newPatientId} onChange={e => setNewPatientId(e.target.value)} placeholder="e.g. P001" style={{ width: '100%', padding: '0.8rem 1rem', border: '2px solid var(--border)', borderRadius: 12, fontSize: '0.95rem', background: 'var(--background)', color: 'var(--foreground)', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--charcoal)', marginBottom: '0.4rem' }}>Nickname (Optional)</label>
                    <input type="text" value={newNickname} onChange={e => setNewNickname(e.target.value)} placeholder="e.g. Dad" style={{ width: '100%', padding: '0.8rem 1rem', border: '2px solid var(--border)', borderRadius: 12, fontSize: '0.95rem', background: 'var(--background)', color: 'var(--foreground)', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--charcoal)', marginBottom: '0.4rem' }}>Relationship (Optional)</label>
                    <input type="text" value={newRelation} onChange={e => setNewRelation(e.target.value)} placeholder="e.g. Father" style={{ width: '100%', padding: '0.8rem 1rem', border: '2px solid var(--border)', borderRadius: 12, fontSize: '0.95rem', background: 'var(--background)', color: 'var(--foreground)', boxSizing: 'border-box' }} />
                  </div>
                </div>
                {addError && (
                  <div style={{ padding: '0.75rem 1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#B91C1C', fontSize: '0.85rem', fontWeight: 600, marginTop: '1rem' }}>
                    ⚠️ {addError}
                  </div>
                )}
                <button
                  onClick={handleAddPatient}
                  disabled={addLoading}
                  style={{ width: '100%', padding: '1rem', marginTop: '1.5rem', background: 'linear-gradient(135deg, #0052A5, #0073D9)', color: 'white', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: addLoading ? 'not-allowed' : 'pointer', opacity: addLoading ? 0.7 : 1 }}
                >
                  {addLoading ? 'Sending Request...' : 'Send Access Request'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
