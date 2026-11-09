import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  Auth,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import firebaseAppletConfig from '../../firebase-applet-config.json';

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};

const rawApiKey = (env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey || '').trim();
export const hasValidFirebaseApiKey = Boolean(rawApiKey && rawApiKey.length > 10);

// Use a syntactically valid placeholder key when VITE_FIREBASE_API_KEY is not injected in preview
// so Firebase SDK initialization (getAuth / getFirestore) never crashes the app at import time.
const safeInitApiKey = hasValidFirebaseApiKey
  ? rawApiKey
  : 'AIzaSyPreviewPlaceholderKeyForLocalUI00000';

export const resolvedFirebaseConfig = {
  ...firebaseAppletConfig,
  apiKey: safeInitApiKey,
  projectId: (env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId || '').trim(),
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain || '').trim(),
  firestoreDatabaseId: (
    env.VITE_FIREBASE_DATABASE_ID ||
    firebaseAppletConfig.firestoreDatabaseId ||
    ''
  ).trim(),
  storageBucket: (
    env.VITE_FIREBASE_STORAGE_BUCKET ||
    firebaseAppletConfig.storageBucket ||
    ''
  ).trim(),
  messagingSenderId: (
    env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    firebaseAppletConfig.messagingSenderId ||
    ''
  ).trim(),
  appId: (env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId || '').trim(),
};

const app = getApps().length > 0 ? getApp() : initializeApp(resolvedFirebaseConfig);

// Critical: getFirestore with firestoreDatabaseId
export const db = getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId);

// Enable local IndexedDB persistence so past journal entries are available offline when browsing the archive
if (typeof window !== 'undefined' && hasValidFirebaseApiKey) {
  enableIndexedDbPersistence(db).catch((err: { code?: string }) => {
    if (err.code === 'failed-precondition') {
      console.warn(
        'Firestore IndexedDB persistence failed: multiple tabs open, persistence can only be enabled in one tab at a time.'
      );
    } else if (err.code === 'unimplemented') {
      console.warn(
        'Firestore IndexedDB persistence is not supported by the current browser environment.'
      );
    }
  });
}

let authInstance: Auth | null = null;
try {
  authInstance = getAuth(app);
} catch (err) {
  console.warn('Firebase Auth initialized in preview fallback mode:', err);
}

export const auth = authInstance as Auth;
export const googleProvider = new GoogleAuthProvider();

export function subscribeToAuthChanges(
  callback: (user: FirebaseUser | null) => void
): () => void {
  if (!hasValidFirebaseApiKey || !authInstance) {
    // Immediately resolve as signed-out guest so the preview loads without delay or error
    queueMicrotask(() => callback(null));
    return () => {};
  }
  try {
    return onAuthStateChanged(authInstance, callback, err => {
      console.warn('Auth state listener warning:', err);
      callback(null);
    });
  } catch {
    queueMicrotask(() => callback(null));
    return () => {};
  }
}

export function formatFirebaseAuthError(
  err: unknown,
  lang: 'pl' | 'en' | 'es' | 'fr' = 'pl'
): string {
  const rawMsg = err instanceof Error ? err.message : String(err || '');
  const code = (err as { code?: string })?.code || '';
  const hostname =
    typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : 'yourmoments.vercel.app';
  const projectId = resolvedFirebaseConfig.projectId || 'gen-lang-client-0751515487';

  if (code === 'auth/unauthorized-domain' || rawMsg.includes('auth/unauthorized-domain')) {
    if (lang === 'en') {
      return `Domain "${hostname}" is not authorized in Firebase Auth yet. Go to Firebase Console → Authentication → Settings → Authorized domains (project: ${projectId}) and add "${hostname}".`;
    }
    if (lang === 'es') {
      return `El dominio "${hostname}" aún no está autorizado en Firebase Auth. Ve a Firebase Console → Authentication → Settings → Authorized domains y añade "${hostname}".`;
    }
    if (lang === 'fr') {
      return `Le domaine "${hostname}" n'est pas encore autorisé dans Firebase Auth. Allez dans Firebase Console → Authentication → Settings → Authorized domains et ajoutez "${hostname}".`;
    }
    return `Domena „${hostname}” nie jest jeszcze dodana do autoryzowanych domen w Firebase. Wejdź w Firebase Console → Authentication → Settings → Authorized domains (projekt: ${projectId}) i dodaj „${hostname}”.`;
  }

  if (
    rawMsg.includes('API_KEY_HTTP_REFERRER_BLOCKED') ||
    rawMsg.includes('Requests from referer')
  ) {
    if (lang === 'en') {
      return `Domain "https://${hostname}/*" is blocked by Google Cloud API Key Website Restrictions. Add "https://${hostname}/*" in Google Cloud Console → APIs & Services → Credentials → Browser key.`;
    }
    return `Domena „https://${hostname}/*” jest zablokowana w ograniczeniach klucza API (Website restrictions). Dopisz „https://${hostname}/*” w Google Cloud Console → APIs & Services → Credentials → Browser key.`;
  }

  if (
    code === 'auth/invalid-api-key' ||
    code === 'auth/api-key-not-valid' ||
    rawMsg.includes('api-key-not-valid') ||
    rawMsg.includes('invalid-api-key') ||
    !hasValidFirebaseApiKey
  ) {
    if (lang === 'en') {
      return 'Preview mode (VITE_FIREBASE_API_KEY not set in this environment). You can test the full interface right here using the preview button!';
    }
    return 'Tryb podglądu (brak klucza VITE_FIREBASE_API_KEY w tym środowisku). Możesz przetestować pełny interfejs po zalogowaniu klikając „Podgląd aplikacji”!';
  }

  return rawMsg;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test initial connection to Firestore
export async function testFirestoreConnection() {
  if (!hasValidFirebaseApiKey) {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or connecting.');
    }
  }
}

export { signInWithPopup, signOut };

