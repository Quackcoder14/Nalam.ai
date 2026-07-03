'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, ClipboardList, HeartPulse, IdCard, Phone, Plus, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

const BLOOD_GROUPS = ['Unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female', 'Other'];
const DISTRICTS = ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Vellore', 'Thanjavur', 'Kancheepuram', 'Other'];

const emptyPatient = {
  id: '',
  password: '',
  name: '',
  dob: '',
  gender: '',
  guardianName: '',
  mobile: '',
  contact: '',
  email: '',
  address: '',
  city: '',
  district: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '',
  emergencyName: '',
  emergencyRelation: '',
  emergencyPhone: '',
  occupation: '',
  maritalStatus: '',
  preferredLanguage: 'Tamil',
  aadhaarLast4: '',
  insuranceProvider: '',
  insurancePolicy: '',
  bloodType: 'Unknown',
  allergies: '',
  chronicConditions: '',
  currentMedications: '',
  pastSurgeries: '',
  familyHistory: '',
  lifestyleNotes: '',
  consentEmergency: true,
  consentSpecialist: true,
  consentResearch: false,
};

const emptyRecord = {
  date: new Date().toISOString().slice(0, 10),
  type: 'Initial Intake',
  provider: '',
  department: '',
  doctorName: '',
  diagnosis: '',
  notes: '',
  labResults: '',
  medications: '',
  procedures: '',
  followUpDate: '',
};
type ConsentKey = 'consentEmergency' | 'consentSpecialist' | 'consentResearch';
const CONSENT_ITEMS: Array<[ConsentKey, string]> = [
  ['consentEmergency', 'Emergency care access'],
  ['consentSpecialist', 'Specialist referral access'],
  ['consentResearch', 'De-identified research access'],
];

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.78rem', fontWeight: 700, color: 'var(--charcoal)' }}>
      <span>{label}{required && <span style={{ color: 'var(--accent-red)' }}> *</span>}</span>
      {children}
    </label>
  );
}

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

export default function NewPatientPage() {
  const router = useRouter();
  const [form, setForm] = useState(emptyPatient);
  const [records, setRecords] = useState([{ ...emptyRecord }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState('');
  const [createdEmail, setCreatedEmail] = useState('');

  const update = (key: string, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));
  const updateRecord = (index: number, key: string, value: string) => setRecords(prev => prev.map((record, i) => i === index ? { ...record, [key]: value } : record));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setCreatedId('');
    setCreatedEmail('');
    try {
      const res = await apiFetch('/api/hospital-desk/patients', {
        method: 'POST',
        body: JSON.stringify({ ...form, records }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to register patient');
      setCreatedId(data.patientId);
      setCreatedEmail(data.loginEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register patient');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container fade-in" style={{ maxWidth: 1120 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.25rem' }}>
        <button onClick={() => router.push('/hospital-desk')} className="glass-button" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.9rem' }}>
          <ArrowLeft size={16} /> Desk
        </button>
        <div>
          <h2 style={{ fontSize: '1.55rem', color: 'var(--deep-blue)' }}>New Patient Registration</h2>
          <p style={{ color: 'var(--charcoal)', fontSize: '0.9rem' }}>Hospital desk intake for Tamil Nadu care settings</p>
        </div>
      </div>

      {createdId && (
        <div style={{ marginBottom: '1rem', padding: '0.9rem 1rem', borderRadius: 10, background: 'var(--accent-green-bg)', color: 'var(--accent-green)', border: '1px solid var(--accent-green)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
          <CheckCircle size={18} /> Patient registered: {createdId} (Login: {createdEmail})
          <button onClick={() => router.push(`/hospital-desk`)} style={{ marginLeft: 'auto', border: 'none', borderRadius: 8, background: 'var(--surface)', color: 'var(--accent-green)', padding: '0.4rem 0.75rem', fontWeight: 800, cursor: 'pointer' }}>Back to desk</button>
        </div>
      )}
      {error && <div style={{ marginBottom: '1rem', padding: '0.85rem 1rem', borderRadius: 10, background: 'var(--accent-red-bg)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', fontWeight: 700 }}>{error}</div>}

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <section className="glass-panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', marginBottom: '1rem' }}><UserRound size={18} /> Identity</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
            <Field label="Patient ID"><input style={inputStyle} value={form.id} onChange={e => update('id', e.target.value)} placeholder="Auto if blank, e.g. P102" /></Field>
            <Field label="Full name" required><input style={inputStyle} required value={form.name} onChange={e => update('name', e.target.value)} placeholder="As per hospital record" /></Field>
            <Field label="Portal Password" required><input style={inputStyle} required type="text" value={form.password} onChange={e => update('password', e.target.value)} placeholder="For patient login" /><small style={{color: 'var(--charcoal)', fontSize: '0.75rem', marginTop: 4, display: 'block'}}>Login ID will be: {form.name ? form.name.toLowerCase().replace(/\s+/g, '') + '@nalam.ai' : '[fullname]@nalam.ai'}</small></Field>
            <Field label="Date of birth" required><input style={inputStyle} type="date" required value={form.dob} onChange={e => update('dob', e.target.value)} /></Field>
            <Field label="Gender" required><select style={inputStyle} required value={form.gender} onChange={e => update('gender', e.target.value)}><option value="">Select</option>{GENDERS.map(v => <option key={v}>{v}</option>)}</select></Field>
            <Field label="Parent / guardian / spouse"><input style={inputStyle} value={form.guardianName} onChange={e => update('guardianName', e.target.value)} /></Field>
            <Field label="Preferred language"><select style={inputStyle} value={form.preferredLanguage} onChange={e => update('preferredLanguage', e.target.value)}><option>Tamil</option><option>English</option><option>Hindi</option><option>Telugu</option><option>Malayalam</option></select></Field>
          </div>
        </section>

        <section className="glass-panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-teal)', marginBottom: '1rem' }}><Phone size={18} /> Contact & Local Address</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
            <Field label="Mobile" required><input style={inputStyle} required value={form.mobile} onChange={e => update('mobile', e.target.value)} placeholder="+91..." /></Field>
            <Field label="Alternate contact"><input style={inputStyle} value={form.contact} onChange={e => update('contact', e.target.value)} /></Field>
            <Field label="Email"><input style={inputStyle} type="email" value={form.email} onChange={e => update('email', e.target.value)} /></Field>
            <Field label="Address"><input style={inputStyle} value={form.address} onChange={e => update('address', e.target.value)} placeholder="Door no, street, area" /></Field>
            <Field label="City / town"><input style={inputStyle} value={form.city} onChange={e => update('city', e.target.value)} /></Field>
            <Field label="District"><select style={inputStyle} value={form.district} onChange={e => update('district', e.target.value)}>{DISTRICTS.map(v => <option key={v}>{v}</option>)}</select></Field>
            <Field label="State"><input style={inputStyle} value={form.state} onChange={e => update('state', e.target.value)} /></Field>
            <Field label="PIN code"><input style={inputStyle} value={form.pincode} onChange={e => update('pincode', e.target.value)} maxLength={6} /></Field>
          </div>
        </section>

        <section className="glass-panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-red)', marginBottom: '1rem' }}><IdCard size={18} /> Emergency & Coverage</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
            <Field label="Emergency contact name"><input style={inputStyle} value={form.emergencyName} onChange={e => update('emergencyName', e.target.value)} /></Field>
            <Field label="Relation"><input style={inputStyle} value={form.emergencyRelation} onChange={e => update('emergencyRelation', e.target.value)} placeholder="Father, spouse, neighbour..." /></Field>
            <Field label="Emergency phone"><input style={inputStyle} value={form.emergencyPhone} onChange={e => update('emergencyPhone', e.target.value)} /></Field>
            <Field label="Aadhaar last 4 digits"><input style={inputStyle} value={form.aadhaarLast4} onChange={e => update('aadhaarLast4', e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} /></Field>
            <Field label="Insurance / scheme"><input style={inputStyle} value={form.insuranceProvider} onChange={e => update('insuranceProvider', e.target.value)} placeholder="CMCHIS, PM-JAY, private..." /></Field>
            <Field label="Policy / card number"><input style={inputStyle} value={form.insurancePolicy} onChange={e => update('insurancePolicy', e.target.value)} /></Field>
          </div>
        </section>

        <section className="glass-panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-purple)', marginBottom: '1rem' }}><HeartPulse size={18} /> Clinical Baseline</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
            <Field label="Blood group"><select style={inputStyle} value={form.bloodType} onChange={e => update('bloodType', e.target.value)}>{BLOOD_GROUPS.map(v => <option key={v}>{v}</option>)}</select></Field>
            <Field label="Occupation"><input style={inputStyle} value={form.occupation} onChange={e => update('occupation', e.target.value)} /></Field>
            <Field label="Marital status"><select style={inputStyle} value={form.maritalStatus} onChange={e => update('maritalStatus', e.target.value)}><option value="">Select</option><option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option></select></Field>
            <Field label="Allergies"><textarea style={inputStyle} rows={2} value={form.allergies} onChange={e => update('allergies', e.target.value)} placeholder="Drug/food allergy, NKDA if none" /></Field>
            <Field label="Chronic conditions"><textarea style={inputStyle} rows={2} value={form.chronicConditions} onChange={e => update('chronicConditions', e.target.value)} placeholder="Diabetes, hypertension, asthma..." /></Field>
            <Field label="Current medications"><textarea style={inputStyle} rows={2} value={form.currentMedications} onChange={e => update('currentMedications', e.target.value)} /></Field>
            <Field label="Past surgeries / admissions"><textarea style={inputStyle} rows={2} value={form.pastSurgeries} onChange={e => update('pastSurgeries', e.target.value)} /></Field>
            <Field label="Family history"><textarea style={inputStyle} rows={2} value={form.familyHistory} onChange={e => update('familyHistory', e.target.value)} /></Field>
            <Field label="Lifestyle notes"><textarea style={inputStyle} rows={2} value={form.lifestyleNotes} onChange={e => update('lifestyleNotes', e.target.value)} placeholder="Tobacco, alcohol, diet, occupation exposure" /></Field>
          </div>
        </section>

        <section className="glass-panel">
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--deep-blue)' }}><ClipboardList size={18} /> Initial Medical Records</h3>
            <button type="button" className="glass-button" onClick={() => setRecords(prev => [...prev, { ...emptyRecord }])} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={15} /> Add record</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {records.map((record, index) => (
              <div key={index} style={{ padding: '1rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-muted)' }}>
                <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ color: 'var(--deep-blue)' }}>Record {index + 1}</strong>
                  {records.length > 1 && <button type="button" onClick={() => setRecords(prev => prev.filter((_, i) => i !== index))} style={{ border: 'none', background: 'transparent', color: 'var(--accent-red)', cursor: 'pointer' }}><Trash2 size={16} /></button>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <Field label="Date"><input style={inputStyle} type="date" value={record.date} onChange={e => updateRecord(index, 'date', e.target.value)} /></Field>
                  <Field label="Record type"><input style={inputStyle} value={record.type} onChange={e => updateRecord(index, 'type', e.target.value)} /></Field>
                  <Field label="Provider / facility"><input style={inputStyle} value={record.provider} onChange={e => updateRecord(index, 'provider', e.target.value)} placeholder="Apollo Hospitals Chennai" /></Field>
                  <Field label="Department"><input style={inputStyle} value={record.department} onChange={e => updateRecord(index, 'department', e.target.value)} /></Field>
                  <Field label="Doctor name"><input style={inputStyle} value={record.doctorName} onChange={e => updateRecord(index, 'doctorName', e.target.value)} /></Field>
                  <Field label="Diagnosis / reason"><input style={inputStyle} value={record.diagnosis} onChange={e => updateRecord(index, 'diagnosis', e.target.value)} /></Field>
                  <Field label="Medications"><textarea style={inputStyle} rows={2} value={record.medications} onChange={e => updateRecord(index, 'medications', e.target.value)} /></Field>
                  <Field label="Lab results"><textarea style={inputStyle} rows={2} value={record.labResults} onChange={e => updateRecord(index, 'labResults', e.target.value)} /></Field>
                  <Field label="Procedures"><textarea style={inputStyle} rows={2} value={record.procedures} onChange={e => updateRecord(index, 'procedures', e.target.value)} /></Field>
                  <Field label="Notes"><textarea style={inputStyle} rows={2} value={record.notes} onChange={e => updateRecord(index, 'notes', e.target.value)} /></Field>
                  <Field label="Follow-up date"><input style={inputStyle} type="date" value={record.followUpDate} onChange={e => updateRecord(index, 'followUpDate', e.target.value)} /></Field>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)' }}><ShieldCheck size={18} /> Consent Defaults</h3>
          {CONSENT_ITEMS.map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 700, color: 'var(--foreground)' }}>
              <input type="checkbox" checked={form[key]} onChange={e => update(key, e.target.checked)} />
              {label}
            </label>
          ))}
        </section>

        <button disabled={saving} type="submit" style={{ padding: '0.9rem 1.25rem', borderRadius: 10, background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 800, fontSize: '0.95rem', cursor: saving ? 'wait' : 'pointer', boxShadow: '0 4px 16px rgba(0,82,165,0.28)' }}>
          {saving ? 'Registering...' : 'Register Patient'}
        </button>
      </form>
    </div>
  );
}
