'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Rook redirects to: /rook-callback/client_uuid/<uuid>/user_id/<patientId>
// after the user grants device permissions.
// This page simply marks the connection as done in localStorage and redirects home.
export default function RookCallback() {
  const router = useRouter();

  useEffect(() => {
    try {
      // Mark the Rook connection as successful in localStorage
      localStorage.setItem('rookConnected', 'true');
      const connectedAt = new Date().toISOString();
      localStorage.setItem('rookConnectedAt', connectedAt);
    } catch {}

    // Redirect back to the patient dashboard after a short delay
    const t = setTimeout(() => {
      router.replace('/dashboard?rook=connected');
    }, 1500);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
      gap: '1.5rem',
    }}>
      <div style={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
        boxShadow: '0 8px 32px rgba(34,197,94,0.35)',
        animation: 'pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        ✓
      </div>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          Device Connected!
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.5rem', fontSize: '0.95rem' }}>
          Your wearable is now linked to Nalam AI.<br />
          Redirecting you back to the dashboard…
        </p>
      </div>
      <div style={{
        display: 'flex',
        gap: '0.4rem',
        alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#22c55e',
            animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes pop {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%           { transform: translateY(-10px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
