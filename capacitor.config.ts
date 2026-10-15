/// <reference types="@capacitor/background-runner" />
/// <reference types="@capacitor/local-notifications" />
/// <reference types="@capacitor/splash-screen" />
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'qa.jobfinder.app',
  appName: 'Job Finder',
  webDir: 'dist',
  android: { backgroundColor: '#0d0a0c' },
  plugins: {
    // Keeps cookies between native requests (LinkedIn rate-limits cookie-less clients much faster).
    CapacitorCookies: { enabled: true },
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
    SplashScreen: { launchShowDuration: 1200, launchAutoHide: false, backgroundColor: '#5e0b25', androidScaleType: 'CENTER_CROP', showSpinner: false },
    LocalNotifications: { smallIcon: 'ic_stat_notify', iconColor: '#8A1538' },
    BackgroundRunner: {
      label: 'qa.jobfinder.app.check',
      src: 'runners/background.js',
      event: 'checkJobs',
      repeat: true,
      interval: 60,
      autoStart: true,
    },
  },
};

export default config;
