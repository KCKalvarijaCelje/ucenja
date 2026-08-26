import React, { useState, useEffect } from 'react';
import { Download, X, Sparkles, BookOpen } from 'lucide-react';

interface PwaInstallBannerProps {
  currentLang: 'sl' | 'en';
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallBanner: React.FC<PwaInstallBannerProps> = ({ currentLang }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // If running in standalone mode (already installed), don't show
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!sessionStorage.getItem('kck_ucenja_pwa_dismissed')) {
        setIsVisible(true);
      }
    };

    const installedHandler = () => {
      setIsVisible(false);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    // Show banner after brief delay if not dismissed and not in standalone mode
    const timer = setTimeout(() => {
      if (!sessionStorage.getItem('kck_ucenja_pwa_dismissed') && !(window.matchMedia('(display-mode: standalone)').matches)) {
        setIsVisible(true);
      }
    }, 3500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback instruction for iOS and browsers without deferred prompt
      alert(
        currentLang === 'sl'
          ? 'Za namestitev aplikacije na telefon izberite »Dodaj na začetni zaslon« (Add to Home Screen) v meniju brskalnika.'
          : 'To install on your device, tap "Add to Home Screen" in your browser menu.'
      );
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    sessionStorage.setItem('kck_ucenja_pwa_dismissed', 'true');
  };

  if (!isVisible || isDismissed) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 max-w-sm w-full bg-[#064E3B] text-white p-4 rounded-2xl shadow-2xl border border-emerald-500/40 animate-in slide-in-from-bottom-6 duration-300">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm border border-emerald-400/30 shadow-xs">
            <BookOpen className="w-4 h-4 text-emerald-100" />
          </div>
          <div>
            <div className="text-xs font-black font-heading text-white flex items-center gap-1.5">
              <span>{currentLang === 'sl' ? 'Namestite aplikacijo Učenja' : 'Install KCK Teachings App'}</span>
              <Sparkles className="w-3 h-3 text-emerald-300" />
            </div>
            <div className="text-[10px] text-emerald-200">
              {currentLang === 'sl' ? 'Dostop brez povezave & poslušanje pridig' : 'Offline access & teaching audio'}
            </div>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-emerald-300 hover:text-white transition-colors cursor-pointer p-1"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={handleInstallClick}
          className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all border border-emerald-400/20"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{currentLang === 'sl' ? 'Namesti na telefon / PC' : 'Add to Home Screen'}</span>
        </button>
        <button
          onClick={handleDismiss}
          className="py-2 px-3 rounded-xl bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 text-xs font-medium transition-colors cursor-pointer"
        >
          {currentLang === 'sl' ? 'Kasneje' : 'Later'}
        </button>
      </div>
    </div>
  );
};
