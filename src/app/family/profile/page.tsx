'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, Phone, Mail, MapPin, Heart, Briefcase, Shield, Save,
  Pencil, Check, X, AlertCircle, ChevronLeft, Loader2,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { apiFetch } from '@/lib/apiFetch';

/* ──────────────────────────────────────────────────────────────────── */
/* Inline field component */
interface FieldProps {
  label: string;
  value: string;
  fieldKey: string;
  type?: 'text' | 'email' | 'tel' | 'date' | 'select';
  options?: string[];
  editing: string | null;
  draft: Record<string, string>;
  onEdit: (key: string) => void;
  onCancel: () => void;
  onChange: (key: string, val: string) => void;
  placeholder?: string;
}

function ProfileField({
  label, value, fieldKey, type = 'text', options = [],
  editing, draft, onEdit, onCancel, onChange, placeholder,
}: FieldProps) {
  const isEditing = editing === fieldKey;
  const displayVal = draft[fieldKey] !== undefined ? draft[fieldKey] : value;
  const hasValue = !!value;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.35rem',
      padding: '0.85rem 1rem',
      background: 'var(--surface)',
      borderRadius: 12,
      border: isEditing ? '2px solid var(--primary)' : '1px solid var(--border)',
      transition: 'border-color 0.2s',
    }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>

      {isEditing ? (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {type === 'select' ? (
            <select
              value={displayVal}
              onChange={e => onChange(fieldKey, e.target.value)}
              style={{
                flex: 1, background: 'var(--background)', color: 'var(--foreground)',
                border: 'none', outline: 'none', fontSize: '0.95rem', fontWeight: 600,
                padding: '0.2rem 0',
              }}
            >
              <option value="">—</option>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type={type}
              value={displayVal}
              onChange={e => onChange(fieldKey, e.target.value)}
              autoFocus
              placeholder={placeholder || label}
              style={{
                flex: 1, background: 'transparent', color: 'var(--foreground)',
                border: 'none', outline: 'none', fontSize: '0.95rem', fontWeight: 600,
                padding: '0.2rem 0', minWidth: 0,
              }}
            />
          )}
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--charcoal)', padding: '0.2rem', borderRadius: 6, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span style={{
            fontSize: '0.95rem', fontWeight: hasValue ? 600 : 400,
            color: hasValue ? 'var(--foreground)' : 'var(--charcoal)',
            fontStyle: hasValue ? 'normal' : 'italic',
          }}>
            {hasValue ? value : '—'}
          </span>
          <button
            onClick={() => onEdit(fieldKey)}
            style={{
              background: 'var(--surface-muted)', border: '1px solid var(--border)',
              borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              color: 'var(--primary)',
            }}
          >
            <Pencil size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Section header */
function Section({ icon: Icon, title, color = 'var(--primary)' }: { icon: any; title: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '1.5rem', marginBottom: '0.75rem' }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} color={color} />
      </div>
      <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>{title}</h2>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
export default function FamilyProfilePage() {
  const { t, lang } = useLanguage();
  const router = useRouter();

  const [profile, setProfile] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const res = await apiFetch('/api/family/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile || {});
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleEdit = (key: string) => {
    setEditing(key);
    setDraft(prev => ({ ...prev, [key]: profile[key] ?? '' }));
  };
  const handleCancel = () => setEditing(null);
  const handleChange = (key: string, val: string) => setDraft(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      // Merge draft into profile for save
      const payload = { ...profile, ...draft };
      const res = await apiFetch('/api/family/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || (t('profile.saveFailed') || 'Save failed'));
      } else {
        setProfile(payload);
        setDraft({});
        setEditing(null);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch { setError(t('profile.networkError') || 'Network error'); }
    finally { setSaving(false); }
  };

  const fieldProps = (key: string, extra?: Partial<FieldProps>) => ({
    fieldKey: key,
    value: profile[key] ?? '',
    editing,
    draft,
    onEdit: handleEdit,
    onCancel: handleCancel,
    onChange: handleChange,
    ...extra,
  });

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
    </div>
  );

  const hasDraft = Object.keys(draft).length > 0;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 'var(--nav-height, 56px)', zIndex: 100,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground)', display: 'flex', padding: '0.3rem' }}>
          <ChevronLeft size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
            {t('profile.editDetails') || 'Edit Details'}
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--charcoal)', margin: 0 }}>
            {t('profile.familyDetailsDesc') || 'Update your family account information'}
          </p>
        </div>
        {hasDraft && (
          <span style={{ fontSize: '0.75rem', background: '#FEF3C7', color: '#92400E', padding: '0.25rem 0.6rem', borderRadius: 20, fontWeight: 700 }}>
            {t('profile.unsaved') || 'Unsaved changes'}
          </span>
        )}
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1rem 1rem 0' }}>

        {/* Personal Info */}
        <Section icon={User} title={t('profile.personalInfo') || 'Personal Information'} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <ProfileField {...fieldProps('name')} label={t('profile.fullName') || 'Full Name'} />
          <ProfileField {...fieldProps('email')} label={t('profile.email') || 'Email'} type="email" />
          <ProfileField {...fieldProps('mobile')} label={t('profile.mobile') || 'Mobile'} type="tel" />
          <ProfileField {...fieldProps('dob')} label={t('profile.dob') || 'Date of Birth'} type="date" />
          <ProfileField {...fieldProps('gender')} label={t('profile.gender') || 'Gender'} type="select"
            options={['Male', 'Female', 'Other', 'Prefer not to say']} />
        </div>

        {/* Address */}
        <Section icon={MapPin} title={t('profile.address') || 'Address'} color="#0097A7" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <ProfileField {...fieldProps('address')} label={t('profile.addressLine') || 'Address Line'} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <ProfileField {...fieldProps('city')} label={t('profile.city') || 'City'} />
            <ProfileField {...fieldProps('state')} label={t('profile.state') || 'State'} />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ margin: '1rem 0', padding: '0.85rem 1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, display: 'flex', gap: '0.6rem', alignItems: 'center', color: '#B91C1C', fontWeight: 600, fontSize: '0.88rem' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Save Button */}
        <div style={{ marginTop: '1.5rem' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%', padding: '1rem', borderRadius: 14,
              background: saved ? 'linear-gradient(135deg,#059669,#10B981)' : 'linear-gradient(135deg,#0052A5,#0073D9)',
              color: 'white', border: 'none', fontSize: '1rem', fontWeight: 800,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
              transition: 'all 0.3s', boxShadow: '0 4px 16px rgba(0,82,165,0.25)',
            }}
          >
            {saving ? <Loader2 size={18} style={{ animation: 'spin 0.9s linear infinite' }} /> : saved ? <Check size={18} /> : <Save size={18} />}
            {saving ? (t('profile.saving') || 'Saving…') : saved ? (t('profile.saved') || 'Saved!') : (t('profile.saveChanges') || 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  );
}
