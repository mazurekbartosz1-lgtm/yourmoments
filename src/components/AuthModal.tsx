import React, { useState, useEffect } from 'react';
import {
  X,
  LogIn,
  User,
  Sparkles,
  AlertCircle,
  Globe,
  Check,
  Smartphone,
  Download,
  Bell,
  Clock,
  ChevronDown,
  MessageSquare,
  Send,
  Trash2,
  Shield,
  Copy,
  Key,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signOut,
  handleFirestoreError,
  OperationType,
} from '../services/firebase';
import {
  User as FirebaseUser,
  deleteUser,
  reauthenticateWithPopup,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  usePWAInstall,
  getStoredReminderSettings,
  saveStoredReminderSettings,
  requestNotificationPermission,
  showJournalNotification,
} from '../services/pwa';
import { isAuthorizedAdmin } from './AdminPanelModal';

interface AuthModalProps {
  isOpen: boolean;
  user: FirebaseUser | null;
  lang: 'pl' | 'en' | 'es' | 'fr';
  onLanguageChange: (lang: 'pl' | 'en' | 'es' | 'fr') => void;
  onAccountDeleted?: () => void;
  onOpenAdminPanel?: () => void;
  sparkleTestMode?: boolean;
  onToggleSparkleTestMode?: (enabled: boolean) => void;
  onTestSparkleNow?: () => void;
  onClose: () => void;
}

const LANGUAGES = [
  { code: 'pl', label: 'Polski' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
] as const;

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  user,
  lang,
  onLanguageChange,
  onAccountDeleted,
  onOpenAdminPanel,
  sparkleTestMode = false,
  onToggleSparkleTestMode,
  onTestSparkleNow,
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showManualInstallHelp, setShowManualInstallHelp] = useState<boolean>(false);
  const [showLangDropdown, setShowLangDropdown] = useState<boolean>(false);

  // Feedback form state
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [includeEmail, setIncludeEmail] = useState<boolean>(true);
  const [isSendingFeedback, setIsSendingFeedback] = useState<boolean>(false);
  const [feedbackSent, setFeedbackSent] = useState<boolean>(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Delete account state
  const [confirmEmailInput, setConfirmEmailInput] = useState<string>('');
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  const initialReminder = getStoredReminderSettings();
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(initialReminder.enabled);
  const [reminderTime, setReminderTime] = useState<string>(initialReminder.time);
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);

  // Google Play / Android TWA helper state
  const [showGooglePlayGuide, setShowGooglePlayGuide] = useState<boolean>(false);
  const [androidPackageName, setAndroidPackageName] = useState<string>('app.momenty.dziennik');
  const [androidSha256, setAndroidSha256] = useState<string>('');
  const [isSavingAndroidConfig, setIsSavingAndroidConfig] = useState<boolean>(false);
  const [androidConfigSaved, setAndroidConfigSaved] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !showGooglePlayGuide) return;
    fetch('/api/android-twa-config')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data) {
          if (typeof data.packageName === 'string' && data.packageName) {
            setAndroidPackageName(data.packageName);
          }
          if (Array.isArray(data.sha256Fingerprints) && data.sha256Fingerprints.length > 0) {
            setAndroidSha256(data.sha256Fingerprints.join('\n'));
          }
        }
      })
      .catch(() => {});
  }, [isOpen, showGooglePlayGuide]);

  const { isInstallable, isInstalled, isIos, promptInstall } = usePWAInstall();

  if (!isOpen) return null;
  const isEn = lang === 'en';
  const isEs = lang === 'es';
  const isFr = lang === 'fr';
  const tr = (pl: string, en: string, es?: string, fr?: string) =>
    isEn ? en : isEs ? (es ?? en) : isFr ? (fr ?? en) : pl;

  const currentLangObj = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err: unknown) {
      console.error('Login error:', err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : tr(
              'Nie udało się zalogować przez Google.',
              'Failed to sign in with Google.',
              'No se pudo iniciar sesión con Google.',
              'Impossible de se connecter avec Google.'
            )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onClose();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMsg = feedbackMessage.trim().slice(0, 2000);
    if (!cleanMsg || !user) return;

    setIsSendingFeedback(true);
    setFeedbackError(null);
    setFeedbackSent(false);

    const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const senderEmail = includeEmail && user.email ? user.email.slice(0, 254) : '';

    try {
      // 1. Save feedback in Firestore database
      const feedbackRef = doc(db, 'feedback', feedbackId);
      try {
        await setDoc(feedbackRef, {
          id: feedbackId,
          userId: user.uid,
          message: cleanMsg,
          includeEmail: Boolean(includeEmail),
          userEmail: senderEmail,
          recipientEmail: 'mazurekbartosz1@gmail.com',
          lang,
          createdAt: serverTimestamp(),
        });
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.CREATE, `feedback/${feedbackId}`);
      }

      // 2. Forward feedback via backend API to mazurekbartosz1@gmail.com
      await fetch('/api/send-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanMsg,
          includeEmail: Boolean(includeEmail),
          userEmail: senderEmail,
          userName: user.displayName || '',
          lang,
        }),
      }).catch(err => {
        console.warn('Email notification warning:', err);
      });

      setFeedbackMessage('');
      setFeedbackSent(true);
    } catch (err) {
      console.error('Failed to send feedback:', err);
      setFeedbackError(
        tr(
          'Nie udało się wysłać opinii. Spróbuj ponownie.',
          'Could not send feedback. Please try again.',
          'No se pudo enviar el comentario. Inténtalo de nuevo.',
          'Impossible d’envoyer votre avis. Veuillez réessayer.'
        )
      );
    } finally {
      setIsSendingFeedback(false);
    }
  };

  const isEmailConfirmedForDeletion =
    Boolean(user?.email) &&
    confirmEmailInput.trim().toLowerCase() === (user?.email || '').trim().toLowerCase();

  const handleDeleteAccount = async () => {
    if (!user || !isEmailConfirmedForDeletion) return;

    setIsDeletingAccount(true);
    setDeleteAccountError(null);
    const uid = user.uid;

    try {
      // 1. Delete all user journal entries in /users/{uid}/entries
      const entriesCol = collection(db, 'users', uid, 'entries');
      const entriesSnap = await getDocs(entriesCol);
      for (const entryDoc of entriesSnap.docs) {
        await deleteDoc(doc(db, 'users', uid, 'entries', entryDoc.id));
      }

      // 2. Delete all feedback submitted by this user in /feedback
      try {
        const fbQuery = query(collection(db, 'feedback'), where('userId', '==', uid));
        const fbSnap = await getDocs(fbQuery);
        for (const fbDoc of fbSnap.docs) {
          await deleteDoc(doc(db, 'feedback', fbDoc.id));
        }
      } catch {
        // Ignore if no feedback documents exist
      }

      // 3. Delete user profile document /users/{uid}
      await deleteDoc(doc(db, 'users', uid)).catch(() => {});

      // 4. Clear all local storage keys created for this user
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.includes(uid) || k.startsWith('kronika_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();

      // 5. Delete Firebase Auth user account (re-authenticating if required by Firebase)
      try {
        await deleteUser(user);
      } catch (authErr: any) {
        if (authErr?.code === 'auth/requires-recent-login') {
          await reauthenticateWithPopup(user, googleProvider);
          await deleteUser(user);
        } else {
          throw authErr;
        }
      }

      onAccountDeleted?.();
      onClose();
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setDeleteAccountError(
        tr(
          'Nie udało się usunąć konta. Zaloguj się ponownie i spróbuj jeszcze raz.',
          'Failed to delete account. Please sign in again and retry.',
          'No se pudo eliminar la cuenta. Inicia sesión de nuevo e inténtalo otra vez.',
          'Impossible de supprimer le compte. Veuillez vous reconnecter et réessayer.'
        )
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleInstallApp = async () => {
    if (isInstallable) {
      const outcome = await promptInstall();
      if (outcome === 'unavailable') {
        setShowManualInstallHelp(true);
      }
    } else {
      setShowManualInstallHelp(prev => !prev);
    }
  };

  const handleToggleReminder = async () => {
    const nextEnabled = !reminderEnabled;
    if (nextEnabled) {
      const perm = await requestNotificationPermission();
      if (perm === 'denied') {
        setNotifFeedback(
          tr(
            'Powiadomienia są zablokowane w ustawieniach przeglądarki.',
            'Notifications are blocked in your browser settings.',
            'Las notificaciones están bloqueadas en el navegador.',
            'Les notifications sont bloquées dans le navigateur.'
          )
        );
        return;
      }
      if (perm === 'unsupported') {
        setNotifFeedback(
          tr(
            'Ta przeglądarka nie obsługuje powiadomień systemowych.',
            'This browser does not support system notifications.',
            'Este navegador no admite notificaciones del sistema.',
            'Ce navigateur ne prend pas en charge les notifications.'
          )
        );
        return;
      }
    }
    setReminderEnabled(nextEnabled);
    saveStoredReminderSettings({ enabled: nextEnabled, time: reminderTime });
    setNotifFeedback(
      nextEnabled
        ? tr(
            `Przypomnienie ustawione na ${reminderTime}.`,
            `Daily reminder set for ${reminderTime}.`,
            `Recordatorio diario fijado a las ${reminderTime}.`,
            `Rappel quotidien programmé à ${reminderTime}.`
          )
        : null
    );
  };

  const handleTimeChange = (newTime: string) => {
    setReminderTime(newTime);
    saveStoredReminderSettings({ enabled: reminderEnabled, time: newTime });
  };

  const handleTestNotification = async () => {
    const ok = await showJournalNotification(lang, true);
    if (ok) {
      setNotifFeedback(
        tr(
          'Wysłano testowe powiadomienie!',
          'Test notification sent!',
          '¡Notificación de prueba enviada!',
          'Notification de test envoyée !'
        )
      );
    } else {
      setNotifFeedback(
        tr(
          'Zezwól na powiadomienia w przeglądarce (lub otwórz aplikację poza podglądem).',
          'Please allow notifications in your browser (or open the app in a full tab).',
          'Permite las notificaciones en tu navegador.',
          'Veuillez autoriser les notifications dans votre navigateur.'
        )
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#FAF8F5] border border-[#E2DDD3] rounded-xl shadow-xl p-6 text-[#1C1A18] my-auto max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#ECE7DC]">
          <h3 className="text-base font-serif-literary font-medium text-[#1C1A18]">
            {tr('Opcje i Profil', 'Options & Profile', 'Opciones y Perfil', 'Options et Profil')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-5 space-y-5">
          {/* 1. AVATAR & PROFILE AT THE VERY TOP */}
          {user && (
            <div className="space-y-3 pb-4 border-b border-[#ECE7DC]">
              <div className="flex flex-col items-center text-center p-3.5 bg-[#F2EFE8] rounded-lg border border-[#E3DDD1] space-y-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={
                      user.displayName ||
                      tr('Użytkownik', 'User', 'Usuario', 'Utilisateur')
                    }
                    className="w-14 h-14 rounded-full border border-[#D0C8B8] object-cover shadow-2xs"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[#E0DCD3] flex items-center justify-center text-[#7A756D]">
                    <User className="w-6 h-6" />
                  </div>
                )}
                <div className="overflow-hidden max-w-full">
                  <div className="text-sm font-serif-literary font-medium text-[#1C1A18] truncate">
                    {user.displayName ||
                      tr('Kronikarz', 'Chronicler', 'Cronista', 'Chroniqueur')}
                  </div>
                  <div className="text-[11px] font-mono-meta text-[#7A756D] truncate">
                    {user.email}
                  </div>
                </div>
              </div>

              <div className="text-xs text-[#524D46] font-serif-literary leading-relaxed">
                {tr(
                  'Jesteś zalogowany. Twoje wpisy oraz pęk kluczy szyfrujących synchronizują się automatycznie między telefonem a komputerem (także po pisaniu offline).',
                  'You are signed in. Your entries and encryption keyring sync automatically between your phone and computer (including after writing offline).',
                  'Has iniciado sesión. Tus entradas y tu llavero de cifrado se sincronizan automáticamente entre móvil y ordenador.',
                  'Vous êtes connecté. Vos entrées et votre trousseau de chiffrement sont synchronisés automatiquement entre téléphone et ordinateur.'
                )}
              </div>

              {isAuthorizedAdmin(user) && (
                <div className="space-y-2 pt-1">
                  {onOpenAdminPanel && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAdminPanel();
                      }}
                      className="w-full py-2 px-3 rounded border border-[#1C1A18] bg-[#1C1A18] hover:bg-[#33302B] text-[#FAF8F5] text-xs font-mono-meta uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5 text-[#C89D54]" />
                      <span>
                        {tr(
                          'Panel Administratora (Anonimowe Statystyki)',
                          'Admin Panel (Anonymized Stats)',
                          'Panel de Administración (Estadísticas Anónimas)',
                          'Panneau Admin (Statistiques Anonymisées)'
                        )}
                      </span>
                    </button>
                  )}

                  {onToggleSparkleTestMode && (
                    <div className="p-3 rounded-lg border border-[#DDD6C8] bg-[#F2EFE8] space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-left">
                          <Sparkles className="w-4 h-4 text-[#8B2635] shrink-0" />
                          <div>
                            <div className="text-xs font-mono-meta font-medium text-[#1C1A18]">
                              {tr(
                                'Tryb testowy Sparkle (tylko admin)',
                                'Sparkle Test Mode (admin only)',
                                'Modo de prueba Sparkle (solo admin)',
                                'Mode test Sparkle (admin uniquement)'
                              )}
                            </div>
                            <div className="text-[11px] font-serif-literary text-[#6E6961] leading-snug">
                              {tr(
                                'Pokazuje gwiazdki obok Dziennika cały czas (bez czekania na zamknięcie dnia i losowania 1–4 dni).',
                                'Always shows Sparkle stars next to Journal without waiting for day closure or 1–4 day interval.',
                                'Muestra siempre las estrellas Sparkle junto al Diario.',
                                'Affiche toujours les étoiles Sparkle à côté du Journal.'
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={sparkleTestMode}
                          onClick={() => onToggleSparkleTestMode(!sparkleTestMode)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            sparkleTestMode ? 'bg-[#8B2635]' : 'bg-[#C8C2B4]'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#FAF8F5] shadow-xs transition duration-200 ease-in-out ${
                              sparkleTestMode ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {sparkleTestMode && onTestSparkleNow && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onTestSparkleNow();
                          }}
                          className="w-full py-2 px-3 rounded border border-[#DDD6C8] bg-[#FAF8F5] hover:bg-[#EAE5DA] text-[#1C1A18] text-xs font-mono-meta font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#8B2635]" />
                          <span>
                            {tr(
                              'Wygeneruj podsumowanie Sparkle teraz',
                              'Generate Sparkle summary now',
                              'Generar resumen Sparkle ahora',
                              'Générer le résumé Sparkle maintenant'
                            )}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2. Language Switcher Dropdown */}
          <div className="space-y-2 pb-4 border-b border-[#ECE7DC]">
            <label className="text-[11px] font-mono-meta uppercase tracking-wider text-[#7A756D] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#524D46]" />
              <span>
                {tr(
                  'Język aplikacji i pisania',
                  'App & Writing Language',
                  'Idioma de la app y escritura',
                  'Langue de l’application et d’écriture'
                )}
              </span>
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangDropdown(prev => !prev)}
                className="w-full py-2 px-3 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-xs font-mono-meta text-[#1C1A18] flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-2 font-medium">
                  <span>{currentLangObj.label}</span>
                  <span className="text-[10px] uppercase text-[#7A756D]">
                    ({currentLangObj.code})
                  </span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[#7A756D] transition-transform duration-150 ${
                    showLangDropdown ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showLangDropdown && (
                <div className="mt-1.5 w-full rounded bg-[#FAF8F5] border border-[#DDD6C8] shadow-md p-1 text-xs font-mono-meta space-y-0.5">
                  {LANGUAGES.map(item => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => {
                        onLanguageChange(item.code);
                        setShowLangDropdown(false);
                      }}
                      className={`w-full px-3 py-1.5 rounded text-left flex items-center justify-between transition-colors cursor-pointer ${
                        lang === item.code
                          ? 'bg-[#1C1A18] text-[#FAF8F5] font-medium'
                          : 'text-[#524D46] hover:bg-[#EAE5DA] hover:text-[#1C1A18]'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="uppercase text-[10px] opacity-75">{item.code}</span>
                        {lang === item.code && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[11px] font-serif-literary text-[#7A756D] leading-snug pt-0.5">
              {tr(
                'Zmienia pytania dnia, pytania pomocnicze, dyktowanie głosowe i interfejs.',
                'Switches questions, follow-up hints, voice dictation, and interface to English.',
                'Cambia las preguntas diarias, pistas, dictado por voz e interfaz al español.',
                'Passe les questions du jour, les pistes, la dictée vocale et l’interface en français.'
              )}
            </p>
          </div>

          {/* 3. Android / Mobile App Installation Section */}
          <div className="space-y-2.5 pb-4 border-b border-[#ECE7DC]">
            <label className="text-[11px] font-mono-meta uppercase tracking-wider text-[#7A756D] flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-[#524D46]" />
              <span>
                {tr(
                  'Aplikacja na telefon (Android / iOS)',
                  'Mobile App (Android / iOS)',
                  'Aplicación móvil (Android / iOS)',
                  'Application mobile (Android / iOS)'
                )}
              </span>
            </label>

            <button
              type="button"
              onClick={handleInstallApp}
              className={`w-full min-h-[40px] py-2 px-3 rounded border text-xs font-mono-meta flex items-center justify-between transition-colors cursor-pointer ${
                isInstalled
                  ? 'border-[#CCE2CC] bg-[#EBF2EB] text-[#2E5C33]'
                  : 'border-[#1C1A18] bg-[#1C1A18] text-[#FAF8F5] hover:bg-[#33302B]'
              }`}
            >
              <span className="inline-flex items-center gap-2 font-medium">
                {isInstalled ? (
                  <>
                    <Check className="w-4 h-4 text-[#2E5C33]" />
                    <span>
                      {tr(
                        'Zainstalowano na tym urządzeniu',
                        'Installed on this device',
                        'Instalada en este dispositivo',
                        'Installée sur cet appareil'
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-[#EBC5CF]" />
                    <span>
                      {tr(
                        'Zainstaluj aplikację Momenty',
                        'Install Moments App',
                        'Instalar la app Moments',
                        'Installer l’application Moments'
                      )}
                    </span>
                  </>
                )}
              </span>
              {!isInstalled && (
                <span className="text-[10px] opacity-80">PWA · Offline</span>
              )}
            </button>

            {showManualInstallHelp && !isInstalled && (
              <div className="p-3 rounded-lg bg-[#F2EFE8] border border-[#DDD6C8] text-xs font-serif-literary text-[#524D46] space-y-1.5 leading-relaxed">
                {isIos ? (
                  <p>
                    {tr(
                      'Na iPhonie/iPadzie otwórz stronę w Safari, dotknij ikony Udostępnij na dole ekranu i wybierz „Dodaj do ekranu początkowego”.',
                      'On iPhone/iPad, open in Safari, tap the Share icon at the bottom, and choose “Add to Home Screen”.',
                      'En iPhone/iPad, abre en Safari, toca Compartir y elige «Añadir a pantalla de inicio».',
                      'Sur iPhone/iPad, ouvrez dans Safari, appuyez sur Partager et choisissez « Sur l’écran d’accueil ».'
                    )}
                  </p>
                ) : (
                  <p>
                    {tr(
                      'Aby zainstalować na telefonie z Androidem: otwórz pełny adres aplikacji w przeglądarce Chrome, kliknij menu (⋮) w prawym górnym rogu i wybierz „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”.',
                      'To install on Android: open the full app URL in Chrome, tap the menu (⋮) in the top-right corner, and select “Install app” or “Add to Home screen”.',
                      'Para instalar en Android: abre la dirección en Chrome, toca el menú (⋮) y selecciona «Instalar aplicación».',
                      'Pour installer sur Android : ouvrez l’adresse dans Chrome, appuyez sur le menu (⋮) et sélectionnez « Installer l’application ».'
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Google Play Store (.AAB / .APK) TWA Package Builder & Digital Asset Links */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowGooglePlayGuide(prev => !prev)}
                className="w-full py-1.5 px-2.5 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[11px] font-mono-meta text-[#524D46] hover:text-[#1C1A18] flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Key className="w-3.5 h-3.5 text-[#8B2635]" />
                  <span>
                    {tr(
                      'Publikacja w Google Play (Android .AAB / .APK)',
                      'Publish to Google Play (Android .AAB / .APK)',
                      'Publicar en Google Play (Android .AAB / .APK)',
                      'Publier sur Google Play (Android .AAB / .APK)'
                    )}
                  </span>
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#7A756D] transition-transform duration-150 ${
                    showGooglePlayGuide ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showGooglePlayGuide && (
                <div className="mt-2 p-3.5 rounded-lg bg-[#F2EFE8] border border-[#DDD6C8] space-y-3 text-xs">
                  <div className="space-y-1">
                    <div className="font-mono-meta text-[11px] font-medium text-[#1C1A18]">
                      {tr(
                        'Gotowość do sklepu Google Play (Trusted Web Activity / TWA)',
                        'Google Play Store Readiness (Trusted Web Activity / TWA)'
                      )}
                    </div>
                    <p className="text-[11px] font-serif-literary text-[#524D46] leading-relaxed">
                      {tr(
                        'Aplikacja posiada pełny manifest PWA, ikony maskable 512×512px, tryb offline oraz endpoint Digital Asset Links (/.well-known/assetlinks.json) wymagany przez Google Play do uruchamiania na pełnym ekranie bez paska przeglądarki.',
                        'The app includes a full PWA manifest, 512×512px maskable icons, offline Service Worker, and Digital Asset Links (/.well-known/assetlinks.json) required by Google Play for full-screen Android execution.'
                      )}
                    </p>
                  </div>

                  {/* Step-by-step instructions */}
                  <div className="p-2.5 rounded bg-[#FAF8F5] border border-[#E2DDD3] space-y-2 text-[11px] font-serif-literary text-[#1C1A18]">
                    <div className="font-mono-meta text-[10px] uppercase tracking-wider text-[#7A756D]">
                      {tr('3 kroki do dodania do Google Play:', '3 steps to publish on Google Play:')}
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-[#524D46] leading-snug">
                      <li>
                        <span className="font-medium text-[#1C1A18]">
                          {tr('Wygeneruj plik .AAB i .APK:', 'Generate .AAB & .APK bundle:')}
                        </span>{' '}
                        {tr(
                          'Wejdź na darmową stronę PWABuilder.com, wklej adres URL tej aplikacji i kliknij „Package for stores” → „Android” → „Download”.',
                          'Open PWABuilder.com, paste this app’s URL, and click “Package for stores” → “Android” → “Download”.'
                        )}
                      </li>
                      <li>
                        <span className="font-medium text-[#1C1A18]">
                          {tr('Wgraj plik .AAB do Google Play Console:', 'Upload .AAB to Google Play Console:')}
                        </span>{' '}
                        {tr(
                          'Utwórz aplikację w Google Play Console i prześlij pobrany plik .aab w sekcji Testy wewnętrzne lub Produkcja.',
                          'Create an app in Google Play Console and upload the .aab file under Internal Testing or Production.'
                        )}
                      </li>
                      <li>
                        <span className="font-medium text-[#1C1A18]">
                          {tr('Wklej odcisk klucza SHA-256 poniżej:', 'Paste SHA-256 fingerprint below:')}
                        </span>{' '}
                        {tr(
                          'Skopiuj klucz SHA-256 z Google Play Console (Konfiguracja → Podpisywanie aplikacji) lub z pliku assetlinks.json od PWABuilder i zapisz poniżej.',
                          'Copy the SHA-256 certificate fingerprint from Google Play Console (Setup → App signing) and save it below.'
                        )}
                      </li>
                    </ol>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const origin =
                            typeof window !== 'undefined' ? window.location.origin : '';
                          if (origin && navigator.clipboard) {
                            navigator.clipboard.writeText(origin);
                            setCopiedUrl(true);
                            setTimeout(() => setCopiedUrl(false), 2000);
                          }
                        }}
                        className="px-2.5 py-1 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[10px] font-mono-meta text-[#1C1A18] inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedUrl ? (
                          <Check className="w-3 h-3 text-[#2E5C33]" />
                        ) : (
                          <Copy className="w-3 h-3 text-[#524D46]" />
                        )}
                        <span>
                          {copiedUrl
                            ? tr('Skopiowano adres URL!', 'URL copied!')
                            : tr('Kopiuj URL aplikacji', 'Copy App URL')}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const origin =
                            typeof window !== 'undefined'
                              ? window.location.origin
                              : 'https://momenty.app';
                          const host = origin.replace(/^https?:\/\//, '');
                          const twaJson = {
                            packageId: androidPackageName.trim() || 'app.momenty.dziennik',
                            host,
                            name: 'Momenty — Cichy Dziennik',
                            launcherName: 'Momenty',
                            display: 'standalone',
                            themeColor: '#F7F5F0',
                            navigationColor: '#F7F5F0',
                            backgroundColor: '#F7F5F0',
                            enableNotifications: true,
                            startUrl: '/',
                            iconUrl: `${origin}/pwa-512x512.png`,
                            maskableIconUrl: `${origin}/pwa-maskable-512x512.png`,
                            webManifestUrl: `${origin}/manifest.webmanifest`,
                            orientation: 'portrait-primary',
                            appVersionName: '1.0.0',
                            appVersionCode: 1,
                          };
                          const blob = new Blob([JSON.stringify(twaJson, null, 2)], {
                            type: 'application/json',
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'twa-manifest.json';
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="px-2.5 py-1 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[10px] font-mono-meta text-[#1C1A18] inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Download className="w-3 h-3 text-[#524D46]" />
                        <span>twa-manifest.json</span>
                      </button>
                    </div>
                  </div>

                  {/* Digital Asset Links Configurator */}
                  <div className="space-y-2 pt-1 border-t border-[#E2DDD3]">
                    <div className="text-[10px] font-mono-meta uppercase tracking-wider text-[#7A756D]">
                      {tr(
                        'Digital Asset Links (/.well-known/assetlinks.json)',
                        'Digital Asset Links (/.well-known/assetlinks.json)'
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono-meta text-[#524D46]">
                        {tr('Nazwa pakietu Android (Package ID):', 'Android Package ID:')}
                      </label>
                      <input
                        type="text"
                        value={androidPackageName}
                        onChange={e => {
                          setAndroidPackageName(e.target.value);
                          setAndroidConfigSaved(false);
                        }}
                        placeholder="app.momenty.dziennik"
                        className="w-full px-2.5 py-1.5 rounded border border-[#D4CEBF] bg-[#FAF8F5] text-[11px] font-mono-meta text-[#1C1A18] focus:outline-none focus:border-[#1C1A18]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono-meta text-[#524D46]">
                        {tr(
                          'Odcisk certyfikatu SHA-256 (z Google Play Console / PWABuilder):',
                          'SHA-256 Certificate Fingerprint (from Google Play Console):'
                        )}
                      </label>
                      <textarea
                        rows={2}
                        value={androidSha256}
                        onChange={e => {
                          setAndroidSha256(e.target.value);
                          setAndroidConfigSaved(false);
                        }}
                        placeholder="AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
                        className="w-full px-2.5 py-1.5 rounded border border-[#D4CEBF] bg-[#FAF8F5] text-[10px] font-mono-meta text-[#1C1A18] placeholder-[#ABA497] focus:outline-none focus:border-[#1C1A18] resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono-meta text-[#7A756D] truncate">
                        /.well-known/assetlinks.json
                      </span>
                      <button
                        type="button"
                        disabled={isSavingAndroidConfig}
                        onClick={async () => {
                          setIsSavingAndroidConfig(true);
                          setAndroidConfigSaved(false);
                          try {
                            const res = await fetch('/api/android-twa-config', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                packageName: androidPackageName.trim() || 'app.momenty.dziennik',
                                sha256Fingerprints: androidSha256,
                              }),
                            });
                            if (res.ok) {
                              setAndroidConfigSaved(true);
                            }
                          } catch {
                            // ignore
                          } finally {
                            setIsSavingAndroidConfig(false);
                          }
                        }}
                        className="px-3 py-1 rounded border border-[#1C1A18] bg-[#1C1A18] hover:bg-[#33302B] text-[#FAF8F5] text-[11px] font-mono-meta inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        {androidConfigSaved ? (
                          <>
                            <Check className="w-3 h-3 text-[#EBC5CF]" />
                            <span>{tr('Zapisano assetlinks.json', 'Saved assetlinks.json')}</span>
                          </>
                        ) : (
                          <span>
                            {isSavingAndroidConfig
                              ? tr('Zapisywanie...', 'Saving...')
                              : tr('Zapisz certyfikat SHA-256', 'Save SHA-256 certificate')}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Daily Writing Reminder Notifications Section */}
          <div className="space-y-2.5 pb-4 border-b border-[#ECE7DC]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-mono-meta uppercase tracking-wider text-[#7A756D] flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-[#524D46]" />
                <span>
                  {tr(
                    'Powiadomienia o pisaniu',
                    'Writing Reminders',
                    'Recordatorios de escritura',
                    'Rappels d’écriture'
                  )}
                </span>
              </label>
              <button
                type="button"
                onClick={handleToggleReminder}
                className={`px-2.5 py-1 rounded text-[11px] font-mono-meta border transition-colors cursor-pointer whitespace-nowrap ${
                  reminderEnabled
                    ? 'bg-[#EBF2EB] border-[#CCE2CC] text-[#2E5C33] font-medium'
                    : 'bg-[#F5F2EB] border-[#DDD6C8] text-[#524D46] hover:bg-[#EAE5DA] hover:text-[#1C1A18]'
                }`}
              >
                {reminderEnabled
                  ? tr('Włączone', 'Enabled', 'Activado', 'Activé')
                  : tr('Włącz przypomnienie', 'Enable reminder', 'Activar', 'Activer')}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-1.5 text-xs font-serif-literary text-[#524D46]">
                <Clock className="w-3.5 h-3.5 text-[#7A756D]" />
                <span>
                  {tr(
                    'Godzina przypomnienia:',
                    'Reminder time:',
                    'Hora del recordatorio:',
                    'Heure du rappel :'
                  )}
                </span>
              </div>
              <input
                type="time"
                value={reminderTime}
                onChange={e => handleTimeChange(e.target.value)}
                className="px-2.5 py-1 rounded border border-[#D4CEBF] bg-[#FAF8F5] text-xs font-mono-meta text-[#1C1A18] focus:outline-none focus:border-[#1C1A18]"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleTestNotification}
                className="px-2.5 py-1 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[11px] font-mono-meta text-[#524D46] hover:text-[#1C1A18] transition-colors cursor-pointer whitespace-nowrap"
              >
                {tr(
                  'Wyślij testowe powiadomienie →',
                  'Send test notification →',
                  'Enviar notificación de prueba →',
                  'Envoyer une notification de test →'
                )}
              </button>
            </div>

            {notifFeedback && (
              <p className="text-[11px] font-serif-literary text-[#524D46] bg-[#F2EFE8] px-2.5 py-1.5 rounded border border-[#E3DDD1]">
                {notifFeedback}
              </p>
            )}
          </div>

          {/* 5. Drop a Feedback Section (Saved to Firestore + emailed to mazurekbartosz1@gmail.com) */}
          {user && (
            <form
              onSubmit={handleSendFeedback}
              className="space-y-2.5 pb-4 border-b border-[#ECE7DC]"
            >
              <label className="text-[11px] font-mono-meta uppercase tracking-wider text-[#7A756D] flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#524D46]" />
                <span>
                  {tr(
                    'Zostaw opinię (Drop a feedback)',
                    'Drop a feedback',
                    'Enviar comentarios (Drop a feedback)',
                    'Envoyer un avis (Drop a feedback)'
                  )}
                </span>
              </label>

              <textarea
                rows={3}
                maxLength={2000}
                value={feedbackMessage}
                onChange={e => {
                  setFeedbackMessage(e.target.value);
                  if (feedbackSent) setFeedbackSent(false);
                }}
                placeholder={tr(
                  'Podziel się swoją opinią, pomysłem lub zgłoś uwagę...',
                  'Share your thoughts, ideas, or report an issue...',
                  'Comparte tus ideas, sugerencias o comentarios...',
                  'Partagez vos idées, suggestions ou remarques...'
                )}
                className="w-full p-2.5 rounded-lg border border-[#D4CEBF] bg-[#FAF8F5] text-xs font-serif-literary text-[#1C1A18] placeholder-[#9E978C] focus:outline-none focus:border-[#1C1A18] resize-none"
              />

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <label className="inline-flex items-center gap-2 text-xs font-serif-literary text-[#524D46] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeEmail}
                    onChange={e => setIncludeEmail(e.target.checked)}
                    className="rounded border-[#C8C0B0] text-[#1C1A18] focus:ring-0 cursor-pointer"
                  />
                  <span>
                    {tr(
                      'Dołącz mój e-mail (Include my email)',
                      'Include my email',
                      'Incluir mi correo electrónico',
                      'Inclure mon adresse e-mail'
                    )}
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isSendingFeedback || !feedbackMessage.trim()}
                  className="px-3.5 py-1.5 rounded border border-[#1C1A18] bg-[#1C1A18] hover:bg-[#33302B] disabled:opacity-45 text-[#FAF8F5] text-xs font-mono-meta inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Send className="w-3 h-3" />
                  <span>
                    {isSendingFeedback
                      ? tr('Wysyłanie...', 'Sending...', 'Enviando...', 'Envoi...')
                      : tr('Wyślij', 'Send', 'Enviar', 'Envoyer')}
                  </span>
                </button>
              </div>

              {feedbackSent && (
                <div className="p-2.5 rounded-lg bg-[#EBF2EB] border border-[#CCE2CC] text-xs font-serif-literary text-[#2E5C33] flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {tr(
                      'Dziękujemy! Twoja wiadomość została wysłana.',
                      'Thank you! Your feedback has been sent.',
                      '¡Gracias! Tu mensaje ha sido enviado.',
                      'Merci ! Votre message a bien été envoyé.'
                    )}
                  </span>
                </div>
              )}

              {feedbackError && (
                <div className="p-2.5 rounded-lg bg-[#FDF2F2] border border-[#E8C5C5] text-xs font-serif-literary text-[#8B2635]">
                  {feedbackError}
                </div>
              )}
            </form>
          )}

          {/* 6. Sign Out & Delete Account (or Sign In if guest) */}
          {user ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full py-2 px-3 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-xs font-mono-meta text-[#9E2A2B] transition-colors cursor-pointer"
              >
                {tr('Wyloguj się', 'Sign out', 'Cerrar sesión', 'Se déconnecter')}
              </button>

              {/* Delete Account Section below Sign Out */}
              <div className="pt-4 border-t border-[#ECE7DC] space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-mono-meta uppercase tracking-wider text-[#8B2635]">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {tr('Usuń konto', 'Delete account', 'Eliminar cuenta', 'Supprimer le compte')}
                  </span>
                </div>

                <p className="text-xs font-serif-literary text-[#6E675F] leading-relaxed">
                  {tr(
                    'Usunięcie konta bezpowrotnie skasuje Twój profil użytkownika, wszystkie zaszyfrowane wpisy w dzienniku, klucze szyfrowania oraz wszystkie utworzone przez Ciebie dane. Przed rozpoczęciem wpisz ponownie swój adres e-mail.',
                    'Deleting your account permanently removes your user profile, all encrypted journal entries, encryption keys, and all data created by you. Please re-enter your email address below to proceed.',
                    'Eliminar tu cuenta borrará permanentemente tu perfil, todas las entradas cifradas, las claves de cifrado y todos los datos creados por ti. Escribe de nuevo tu correo para confirmar.',
                    'La suppression du compte effacera définitivement votre profil, toutes vos entrées chiffrées, vos clés et toutes vos données. Veuillez ressaisir votre adresse e-mail pour confirmer.'
                  )}
                </p>

                <input
                  type="email"
                  value={confirmEmailInput}
                  onChange={e => setConfirmEmailInput(e.target.value)}
                  placeholder={
                    user.email ||
                    tr('Twój adres e-mail', 'Your email address', 'Tu correo electrónico', 'Votre e-mail')
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#D4CEBF] bg-[#FAF8F5] text-xs font-mono-meta text-[#1C1A18] placeholder-[#ABA497] focus:outline-none focus:border-[#8B2635]"
                />

                {deleteAccountError && (
                  <div className="p-2.5 rounded-lg bg-[#FDF2F2] border border-[#E8C5C5] text-xs font-serif-literary text-[#8B2635]">
                    {deleteAccountError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={!isEmailConfirmedForDeletion || isDeletingAccount}
                  className="w-full py-2 px-3 rounded border border-[#8B2635] text-xs font-mono-meta text-white bg-[#8B2635] hover:bg-[#731D2A] disabled:border-[#DDD6C8] disabled:bg-[#EAE5DA] disabled:text-[#9E978C] disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {isDeletingAccount
                    ? tr(
                        'Usuwanie konta i danych...',
                        'Deleting account and data...',
                        'Eliminando cuenta y datos...',
                        'Suppression du compte et des données...'
                      )
                    : tr(
                        'Usuń konto i wszystkie dane',
                        'Delete account and all data',
                        'Eliminar cuenta y todos los datos',
                        'Supprimer le compte et toutes les données'
                      )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="w-10 h-10 rounded-full bg-[#EAE5DA] flex items-center justify-center text-[#1C1A18] mx-auto">
                <Sparkles className="w-5 h-5" />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-serif-literary text-[#1C1A18]">
                  {tr(
                    'Synchronizuj swój Dziennik',
                    'Sync your Journal',
                    'Sincroniza tu Diario',
                    'Synchronisez votre Journal'
                  )}
                </p>
                <p className="text-xs font-serif-literary text-[#7A756D] leading-relaxed">
                  {tr(
                    'Zaloguj się kontem Google, aby Twoje zaszyfrowane wpisy były bezpiecznie zsynchronizowane na wszystkich Twoich urządzeniach.',
                    'Sign in with Google so your encrypted entries stay safely synced across all your devices.',
                    'Inicia sesión con Google para sincronizar de forma segura tus entradas cifradas en todos tus dispositivos.',
                    'Connectez-vous avec Google pour synchroniser vos entrées chiffrées en toute sécurité sur tous vos appareils.'
                  )}
                </p>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-1.5 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-2.5 px-4 text-xs font-mono-meta text-[#FAF8F5] bg-[#1C1A18] border border-[#1C1A18] rounded hover:bg-[#33302B] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {loading
                    ? tr('Łączenie...', 'Connecting...', 'Conectando...', 'Connexion...')
                    : tr(
                        'Zaloguj przez Google',
                        'Sign in with Google',
                        'Iniciar sesión con Google',
                        'Se connecter avec Google'
                      )}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


