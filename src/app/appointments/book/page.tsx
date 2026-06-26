'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mic, MicOff, Loader2, Paperclip, X, ChevronRight, CheckCircle, Calendar, Stethoscope, AlertTriangle, FileText, Activity, Heart, Zap, Brain } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { DOCTOR_SCHEDULES, getNextSlots, AVAILABLE_TIME_SLOTS } from '@/lib/doctors';

/* ─── Doctor Roster ─────────────────────────────────────────────────────── */
const DOCTORS = [
  {
    id: 'dr_dhanush',
    name: 'Dr. Dhanush',
    specialty: 'Cardiology',
    hospital: 'Apollo Hospitals, Chennai',
    experience: '8 years',
    rating: 4.9,
    avatar: 'D',
    avatarColor: '#0052A5',
    languages: ['English', 'Tamil'],
    slots: DOCTOR_SCHEDULES['dr_dhanush'],
    availableDates: getNextSlots(DOCTOR_SCHEDULES['dr_dhanush']),
  },
  {
    id: 'dr_monissha',
    name: 'Dr. Monissha',
    specialty: 'General Medicine',
    hospital: 'Apollo Hospitals, Chennai',
    experience: '6 years',
    rating: 4.8,
    avatar: 'M',
    avatarColor: '#5C35A1',
    languages: ['English', 'Tamil'],
    slots: DOCTOR_SCHEDULES['dr_monissha'],
    availableDates: getNextSlots(DOCTOR_SCHEDULES['dr_monissha']),
  },
];

const URGENCY_OPTIONS = [
  { value: 'Routine',   label: 'Routine',   color: '#0097A7', bg: '#E0F7FA', desc: 'Non-urgent follow-up or check-up' },
  { value: 'Urgent',    label: 'Urgent',    color: '#C07A00', bg: '#FFF8E1', desc: 'Requires attention within 48 hours' },
  { value: 'Emergency', label: 'Emergency', color: '#C62828', bg: '#FFEBEE', desc: 'Serious symptoms needing same-day care' },
];



function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/* ─── Status Step Bar ───────────────────────────────────────────────────── */
const STEPS = ['Select Doctor', 'Date & Reason', 'AI Summary', 'Review & Submit'];

function StepBar({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '2.5rem' }}>
      {STEPS.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: i < current ? '#22c55e' : i === current ? 'var(--primary)' : 'var(--surface-muted)',
              border: `2px solid ${i <= current ? (i < current ? '#22c55e' : 'var(--primary)') : 'var(--border)'}`,
              color: i <= current ? 'white' : 'var(--foreground-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '0.85rem',
              transition: 'all 0.3s ease',
            }}>
              {i < current ? <CheckCircle size={16} /> : i + 1}
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: i === current ? 'var(--primary)' : 'var(--foreground-muted)', whiteSpace: 'nowrap', textAlign: 'center' }}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < current ? '#22c55e' : 'var(--border)', margin: '0 0.5rem', marginBottom: 18, transition: 'background 0.3s ease' }} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Vitals Snapshot ───────────────────────────────────────────────────── */
function VitalsDisplay({ vitals }: { vitals: any }) {
  if (!vitals) return null;
  const items = [
    { label: 'HR',   value: `${vitals.hr} BPM`,           color: '#FCA5A5' },
    { label: 'SpO₂', value: `${vitals.spo2}%`,             color: '#A5D8FF' },
    { label: 'Resp', value: `${vitals.resp} bpm`,           color: '#86EFAC' },
    { label: 'Temp', value: `${vitals.temp}°C`,             color: '#FDE68A' },
    { label: 'BP',   value: `${vitals.sys}/${vitals.dia}`, color: '#C7D2FE' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginTop: '0.75rem' }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{ padding: '0.4rem 0.6rem', borderRadius: 8, background: `${color}1A`, border: `1px solid ${color}44`, fontSize: '0.8rem', fontWeight: 700, color: 'var(--foreground)', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          <span style={{ color: 'var(--foreground-muted)', fontWeight: 600, fontSize: '0.7rem' }}>{label}</span>
          <span style={{ fontSize: '0.9rem' }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */
export default function BookAppointment() {
  const { t, lang } = useLanguage();
  const router = useRouter();

  const [step, setStep]                 = useState(0);
  const [selectedDoctor, setDoctor]     = useState<typeof DOCTORS[0] | null>(null);
  const [selectedDate, setDate]         = useState('');
  const [selectedTime, setTime]         = useState('');
  const [urgency, setUrgency]           = useState('Routine');
  const [reason, setReason]             = useState('');
  const [inputMode, setInputMode]       = useState<'text' | 'voice'>('text');
  const [isRecording, setIsRecording]   = useState(false);
  const [aiSummary, setAiSummary]       = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [attachments, setAttachments]   = useState<{ name: string; type: string; dataUrl: string }[]>([]);
  const [submitted, setSubmitted]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [vitalsSnap, setVitalsSnap]     = useState({ hr: 72, spo2: 98, resp: 16, temp: 36.6, sys: 120, dia: 80 });
  const [aptId, setAptId]               = useState('');
  const [bookedSlots, setBookedSlots]   = useState<string[]>([]);
  const [fullyBookedDates, setFullyBookedDates] = useState<Set<string>>(new Set());

  const recognitionRef = useRef<any>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  // Fetch availability when doctor or date changes
  const fetchAvailability = useCallback(async (doctorId: string, date: string) => {
    if (!doctorId || !date) return;
    try {
      const res = await fetch(`/api/appointments/availability?doctorId=${doctorId}&date=${date}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setBookedSlots(data.bookedSlots || []);
      }
    } catch {}
  }, []);

  // Pre-check fully booked dates when doctor selected
  const checkFullyBookedDates = useCallback(async (doctorId: string, dates: string[]) => {
    const fullyBooked = new Set<string>();
    await Promise.all(dates.map(async (d) => {
      try {
        const res = await fetch(`/api/appointments/availability?doctorId=${doctorId}&date=${d}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.fullyBooked) fullyBooked.add(d);
        }
      } catch {}
    }));
    setFullyBookedDates(fullyBooked);
  }, []);

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      fetchAvailability(selectedDoctor.id, selectedDate);
      setTime('');
    }
  }, [selectedDoctor, selectedDate, fetchAvailability]);

  useEffect(() => {
    if (selectedDoctor) {
      checkFullyBookedDates(selectedDoctor.id, selectedDoctor.availableDates);
    }
  }, [selectedDoctor, checkFullyBookedDates]);

  // Animate vitals like the dashboard
  useEffect(() => {
    const jitter = (v: number, range: number) => v + (Math.random() - 0.5) * range;
    const iv = setInterval(() => {
      setVitalsSnap(v => ({
        hr:   Math.round(jitter(v.hr,   4)),
        spo2: Math.min(100, Math.round(jitter(v.spo2, 1))),
        resp: Math.round(jitter(v.resp, 1)),
        temp: parseFloat(jitter(v.temp, 0.2).toFixed(1)),
        sys:  Math.round(jitter(v.sys,  4)),
        dia:  Math.round(jitter(v.dia,  3)),
      }));
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  /* ── Voice recording ───────────────────────────────── */
  const toggleVoice = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported. Please use Chrome.'); return; }
    const rec = new SR();
    rec.lang = lang === 'ta' ? 'ta-IN' : 'en-US';
    rec.interimResults = false;
    recognitionRef.current = rec;
    rec.onstart  = () => setIsRecording(true);
    rec.onresult = (e: any) => { setReason(e.results[0][0].transcript); setIsRecording(false); };
    rec.onerror  = () => setIsRecording(false);
    rec.onend    = () => setIsRecording(false);
    rec.start();
  };

  /* ── File attachment ───────────────────────────────── */
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (attachments.length >= 5) return;
      const reader = new FileReader();
      reader.onload = ev => {
        setAttachments(prev => [...prev, {
          name: file.name,
          type: file.type.startsWith('image/') ? 'image' : 'pdf',
          dataUrl: ev.target?.result as string,
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  /* ── Generate AI summary ───────────────────────────── */
  const generateSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/appointments/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          patientName: 'Patient',
          doctorName: selectedDoctor?.name,
          doctorSpecialty: selectedDoctor?.specialty,
          urgency,
        }),
      });
      const data = await res.json();
      setAiSummary(data.summary || reason);
    } catch {
      setAiSummary(reason);
    } finally {
      setSummaryLoading(false);
    }
  };

  /* ── Submit ────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!selectedDoctor || !selectedDate || !selectedTime || !reason) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 'P001',
          patientName: 'Arjun Sharma',
          doctorId: selectedDoctor.id,
          doctorName: selectedDoctor.name,
          doctorSpecialty: selectedDoctor.specialty,
          hospital: 'Apollo Hospitals',
          date: selectedDate,
          time: selectedTime,
          reason,
          aiSummary,
          urgency,
          attachments: attachments.map(a => ({ name: a.name, type: a.type })), // don't store dataUrls server-side
          vitalsSnapshot: { ...vitalsSnap },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAptId(data.appointment.id);
        setSubmitted(true);
        setTimeout(() => router.push('/appointments/requests'), 2800);
      } else {
        alert(data.error || 'Failed to book appointment.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error while booking appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Success screen ────────────────────────────────── */
  if (submitted) {
    return (
      <div className="container flex-center" style={{ minHeight: '80vh', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#dcfce7', border: '3px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'nalamPulse 1.2s ease-in-out' }}>
          <CheckCircle size={48} color="#16a34a" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.6rem', color: '#16a34a', marginBottom: '0.5rem' }}>Request Submitted!</h2>
          <p style={{ color: 'var(--foreground-muted)', fontSize: '0.95rem' }}>Your appointment request has been sent to the hospital desk for review.</p>
          <p style={{ color: 'var(--foreground-muted)', fontSize: '0.82rem', marginTop: '0.4rem' }}>Ref: <strong>{aptId}</strong></p>
        </div>
        <p style={{ color: 'var(--charcoal)', fontSize: '0.83rem' }}>Redirecting to your requests…</p>
      </div>
    );
  }

  /* ── Main render ───────────────────────────────────── */
  return (
    <div className="container fade-in" style={{ maxWidth: 780 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--foreground-muted)', fontWeight: 600, fontSize: '0.9rem', padding: '0.4rem 0' }}>
          <ArrowLeft size={18} /> Back
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1.6rem', marginBottom: 0 }}>📅 Book Appointment</h2>
          <p style={{ color: 'var(--charcoal)', fontSize: '0.88rem' }}>Request an appointment with a Nalam.ai-connected doctor</p>
        </div>
      </div>

      <StepBar current={step} />

      {/* ── STEP 0: Select Doctor ── */}
      {step === 0 && (
        <div className="slide-up">
          <h3 style={{ marginBottom: '1rem', color: 'var(--deep-blue)', fontSize: '1.1rem' }}>Choose your doctor</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {DOCTORS.map(doc => (
              <button
                key={doc.id}
                onClick={() => { setDoctor(doc); setDate(''); setStep(1); }}
                style={{
                  textAlign: 'left', cursor: 'pointer', padding: '1.5rem',
                  borderRadius: 16, border: `2px solid ${selectedDoctor?.id === doc.id ? 'var(--primary)' : 'var(--border)'}`,
                  background: 'var(--surface)', transition: 'all 0.2s ease',
                  boxShadow: 'var(--shadow-sm)',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ width: 54, height: 54, borderRadius: '50%', background: doc.avatarColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.2rem', flexShrink: 0 }}>
                    {doc.avatar}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--deep-blue)' }}>{doc.name}</div>
                    <div style={{ fontSize: '0.83rem', color: 'var(--primary)', fontWeight: 500 }}>{doc.specialty}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--charcoal)', marginTop: 2 }}>{doc.hospital}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: 20, background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 500 }}>
                    ⭐ {doc.rating}
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: 20, background: 'var(--surface-muted)', color: 'var(--charcoal)', fontWeight: 500 }}>
                    {doc.experience} exp.
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: 20, background: 'var(--surface-muted)', color: 'var(--charcoal)', fontWeight: 500 }}>
                    🗣 {doc.languages.join(' · ')}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)', marginBottom: '0.5rem', fontWeight: 500 }}>Available: {doc.slots.join(' · ')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end', color: 'var(--primary)', fontWeight: 700, fontSize: '0.88rem' }}>
                  Select <ChevronRight size={16} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 1: Date & Reason ── */}
      {step === 1 && selectedDoctor && (
        <div className="slide-up">
          {/* Doctor recap */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 10, background: 'var(--primary-light)', border: '1px solid rgba(0,82,165,0.2)', marginBottom: '1.5rem' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: selectedDoctor.avatarColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>
              {selectedDoctor.avatar}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--deep-blue)' }}>{selectedDoctor.name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--charcoal)' }}>{selectedDoctor.specialty} · {selectedDoctor.hospital}</div>
            </div>
            <button onClick={() => setStep(0)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600 }}>Change</button>
          </div>

          {/* Date selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 700, color: 'var(--deep-blue)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
              <Calendar size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Select Available Date
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {selectedDoctor.availableDates.map(d => {
                const isFullyBooked = fullyBookedDates.has(d);
                return (
                  <button
                    key={d}
                    onClick={() => !isFullyBooked && setDate(d)}
                    disabled={isFullyBooked}
                    title={isFullyBooked ? 'Fully booked — no slots available' : undefined}
                    style={{
                      padding: '0.5rem 1rem', borderRadius: 10,
                      border: `1.5px solid ${isFullyBooked ? '#E2E8F0' : selectedDate === d ? 'var(--primary)' : 'var(--border)'}`,
                      background: isFullyBooked ? '#F1F5F9' : selectedDate === d ? 'var(--primary)' : 'var(--surface)',
                      color: isFullyBooked ? '#94A3B8' : selectedDate === d ? 'white' : 'var(--foreground)',
                      fontWeight: 600, fontSize: '0.82rem',
                      cursor: isFullyBooked ? 'not-allowed' : 'pointer',
                      transition: 'all 0.18s ease',
                      textDecoration: isFullyBooked ? 'line-through' : 'none',
                      opacity: isFullyBooked ? 0.6 : 1,
                    }}
                  >
                    {formatDate(d)}{isFullyBooked ? ' 🚫' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 700, color: 'var(--deep-blue)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
              <Calendar size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Select Time
              {!selectedDate && <span style={{ fontWeight: 400, fontSize: '0.78rem', color: 'var(--charcoal)', marginLeft: 8 }}>— pick a date first</span>}
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {AVAILABLE_TIME_SLOTS.map(slot => {
                const isBooked = bookedSlots.includes(slot);
                return (
                  <button
                    key={slot}
                    onClick={() => !isBooked && selectedDate && setTime(slot)}
                    disabled={isBooked || !selectedDate}
                    title={isBooked ? 'This slot is already booked' : !selectedDate ? 'Select a date first' : undefined}
                    style={{
                      padding: '0.5rem 1rem', borderRadius: 10,
                      border: `1.5px solid ${isBooked ? '#E2E8F0' : selectedTime === slot ? 'var(--primary)' : 'var(--border)'}`,
                      background: isBooked ? '#F1F5F9' : selectedTime === slot ? 'var(--primary)' : 'var(--surface)',
                      color: isBooked ? '#94A3B8' : selectedTime === slot ? 'white' : !selectedDate ? 'var(--foreground-muted)' : 'var(--foreground)',
                      fontWeight: 600, fontSize: '0.82rem',
                      cursor: (isBooked || !selectedDate) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.18s ease',
                      opacity: isBooked ? 0.5 : !selectedDate ? 0.4 : 1,
                      position: 'relative' as const,
                    }}
                  >
                    {slot}{isBooked ? ' ✗' : ''}
                  </button>
                );
              })}
            </div>
            {selectedDate && bookedSlots.length > 0 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--charcoal)', marginTop: '0.5rem' }}>✗ = already booked</p>
            )}
          </div>

          {/* Urgency */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 700, color: 'var(--deep-blue)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
              <AlertTriangle size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Urgency Level
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {URGENCY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setUrgency(opt.value)}
                  style={{
                    padding: '0.6rem 1.1rem', borderRadius: 10,
                    border: `2px solid ${urgency === opt.value ? opt.color : 'var(--border)'}`,
                    background: urgency === opt.value ? opt.bg : 'var(--surface)',
                    color: urgency === opt.value ? opt.color : 'var(--foreground-muted)',
                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.18s ease',
                    textAlign: 'left',
                  }}
                >
                  <div>{opt.label}</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 400, opacity: 0.85 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <label style={{ fontWeight: 700, color: 'var(--deep-blue)', fontSize: '0.95rem' }}>
                <FileText size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Reason for Appointment
              </label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {(['text', 'voice'] as const).map(mode => (
                  <button key={mode} onClick={() => setInputMode(mode)} style={{
                    padding: '0.25rem 0.75rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
                    border: `1.5px solid ${inputMode === mode ? 'var(--primary)' : 'var(--border)'}`,
                    background: inputMode === mode ? 'var(--primary)' : 'var(--surface)',
                    color: inputMode === mode ? 'white' : 'var(--charcoal)', cursor: 'pointer',
                  }}>{mode === 'text' ? '⌨ Type' : '🎙 Voice'}</button>
                ))}
              </div>
            </div>

            {inputMode === 'text' ? (
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Describe your symptoms, concerns, or reason for the appointment…"
                rows={4}
                style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem', border: '2px dashed var(--border)', borderRadius: 12, background: 'var(--surface-muted)' }}>
                <button
                  onClick={toggleVoice}
                  style={{ width: 70, height: 70, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isRecording ? '#FFEBEE' : 'var(--primary)', color: isRecording ? '#C62828' : 'white', boxShadow: isRecording ? '0 0 0 8px rgba(198,40,40,0.2)' : '0 4px 16px rgba(0,82,165,0.3)', animation: isRecording ? 'nalamPulse 1s infinite' : 'none', transition: 'all 0.2s ease' }}
                >
                  {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
                </button>
                <p style={{ color: 'var(--charcoal)', fontSize: '0.88rem', fontWeight: 600 }}>
                  {isRecording ? '🔴 Listening… speak clearly' : 'Tap the mic to speak your reason'}
                </p>
                {reason && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 1rem', width: '100%', fontSize: '0.88rem', color: 'var(--foreground)', lineHeight: 1.6 }}>
                    <strong>Heard:</strong> {reason}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(0)} className="glass-button" style={{ padding: '0.65rem 1rem' }}>← Back</button>
            <button
              disabled={!selectedDate || !selectedTime || !reason.trim()}
              onClick={() => { setStep(2); generateSummary(); }}
              style={{ padding: '0.65rem 1.25rem', borderRadius: 10, background: !selectedDate || !selectedTime || !reason.trim() ? 'var(--border)' : 'var(--primary)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: !selectedDate || !selectedTime || !reason.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, justifyContent: 'center' }}
            >
              Next → AI Summary
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: AI Summary + Attachments ── */}
      {step === 2 && (
        <div className="slide-up">
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--deep-blue)' }}>AI Clinical Summary</h3>
          <p style={{ color: 'var(--charcoal)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Our AI has analyzed your reason and generated a clinical summary for the doctor.</p>

          {summaryLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.5rem', borderRadius: 12, background: 'var(--primary-light)', border: '1px solid rgba(0,82,165,0.2)', marginBottom: '1.5rem' }}>
              <Loader2 size={22} color="var(--primary)" style={{ animation: 'spin 0.8s linear infinite' }} />
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Generating clinical summary via AI…</span>
            </div>
          ) : (
            <div style={{ padding: '1.25rem', borderRadius: 12, background: 'rgba(0,82,165,0.05)', border: '1.5px solid rgba(0,82,165,0.18)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Brain size={18} color="var(--primary)" />
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.88rem' }}>AI-Generated Summary · Groq</span>
              </div>
              <p style={{ color: 'var(--foreground)', lineHeight: 1.7, fontSize: '0.9rem' }}>{aiSummary}</p>
              <button onClick={() => setAiSummary(prev => prev)} style={{ marginTop: '0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--charcoal)', fontSize: '0.78rem', fontWeight: 600 }}>✎ Edit summary</button>
              {/* Editable override */}
              <textarea
                value={aiSummary}
                onChange={e => setAiSummary(e.target.value)}
                rows={3}
                style={{ width: '100%', marginTop: '0.5rem', padding: '0.65rem 0.9rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          )}

          {/* Attachments */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 700, color: 'var(--deep-blue)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
              <Paperclip size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Attachments <span style={{ fontWeight: 400, color: 'var(--charcoal)', fontSize: '0.8rem' }}>(Optional — max 5 files)</span>
            </label>
            <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf" onChange={handleFile} style={{ display: 'none' }} />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: 10, border: '2px dashed var(--border)', background: 'var(--surface-muted)', color: 'var(--charcoal)', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', width: '100%', justifyContent: 'center', marginBottom: '0.75rem' }}
            >
              <Paperclip size={16} /> Upload Photos or PDFs
            </button>
            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {attachments.map((att, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 600 }}>
                    {att.type === 'image' ? '🖼' : '📄'} {att.name}
                    <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', padding: 0, marginLeft: 2 }}><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(1)} className="glass-button" style={{ padding: '0.65rem 1rem' }}>← Back</button>
            <button
              disabled={summaryLoading}
              onClick={() => setStep(3)}
              style={{ padding: '0.65rem 1.25rem', borderRadius: 10, background: summaryLoading ? 'var(--border)' : 'var(--primary)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: summaryLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, justifyContent: 'center' }}
            >
              Review & Submit →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Review & Submit ── */}
      {step === 3 && selectedDoctor && (
        <div className="slide-up">
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--deep-blue)' }}>Review Your Request</h3>
          <p style={{ color: 'var(--charcoal)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Please confirm all details before submitting.</p>

          <div className="glass-panel" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--charcoal)', fontWeight: 600, marginBottom: 2 }}>DOCTOR</div>
                <div style={{ fontWeight: 700, color: 'var(--deep-blue)' }}>{selectedDoctor.name}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--charcoal)' }}>{selectedDoctor.specialty} · {selectedDoctor.hospital}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--charcoal)', fontWeight: 600, marginBottom: 2 }}>DATE</div>
                <div style={{ fontWeight: 700, color: 'var(--deep-blue)' }}>{formatDate(selectedDate)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--charcoal)', fontWeight: 600, marginBottom: 2 }}>URGENCY</div>
                {(() => {
                  const opt = URGENCY_OPTIONS.find(o => o.value === urgency)!;
                  return <span style={{ padding: '0.2rem 0.75rem', borderRadius: 20, background: opt.bg, color: opt.color, fontWeight: 700, fontSize: '0.83rem', border: `1px solid ${opt.color}44` }}>{urgency}</span>;
                })()}
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--charcoal)', fontWeight: 600, marginBottom: 2 }}>ATTACHMENTS</div>
                <div style={{ fontWeight: 600 }}>{attachments.length > 0 ? `${attachments.length} file(s)` : 'None'}</div>
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--charcoal)', fontWeight: 600, marginBottom: 4 }}>AI CLINICAL SUMMARY</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--foreground)', lineHeight: 1.6, padding: '0.75rem', background: 'var(--surface-muted)', borderRadius: 8 }}>{aiSummary}</div>
            </div>
          </div>

          {/* Live vitals snapshot */}
          <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Activity size={16} color="var(--accent-teal)" />
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-teal)' }}>Live Vitals Snapshot</span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#22c55e', fontWeight: 700 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'nalamPulse 1.4s infinite' }} /> Live
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--charcoal)', marginBottom: '0.5rem' }}>These vitals will be attached to your request at the moment of submission.</p>
            <VitalsDisplay vitals={vitalsSnap} />
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <button onClick={() => setStep(2)} className="glass-button" style={{ padding: '0.75rem 1.25rem' }}>← Back</button>
            <button
              disabled={submitting}
              onClick={handleSubmit}
              style={{ flex: 1, padding: '0.75rem 1.25rem', borderRadius: 10, background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 16px rgba(0,82,165,0.3)' }}
            >
              {submitting
                ? <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> Submitting…</>
                : <><CheckCircle size={18} /> Submit Request</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
