import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Keep a module-level reference so navigating between LandingPage and Editor never loses the captured event
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach(fn => fn());
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    promptListeners.forEach(fn => fn());
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => globalDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  });
  const [isInIframe, setIsInIframe] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
    };
    mediaQuery.addEventListener('change', handleMediaChange);

    const syncPrompt = () => {
      setDeferredPrompt(globalDeferredPrompt);
      if (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true
      ) {
        setIsInstalled(true);
      }
    };

    promptListeners.add(syncPrompt);
    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
      promptListeners.delete(syncPrompt);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!globalDeferredPrompt) {
      return 'unavailable';
    }
    try {
      await globalDeferredPrompt.prompt();
      const { outcome } = await globalDeferredPrompt.userChoice;
      if (outcome === 'accepted') {
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
      }
      return outcome;
    } catch {
      return 'unavailable';
    }
  }, []);

  const isIos =
    typeof navigator !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent || '');

  return {
    isInstallable: Boolean(deferredPrompt) && !isInstalled,
    isInstalled,
    isInIframe,
    isIos,
    promptInstall,
  };
}

export function useNetworkStatus(onReconnect?: () => void) {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      if (onReconnect) {
        onReconnect();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onReconnect]);

  return isOnline;
}

export interface ReminderSettings {
  enabled: boolean;
  time: string; // "HH:MM" e.g. "20:30"
}

const REMINDER_ENABLED_KEY = 'kronika_reminder_enabled';
const REMINDER_TIME_KEY = 'kronika_reminder_time';
const REMINDER_LAST_DATE_KEY = 'kronika_reminder_last_sent_date';

export function getStoredReminderSettings(): ReminderSettings {
  try {
    const enabled = localStorage.getItem(REMINDER_ENABLED_KEY) === 'true';
    const time = localStorage.getItem(REMINDER_TIME_KEY) || '20:30';
    return { enabled, time };
  } catch {
    return { enabled: false, time: '20:30' };
  }
}

export function saveStoredReminderSettings(settings: ReminderSettings): void {
  try {
    localStorage.setItem(REMINDER_ENABLED_KEY, String(settings.enabled));
    localStorage.setItem(REMINDER_TIME_KEY, settings.time);
  } catch {
    // ignore storage errors
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showJournalNotification(
  lang: 'pl' | 'en' | 'es' | 'fr',
  isTest: boolean = false
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return false;
  }

  const title = isTest
    ? lang === 'en'
      ? 'Moments — Reminder active'
      : lang === 'es'
      ? 'Moments — Recordatorio activo'
      : lang === 'fr'
      ? 'Moments — Rappel activé'
      : 'Momenty — Przypomnienie działa'
    : lang === 'en'
    ? 'Time for a quiet moment'
    : lang === 'es'
    ? 'Hora de un momento tranquilo'
    : lang === 'fr'
    ? 'L’heure d’un moment paisible'
    : 'Czas na spokojną chwilę z dziennikiem';

  const body = isTest
    ? lang === 'en'
      ? 'Your daily writing notifications are configured properly on this device.'
      : lang === 'es'
      ? 'Tus notificaciones diarias de escritura están configuradas correctamente.'
      : lang === 'fr'
      ? 'Vos notifications quotidiennes d’écriture sont bien configurées sur cet appareil.'
      : 'Powiadomienia o wieczornym pisaniu są poprawnie włączone na tym urządzeniu.'
    : lang === 'en'
    ? 'Today’s question is waiting for you. Write or dictate a few sentences before closing the day.'
    : lang === 'es'
    ? 'La pregunta de hoy te espera. Escribe o dicta unas frases antes de cerrar el día.'
    : lang === 'fr'
    ? 'La question du jour vous attend. Écrivez ou dictez quelques phrases avant de clore la journée.'
    : 'Dzisiejsze pytanie czeka na Ciebie. Zapisz lub podyktuj kilka zdań przed zamknięciem dnia.';

  const options: NotificationOptions = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: isTest ? 'momenty-test-notification' : 'momenty-daily-reminder',
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return true;
      }
    }
    new Notification(title, options);
    return true;
  } catch {
    try {
      new Notification(title, options);
      return true;
    } catch {
      return false;
    }
  }
}

export function checkAndTriggerScheduledReminder(
  todayKey: string,
  isSealed: boolean,
  lang: 'pl' | 'en' | 'es' | 'fr'
): void {
  if (isSealed) return;
  const { enabled, time } = getStoredReminderSettings();
  if (!enabled || !time) return;

  try {
    const lastSent = localStorage.getItem(REMINDER_LAST_DATE_KEY);
    if (lastSent === todayKey) return;

    const [targetHour, targetMinute] = time.split(':').map(Number);
    if (isNaN(targetHour) || isNaN(targetMinute)) return;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const targetMinutes = targetHour * 60 + targetMinute;

    // Trigger if current time is within a 90-minute window after the chosen reminder time
    if (nowMinutes >= targetMinutes && nowMinutes <= targetMinutes + 90) {
      localStorage.setItem(REMINDER_LAST_DATE_KEY, todayKey);
      showJournalNotification(lang, false);
    }
  } catch {
    // ignore
  }
}
