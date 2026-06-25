'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, AlertTriangle, CheckCircle, Clock, XCircle, ChevronRight, Activity, Paperclip, Trash2, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { apiFetch } from '@/lib/apiFetch';

const STATUS_STEPS = ['pending', 'approved', 'scheduled'];

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:            { label: 'Under Review',       color: '#C07A00', bg: '#FFF8E1', icon: Clock },
  approved:           { label: 'Approved',           color: '#0052A5', bg: '#EBF3FF', icon: CheckCircle },
  scheduled:          { label: 'Scheduled',          color: '#2E7D32', bg: '#E8F5E9', icon: CheckCircle },
  pending_reschedule: { label: 'Reschedule Proposed', color: '#7C3AED', bg: '#F3E8FF', icon: AlertTriangle },
  rejected:           { label: 'Rejected',           color: '#C62828', bg: '#FFEBEE', icon: XCircle },
  cancelled:          { label: 'Cancelled',          color: '#71717A', bg: '#F4F4F5', icon: XCircle },
};

const URGENCY_COLORS: Record<string, { color: string; bg: string }> = {
  Routine:   { color: '#0097A7', bg: '#E0F7FA' },
  Urgent:    { color: '#C07A00', bg: '#FFF8E1' },
  Emergency: { color: '#C62828', bg: '#FFEBEE' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusStepper({ status }: { status: string }) {
  const steps = [
    { key: 'pending',   label: 'Submitted' },
    { key: 'approved',  label: 'Approved' },
    { key: 'scheduled', label: 'Scheduled' },
  ];
  const currentIdx = (status === 'rejected' || status === 'cancelled') ? -1
    : status === 'pending_reschedule' ? 2
    : STATUS_STEPS.indexOf(status);

  if (status === 'rejected') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 8, background: '#FFEBEE', border: '1px solid rgba(198,40,40,0.25)' }}>
        <XCircle size={15} color="#C62828" />
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#C62828' }}>Request Rejected</span>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 8, background: '#F4F4F5', border: '1px solid #D4D4D8' }}>
        <XCircle size={15} color="#71717A" />
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#71717A' }}>Request Cancelled</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {steps.map((s, i) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: i <= currentIdx ? (i < currentIdx ? '#22c55e' : 'var(--primary)') : 'var(--surface-muted)',
              border: `2px solid ${i <= currentIdx ? (i < currentIdx ? '#22c55e' : 'var(--primary)') : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem', fontWeight: 700, color: i <= currentIdx ? 'white' : 'var(--foreground-muted)',
            }}>
              {i < currentIdx ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: i === currentIdx ? 'var(--primary)' : i < currentIdx ? '#16a34a' : 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < currentIdx ? '#22c55e' : 'var(--border)', margin: '0 4px', marginBottom: 14 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function VitalsDisplay({ vitals }: { vitals: any }) {
  if (!vitals) return null;
  const items = [
    { label: 'HR',   value: `${vitals.hr} BPM`,          color: '#FCA5A5' },
    { label: 'SpO₂', value: `${vitals.spo2}%`,            color: '#A5D8FF' },
    { label: 'Resp', value: `${vitals.resp} bpm`,          color: '#86EFAC' },
    { label: 'Temp', value: `${vitals.temp}°C`,            color: '#FDE68A' },
    { label: 'BP',   value: `${vitals.sys}/${vitals.dia}`, color: '#C7D2FE' },
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{ padding: '0.25rem 0.6rem', borderRadius: 7, background: `${color}22`, border: `1px solid ${color}66`, fontSize: '0.77rem', fontWeight: 700 }}>
          <span style={{ color: 'var(--foreground-muted)', fontWeight: 500 }}>{label}: </span>{value}
        </div>
      ))}
    </div>
  );
}

export default function ViewRequests() {
  const router = useRouter();
  const { lang } = useLanguage();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [cancelling, setCancelling]     = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/appointments?patientId=P001`);
      if (res.ok) setAppointments(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const cancelRequest = async (id: string) => {
    if (!confirm('Cancel this appointment request?')) return;
    setCancelling(id);
    try {
      await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/appointments?id=${id}&patientId=P001`, { method: 'DELETE' });
      await fetchAppointments();
    } finally { setCancelling(null); }
  };

  if (loading) return (
    <div className="container flex-center" style={{ minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Loading your requests…</span>
    </div>
  );

  return (
    <div className="container fade-in" style={{ maxWidth: 820 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--foreground-muted)', fontWeight: 600, fontSize: '0.9rem' }}>
          <ArrowLeft size={18} /> Back
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1.6rem', marginBottom: 0 }}>📋 My Appointment Requests</h2>
          <p style={{ color: 'var(--charcoal)', fontSize: '0.88rem' }}>{appointments.length} total request{appointments.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={fetchAppointments} className="glass-button" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => router.push('/appointments/book')} style={{ padding: '0.5rem 1.1rem', borderRadius: 8, background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
            + Book New
          </button>
        </div>
      </div>

      {appointments.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--charcoal)' }}>
          <Calendar size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No requests yet</h3>
          <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>Book your first appointment with a Nalam.ai-connected doctor.</p>
          <button onClick={() => router.push('/appointments/book')} style={{ padding: '0.65rem 1.5rem', borderRadius: 10, background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
            Book Appointment
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {appointments.map(apt => {
            const sm = STATUS_META[apt.status] || STATUS_META.pending;
            const uc = URGENCY_COLORS[apt.urgency] || URGENCY_COLORS.Routine;
            const isExpanded = expanded === apt.id;

            return (
              <div
                key={apt.id}
                className="glass-panel"
                style={{ cursor: 'pointer', transition: 'all 0.2s ease', padding: '1.25rem', borderLeft: `4px solid ${sm.color}` }}
                onClick={() => setExpanded(isExpanded ? null : apt.id)}
              >
                {/* Row summary */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--deep-blue)' }}>{apt.doctorName}</span>
                      <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.6rem', borderRadius: 20, background: uc.bg, color: uc.color, fontWeight: 700, border: `1px solid ${uc.color}44` }}>{apt.urgency}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)', marginBottom: '0.25rem' }}>{apt.doctorSpecialty} · {apt.hospital}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <Calendar size={12} /> {formatDate(apt.date)}
                      {apt.time && (
                        <><Clock size={12} style={{ marginLeft: 4 }} /> {apt.time}</>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                    <StatusStepper status={apt.status} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)' }}>Submitted {formatDateTime(apt.createdAt)}</span>
                  </div>
                  <ChevronRight size={18} color="var(--foreground-muted)" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--charcoal)', fontWeight: 700, marginBottom: 3 }}>REFERENCE</div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--primary)' }}>{apt.id}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--charcoal)', fontWeight: 700, marginBottom: 3 }}>STATUS</div>
                        <span style={{ padding: '0.2rem 0.7rem', borderRadius: 20, background: sm.bg, color: sm.color, fontWeight: 700, fontSize: '0.8rem', border: `1px solid ${sm.color}44` }}>{sm.label}</span>
                      </div>
                      {apt.approvedAt && (
                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--charcoal)', fontWeight: 700, marginBottom: 3 }}>APPROVED AT</div>
                          <div style={{ fontSize: '0.83rem' }}>{formatDateTime(apt.approvedAt)}</div>
                        </div>
                      )}
                      {apt.scheduledAt && (
                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--charcoal)', fontWeight: 700, marginBottom: 3 }}>SCHEDULED AT</div>
                          <div style={{ fontSize: '0.83rem' }}>{formatDateTime(apt.scheduledAt)}</div>
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--charcoal)', fontWeight: 700, marginBottom: 4 }}>YOUR REASON</div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--foreground)', lineHeight: 1.6, padding: '0.65rem 0.85rem', background: 'var(--surface-muted)', borderRadius: 8 }}>{apt.reason}</div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--charcoal)', fontWeight: 700, marginBottom: 4 }}>AI CLINICAL SUMMARY</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.6, padding: '0.65rem 0.85rem', background: 'rgba(0,82,165,0.05)', border: '1px solid rgba(0,82,165,0.15)', borderRadius: 8 }}>{apt.aiSummary}</div>
                    </div>

                    {apt.vitalsSnapshot && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--charcoal)', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Activity size={11} /> VITALS AT SUBMISSION
                        </div>
                        <VitalsDisplay vitals={apt.vitalsSnapshot} />
                      </div>
                    )}

                    {apt.attachments?.length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--charcoal)', fontWeight: 700, marginBottom: 6 }}>ATTACHMENTS</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {apt.attachments.map((att: any, i: number) => (
                            <span key={i} style={{ padding: '0.25rem 0.65rem', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: '0.78rem', fontWeight: 600 }}>
                              {att.type === 'image' ? '🖼' : '📄'} {att.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reschedule Proposal Banner */}
                    {apt.status === 'pending_reschedule' && (
                      <div style={{ marginBottom: '1rem', padding: '0.85rem 1rem', borderRadius: 10, background: '#F3E8FF', border: '1.5px solid #7C3AED44' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <AlertTriangle size={15} color="#7C3AED" />
                          <span style={{ fontWeight: 700, color: '#7C3AED', fontSize: '0.82rem' }}>RESCHEDULE PROPOSED BY DOCTOR</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#4C1D95', marginBottom: '0.35rem' }}>
                          <strong>New Date:</strong> {apt.rescheduleProposedDate ? formatDate(apt.rescheduleProposedDate) : '—'}
                          {apt.rescheduleProposedTime && <> &nbsp;at&nbsp; <strong>{apt.rescheduleProposedTime}</strong></>}
                        </div>
                        {apt.rescheduleReason && (
                          <div style={{ fontSize: '0.82rem', color: '#4C1D95', fontStyle: 'italic' }}>Reason: {apt.rescheduleReason}</div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: '#7C3AED', marginTop: '0.4rem', fontWeight: 600 }}>Awaiting desk approval — you will be notified once confirmed.</div>
                      </div>
                    )}

                    {apt.hdeskNote && (
                      <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: 8, background: 'var(--primary-light)', border: '1px solid rgba(0,82,165,0.2)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700, marginBottom: 3 }}>NOTE FROM HOSPITAL DESK</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--deep-blue)' }}>{apt.hdeskNote}</div>
                      </div>
                    )}

                    {apt.status === 'pending' && (
                      <button
                        disabled={cancelling === apt.id}
                        onClick={() => cancelRequest(apt.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: 8, background: '#FFEBEE', border: '1px solid rgba(198,40,40,0.3)', color: '#C62828', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                      >
                        <Trash2 size={13} /> {cancelling === apt.id ? 'Cancelling…' : 'Cancel Request'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
