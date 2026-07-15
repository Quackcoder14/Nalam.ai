'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Heart, LogOut, LayoutDashboard, Stethoscope,
  Search, Moon, Sun, Menu, X, Brain, Calendar,
  MessageSquare, Building2, Globe, Shield, Network, UserPlus, ClipboardPlus, FolderOpen, CalendarDays, Bell, Users, UserCog
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

export default function ClientNav() {
  const [role, setRole]         = useState<string | null>(null);
  const [dark, setDark]         = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router   = useRouter();
  const pathname = usePathname();
  const { t, lang, setLang } = useLanguage();

  useEffect(() => {
    const saved = localStorage.getItem('nalamTheme') || 'light';
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setDark(saved === 'dark');
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  useEffect(() => {
    setRole(typeof window !== 'undefined' ? (sessionStorage.getItem('nalamRole') || localStorage.getItem('nalamRole')) : null);
    setDrawerOpen(false); // close drawer on route change
  }, [pathname]);

  // Close drawer on escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark';
    setDark(!dark);
    localStorage.setItem('nalamTheme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) { console.error('Logout failed', e); }
    localStorage.removeItem('nalamRole');
    sessionStorage.removeItem('nalamRole');
    localStorage.removeItem('nalamPatientId');
    sessionStorage.removeItem('nalamPatientId');
    localStorage.removeItem('nalamClinicianRole');
    sessionStorage.removeItem('nalamClinicianRole');
    localStorage.removeItem('nalamHdeskBranch');
    sessionStorage.removeItem('nalamHdeskBranch');
    localStorage.removeItem('nalamStaffId');
    sessionStorage.removeItem('nalamStaffId');
    sessionStorage.removeItem('nalamToken');
    localStorage.removeItem('nalamToken');
    localStorage.removeItem('nalamPatientName');
    sessionStorage.removeItem('nalamPatientName');
    setRole(null);
    setDrawerOpen(false);
    router.push('/');
  };

  const nav = (path: string) => {
    setDrawerOpen(false);
    router.push(path);
  };

  if (pathname === '/') return null;

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + '/');

  // ── Bottom nav items by role ──────────────────────────────────────────
  const patientBottomItems = [
    { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/dashboard' },
    { icon: Calendar, label: t('nav.appts'), path: '/appointments/book' },
    { icon: MessageSquare, label: t('nav.chat'), path: '/dashboard/chat' },
    { icon: Brain, label: t('nav.ai'), path: '/xai' },
  ];

  const clinicianBottomItems = [
    { icon: Stethoscope, label: t('nav.portal'), path: '/clinician' },
    { icon: Brain, label: t('nav.ai'), path: '/xai' },
  ];

  const hdeskBottomItems = [
    { icon: Building2, label: t('nav.desk'), path: '/hospital-desk' },
  ];

  const familyBottomItems = [
    { icon: Heart, label: t('family.myFamily'), path: '/family' },
  ];

  const bottomItems =
    role === 'patient' ? patientBottomItems :
    role === 'clinician' ? clinicianBottomItems :
    role === 'family' ? familyBottomItems :
    hdeskBottomItems;

  return (
    <>
      {/* ── Top Bar ── */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 1rem',
        height: 'var(--nav-height)',
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-sm)',
        position: 'sticky', top: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}>
        {/* Brand */}
        <a
          href={role === 'clinician' ? '/clinician' : role === 'hdesk' ? '/hospital-desk' : role === 'family' ? '/family' : '/dashboard'}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', flexShrink: 0 }}
        >
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg,#0052A5,#0097A7)',
            borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,82,165,0.3)',
          }}>
            <Heart size={16} color="white" />
          </div>
          <div>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.3px' }}>nalam</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-orange)', letterSpacing: '-0.3px' }}>.ai</span>
          </div>
        </a>

        {/* Unified Right Actions (Theme + Menu) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={toggleTheme}
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 50, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--foreground-muted)', flexShrink: 0 }}
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground)', padding: '0.3rem', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36 }}
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* ── Drawer Overlay ── */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
      )}

      {/* ── Drawer Panel ── */}
      {drawerOpen && (
        <div className="drawer-panel">
          <div className="drawer-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#0052A5,#0097A7)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Heart size={18} color="white" />
              </div>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>nalam<span style={{ color: 'var(--accent-orange)' }}>.ai</span></div>
                <div style={{ fontSize: '0.72rem', color: 'var(--charcoal)', fontWeight: 600, textTransform: 'capitalize', marginTop: 2 }}>
                  {role === 'patient' ? '🧑 Patient' : role === 'clinician' ? '👨‍⚕️ Clinician' : role === 'family' ? '👨‍👩‍👧 Family' : '🏥 Hospital Desk'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              style={{ background: 'var(--surface-muted)', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} />
            </button>
          </div>

          <div className="drawer-body">
            {/* Navigation Section */}
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.4rem 0.5rem', marginBottom: '0.2rem' }}>
              {t('nav.navigation')}
            </div>

            {role === 'patient' && (
              <>
                <button className={`drawer-item${isActive('/dashboard') && pathname === '/dashboard' ? ' active' : ''}`} onClick={() => nav('/dashboard')}>
                  <LayoutDashboard size={18} /> {t('nav.dashboard')}
                </button>
                <button className="drawer-item" onClick={() => nav('/appointments/book')}>
                  <Calendar size={18} /> {t('nav.bookAppointment')}
                </button>
                <button className="drawer-item" onClick={() => nav('/appointments/requests')}>
                  <Shield size={18} /> {t('nav.myRequests')}
                </button>
                <button className="drawer-item" onClick={() => nav('/dashboard/chat')}>
                  <MessageSquare size={18} /> {t('nav.chatWithDoctor')}
                </button>
                <button className={`drawer-item${isActive('/xai') ? ' active' : ''}`} onClick={() => nav('/xai')}>
                  <Brain size={18} /> {t('nav.aiInsights')}
                </button>
                <button className={`drawer-item${isActive('/dashboard/consent') ? ' active' : ''}`} onClick={() => nav('/dashboard/consent')}>
                  <Shield size={18} /> {t('dashboard.smartConsent')}
                </button>
                <button className={`drawer-item${isActive('/dashboard/ehr') ? ' active' : ''}`} onClick={() => nav('/dashboard/ehr')}>
                  <Network size={18} /> {t('dashboard.connectedEHR')}
                </button>
                <button className="drawer-item" onClick={() => nav('/search')}>
                  <Search size={18} /> {t('nav.searchRecords')}
                </button>
                <button className={`drawer-item${pathname === '/dashboard/records' ? ' active' : ''}`} onClick={() => nav('/dashboard/records')}>
                  <FolderOpen size={18} /> {t('nav.myRecords')}
                </button>
                <button className="drawer-item" onClick={() => { setDrawerOpen(false); if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('openPastNotifications')); }}>
                  <Bell size={18} /> {t('nav.pastNotifications')}
                </button>
                <button className={`drawer-item${isActive('/dashboard/family') ? ' active' : ''}`} onClick={() => nav('/dashboard/family')}>
                  <Users size={18} /> Family Members
                </button>
                <button className={`drawer-item${isActive('/dashboard/profile') ? ' active' : ''}`} onClick={() => nav('/dashboard/profile')}>
                  <UserCog size={18} /> {t('nav.editProfile')}
                </button>
              </>
            )}

            {role === 'clinician' && (
              <>
                <button className={`drawer-item${isActive('/clinician') ? ' active' : ''}`} onClick={() => nav('/clinician')}>
                  <Stethoscope size={18} /> {t('nav.clinicianPortal')}
                </button>
                <button className="drawer-item" onClick={() => nav('/xai')}>
                  <Brain size={18} /> {t('nav.xaiDashboard')}
                </button>

              </>
            )}

            {role === 'hdesk' && (
              <>
                <button className={`drawer-item${isActive('/hospital-desk') ? ' active' : ''}`} onClick={() => nav('/hospital-desk')}>
                  <Building2 size={18} /> {t('nav.hospitalDesk')}
                </button>
                <button className={`drawer-item${isActive('/hospital-desk/calendar') ? ' active' : ''}`} onClick={() => nav('/hospital-desk/calendar')}>
                  <CalendarDays size={18} /> {t('nav.doctorsCalendar')}
                </button>
                <button className={`drawer-item${isActive('/hospital-desk/patients/new') ? ' active' : ''}`} onClick={() => nav('/hospital-desk/patients/new')}>
                  <UserPlus size={18} /> {t('nav.addPatient')}
                </button>
                <button className={`drawer-item${isActive('/hospital-desk/doctors/new') ? ' active' : ''}`} onClick={() => nav('/hospital-desk/doctors/new')}>
                  <ClipboardPlus size={18} /> {t('nav.addDoctor')}
                </button>
                <button className="drawer-item" onClick={() => nav('/search')}>
                  <Search size={18} /> {t('nav.searchRecords')}
                </button>
                <button className="drawer-item" onClick={() => { setDrawerOpen(false); if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('openPastNotifications')); }}>
                  <Bell size={18} /> {t('nav.pastNotifications')}
                </button>
              </>
            )}

            {role === 'family' && (
              <>
                <button className={`drawer-item${isActive('/family') ? ' active' : ''}`} onClick={() => nav('/family')}>
                  <Heart size={18} /> {t('family.myFamily')}
                </button>
                <button className={`drawer-item${isActive('/family/profile') ? ' active' : ''}`} onClick={() => nav('/family/profile')}>
                  <UserCog size={18} /> {t('nav.editProfile')}
                </button>
              </>
            )}

            <div className="drawer-divider" />

            {/* Settings Section */}
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.4rem 0.5rem', marginBottom: '0.2rem' }}>
              {t('nav.settings')}
            </div>

            <button
              className="drawer-item"
              onClick={() => { setLang(lang === 'en' ? 'ta' : 'en'); localStorage.setItem('nalamLangChosen', 'true'); }}
            >
              <Globe size={18} />
              {t('nav.switchLanguage')}
            </button>

            <button className="drawer-item" onClick={toggleTheme}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
              {dark ? t('nav.switchToLight') : t('nav.switchToDark')}
            </button>
          </div>

          <div className="drawer-footer">
            <button className="drawer-item danger" onClick={logout} style={{ color: 'var(--accent-red)', width: '100%', border: '1.5px solid var(--border)', borderRadius: 12 }}>
              <LogOut size={18} /> {t('nav.signOut')}
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile Bottom Nav ── */}
      {role && (
        <nav className="mobile-bottom-nav">
          {bottomItems.map(({ icon: Icon, label, path }) => (
            <button
              key={path}
              className={`bottom-nav-item${isActive(path) ? ' active' : ''}`}
              onClick={() => router.push(path)}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
          {/* More button → opens drawer */}
          <button
            className="bottom-nav-item"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={20} />
            {lang === 'en' ? 'More' : 'மேலும்'}
          </button>
        </nav>
      )}
    </>
  );
}
