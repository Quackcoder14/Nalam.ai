'use client';
import { useState } from 'react';
import { X, ShieldCheck, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

type Phase = 'idle' | 'sending' | 'enter_otp' | 'verifying' | 'error';

export function ContextOtpModal({
  patientId,
  requestorName,
  onClose,
  onSuccess,
}: {
  patientId: string;
  requestorName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [otp, setOtp] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const sendOtp = async () => {
    setPhase('sending');
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/patient/records-otp', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate', patientId, requestorName }),
      });
      if (res.ok) {
        setPhase('enter_otp');
      } else {
        const d = await res.json();
        setErrorMsg(d.error || 'Failed to send OTP');
        setPhase('error');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setPhase('error');
    }
  };

  const verifyOtp = async () => {
    if (otp.replace(/\s/g, '').length !== 6) return;
    setPhase('verifying');
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/patient/records-otp', {
        method: 'POST',
        body: JSON.stringify({ action: 'verify', patientId, otp }),
      });
      const d = await res.json();
      if (d.valid) {
        onSuccess();
      } else {
        setErrorMsg(d.error || 'Invalid or expired OTP');
        setPhase('enter_otp');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setPhase('enter_otp');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(6px)' }}>
      <div className="glass-panel slide-up" style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden', background: 'var(--surface)' }}>
        
        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#EBF4FF,#BFDBFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={22} color="#0052A5" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--deep-blue)', fontSize: '0.95rem' }}>
              Verify Context Access
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--charcoal)', marginTop: 2 }}>
              Patient: {patientId}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--charcoal)' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {/* Phase: idle */}
          {phase === 'idle' && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔐</div>
              <h3 style={{ color: 'var(--deep-blue)', marginBottom: 8 }}>Consent Required</h3>
              <p style={{ color: 'var(--charcoal)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Clicking below will send a <strong>6-digit OTP</strong> to the patient's dashboard. Ask the patient for the code to gain context access.
              </p>
              <button
                onClick={sendOtp}
                style={{ width: '100%', padding: '0.85rem', background: 'linear-gradient(135deg,#0052A5,#0073D9)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <ShieldCheck size={18} /> Send OTP to Patient
              </button>
            </div>
          )}

          {/* Phase: sending */}
          {phase === 'sending' && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <Loader2 size={40} color="var(--primary)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--charcoal)' }}>Sending OTP to patient's device…</p>
            </div>
          )}

          {/* Phase: enter OTP */}
          {phase === 'enter_otp' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📲</div>
                <h3 style={{ color: 'var(--deep-blue)', marginBottom: 6 }}>OTP Sent!</h3>
                <p style={{ color: 'var(--charcoal)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                  The OTP has appeared on the patient's dashboard.
                </p>
              </div>
              {errorMsg && (
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: 8, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {errorMsg}
                </div>
              )}
              <input
                type="text"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/[^0-9\s]/g, '').slice(0, 7))}
                onKeyDown={e => e.key === 'Enter' && verifyOtp()}
                maxLength={7}
                style={{ width: '100%', padding: '0.85rem', borderRadius: 10, border: '2px solid var(--border)', background: 'var(--surface-muted)', color: 'var(--foreground)', fontFamily: 'inherit', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.2em', textAlign: 'center', outline: 'none', boxSizing: 'border-box', marginBottom: '0.75rem' }}
              />
              <button
                onClick={verifyOtp}
                disabled={otp.replace(/\s/g, '').length !== 6}
                style={{ width: '100%', padding: '0.85rem', background: otp.replace(/\s/g, '').length === 6 ? 'linear-gradient(135deg,#0052A5,#0073D9)' : 'var(--surface-muted)', color: otp.replace(/\s/g, '').length === 6 ? 'white' : 'var(--charcoal)', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '0.95rem', cursor: otp.replace(/\s/g, '').length === 6 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', marginBottom: '0.6rem' }}
              >
                Verify & Access Context
              </button>
              <button onClick={sendOtp} style={{ width: '100%', padding: '0.6rem', background: 'none', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 600, fontSize: '0.82rem', color: 'var(--charcoal)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Resend OTP
              </button>
            </div>
          )}

          {/* Phase: verifying */}
          {phase === 'verifying' && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <Loader2 size={40} color="var(--primary)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--charcoal)' }}>Verifying OTP…</p>
            </div>
          )}

          {/* Phase: error */}
          {phase === 'error' && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
              <p style={{ color: '#DC2626', marginBottom: '1.25rem' }}>{errorMsg}</p>
              <button onClick={() => setPhase('idle')} style={{ padding: '0.75rem 1.5rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
