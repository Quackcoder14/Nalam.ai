'use client';
import { Network, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useRouter } from 'next/navigation';

export default function EHRPage() {
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <div style={{ padding: '1.5rem', maxWidth: '600px', margin: '0 auto', minHeight: 'calc(100vh - var(--nav-height) - var(--bottom-nav-height))' }}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> {t('nav.back')}
      </button>

      <section className="glass-panel slide-up">
        <div className="flex-between" style={{ marginBottom: '1.2rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', color: 'var(--deep-blue)' }}>
            <Network size={20} color="var(--accent-purple)" /> {t('dashboard.connectedEHR')}
          </h2>
          <span className="badge purple pulse-glow">{t('dashboard.live')}</span>
        </div>
        
        <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          {t('dashboard.ehrDesc')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {[
            { name: 'Epic Systems', loc: 'Apollo Hospital Chennai', color: 'var(--primary)' },
            { name: 'Cerner Health', loc: 'AIIMS Delhi', color: 'var(--accent-teal)' },
            { name: 'Apple HealthKit', loc: 'Wearables · Live Stream', color: 'var(--accent-amber)' },
          ].map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--surface-muted)', borderRadius: 12, borderLeft: `4px solid ${s.color}` }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--deep-blue)' }}>{s.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--charcoal)', marginTop: '0.2rem' }}>{s.loc}</div>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-green)', background: 'var(--accent-green-bg)', padding: '0.3rem 0.6rem', borderRadius: 8 }}>{t('dashboard.synced')}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
