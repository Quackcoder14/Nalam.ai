'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Heart, LogOut, LayoutDashboard, Rss, Stethoscope } from 'lucide-react';

export default function ClientNav() {
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setRole(typeof window !== 'undefined' ? localStorage.getItem('nalamRole') : null);
  }, [pathname]);

  // Don't show nav on splash/login page
  if (pathname === '/') return null;

  const logout = () => {
    localStorage.removeItem('nalamRole');
    localStorage.removeItem('nalamPatientId');
    router.push('/');
  };

  return (
    <header style={{
      borderBottom: '1px solid var(--border)',
      padding: '0.75rem 2rem',
      background: 'var(--surface)',
      boxShadow: '0 1px 6px rgba(26,43,74,0.07)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Brand */}
        <a href={role === 'clinician' ? '/clinician' : '/dashboard'} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#0052A5,#0097A7)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,82,165,0.3)' }}>
            <Heart size={18} color="white" />
          </div>
          <div>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.3px' }}>nalam</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-orange)', letterSpacing: '-0.3px' }}>.ai</span>
          </div>
        </a>

        {/* Nav links */}
        <nav style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {role === 'patient' && (
            <>
              <a href="/dashboard" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <LayoutDashboard size={15} /> Dashboard
              </a>
              <a href="/feed" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Rss size={15} /> Feed Input
              </a>
            </>
          )}
          {role === 'clinician' && (
            <a href="/clinician" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Stethoscope size={15} /> Clinician Portal
            </a>
          )}
          <button onClick={logout} className="glass-button" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
            <LogOut size={15} /> Sign Out
          </button>
        </nav>
      </div>
    </header>
  );
}
