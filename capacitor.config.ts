import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.nalam.app',
  appName: 'Nalam.ai',
  webDir: 'public',
  server: {
    url: 'https://nalam-ai1.vercel.app',
    cleartext: true
  }
};

export default config;
