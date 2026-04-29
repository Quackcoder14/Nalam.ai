import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: 'nalam.ai — Your Longitudinal Health Memory',
  description: 'An AI-powered, privacy-preserving patient memory layer that follows you across every provider.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={jakarta.className} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <header style={{
          borderBottom: '1px solid var(--border)',
          padding: '0.85rem 2rem',
          background: 'var(--surface)',
          boxShadow: '0 1px 6px rgba(26,43,74,0.07)',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Brand */}
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
              <div style={{
                width: 36, height: 36,
                background: 'linear-gradient(135deg, #0052A5 0%, #0097A7 100%)',
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,82,165,0.3)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="white" opacity="0"/>
                  <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" fill="white"/>
                </svg>
              </div>
              <div>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.3px' }}>nalam</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-orange)', letterSpacing: '-0.3px' }}>.ai</span>
              </div>
            </a>

            {/* Nav */}
            <nav style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <a href="/" className="nav-link">
                Patient Portal
              </a>
              <a href="/clinician" className="nav-button">
                Clinician View
              </a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
