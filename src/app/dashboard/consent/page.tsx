'use client';
import { useState } from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useRouter } from 'next/navigation';

export default function SmartConsentPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [consent, setConsent] = useState({ emergency: false, specialist: false, research: false });

  const toggleConsent = (k: keyof typeof consent) => setConsent(c => ({ ...c, [k]: !c[k] }));

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
          <span className="badge teal">{t('dashboard.masterKey')}</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          {t('dashboard.consentDesc')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <ConsentToggle label={t('dashboard.emergencyAccess')} desc={t('dashboard.emergencyDesc')} active={consent.emergency} onToggle={() => toggleConsent('emergency')} />
          <ConsentToggle label={t('dashboard.specialistAccess')} desc={t('dashboard.specialistDesc')} active={consent.specialist} onToggle={() => toggleConsent('specialist')} />
          <ConsentToggle label={t('dashboard.researchAccess')} desc={t('dashboard.researchDesc')} active={consent.research} onToggle={() => toggleConsent('research')} />
        </div>
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
