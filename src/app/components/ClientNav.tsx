'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Heart, LogOut, LayoutDashboard, Rss, Stethoscope,
  Search, Moon, Sun,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

export default function ClientNav() {
  const [role, setRole]     = useState<string | null>(null);
  const [dark, setDark]     = useState(false);
  const [searchQ, setQ]     = useState('');
  const router   = useRouter();
  const pathname = usePathname();
  const { t, lang, setLang } = useLanguage();

  useEffect(() => {
    const saved = localStorage.getItem('nalamTheme') || 'light';
    setDark(saved === 'dark');
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  useEffect(() => {
    setRole(typeof window !== 'undefined' ? localStorage.getItem('nalamRole') : null);
  }, [pathname]);

  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark';
    setDark(!dark);
    localStorage.setItem('nalamTheme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const logout = () => {
    localStorage.removeItem('nalamRole');
    localStorage.removeItem('nalamPatientId');
    router.push('/');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQ.trim().length >= 2) {
      router.push(`/search?q=${encodeURIComponent(searchQ.trim())}`);
    }
  };

  if (pathname === '/') return null;

  return (
    <header style={{
      borderBottom: '1px solid var(--border)',
      padding: '0.6rem 2rem',
      background: 'var(--surface)',
      boxShadow: 'var(--shadow-sm)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1280px', margin: '0 auto', gap: '1rem' }}>

        {/* Brand */}
        <a href={role === 'clinician' ? '/clinician' : '/dashboard'} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#0052A5,#0097A7)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,82,165,0.3)' }}>
            <Heart size={17} color="white" />
          </div>
          <div>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.3px' }}>nalam</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-orange)', letterSpacing: '-0.3px' }}>.ai</span>
          </div>
        </a>

        {/* Search bar */}
        {role && (
          <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 420 }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-subtle)', pointerEvents: 'none' }} />
              <input
                id="nav-search"
                type="search"
                value={searchQ}
                onChange={e => setQ(e.target.value)}
                placeholder={t('nav.search')}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                  borderRadius: 50,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-muted)',
                  color: 'var(--foreground)',
                  fontSize: '0.84rem',
                  outline: 'none',
                }}
              />
            </div>
          </form>
        )}

        {/* Nav links */}
        <nav style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
          {role === 'patient' && (
            <>
              <a href="/dashboard" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <LayoutDashboard size={15} /> {t('nav.dashboard')}
              </a>
              <a href="/feed" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Rss size={15} /> {t('nav.feedInput')}
              </a>
            </>
          )}
          {role === 'clinician' && (
            <a href="/clinician" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Stethoscope size={15} /> {t('nav.clinicianPortal')}
            </a>
          )}

          {/* Language toggle */}
          <button
            id="lang-toggle"
            onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
            title={lang === 'en' ? 'Switch to Tamil' : 'Switch to English'}
            style={{
              background: 'var(--surface-muted)',
              border: '1px solid var(--border)',
              borderRadius: 50,
              width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--foreground-muted)',
              fontSize: '0.8rem', fontWeight: 700
            }}
          >
            {lang === 'en' ? 'TA' : 'EN'}
          </button>

          {/* Theme toggle */}
          <button
            id="theme-toggle"
            onClick={toggleTheme}
            title={dark ? t('nav.lightMode') : t('nav.darkMode')}
            style={{
              background: 'var(--surface-muted)',
              border: '1px solid var(--border)',
              borderRadius: 50,
              width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--foreground-muted)',
            }}
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button onClick={logout} className="glass-button" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
            <LogOut size={15} /> {t('nav.signOut')}
          </button>
        </nav>
      </div>
    </header>
  );
}
