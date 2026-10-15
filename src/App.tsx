import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { Briefcase, Compass, Inbox, UserRound } from 'lucide-react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { useStore } from './store/useStore';
import { useNav, type Tab } from './ui/nav';
import { Toaster, spring } from './ui/kit';
import { haptic } from './ui/haptics';
import { useT } from './i18n';
import { isNative } from './lib/http';
import { runSearch } from './lib/pipeline';
import { onNotificationTap } from './lib/notify';
import { syncBackground } from './lib/background';
import Welcome from './pages/Welcome';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Review from './pages/Review';
import Tracker from './pages/Tracker';
import ProfilePage from './pages/Profile';
import JobDetail from './pages/JobDetail';
import Settings from './pages/Settings';
import EditProfile from './pages/EditProfile';
import EditTrack from './pages/EditTrack';

function useTheme(): boolean {
  const mode = useStore((s) => s.settings.theme);
  const lang = useStore((s) => s.settings.uiLang);
  const [sysDark, setSysDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => setSysDark(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  const dark = mode === 'dark' || (mode === 'system' && sysDark);
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0d0a0c' : '#f7f3ec');
    if (isNative) {
      void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
      void StatusBar.setBackgroundColor({ color: dark ? '#0d0a0c' : '#f7f3ec' }).catch(() => undefined);
    }
  }, [dark, lang]);
  return dark;
}

const TABS: { id: Tab; icon: typeof Compass }[] = [
  { id: 'home', icon: Compass },
  { id: 'review', icon: Inbox },
  { id: 'tracker', icon: Briefcase },
  { id: 'profile', icon: UserRound },
];

function TabBar() {
  const { t } = useT();
  const { tab, setTab } = useNav();
  const readyCount = useStore((s) => Object.values(s.matches).filter((m) => m.status === 'ready' && !m.seen).length);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface shadow-[0_-8px_24px_-14px_rgba(0,0,0,0.4)]" style={{ paddingBottom: 'var(--sab)' }}>
      <div className="mx-auto flex max-w-xl px-2 pt-1.5 pb-1">
        {TABS.map(({ id, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => {
                haptic();
                setTab(id);
              }}
              className={`flex flex-1 flex-col items-center gap-1 py-0.5 text-[11px] font-semibold transition-colors ${active ? 'text-accent' : 'text-muted'}`}
            >
              <span className="relative grid h-8 w-12 place-items-center">
                {active && <motion.span layoutId="tab-pill" transition={spring} className="absolute inset-0 rounded-[11px]" style={{ background: 'var(--pill)' }} />}
                <Icon className="relative size-5" strokeWidth={active ? 2.4 : 1.9} />
                {id === 'review' && readyCount > 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1 end-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] text-white ring-2 ring-[var(--surface)]">
                    {readyCount}
                  </motion.span>
                )}
              </span>
              <span>{t.tabs[id]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Main() {
  const { tab, stack, dir } = useNav();
  const top = stack[stack.length - 1];
  const rtl = useStore((s) => s.settings.uiLang === 'ar');
  // Screens enter from the reading-start edge and leave the same way: right in Arabic, left in English.
  const sign = rtl ? 1 : -1;
  const TabPage = { home: Home, review: Review, tracker: Tracker, profile: ProfilePage }[tab];
  return (
    <>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.main key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="min-h-full pb-28">
          <TabPage />
        </motion.main>
      </AnimatePresence>
      <TabBar />
      <AnimatePresence custom={dir}>
        {top && (
          <motion.div
            key={stack.length + top.name}
            className="fixed inset-0 z-40 overflow-y-auto bg-bg"
            initial={{ x: `${100 * sign}%` }}
            animate={{ x: 0 }}
            exit={{ x: `${100 * sign}%` }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            {top.name === 'job' && <JobDetail id={top.id} />}
            {top.name === 'settings' && <Settings />}
            {top.name === 'editProfile' && <EditProfile section={top.section} />}
            {top.name === 'track' && <EditTrack id={top.id} />}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function App() {
  useTheme();
  const onboarded = useStore((s) => s.onboarded);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (isNative) void SplashScreen.hide({ fadeOutDuration: 350 }).catch(() => undefined);
    onNotificationTap((route) => useNav.getState().setTab(route.includes('inbox') ? 'review' : 'home'));
    if (!isNative) return;
    const back = CapApp.addListener('backButton', () => {
      if (!useNav.getState().pop()) {
        if (useNav.getState().tab !== 'home') useNav.getState().setTab('home');
        else void CapApp.minimizeApp();
      }
    });
    const resume = CapApp.addListener('resume', () => {
      const { onboarded, lastRun } = useStore.getState();
      if (onboarded && (!lastRun || Date.now() - new Date(lastRun).getTime() > 30 * 60000)) void runSearch().catch(() => undefined);
    });
    return () => {
      void back.then((h) => h.remove());
      void resume.then((h) => h.remove());
    };
  }, []);

  useEffect(() => {
    if (!onboarded) return;
    useStore.getState().prune(); // drop stored jobs that are old, closed or outside Qatar
    void syncBackground();
    const { lastRun } = useStore.getState();
    if (!lastRun || Date.now() - new Date(lastRun).getTime() > 30 * 60000) void runSearch().catch(() => undefined);
  }, [onboarded]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="status-scrim" aria-hidden />
      <Toaster />
      <AnimatePresence mode="wait">
        {onboarded ? (
          <motion.div key="main" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Main />
          </motion.div>
        ) : started ? (
          <motion.div key="ob" className="h-full" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Onboarding onBack={() => setStarted(false)} />
          </motion.div>
        ) : (
          <motion.div key="welcome" className="h-full" exit={{ opacity: 0, scale: 1.02 }}>
            <Welcome onStart={() => setStarted(true)} />
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
