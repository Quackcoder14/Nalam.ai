'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Building2, CalendarDays, CheckCircle, GraduationCap, Languages, Stethoscope, UserRound } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { AVAILABLE_TIME_SLOTS } from '@/lib/doctors';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LANGUAGES = ['Tamil', 'English', 'Hindi', 'Telugu', 'Malayalam'];
const MODES = ['In-person', 'Teleconsult', 'Emergency on-call'];
const SPECIALTIES = ['General Medicine', 'Cardiology', 'Diabetology', 'Obstetrics & Gynaecology', 'Paediatrics', 'Orthopaedics', 'Neurology', 'Dermatology', 'ENT', 'Psychiatry', 'Emergency Medicine'];

const emptyDoctor = {
  id: '',
  password: '',
  fullName: '',
  gender: '',
  dob: '',
  mobile: '',
  email: '',
  registrationNumber: '',
  registrationCouncil: 'Tamil Nadu Medical Council',
  registrationYear: '',
  qualification: '',
  specialty: 'General Medicine',
  department: 'General Medicine',
  designation: 'Consultant',
  hospital: '',
  experienceYears: '',
  roomNumber: '',
  address: '',
  district: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '',
  status: 'active',
};

const inputStyle = {
  width: '100%',
  padding: '0.62rem 0.75rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--foreground)',
  fontFamily: 'inherit',
  boxSizing: 'border-box' as const,
};

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.78rem', fontWeight: 700, color: 'var(--charcoal)' }}>
      <span>{label}{required && <span style={{ color: 'var(--accent-red)' }}> *</span>}</span>
      {children}
    </label>
  );
}

function ToggleGrid({ values, selected, onChange }: { values: string[]; selected: string[]; onChange: (next: string[]) => void }) {
  return (
    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
      {values.map(value => {
        const active = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(active ? selected.filter(v => v !== value) : [...selected, value])}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: 999,
              border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
              background: active ? 'var(--primary-light)' : 'var(--surface)',
              color: active ? 'var(--primary)' : 'var(--foreground-muted)',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: '0.78rem',
            }}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

export default function NewDoctorPage() {
  const router = useRouter();
  const [form, setForm] = useState(emptyDoctor);
  const [languages, setLanguages] = useState(['Tamil', 'English']);
  const [consultationModes, setConsultationModes] = useState(['In-person']);
  const [availableDays, setAvailableDays] = useState(['Mon', 'Wed', 'Fri']);
  const [timeSlots, setTimeSlots] = useState(['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState('');
  const [createdEmail, setCreatedEmail] = useState('');

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setCreated('');
    setCreatedEmail('');
    try {
      const res = await apiFetch('/api/hospital-desk/doctors', {
        method: 'POST',
        body: JSON.stringify({ ...form, languages, consultationModes, availableDays, timeSlots }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to register doctor');
      setCreated(data.doctor?.id || form.fullName);
      setCreatedEmail(data.loginEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register doctor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container fade-in" style={{ maxWidth: 1080 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.25rem' }}>
        <button onClick={() => router.push('/hospital-desk')} className="glass-button" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={16} /> Desk
        </button>
        <div>
          <h2 style={{ fontSize: '1.55rem', color: 'var(--deep-blue)' }}>New Doctor Registration</h2>
          <p style={{ color: 'var(--charcoal)', fontSize: '0.9rem' }}>Clinical roster and appointment setup for Tamil Nadu hospitals</p>
        </div>
      </div>

      {created && (
        <div style={{ marginBottom: '1rem', padding: '0.9rem 1rem', borderRadius: 10, background: 'var(--accent-green-bg)', color: 'var(--accent-green)', border: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
          <CheckCircle size={18} /> Doctor registered: {created} (Login: {createdEmail})
        </div>
      )}
      {error && <div style={{ marginBottom: '1rem', padding: '0.85rem 1rem', borderRadius: 10, background: 'var(--accent-red-bg)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', fontWeight: 700 }}>{error}</div>}

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <section className="glass-panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', marginBottom: '1rem' }}><UserRound size={18} /> Identity & Contact</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
            <Field label="Doctor ID"><input style={inputStyle} value={form.id} onChange={e => update('id', e.target.value)} placeholder="Auto if blank, e.g. dr_ravi" /></Field>
            <Field label="Full name" required><input style={inputStyle} required value={form.fullName} onChange={e => update('fullName', e.target.value)} placeholder="Dr. ..." /></Field>
            <Field label="Portal Password" required><input style={inputStyle} required type="text" value={form.password} onChange={e => update('password', e.target.value)} placeholder="For clinician login" /><small style={{color: 'var(--charcoal)', fontSize: '0.75rem', marginTop: 4, display: 'block'}}>Login ID will be: {form.fullName ? form.fullName.toLowerCase().replace(/\s+/g, '') + '@nalam.ai' : '[fullname]@nalam.ai'}</small></Field>
            <Field label="Gender"><select style={inputStyle} value={form.gender} onChange={e => update('gender', e.target.value)}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></Field>
            <Field label="Date of birth"><input style={inputStyle} type="date" value={form.dob} onChange={e => update('dob', e.target.value)} /></Field>
            <Field label="Mobile"><input style={inputStyle} value={form.mobile} onChange={e => update('mobile', e.target.value)} /></Field>
            <Field label="Email"><input style={inputStyle} type="email" value={form.email} onChange={e => update('email', e.target.value)} /></Field>
          </div>
        </section>

        <section className="glass-panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-purple)', marginBottom: '1rem' }}><BadgeCheck size={18} /> Medical Registration</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
            <Field label="Registration council" required><input style={inputStyle} required value={form.registrationCouncil} onChange={e => update('registrationCouncil', e.target.value)} /></Field>
            <Field label="Registration number" required><input style={inputStyle} required value={form.registrationNumber} onChange={e => update('registrationNumber', e.target.value)} /></Field>
            <Field label="Registration year"><input style={inputStyle} value={form.registrationYear} onChange={e => update('registrationYear', e.target.value)} placeholder="YYYY" /></Field>
            <Field label="Qualification" required><input style={inputStyle} required value={form.qualification} onChange={e => update('qualification', e.target.value)} placeholder="MBBS, MD General Medicine..." /></Field>
          </div>
        </section>

        <section className="glass-panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-teal)', marginBottom: '1rem' }}><Stethoscope size={18} /> Clinical Posting</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
            <Field label="Specialty" required><select style={inputStyle} required value={form.specialty} onChange={e => { update('specialty', e.target.value); update('department', e.target.value); }}>{SPECIALTIES.map(v => <option key={v}>{v}</option>)}</select></Field>
            <Field label="Department" required><input style={inputStyle} required value={form.department} onChange={e => update('department', e.target.value)} /></Field>
            <Field label="Designation"><input style={inputStyle} value={form.designation} onChange={e => update('designation', e.target.value)} placeholder="Consultant, Senior Consultant..." /></Field>
            <Field label="Experience years"><input style={inputStyle} type="number" min="0" value={form.experienceYears} onChange={e => update('experienceYears', e.target.value)} /></Field>
          </div>
        </section>

        <section className="glass-panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--deep-blue)', marginBottom: '1rem' }}><Building2 size={18} /> Hospital Assignment</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
            <Field label="Hospital / branch" required><input style={inputStyle} required value={form.hospital} onChange={e => update('hospital', e.target.value)} placeholder="Apollo Hospitals, Chennai" /></Field>
            <Field label="Room / OP number"><input style={inputStyle} value={form.roomNumber} onChange={e => update('roomNumber', e.target.value)} /></Field>
            <Field label="Address"><input style={inputStyle} value={form.address} onChange={e => update('address', e.target.value)} /></Field>
            <Field label="District"><input style={inputStyle} value={form.district} onChange={e => update('district', e.target.value)} /></Field>
            <Field label="State"><input style={inputStyle} value={form.state} onChange={e => update('state', e.target.value)} /></Field>
            <Field label="PIN code"><input style={inputStyle} value={form.pincode} onChange={e => update('pincode', e.target.value)} /></Field>
          </div>
        </section>

        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)' }}><CalendarDays size={18} /> Appointment Availability</h3>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--charcoal)', marginBottom: '0.45rem' }}>Available days</div>
            <ToggleGrid values={DAYS} selected={availableDays} onChange={setAvailableDays} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--charcoal)', marginBottom: '0.45rem' }}>OP time slots</div>
            <ToggleGrid values={AVAILABLE_TIME_SLOTS} selected={timeSlots} onChange={setTimeSlots} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--charcoal)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: 6 }}><Languages size={15} /> Languages</div>
            <ToggleGrid values={LANGUAGES} selected={languages} onChange={setLanguages} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--charcoal)', marginBottom: '0.45rem' }}>Consultation modes</div>
            <ToggleGrid values={MODES} selected={consultationModes} onChange={setConsultationModes} />
          </div>
        </section>

        <section className="glass-panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-amber)', marginBottom: '0.6rem' }}><GraduationCap size={18} /> Verification Checklist</h3>
          <div style={{ display: 'grid', gap: '0.45rem', color: 'var(--charcoal)', fontSize: '0.86rem', lineHeight: 1.5 }}>
            <div>Confirm registration number against the relevant State Medical Council / NMC record.</div>
            <div>Collect qualification, council registration, ID proof, and appointment order copies offline before activation.</div>
            <div>Use status inactive if credentials are pending verification.</div>
          </div>
          <Field label="Status"><select style={{ ...inputStyle, marginTop: '0.8rem' }} value={form.status} onChange={e => update('status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive / pending verification</option></select></Field>
        </section>

        <button disabled={saving} type="submit" style={{ padding: '0.9rem 1.25rem', borderRadius: 10, background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 800, fontSize: '0.95rem', cursor: saving ? 'wait' : 'pointer', boxShadow: '0 4px 16px rgba(0,82,165,0.28)' }}>
          {saving ? 'Registering...' : 'Register Doctor'}
        </button>
      </form>
    </div>
  );
}
