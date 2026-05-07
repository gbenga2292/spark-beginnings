import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dcel.hr',
  appName: 'DCEL Office Suite',
  webDir: 'dist',
  server: {
    // Allow the app to make requests to these external domains
    allowNavigation: [
      'dewaterconstruct.com',
      'qivyzfdxrzmzhvgjfaed.supabase.co',
    ],
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false, // We use HTTPS everywhere — keep this false
  },
  plugins: {
    // Allow camera and media access
    Filesystem: {
      iosScheme: 'ionic',
    },
  },
};

export default config;
