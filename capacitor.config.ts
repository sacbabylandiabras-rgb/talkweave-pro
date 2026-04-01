import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.9023f99095c6410f8f3bbb7c314444a5',
  appName: 'talkweave-pro',
  webDir: 'dist',
  server: {
    url: 'https://9023f990-95c6-410f-8f3b-bb7c314444a5.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
