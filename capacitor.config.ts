import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zaplynxpay.app',
  appName: 'Zaplynx Pay',
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
