'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, User, Stethoscope, ChevronRight } from 'lucide-react';

type Phase = 'splash' | 'login';
type LoginType = 'patient' | 'clinician' | null;

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>('splash');
  const [splashFading, setSplashFading] = useState(false);
  const [loginType, setLoginType] = useState<LoginType>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  useEffect(() => {
    const t1 = setTimeout(() => setSplashFading(true), 2200);
    const t2 = setTimeout(() => setPhase('login'), 2750);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const handleLogin = (role: 'patient' | 'clinician') => {
    localStorage.setItem('nalamRole', role);
    localStorage.setItem('nalamPatientId', 'P001');
    router.push(role === 'patient' ? '/dashboard' : '/clinician');
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
          Your Longitudinal Health Memory
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: '0.5rem' }}>
        {[0, 1, 2].map(i => (
          <div key={i} className={`dot-bounce dot-bounce-${i}`} />
        ))}
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
          <h1 style={{ fontSize: '1.6rem', color: '#1A2B4A', fontWeight: 700, marginBottom: '0.4rem' }}>Welcome Back</h1>
          <p style={{ color: '#4A5568', fontSize: '0.97rem' }}>Select your role to continue</p>
        </div>

        {!loginType ? (
          /* ── Role picker ── */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', animation: 'slideUp 0.6s ease' }}>
            {[
              { role: 'patient' as const, Icon: User, title: 'Patient Login', desc: 'View your health dashboard, longitudinal timeline, consent settings, and upload health documents.', accentColor: '#0052A5', bg: 'linear-gradient(135deg,#EBF4FF,#BFDBFE)' },
              { role: 'clinician' as const, Icon: Stethoscope, title: 'Clinician Login', desc: 'Access patient records, AI biographer synthesis, precision simulations, and contextual data retrieval.', accentColor: '#0097A7', bg: 'linear-gradient(135deg,#E0F7FA,#B2EBF2)' },
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
                  Continue <ChevronRight size={15} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* ── Credentials form ── */
          <div style={{ maxWidth: 430, margin: '0 auto', background: 'white', borderRadius: 22, padding: '2.5rem', boxShadow: '0 8px 40px rgba(0,82,165,0.1)', animation: 'slideUp 0.4s ease' }}>
            <button onClick={() => setLoginType(null)} style={{ background: 'none', border: 'none', color: '#4A5568', cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', padding: 0, fontFamily: 'inherit' }}>
              ← Back
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
              <div style={{ width: 44, height: 44, background: loginType === 'patient' ? 'linear-gradient(135deg,#EBF4FF,#BFDBFE)' : 'linear-gradient(135deg,#E0F7FA,#B2EBF2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {loginType === 'patient' ? <User size={22} color="#0052A5" /> : <Stethoscope size={22} color="#0097A7" />}
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1A2B4A' }}>
                {loginType === 'patient' ? 'Patient Login' : 'Clinician Login'}
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(['Username', 'Password'] as const).map((label) => (
                <div key={label}>
                  <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.4rem' }}>{label}</label>
                  <input
                    type={label === 'Password' ? 'password' : 'text'}
                    value={label === 'Username' ? username : password}
                    onChange={e => label === 'Username' ? setUsername(e.target.value) : setPassword(e.target.value)}
                    placeholder={label === 'Password' ? '••••••••' : loginType === 'patient' ? 'patient@nalam.ai' : 'clinician@nalam.ai'}
                    onKeyDown={e => e.key === 'Enter' && handleLogin(loginType)}
                    style={{ width: '100%', padding: '0.8rem 1rem', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#1A2B4A', transition: 'border-color 0.2s', background: '#FAFBFD' }}
                    onFocus={e => e.target.style.borderColor = loginType === 'patient' ? '#0052A5' : '#0097A7'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>
              ))}
              <button
                onClick={() => handleLogin(loginType)}
                style={{ width: '100%', padding: '0.9rem', marginTop: '0.5rem', background: loginType === 'patient' ? 'linear-gradient(135deg,#0052A5,#0073D9)' : 'linear-gradient(135deg,#0097A7,#00BCD4)', color: 'white', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.2s', fontFamily: 'inherit' }}
                onMouseOver={e => e.currentTarget.style.opacity = '0.88'}
                onMouseOut={e => e.currentTarget.style.opacity = '1'}
              >
                Sign In →
              </button>
              <p style={{ fontSize: '0.76rem', color: '#94a3b8', textAlign: 'center' }}>Demo mode — any credentials are accepted</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
