'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Activity, Bell, Calendar, FolderOpen, ArrowLeft, ShieldAlert, CheckCircle,
  FileText, ChevronDown, Stethoscope, X, Loader2, AlertTriangle,
} from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { AVAILABLE_TIME_SLOTS, getNextSlots } from '@/lib/doctors';

const PAGE_SIZE = 5;

const URGENCY_OPTIONS = [
  { value: 'Routine', label: 'Routine Checkup', desc: 'Non-urgent follow-up or general consultation', color: '#059669', bg: '#D1FAE5' },
  { value: 'Urgent', label: 'Urgent', desc: 'Needs attention soon (e.g. fever, sudden pain)', color: '#D97706', bg: '#FEF3C7' },
  { value: 'Emergency', label: 'Emergency', desc: 'Critical condition requiring immediate care', color: '#DC2626', bg: '#FEE2E2' },
];

function VitalCard({ label, value, unit, color }: { label: string; value: any; unit: string; color?: string }) {
  return (
    <div style={{ background: 'var(--surface-muted)', borderRadius: 16, padding: '1rem' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--charcoal)', marginBottom: '0.3rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: color || 'var(--foreground)' }}>
        {value ?? '--'} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--charcoal)' }}>{unit}</span>
      </div>
    </div>
  );
}

const HOSPITALS = ['Apollo Hospital', 'Kauvery Hospital', 'Govt Hospital'];

export default function FamilyPatientView() {
  const params = useParams();
  const patientId = params.patientId as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = (searchParams.get('tab') as any) || 'vitals';

  const [patientData, setPatientData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertPage, setAlertPage] = useState(1);
  const [tab, setTab] = useState(defaultTab);
  const [showBookModal, setShowBookModal] = useState(false);

  // Booking state
  const [bookStep, setBookStep] = useState(0);
  const [bookHospital, setBookHospital] = useState('');
  const [bookDoctors, setBookDoctors] = useState<any[]>([]);
  const [bookDoctor, setBookDoctor] = useState<any>(null);
  const [bookDoctorLoading, setBookDoctorLoading] = useState(false);
  const [bookDate, setBookDate] = useState('');
  const [bookTime, setBookTime] = useState('');
  const [bookReason, setBookReason] = useState('');
  const [bookUrgency, setBookUrgency] = useState('Routine');
  const [bookLoading, setBookLoading] = useState(false);
  const [bookSuccess, setBookSuccess] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [fullyBookedDates, setFullyBookedDates] = useState<Set<string>>(new Set());

  useEffect(() => { loadData(); }, [patientId]);

  useEffect(() => {
    if (!bookDoctor || !bookDate) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setBookTime('');
    });

    fetch(`/api/appointments/availability?doctorId=${bookDoctor.id}&date=${bookDate}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setBookedSlots(data.bookedSlots || []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [bookDoctor, bookDate]);

  useEffect(() => {
    if (!bookDoctor) return;

    let cancelled = false;
    Promise.all((bookDoctor.availableDates || []).map(async (d: string) => {
      try {
        const res = await fetch(`/api/appointments/availability?doctorId=${bookDoctor.id}&date=${d}`, { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        return data.fullyBooked ? d : null;
      } catch {
        return null;
      }
    })).then((dates) => {
      if (!cancelled) setFullyBookedDates(new Set(dates.filter((d): d is string => Boolean(d))));
    });

    return () => {
      cancelled = true;
    };
  }, [bookDoctor]);

  const loadData = async (skipCache = false) => {
    try {
      const res = await apiFetch(`/api/family/patients/${patientId}`, { skipCache });
      if (!res.ok) { setError('Not authorized or patient not found'); return; }
      setPatientData(await res.json());
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  const loadDoctors = async (hospital: string) => {
    setBookDoctorLoading(true);
    try {
      const res = await apiFetch(`/api/hospital-desk/doctors?hospital=${encodeURIComponent(hospital)}`);
      if (res.ok) {
        const d = await res.json();
        const docsWithDates = (d.doctors || []).map((doc: any) => ({
          ...doc,
          availableDates: doc.availableDates || getNextSlots(doc.slots || [])
        }));
        setBookDoctors(docsWithDates);
      }
    } catch { }
    finally { setBookDoctorLoading(false); }
  };

  const handleSelectHospital = (h: string) => {
    setBookHospital(h); setBookDoctor(null); setBookDoctors([]); loadDoctors(h);
  };

  const handleBookAppointment = async () => {
    if (!bookDoctor || !bookDate || !bookReason.trim()) {
      setBookError('Please fill in all required fields'); return;
    }
    setBookLoading(true);
    setBookError(null);
    try {
      const res = await apiFetch('/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId,
          patientName: patientData.name,
          doctorId: bookDoctor.id,
          doctorName: bookDoctor.name,
          doctorSpecialty: bookDoctor.specialty,
          hospital: bookHospital,
          date: bookDate,
          time: bookTime || undefined,
          reason: bookReason,
          urgency: bookUrgency,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setBookError(data.error || 'Failed to book appointment'); }
      else { setBookSuccess(true); loadData(); }
    } catch { setBookError('Network error'); }
    finally { setBookLoading(false); }
  };

  const closeBookModal = () => {
    setShowBookModal(false); setBookSuccess(false); setBookError(null);
    setBookStep(0); setBookHospital(''); setBookDoctor(null); setBookDoctors([]);
    setBookDate(''); setBookTime(''); setBookReason(''); setBookUrgency('Routine');
  };

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (error || !patientData) return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center' }}>
      <ShieldAlert size={48} color="var(--accent-red)" style={{ marginBottom: '1rem' }} />
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '0.5rem' }}>Access Denied</h1>
      <p style={{ color: 'var(--charcoal)', marginBottom: '2rem' }}>{error}</p>
      <button onClick={() => router.push('/family')} style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '0.8rem 1.5rem', borderRadius: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--foreground)' }}>
        Back to Family Dashboard
      </button>
    </div>
  );

  const { vitals, alerts = [], appointments = [], records = [] } = patientData;
  const v = vitals;

  const getVitalColor = (key: string, val: number) => {
    if (key === 'hr' && (val > 120 || val < 50)) return '#DC2626';
    if (key === 'hr' && val > 100) return '#D97706';
    if (key === 'spo2' && val < 92) return '#DC2626';
    if (key === 'spo2' && val < 95) return '#D97706';
    if (key === 'sys' && val > 160) return '#DC2626';
    if (key === 'sys' && val > 140) return '#D97706';
    if (key === 'temp' && val > 38.5) return '#DC2626';
    if (key === 'temp' && val > 37.8) return '#D97706';
    return '#059669';
  };

  const visibleAlerts = alerts.slice(0, alertPage * PAGE_SIZE);
  const hasMoreAlerts = alerts.length > alertPage * PAGE_SIZE;

  const TABS = [
    { key: 'vitals', label: 'Vitals', icon: <Activity size={15} /> },
    { key: 'alerts', label: `Alerts (${alerts.length})`, icon: <Bell size={15} /> },
    { key: 'appointments', label: 'Appointments', icon: <Calendar size={15} /> },
    { key: 'records', label: 'Records', icon: <FolderOpen size={15} /> },
  ];

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', padding: 'max(1.5rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(5rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '2rem' }}>
          <button onClick={() => router.push('/family')} style={{ background: 'var(--surface)', border: '1px solid var(--border)', width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <ArrowLeft size={20} color="var(--foreground)" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '0.2rem' }}>{patientData.name}</h1>
            <p style={{ color: 'var(--charcoal)', fontSize: '0.88rem' }}>ID: {patientData.id} • {patientData.gender} • DOB: {patientData.dob}</p>
          </div>
          <button
            onClick={() => setShowBookModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #0052A5, #0073D9)', color: 'white', border: 'none', borderRadius: 12, padding: '0.7rem 1.1rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
          >
            <Stethoscope size={16} /> Book Appointment
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem',
                borderRadius: 10, border: tab === t.key ? 'none' : '1px solid var(--border)',
                background: tab === t.key ? 'var(--foreground)' : 'var(--surface)',
                color: tab === t.key ? 'var(--background)' : 'var(--foreground)',
                fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── VITALS TAB ── */}
        {tab === 'vitals' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} color="var(--primary)" /> Live Vitals
              <button onClick={() => loadData(true)} style={{ marginLeft: '0.5rem', background: 'var(--surface-muted)', border: '1px solid var(--border)', padding: '0.3rem 0.6rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Activity size={12}/> Refresh</button>
              {v?.recordedAt && <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--charcoal)', marginLeft: 'auto' }}>Recorded {new Date(v.recordedAt).toLocaleString()}</span>}
            </h2>
            {v ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                <VitalCard label="Heart Rate" value={v.hr} unit="bpm" color={getVitalColor('hr', v.hr)} />
                <VitalCard label="SpO₂" value={v.spo2} unit="%" color={getVitalColor('spo2', v.spo2)} />
                <VitalCard label="Systolic BP" value={v.sys} unit="mmHg" color={getVitalColor('sys', v.sys)} />
                <VitalCard label="Diastolic BP" value={v.dia} unit="mmHg" />
                <VitalCard label="Temperature" value={v.temp} unit="°C" color={getVitalColor('temp', v.temp)} />
                <VitalCard label="Resp. Rate" value={v.resp} unit="/min" />
              </div>
            ) : (
              <div style={{ color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 0' }}>
                <Activity size={16} /> No recent vitals recorded.
              </div>
            )}
          </div>
        )}

        {/* ── ALERTS TAB ── */}
        {tab === 'alerts' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={18} color="#D97706" /> Active Alerts
            </h2>
            {alerts.length > 0 ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {visibleAlerts.map((a: any) => {
                    const isCrit = a.severity === 'critical';
                    return (
                      <div key={a.id} style={{ background: isCrit ? '#FEF2F2' : 'var(--surface-muted)', border: `1px solid ${isCrit ? '#FECACA' : 'transparent'}`, borderRadius: 14, padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: isCrit ? '#FEE2E2' : '#EFF6FF', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isCrit ? <ShieldAlert size={17} color="#DC2626" /> : <Bell size={17} color="var(--primary)" />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: isCrit ? '#DC2626' : 'var(--foreground)' }}>{a.title}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--charcoal)' }}>{new Date(a.created_at).toLocaleString()}</span>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', lineHeight: 1.5, margin: 0 }}>
                            {a.severity === 'family_link_request' ? (() => {
                              try { const p = JSON.parse(a.message); return (p.text || a.message).replace(/\*\*/g, ''); } catch { return a.message; }
                            })() : a.message}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {hasMoreAlerts && (
                  <button onClick={() => setAlertPage(p => p + 1)} style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                    <ChevronDown size={16} /> Show More ({alerts.length - alertPage * PAGE_SIZE} remaining)
                  </button>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--charcoal)', padding: '1rem 0' }}>
                <CheckCircle size={16} color="#059669" /> No active alerts
              </div>
            )}
          </div>
        )}

        {/* ── APPOINTMENTS TAB ── */}
        {tab === 'appointments' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={18} color="var(--primary)" /> Appointments
              </h2>
              <button onClick={() => setShowBookModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 9, padding: '0.5rem 0.9rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                + Book New
              </button>
            </div>
            {appointments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {appointments.map((a: any) => (
                  <div key={a.id} style={{ background: 'var(--surface-muted)', borderRadius: 14, padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>{a.doctor_name}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)', marginTop: 2 }}>{a.hospital} • {a.date}{a.time ? ` at ${a.time}` : ''}</div>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, background: ['approved', 'scheduled'].includes(a.status) ? '#D1FAE5' : '#FEF3C7', color: ['approved', 'scheduled'].includes(a.status) ? '#059669' : '#D97706', padding: '0.25rem 0.6rem', borderRadius: 6, textTransform: 'uppercase' }}>{a.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--charcoal)', fontSize: '0.9rem' }}>No appointments found.</div>
            )}
          </div>
        )}

        {/* ── RECORDS TAB ── */}
        {tab === 'records' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FolderOpen size={18} color="#D97706" /> Medical Records ({records.length})
            </h2>
            {records.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {records.map((r: any) => (
                  <div key={r.id} style={{ background: 'var(--surface-muted)', borderRadius: 14, padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={18} color="var(--charcoal)" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>{r.type}</div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--charcoal)', flexShrink: 0, marginLeft: '0.5rem' }}>{r.date}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--charcoal)', marginTop: 2 }}>{r.provider}{r.department ? ` • ${r.department}` : ''}</div>
                        {r.diagnosis && <div style={{ fontSize: '0.82rem', color: 'var(--foreground)', marginTop: '0.4rem', fontWeight: 600 }}>Dx: {r.diagnosis}</div>}
                        {r.notes && <div style={{ fontSize: '0.8rem', color: 'var(--charcoal)', marginTop: '0.25rem', lineHeight: 1.5 }}>{r.notes}</div>}
                        {r.labResults && <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '0.25rem', fontWeight: 600 }}>Labs: {r.labResults}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--charcoal)', fontSize: '0.9rem' }}>No medical records found.</div>
            )}
          </div>
        )}
      </div>

      {/* ── BOOK APPOINTMENT MODAL ── */}
      {showBookModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--surface)', width: '100%', maxWidth: 480, borderRadius: 24, padding: '2rem', boxShadow: '0 24px 48px rgba(0,0,0,0.25)', animation: 'slideUp 0.3s ease', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--foreground)' }}>Book Appointment</h3>
              <button onClick={closeBookModal} style={{ background: 'var(--surface-muted)', border: 'none', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={18} color="var(--charcoal)" />
              </button>
            </div>

            {bookSuccess ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <CheckCircle size={48} color="#059669" style={{ margin: '0 auto 1rem' }} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>Appointment Requested!</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--charcoal)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  The appointment request has been sent on behalf of {patientData.name}. The hospital desk will review and approve it shortly.
                </p>
                <button onClick={closeBookModal} style={{ padding: '0.75rem 2rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '0.85rem', color: 'var(--charcoal)', marginBottom: '1.5rem', padding: '0.75rem 1rem', background: 'var(--surface-muted)', borderRadius: 12 }}>
                  Booking for: <strong style={{ color: 'var(--foreground)' }}>{patientData.name}</strong>
                </div>

                {/* Hospital */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--charcoal)', marginBottom: '0.5rem' }}>Hospital *</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {HOSPITALS.map(h => (
                      <button key={h} onClick={() => handleSelectHospital(h)} style={{ padding: '0.75rem 1rem', borderRadius: 12, border: `2px solid ${bookHospital === h ? 'var(--primary)' : 'var(--border)'}`, background: bookHospital === h ? 'var(--primary-light)' : 'var(--surface-muted)', color: 'var(--foreground)', fontWeight: bookHospital === h ? 700 : 500, cursor: 'pointer', textAlign: 'left', fontSize: '0.9rem' }}>
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Doctor */}
                {bookHospital && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--charcoal)', marginBottom: '0.5rem' }}>Doctor *</label>
                    {bookDoctorLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}><Loader2 size={24} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} /></div>
                    ) : bookDoctors.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {bookDoctors.map((d: any) => (
                          <button key={d.id} onClick={() => setBookDoctor(d)} style={{ padding: '0.75rem 1rem', borderRadius: 12, border: `2px solid ${bookDoctor?.id === d.id ? 'var(--primary)' : 'var(--border)'}`, background: bookDoctor?.id === d.id ? 'var(--primary-light)' : 'var(--surface-muted)', color: 'var(--foreground)', fontWeight: bookDoctor?.id === d.id ? 700 : 500, cursor: 'pointer', textAlign: 'left', fontSize: '0.88rem' }}>
                            {d.name} <span style={{ color: 'var(--charcoal)', fontWeight: 400 }}>• {d.specialty}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', color: 'var(--charcoal)', padding: '0.5rem 0' }}>No doctors found for this hospital.</div>
                    )}
                  </div>
                )}

                {/* Date & Time Selection (Matched to patient flow) */}
                {bookDoctor && (
                  <>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontWeight: 700, color: 'var(--deep-blue)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                        <Calendar size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Select Date *
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', margin: '0 -0.25rem', padding: '0.25rem' }}>
                        {(bookDoctor?.availableDates || []).map((d: string) => {
                          const isFullyBooked = fullyBookedDates.has(d);
                          return (
                            <button
                              key={d}
                              onClick={() => !isFullyBooked && setBookDate(d)}
                              disabled={isFullyBooked}
                              title={isFullyBooked ? 'All slots booked' : ''}
                              style={{
                                flexShrink: 0,
                                padding: '0.5rem 1rem', borderRadius: 10,
                                border: `1.5px solid ${isFullyBooked ? '#E2E8F0' : bookDate === d ? 'var(--primary)' : 'var(--border)'}`,
                                background: isFullyBooked ? '#F1F5F9' : bookDate === d ? 'var(--primary)' : 'var(--surface)',
                                color: isFullyBooked ? '#94A3B8' : bookDate === d ? 'white' : 'var(--foreground)',
                                fontWeight: 600, fontSize: '0.82rem',
                                cursor: isFullyBooked ? 'not-allowed' : 'pointer',
                                transition: 'all 0.18s ease',
                                textDecoration: isFullyBooked ? 'line-through' : 'none',
                                opacity: isFullyBooked ? 0.6 : 1,
                              }}
                            >
                              {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}{isFullyBooked ? ' 🚫' : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontWeight: 700, color: 'var(--deep-blue)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                        <Calendar size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Select Time *
                        {!bookDate && <span style={{ fontWeight: 400, fontSize: '0.78rem', color: 'var(--charcoal)', marginLeft: 8 }}>(Please pick a date first)</span>}
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {AVAILABLE_TIME_SLOTS.map(slot => {
                          const isBooked = bookedSlots.includes(slot);
                          return (
                            <button
                              key={slot}
                              onClick={() => !isBooked && bookDate && setBookTime(slot)}
                              disabled={isBooked || !bookDate}
                              title={isBooked ? 'Slot already booked' : !bookDate ? 'Please select a date first' : undefined}
                              style={{
                                padding: '0.5rem 1rem', borderRadius: 10,
                                border: `1.5px solid ${isBooked ? '#E2E8F0' : bookTime === slot ? 'var(--primary)' : 'var(--border)'}`,
                                background: isBooked ? '#F1F5F9' : bookTime === slot ? 'var(--primary)' : 'var(--surface)',
                                color: isBooked ? '#94A3B8' : bookTime === slot ? 'white' : !bookDate ? 'var(--foreground-muted)' : 'var(--foreground)',
                                fontWeight: 600, fontSize: '0.82rem',
                                cursor: (isBooked || !bookDate) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.18s ease',
                                opacity: isBooked ? 0.5 : !bookDate ? 0.4 : 1,
                                position: 'relative' as const,
                              }}
                            >
                              {slot}{isBooked ? ' ✗' : ''}
                            </button>
                          );
                        })}
                      </div>
                      {bookDate && bookedSlots.length > 0 && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--charcoal)', marginTop: '0.5rem' }}>Some slots are already booked.</p>
                      )}
                    </div>
                  </>
                )}

                {/* Urgency */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontWeight: 700, color: 'var(--deep-blue)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                    <AlertTriangle size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Urgency
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {URGENCY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setBookUrgency(opt.value)}
                        style={{
                          padding: '0.6rem 1.1rem', borderRadius: 10,
                          border: `2px solid ${bookUrgency === opt.value ? opt.color : 'var(--border)'}`,
                          background: bookUrgency === opt.value ? opt.bg : 'var(--surface)',
                          color: bookUrgency === opt.value ? opt.color : 'var(--foreground-muted)',
                          fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.18s ease',
                          textAlign: 'left', flex: 1, minWidth: '140px'
                        }}
                      >
                        <div>{opt.label}</div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 400, opacity: 0.85 }}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reason */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--charcoal)', marginBottom: '0.4rem' }}>Reason for Visit *</label>
                  <textarea value={bookReason} onChange={e => setBookReason(e.target.value)} rows={3} placeholder="Describe the symptoms or reason for this appointment..." style={{ width: '100%', padding: '0.75rem', border: '2px solid var(--border)', borderRadius: 12, fontSize: '0.9rem', background: 'var(--surface-muted)', color: 'var(--foreground)', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>

                {bookError && (
                  <div style={{ padding: '0.75rem 1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#B91C1C', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>
                    ⚠️ {bookError}
                  </div>
                )}

                <button
                  onClick={handleBookAppointment}
                  disabled={bookLoading || !bookHospital || !bookDoctor || !bookDate || !bookReason.trim()}
                  style={{ width: '100%', padding: '1rem', background: 'linear-gradient(135deg, #0052A5, #0073D9)', color: 'white', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: bookLoading ? 'not-allowed' : 'pointer', opacity: (bookLoading || !bookHospital || !bookDoctor || !bookDate || !bookReason.trim()) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  {bookLoading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Booking...</> : 'Confirm Appointment'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
