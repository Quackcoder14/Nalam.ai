'use client';
import { useState, useEffect } from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch';

export default function SmartConsentPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [consent, setConsent] = useState({ emergency: false, specialist: false, research: false });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const getPatientId = () =>
    sessionStorage.getItem('nalamPatientId') || localStorage.getItem('nalamPatientId') || 'P001';

  // Load current consent from the backend on mount
  useEffect(() => {
    const patientId = getPatientId();
    apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/patient?id=${patientId}`)
      .then(r => r.json())
      .then(data => {
        if (data.patient) {
          setConsent({
            emergency: data.patient.consent_emergency === 'true' || data.patient.consent_emergency === true,
            specialist: data.patient.consent_specialist === 'true' || data.patient.consent_specialist === true,
            research: data.patient.consent_research === 'true' || data.patient.consent_research === true,
          });
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const toggleConsent = async (k: keyof typeof consent) => {
    const next = { ...consent, [k]: !consent[k] };
    setConsent(next);
    setSaving(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/patient/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: getPatientId(), ...next }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '600px', margin: '0 auto', minHeight: 'calc(100vh - var(--nav-height) - var(--bottom-nav-height))' }}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> {t('nav.back')}
      </button>

      <section className="glass-panel slide-up">
        <div className="flex-between" style={{ marginBottom: '1rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', color: 'var(--deep-blue)' }}>
            <Shield size={20} color="var(--primary)" /> {t('dashboard.smartConsent')}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {saving && <span style={{ fontSize: '0.75rem', color: 'var(--charcoal)' }}>Saving…</span>}
            <span className="badge teal">{t('dashboard.masterKey')}</span>
          </div>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          {t('dashboard.consentDesc')}
        </p>

        {!loaded ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <ConsentToggle
              label="Apollo Hospital"
              desc={t('dashboard.emergencyDesc')}
              active={consent.emergency}
              onToggle={() => toggleConsent('emergency')}
            />
            <ConsentToggle
              label="Kauvery Hospital"
              desc={t('dashboard.specialistDesc')}
              active={consent.specialist}
              onToggle={() => toggleConsent('specialist')}
            />
            <ConsentToggle
              label="Govt Hospital"
              desc={t('dashboard.researchDesc')}
              active={consent.research}
              onToggle={() => toggleConsent('research')}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function ConsentToggle({ label, desc, active, onToggle }: { label: string; desc: string; active: boolean; onToggle: () => void }) {
  return (
    <div className="flex-between" style={{ padding: '1rem', background: active ? 'var(--primary-light)' : 'var(--surface-muted)', borderRadius: 12, border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`, transition: 'all 0.25s', gap: '1rem' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--deep-blue)' }}>{label}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--charcoal)', marginTop: 4, lineHeight: 1.4 }}>{desc}</div>
      </div>
      <button onClick={onToggle} style={{ width: 50, height: 28, borderRadius: 14, background: active ? 'var(--primary)' : '#CBD5E0', border: 'none', position: 'relative', cursor: 'pointer', transition: 'background 0.3s', flexShrink: 0 }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: active ? 25 : 3, transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}
