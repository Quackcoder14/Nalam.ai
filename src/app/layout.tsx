import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import ClientNav from './components/ClientNav';
import { LanguageProvider } from '@/lib/i18n';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://nalam-ai.onrender.com'),
  title: 'nalam.ai — Your Longitudinal Health Memory',
  description: 'An AI-powered, privacy-preserving patient memory layer that follows you across every provider.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'nalam.ai',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    title: 'nalam.ai',
    description: 'Your AI-powered health memory',
    images: ['/icon-512.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0052A5',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        {/* Prevent FOUC: apply theme before React paints */}
        <Script
          id="theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var t = localStorage.getItem('nalamTheme') || 'light';
                  document.documentElement.setAttribute('data-theme', t);
                } catch(e){}
              })();
            `,
          }}
        />
      </head>
      <body className={jakarta.className} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <LanguageProvider>
          <ClientNav />
          <main>{children}</main>
        </LanguageProvider>
        {/* Service Worker registration */}
        <Script
          id="sw-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(){});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
