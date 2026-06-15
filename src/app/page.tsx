'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, User, Stethoscope, ChevronRight, Monitor, Globe } from 'lucide-react';
import { useLanguage, type Lang } from '@/lib/i18n';

type Phase = 'splash' | 'language' | 'login';
type LoginType = 'patient' | 'clinician' | 'hdesk' | null;

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>('splash');
  const [splashFading, setSplashFading] = useState(false);
  const [loginType, setLoginType] = useState<LoginType>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [langFading, setLangFading] = useState(false);
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();

  useEffect(() => {
    const splashShown = sessionStorage.getItem('splashShown');
    const alreadyChoseLang = localStorage.getItem('nalamLangChosen');

    if (splashShown) {
      setPhase(alreadyChoseLang ? 'login' : 'language');
      return;
    }

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

  const handleLogin = (role: 'patient' | 'clinician' | 'hdesk') => {
    if (password !== '123') {
      alert(t('login.invalidCreds'));
      return;
    }
    if (role === 'patient' && username.toLowerCase() !== 'karthik@nalam.ai') {
      alert(t('login.invalidPatient'));
      return;
    }
    if (role === 'clinician' && username.toLowerCase() !== 'dhanush@nalam.ai' && username.toLowerCase() !== 'monissha@nalam.ai') {
      alert(t('login.invalidClinician'));
      return;
    }
    if (role === 'hdesk' && username.toLowerCase() !== 'hdesk@nalam.ai') {
      alert(t('login.invalidHdesk'));
      return;
    }
    localStorage.setItem('nalamRole', role);
    localStorage.setItem('nalamPatientId', 'P001');
    if (role === 'patient') router.push('/dashboard');
    else if (role === 'clinician') router.push('/clinician');
    else router.push('/hospital-desk');
  };

  /* ── SPLASH ── */
  if (phase === 'splash') return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(145deg, #001d5c 0%, #0052A5 55%, #0097A7 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem',
      opacity: splashFading ? 0 : 1, transition: 'opacity 0.6s ease', zIndex: 9999,
    }}>
      <div className="splash-logo">
        <Heart size={52} color="white" className="splash-heart" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3.5rem', fontWeight: 800, color: 'white', letterSpacing: '-1px', lineHeight: 1 }}>
          nalam<span style={{ color: '#F4831F' }}>.ai</span>
        </div>
        <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.65)', marginTop: '0.6rem', letterSpacing: '0.03em' }}>
          {t('splash.tagline')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: '0.5rem' }}>
        {[0, 1, 2].map(i => (
          <div key={i} className={`dot-bounce dot-bounce-${i}`} />
        ))}
      </div>
    </div>
  );

  /* ── LANGUAGE SELECTION ── */
  if (phase === 'language') return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(150deg, #001d5c 0%, #0052A5 55%, #0097A7 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
      opacity: langFading ? 0 : 1,
      transition: 'opacity 0.4s ease',
    }}>
      <div style={{ width: '100%', maxWidth: 560, textAlign: 'center', animation: 'slideUp 0.5s ease' }}>
        {/* Logo */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
          <div style={{
            width: 54, height: 54,
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 24px rgba(0,0,0,0.2)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}>
            <Heart size={28} color="white" />
          </div>
          <span style={{ fontSize: '2.2rem', fontWeight: 800, color: 'white' }}>nalam</span>
          <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#F4831F', marginLeft: -10 }}>.ai</span>
        </div>

        {/* Globe Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)' }}>
            <Globe size={30} color="white" />
          </div>
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'white', marginBottom: '0.5rem' }}>
          {t('lang.choose')}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', marginBottom: '2.5rem' }}>
          {t('lang.subtitle')}
        </p>

        {/* Language cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1rem' }}>
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
                borderRadius: 20,
                padding: '2rem 1.5rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.25s ease',
                backdropFilter: 'blur(12px)',
                boxShadow: lang === code ? '0 8px 32px rgba(0,0,0,0.25)' : '0 4px 16px rgba(0,0,0,0.15)',
              }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
              onMouseOut={e => { e.currentTarget.style.background = lang === code ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: lang === code ? 'white' : 'rgba(255,255,255,0.8)', marginBottom: '0.75rem', letterSpacing: '-1px' }}>{flag}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'white', marginBottom: '0.25rem' }}>{subLabel}</div>
              <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── LOGIN ── */
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(150deg, #EBF4FF 0%, #F0FBFF 60%, #FFF8F2 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', animation: 'fadeIn 0.7s ease',
    }}>
      <div style={{ width: '100%', maxWidth: 860 }}>
        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: '2.75rem', animation: 'slideUp 0.5s ease' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{
              width: 54, height: 54,
              background: 'linear-gradient(135deg, #0052A5, #0097A7)',
              borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 24px rgba(0,82,165,0.28)',
            }}>
              <Heart size={28} color="white" />
            </div>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#0052A5' }}>nalam</span>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#F4831F', marginLeft: -10 }}>.ai</span>
          </div>
          {/* Language switch button */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <button
              onClick={() => { setLangFading(false); setPhase('language'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: '1.5px solid #cbd5e0', borderRadius: 20, padding: '0.3rem 0.9rem', cursor: 'pointer', fontSize: '0.82rem', color: '#4A5568', fontFamily: 'inherit', transition: 'all 0.2s' }}
              onMouseOver={e => e.currentTarget.style.borderColor = '#0052A5'}
              onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e0'}
            >
              <Globe size={14} /> {lang === 'ta' ? 'தமிழ்' : 'English'} ↻
            </button>
          </div>
          <h1 style={{ fontSize: '1.6rem', color: '#1A2B4A', fontWeight: 700, marginBottom: '0.4rem' }}>{t('login.welcome')}</h1>
          <p style={{ color: '#4A5568', fontSize: '0.97rem' }}>{t('login.selectRole')}</p>
        </div>

        {!loginType ? (
          /* ── Role picker ── */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', animation: 'slideUp 0.6s ease' }}>
            {[
              { role: 'patient' as const, Icon: User, title: t('role.patient.title'), desc: t('role.patient.desc'), accentColor: '#0052A5', bg: 'linear-gradient(135deg,#EBF4FF,#BFDBFE)' },
              { role: 'clinician' as const, Icon: Stethoscope, title: t('role.clinician.title'), desc: t('role.clinician.desc'), accentColor: '#0097A7', bg: 'linear-gradient(135deg,#E0F7FA,#B2EBF2)' },
              { role: 'hdesk' as const, Icon: Monitor, title: t('role.hdesk.title'), desc: t('role.hdesk.desc'), accentColor: '#5C35A1', bg: 'linear-gradient(135deg,#F3E8FF,#D8B4FE)' },
            ].map(({ role, Icon, title, desc, accentColor, bg }) => (
              <button key={role} onClick={() => setLoginType(role)}
                className="login-card"
                style={{ background: 'white', border: '2px solid #e2e8f0', borderRadius: 22, padding: '2.5rem 2rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.25s ease', boxShadow: '0 4px 20px rgba(0,82,165,0.06)', display: 'block', width: '100%' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 14px 40px ${accentColor}22`; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,82,165,0.06)'; }}
              >
                <div style={{ width: 56, height: 56, background: bg, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  <Icon size={28} color={accentColor} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1A2B4A', marginBottom: '0.5rem' }}>{title}</h3>
                <p style={{ color: '#4A5568', fontSize: '0.875rem', lineHeight: 1.65 }}>{desc}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '1.25rem', color: accentColor, fontWeight: 600, fontSize: '0.88rem' }}>
                  {t('role.continue')} <ChevronRight size={15} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* ── Credentials form ── */
          <div style={{ maxWidth: 430, margin: '0 auto', background: 'white', borderRadius: 22, padding: '2.5rem', boxShadow: '0 8px 40px rgba(0,82,165,0.1)', animation: 'slideUp 0.4s ease' }}>
            <button onClick={() => setLoginType(null)} style={{ background: 'none', border: 'none', color: '#4A5568', cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', padding: 0, fontFamily: 'inherit' }}>
              {t('login.back')}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
              <div style={{ width: 44, height: 44, background: loginType === 'patient' ? 'linear-gradient(135deg,#EBF4FF,#BFDBFE)' : loginType === 'clinician' ? 'linear-gradient(135deg,#E0F7FA,#B2EBF2)' : 'linear-gradient(135deg,#F3E8FF,#D8B4FE)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {loginType === 'patient' ? <User size={22} color="#0052A5" /> : loginType === 'clinician' ? <Stethoscope size={22} color="#0097A7" /> : <Monitor size={22} color="#5C35A1" />}
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1A2B4A' }}>
                {loginType === 'patient' ? t('role.patient.loginTitle') : loginType === 'clinician' ? t('role.clinician.loginTitle') : t('role.hdesk.loginTitle')}
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[t('login.username'), t('login.password')].map((label, idx) => (
                <div key={idx}>
                  <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.4rem' }}>{label}</label>
                  <input
                    type={idx === 1 ? 'password' : 'text'}
                    value={idx === 0 ? username : password}
                    onChange={e => idx === 0 ? setUsername(e.target.value) : setPassword(e.target.value)}
                    placeholder={idx === 1 ? '••••••••' : loginType === 'patient' ? 'karthik@nalam.ai' : loginType === 'clinician' ? 'dhanush@nalam.ai / monissha@nalam.ai' : 'hdesk@nalam.ai'}
                    onKeyDown={e => e.key === 'Enter' && handleLogin(loginType!)}
                    style={{ width: '100%', padding: '0.8rem 1rem', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#1A2B4A', transition: 'border-color 0.2s', background: '#FAFBFD' }}
                    onFocus={e => e.target.style.borderColor = loginType === 'patient' ? '#0052A5' : loginType === 'clinician' ? '#0097A7' : '#5C35A1'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>
              ))}
              <button
                onClick={() => handleLogin(loginType!)}
                style={{ width: '100%', padding: '0.9rem', marginTop: '0.5rem', background: loginType === 'patient' ? 'linear-gradient(135deg,#0052A5,#0073D9)' : loginType === 'clinician' ? 'linear-gradient(135deg,#0097A7,#00BCD4)' : 'linear-gradient(135deg,#5C35A1,#8B5CF6)', color: 'white', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.2s', fontFamily: 'inherit' }}
                onMouseOver={e => e.currentTarget.style.opacity = '0.88'}
                onMouseOut={e => e.currentTarget.style.opacity = '1'}
              >
                {t('login.signIn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
