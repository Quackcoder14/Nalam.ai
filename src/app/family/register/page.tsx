'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, User, Mail, Phone, Lock, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

export default function FamilyRegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const { t } = useLanguage();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('family.passwordMismatch') || 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError(t('family.passwordTooShort') || 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/family/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, mobile, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      // Success - save session data
      sessionStorage.setItem('nalamRole', 'family');
      localStorage.setItem('nalamRole', 'family');
      sessionStorage.setItem('nalamStaffId', data.staffId);
      localStorage.setItem('nalamStaffId', data.staffId);
      if (data.familyName) {
        sessionStorage.setItem('nalamPatientName', data.familyName);
        localStorage.setItem('nalamPatientName', data.familyName);
      }
      if (data.token) {
        sessionStorage.setItem('nalamToken', data.token);
        localStorage.setItem('nalamToken', data.token);
      }

      router.push('/family');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--background)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: 440, animation: 'slideUp 0.5s ease' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
            <div style={{ width: 42, height: 42, background: 'linear-gradient(135deg, #0052A5, #0097A7)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(0,82,165,0.25)' }}>
              <Heart size={20} color="white" />
            </div>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)' }}>nalam<span style={{ color: 'var(--accent-orange)' }}>.ai</span></span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '0.4rem' }}>
            {t('family.registerTitle') || 'Create Family Account'}
          </h1>
          <p style={{ color: 'var(--charcoal)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
            <ShieldCheck size={16} color="var(--accent-green)" />
            {t('family.registerDesc') || 'Securely manage your family\'s health'}
          </p>
        </div>

        {/* Form */}
        <div style={{ background: 'var(--surface)', borderRadius: 24, padding: '2rem', boxShadow: '0 8px 32px rgba(0,0,0,0.06)', border: '1px solid var(--border)' }}>
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--charcoal)', marginBottom: '0.4rem' }}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="var(--foreground-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text" required value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Karthik Raj"
                  style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', border: '2px solid var(--border)', borderRadius: 12, fontSize: '0.95rem', background: 'var(--surface-muted)', color: 'var(--foreground)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--charcoal)', marginBottom: '0.4rem' }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="var(--foreground-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. karthik@example.com"
                  style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', border: '2px solid var(--border)', borderRadius: 12, fontSize: '0.95rem', background: 'var(--surface-muted)', color: 'var(--foreground)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--charcoal)', marginBottom: '0.4rem' }}>Mobile Number (optional)</label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} color="var(--foreground-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="tel" value={mobile} onChange={e => setMobile(e.target.value)}
                  placeholder="+91 98765 43210"
                  style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', border: '2px solid var(--border)', borderRadius: 12, fontSize: '0.95rem', background: 'var(--surface-muted)', color: 'var(--foreground)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--charcoal)', marginBottom: '0.4rem' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="var(--foreground-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', border: '2px solid var(--border)', borderRadius: 12, fontSize: '0.95rem', background: 'var(--surface-muted)', color: 'var(--foreground)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--charcoal)', marginBottom: '0.4rem' }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="var(--foreground-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', border: '2px solid var(--border)', borderRadius: 12, fontSize: '0.95rem', background: 'var(--surface-muted)', color: 'var(--foreground)' }}
                />
              </div>
            </div>

            {error && (
              <div style={{ padding: '0.8rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#B91C1C', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '1rem', marginTop: '0.5rem',
                background: 'linear-gradient(135deg, #0052A5, #0073D9)',
                color: 'white', border: 'none', borderRadius: 12,
                fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
              }}
            >
              {loading ? (
                <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <>{t('family.createAccount') || 'Create Account'} <ArrowRight size={18} /></>
              )}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button
            onClick={() => router.push('/')}
            style={{ background: 'none', border: 'none', color: 'var(--charcoal)', cursor: 'pointer', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <ArrowLeft size={16} /> Back to login
          </button>
        </div>

      </div>
    </div>
  );
}
