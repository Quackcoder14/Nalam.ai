import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import ClientNav from './components/ClientNav';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: 'nalam.ai — Your Longitudinal Health Memory',
  description: 'An AI-powered, privacy-preserving patient memory layer that follows you across every provider.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={jakarta.className} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <ClientNav />
        <main>{children}</main>
      </body>
    </html>
  );
}
