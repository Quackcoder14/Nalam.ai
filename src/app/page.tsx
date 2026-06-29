'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, User, Stethoscope, ChevronRight, Monitor, Globe, ArrowLeft } from 'lucide-react';
import { useLanguage, type Lang } from '@/lib/i18n';

type Phase = 'splash' | 'language' | 'login';
type LoginType = 'patient' | 'clinician' | 'hdesk' | null;

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>('splash');
  const [splashFading, setSplashFading] = useState(false);
  const [loginType, setLoginType] = useState<LoginType>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [hdeskStaffId, setHdeskStaffId] = useState('');
  const [langFading, setLangFading] = useState(false);
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();

  useEffect(() => {
    const splashShown = sessionStorage.getItem('splashShown');
    const alreadyChoseLang = localStorage.getItem('nalamLangChosen');
    if (splashShown) { setPhase(alreadyChoseLang ? 'login' : 'language'); return; }
    const t1 = setTimeout(() => setSplashFading(true), 2200);
    const t2 = setTimeout(() => {
      sessionStorage.setItem('splashShown', 'true');
      setPhase(alreadyChoseLang ? 'login' : 'language');
    }, 2750);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const chooseLang = (l: Lang) => {
    setLang(l);
    localStorage.setItem('nalamLangChosen', 'true');
    setLangFading(true);
    setTimeout(() => setPhase('login'), 450);
  };

  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async (role: 'patient' | 'clinician' | 'hdesk') => {
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password, hdeskStaffId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || t('login.invalidCreds'));
        return;
      }
      // Validate the returned role matches the button clicked
      if (data.role !== role) {
        setLoginError(t('login.invalidCreds'));
        return;
      }
      // Storage for UI cache: use sessionStorage for tab isolation, localStorage as fallback
      sessionStorage.setItem('nalamRole', data.role);
      localStorage.setItem('nalamRole', data.role);
      if (data.role === 'patient') {
        sessionStorage.setItem('nalamPatientId', data.staffId);
        localStorage.setItem('nalamPatientId', data.staffId);
        if (data.patientName) {
          sessionStorage.setItem('nalamPatientName', data.patientName);
          localStorage.setItem('nalamPatientName', data.patientName);
        }
      }
      if (data.clinicianRole) {
        sessionStorage.setItem('nalamClinicianRole', data.clinicianRole);
        localStorage.setItem('nalamClinicianRole', data.clinicianRole);
      }
      if (data.branch) {
        sessionStorage.setItem('nalamHdeskBranch', data.branch);
        localStorage.setItem('nalamHdeskBranch', data.branch);
      }
      if (data.staffId && data.role !== 'patient') {
        sessionStorage.setItem('nalamStaffId', data.staffId);
        localStorage.setItem('nalamStaffId', data.staffId);
      }
      // Store token in sessionStorage as a Bearer fallback for API calls
      if (data.token) {
        sessionStorage.setItem('nalamToken', data.token);
        localStorage.setItem('nalamToken', data.token);
      }

      if (data.role === 'patient') router.push('/dashboard');
      else if (data.role === 'clinician') router.push('/clinician');
      else router.push('/hospital-desk');
    } catch {
      setLoginError('Network error — please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  /* ── SPLASH ── */
  if (phase === 'splash') return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(145deg, #001d5c 0%, #0052A5 55%, #0097A7 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.25rem',
      opacity: splashFading ? 0 : 1, transition: 'opacity 0.6s ease', zIndex: 9999,
    }}>
      <div className="splash-logo">
        <Heart size={46} color="white" className="splash-heart" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', fontWeight: 800, color: 'white', letterSpacing: '-1px', lineHeight: 1 }}>
          nalam<span style={{ color: '#F4831F' }}>.ai</span>
        </div>
        <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.65)', marginTop: '0.5rem', letterSpacing: '0.03em' }}>
          {t('splash.tagline')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} className={`dot-bounce dot-bounce-${i}`} />
        ))}
      </div>
    </div>
  );

  /* ── LANGUAGE SELECTION ── */
  if (phase === 'language') return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(150deg, #001d5c 0%, #0052A5 55%, #0097A7 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: langFading ? 0 : 1, transition: 'opacity 0.4s ease',
      padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center', animation: 'slideUp 0.5s ease' }}>
        {/* Logo */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem', marginBottom: '2rem' }}>
          <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.15)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Heart size={24} color="white" />
          </div>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'white' }}>nalam</span>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: '#F4831F', marginLeft: -10 }}>.ai</span>
        </div>

        {/* Globe Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)' }}>
            <Globe size={26} color="white" />
          </div>
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', marginBottom: '0.4rem' }}>
          {t('lang.choose')}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.88rem', marginBottom: '2rem' }}>
          {t('lang.subtitle')}
        </p>

        {/* Language cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {[
            { code: 'en' as Lang, label: t('lang.english'), subLabel: 'English', flag: 'EN' },
            { code: 'ta' as Lang, label: t('lang.tamil'), subLabel: 'தமிழ்', flag: 'TA' },
          ].map(({ code, label, subLabel, flag }) => (
            <button
              key={code}
              onClick={() => chooseLang(code)}
              style={{
                background: lang === code ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)',
                border: lang === code ? '2.5px solid white' : '2px solid rgba(255,255,255,0.25)',
                borderRadius: 18,
                padding: '1.5rem 1rem',
                cursor: 'pointer', textAlign: 'center',
                transition: 'all 0.25s ease',
                backdropFilter: 'blur(12px)',
                boxShadow: lang === code ? '0 8px 32px rgba(0,0,0,0.25)' : '0 4px 16px rgba(0,0,0,0.15)',
              }}
            >
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'white', marginBottom: '0.5rem' }}>{flag}</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'white', marginBottom: '0.2rem' }}>{subLabel}</div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── LOGIN ── */
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--background)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      animation: 'fadeIn 0.7s ease',
      padding: '1.25rem 1rem',
      paddingTop: 'max(1.25rem, env(safe-area-inset-top))',
      paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
    }}>
      <style>{`
        .home-wrapper { width: 100%; max-width: 520px; transition: max-width 0.3s; }
        .home-title { font-size: 1.4rem; transition: font-size 0.3s; }
        .home-subtitle { font-size: 0.88rem; transition: font-size 0.3s; }
        .role-btn { padding: 1.1rem 1.25rem; transition: all 0.25s ease; }
        .role-title { font-size: 1rem; transition: font-size 0.3s; }
        .role-desc { font-size: 0.8rem; transition: font-size 0.3s; }
        .login-box { padding: 1.5rem; transition: padding 0.3s; }
        @media (min-width: 768px) {
          .home-wrapper { max-width: 680px; }
          .home-title { font-size: 1.8rem; }
          .home-subtitle { font-size: 1.05rem; }
          .role-btn { padding: 1.5rem; }
          .role-title { font-size: 1.25rem; }
          .role-desc { font-size: 0.95rem; }
          .login-box { padding: 2.5rem; }
        }
      `}</style>
      <div className="home-wrapper">
        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem', animation: 'slideUp 0.5s ease' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
            <div style={{ width: 46, height: 46, background: 'linear-gradient(135deg, #0052A5, #0097A7)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(0,82,165,0.28)' }}>
              <Heart size={24} color="white" />
            </div>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#0052A5' }}>nalam</span>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#F4831F', marginLeft: -10 }}>.ai</span>
          </div>

          {/* Language switch */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.6rem' }}>
            <button
              onClick={() => { setLangFading(false); setPhase('language'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: '1.5px solid #cbd5e0', borderRadius: 20, padding: '0.28rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem', color: '#4A5568', fontFamily: 'inherit' }}
            >
              <Globe size={14} /> {lang === 'ta' ? 'தமிழ்' : 'English'} ↻
            </button>
          </div>
          <h1 className="home-title" style={{ color: '#1A2B4A', fontWeight: 700, marginBottom: '0.3rem' }}>{t('login.welcome')}</h1>
          <p className="home-subtitle" style={{ color: '#4A5568' }}>{t('login.selectRole')}</p>
        </div>

        {!loginType ? (
          /* ── Role picker ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', animation: 'slideUp 0.6s ease' }}>
            {[
              { role: 'patient' as const, Icon: User, title: t('role.patient.title'), desc: t('role.patient.desc'), accentColor: '#0052A5', bg: 'linear-gradient(135deg,#EBF4FF,#BFDBFE)' },
              { role: 'clinician' as const, Icon: Stethoscope, title: t('role.clinician.title'), desc: t('role.clinician.desc'), accentColor: '#0097A7', bg: 'linear-gradient(135deg,#E0F7FA,#B2EBF2)' },
              { role: 'hdesk' as const, Icon: Monitor, title: t('role.hdesk.title'), desc: t('role.hdesk.desc'), accentColor: '#5C35A1', bg: 'linear-gradient(135deg,#F3E8FF,#D8B4FE)' },
            ].map(({ role, Icon, title, desc, accentColor, bg }) => (
              <button key={role} onClick={() => setLoginType(role)} className="role-btn"
                style={{
                  background: 'var(--surface)', border: '1.5px solid #e2e8f0', borderRadius: 18,
                  cursor: 'pointer', textAlign: 'left',
                  boxShadow: '0 2px 12px rgba(0,82,165,0.06)',
                  display: 'flex', alignItems: 'center', gap: '1rem', width: '100%',
                }}
                onTouchStart={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.background = `${accentColor}08`; }}
                onTouchEnd={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'var(--surface)'; }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 10px 32px ${accentColor}22`; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,82,165,0.06)'; }}
              >
                <div style={{ width: 56, height: 56, background: bg, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={28} color={accentColor} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 className="role-title" style={{ fontWeight: 700, color: '#1A2B4A', marginBottom: '0.2rem' }}>{title}</h3>
                  <p className="role-desc" style={{ color: '#4A5568', lineHeight: 1.45 }}>{desc}</p>
                </div>
                <ChevronRight size={20} color={accentColor} style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        ) : (
          /* ── Credentials form ── */
          <div className="login-box" style={{ background: 'var(--surface)', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,82,165,0.1)', animation: 'slideUp 0.4s ease' }}>
            <button onClick={() => setLoginType(null)} style={{ background: 'none', border: 'none', color: '#4A5568', cursor: 'pointer', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', padding: 0, fontFamily: 'inherit' }}>
              <ArrowLeft size={15} /> {t('login.back')}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.5rem' }}>
              <div style={{ width: 40, height: 40, background: loginType === 'patient' ? 'linear-gradient(135deg,#EBF4FF,#BFDBFE)' : loginType === 'clinician' ? 'linear-gradient(135deg,#E0F7FA,#B2EBF2)' : 'linear-gradient(135deg,#F3E8FF,#D8B4FE)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {loginType === 'patient' ? <User size={20} color="#0052A5" /> : loginType === 'clinician' ? <Stethoscope size={20} color="#0097A7" /> : <Monitor size={20} color="#5C35A1" />}
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1A2B4A' }}>
                {loginType === 'patient' ? t('role.patient.loginTitle') : loginType === 'clinician' ? t('role.clinician.loginTitle') : t('role.hdesk.loginTitle')}
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {[t('login.username'), t('login.password')].map((label, idx) => (
                <div key={idx}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>{label}</label>
                  <input
                    type={idx === 1 ? 'password' : 'text'}
                    value={idx === 0 ? username : password}
                    onChange={e => idx === 0 ? setUsername(e.target.value) : setPassword(e.target.value)}
                    placeholder={idx === 1 ? '••••••••' : 'Enter username'}
                    onKeyDown={e => e.key === 'Enter' && handleLogin(loginType!)}
                    style={{ width: '100%', padding: '0.75rem 0.9rem', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: '1rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#1A2B4A', background: '#FAFBFD' }}
                    onFocus={e => e.target.style.borderColor = loginType === 'patient' ? '#0052A5' : loginType === 'clinician' ? '#0097A7' : '#5C35A1'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>
              ))}
              {loginType === 'hdesk' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>Staff ID</label>
                  <input
                    type="text"
                    value={hdeskStaffId}
                    onChange={e => setHdeskStaffId(e.target.value)}
                    placeholder="Enter your desk staff ID"
                    onKeyDown={e => e.key === 'Enter' && handleLogin(loginType!)}
                    style={{ width: '100%', padding: '0.75rem 0.9rem', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: '1rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#1A2B4A', background: '#FAFBFD' }}
                    onFocus={e => e.target.style.borderColor = '#5C35A1'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#718096', marginTop: '0.35rem', fontStyle: 'italic' }}>
                    Hint: Use HD-101 (Front Desk) or HD-102 (Manager)
                  </div>
                </div>
              )}
              {loginError && (
                <div style={{ padding: '0.6rem 0.9rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#B91C1C', fontSize: '0.82rem', fontWeight: 600 }}>
                  ⚠️ {loginError}
                </div>
              )}
              <button
                onClick={() => handleLogin(loginType!)}
                disabled={loginLoading}
                style={{ width: '100%', padding: '0.85rem', marginTop: '0.25rem', background: loginType === 'patient' ? 'linear-gradient(135deg,#0052A5,#0073D9)' : loginType === 'clinician' ? 'linear-gradient(135deg,#0097A7,#00BCD4)' : 'linear-gradient(135deg,#5C35A1,#8B5CF6)', color: 'white', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: loginLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loginLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                onMouseOver={e => { if (!loginLoading) e.currentTarget.style.opacity = '0.9'; }}
                onMouseOut={e => { if (!loginLoading) e.currentTarget.style.opacity = '1'; }}
              >
                {loginLoading ? (
                  <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> {t('login.signingIn') || 'Signing in…'}</>
                ) : t('login.signIn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
