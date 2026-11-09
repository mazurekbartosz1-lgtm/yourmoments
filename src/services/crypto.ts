/**
 * Zero-Knowledge End-to-End Encryption (E2EE) Service
 * Uses Web Crypto API (AES-GCM 256-bit + PBKDF2 key derivation with SHA-256)
 *
 * All journal entries are encrypted client-side before sending to Firestore.
 * Anyone with direct database access or an intruder will only see scrambled ciphertext.
 */

// Convert ArrayBuffer to Hex string
function bufToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert Hex string to Uint8Array
function hexToBuf(hex: string): Uint8Array {
  const cleanHex = hex.trim();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Derive AES-GCM 256-bit key from passphrase and salt
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedPayload {
  encryptedContent: string;
  iv: string;
  salt: string;
}

/**
 * Encrypt plain text using AES-GCM
 */
export async function encryptText(plainText: string, passphrase: string): Promise<EncryptedPayload> {
  if (!passphrase) {
    throw new Error('Klucz szyfrowania jest wymagany do zapisu.');
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const enc = new TextEncoder();
  const encodedData = enc.encode(plainText);

  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    encodedData
  );

  return {
    encryptedContent: bufToHex(ciphertext),
    iv: bufToHex(iv),
    salt: bufToHex(salt),
  };
}

/**
 * Decrypt ciphertext using AES-GCM
 */
export async function decryptText(
  encryptedContent: string,
  ivHex: string,
  saltHex: string,
  passphrase: string
): Promise<string> {
  if (!passphrase) {
    throw new Error('Wymagany klucz deszyfrujący.');
  }

  const salt = hexToBuf(saltHex);
  const iv = hexToBuf(ivHex);
  const ciphertext = hexToBuf(encryptedContent);
  const key = await deriveKey(passphrase, salt);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    ciphertext as unknown as BufferSource
  );

  const dec = new TextDecoder();
  return dec.decode(decrypted);
}

/**
 * Generates a clean random journal key (e.g. 4 groups of alphanumeric characters)
 */
export function generateJournalKey(): string {
  const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // base32 without easily confused chars (0, O, 1, I)
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += charset[bytes[i] % charset.length];
    if ((i + 1) % 4 === 0 && i !== 15) {
      result += '-';
    }
  }
  return result;
}

const STORAGE_KEY_PREFIX = 'kronika_e2ee_key_';
const STORAGE_KEYRING_PREFIX = 'kronika_e2ee_keyring_';
const STORAGE_PIN_PREFIX = 'kronika_e2ee_pin_';
const STORAGE_DEVICE_NAME_KEY = 'kronika_device_name';
const STORAGE_KEY_DEVICE_PREFIX = 'kronika_key_device_';

export type KeySyncMode = 'auto' | 'pin';

/**
 * Deterministic wrapping passphrase for 'auto' mode (tied to authenticated Google UID)
 */
export function getAutoWrappingPassphrase(userId: string): string {
  return `kronika-cloud-vault-v1::${userId}::e2ee-auto-wrap`;
}

/**
 * Wraps a single journal key using AES-GCM 256 into a compact token: "iv.salt.ciphertext"
 */
export async function wrapSingleKey(rawKey: string, wrappingPassphrase: string): Promise<string> {
  const cleanKey = rawKey.trim();
  const payload = await encryptText(cleanKey, wrappingPassphrase);
  return `${payload.iv}.${payload.salt}.${payload.encryptedContent}`;
}

/**
 * Unwraps a single "iv.salt.ciphertext" token back into a raw journal key
 */
export async function unwrapSingleKey(
  wrappedToken: string,
  wrappingPassphrase: string
): Promise<string | null> {
  if (!wrappedToken || !wrappingPassphrase) return null;
  const parts = wrappedToken.split('.');
  if (parts.length !== 3) return null;
  const [iv, salt, encryptedContent] = parts;
  if (!iv || !salt || !encryptedContent) return null;
  try {
    const raw = await decryptText(encryptedContent, iv, salt, wrappingPassphrase);
    return raw.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Decrypts an entry trying the primary key first, then any historical device keys in the keyring
 */
export async function decryptTextWithKeyring(
  encryptedContent: string,
  ivHex: string,
  saltHex: string,
  primaryKey: string | null,
  keyring: string[] = []
): Promise<{ text: string; matchedKey: string }> {
  const candidates: string[] = [];
  if (primaryKey && primaryKey.trim()) {
    candidates.push(primaryKey.trim());
  }
  for (const k of keyring) {
    const clean = k?.trim();
    if (clean && !candidates.includes(clean)) {
      candidates.push(clean);
    }
  }

  if (candidates.length === 0) {
    throw new Error('Wymagany klucz deszyfrujący.');
  }

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const text = await decryptText(encryptedContent, ivHex, saltHex, candidate);
      return { text, matchedKey: candidate };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Żaden z kluczy nie pasuje do tego wpisu.');
}

/**
 * Automatically detects a human-readable device and browser label (e.g., "Android · Chrome", "MacBook · Safari")
 */
export function detectDefaultDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Przeglądarka Web';
  const ua = navigator.userAgent || '';

  let os = 'Komputer';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Telefon Android';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'MacBook / Mac';
  else if (/Windows/i.test(ua)) os = 'Windows PC';
  else if (/Linux/i.test(ua)) os = 'Linux PC';

  let browser = 'Przeglądarka';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

  return `${os} (${browser})`;
}

export function getStoredDeviceName(): string {
  try {
    const saved = localStorage.getItem(STORAGE_DEVICE_NAME_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
    const detected = detectDefaultDeviceName();
    localStorage.setItem(STORAGE_DEVICE_NAME_KEY, detected);
    return detected;
  } catch {
    return detectDefaultDeviceName();
  }
}

export function saveDeviceName(name: string): string {
  const clean = name.trim().slice(0, 80) || detectDefaultDeviceName();
  try {
    localStorage.setItem(STORAGE_DEVICE_NAME_KEY, clean);
  } catch {
    // ignore storage errors
  }
  return clean;
}

export function getStoredJournalKey(userId: string): string | null {
  return (
    localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`) ||
    sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`)
  );
}

export function getStoredKeyring(userId: string): string[] {
  try {
    const primary = getStoredJournalKey(userId);
    const rawList = localStorage.getItem(`${STORAGE_KEYRING_PREFIX}${userId}`) || '';
    const parts = rawList
      .split('|')
      .map(s => s.trim())
      .filter(Boolean);
    const unique: string[] = [];
    if (primary && primary.trim()) {
      unique.push(primary.trim());
    }
    for (const p of parts) {
      if (!unique.includes(p)) {
        unique.push(p);
      }
    }
    return unique.slice(0, 10);
  } catch {
    const primary = getStoredJournalKey(userId);
    return primary ? [primary] : [];
  }
}

export function saveStoredKeyring(userId: string, keys: string[]): string[] {
  const unique: string[] = [];
  for (const k of keys) {
    const clean = k?.trim();
    if (clean && !unique.includes(clean)) {
      unique.push(clean);
    }
  }
  const bounded = unique.slice(0, 10);
  try {
    localStorage.setItem(`${STORAGE_KEYRING_PREFIX}${userId}`, bounded.join('|'));
  } catch {
    // ignore storage errors
  }
  return bounded;
}

export function getStoredPinPassphrase(userId: string): string | null {
  try {
    return (
      localStorage.getItem(`${STORAGE_PIN_PREFIX}${userId}`) ||
      sessionStorage.getItem(`${STORAGE_PIN_PREFIX}${userId}`)
    );
  } catch {
    return null;
  }
}

export function saveStoredPinPassphrase(userId: string, pin: string | null) {
  try {
    if (!pin) {
      localStorage.removeItem(`${STORAGE_PIN_PREFIX}${userId}`);
      sessionStorage.removeItem(`${STORAGE_PIN_PREFIX}${userId}`);
    } else {
      localStorage.setItem(`${STORAGE_PIN_PREFIX}${userId}`, pin.trim());
    }
  } catch {
    // ignore storage errors
  }
}

export function getKeyDeviceName(userId: string): string {
  try {
    return localStorage.getItem(`${STORAGE_KEY_DEVICE_PREFIX}${userId}`) || getStoredDeviceName();
  } catch {
    return getStoredDeviceName();
  }
}

export function saveJournalKey(
  userId: string,
  key: string,
  persist: boolean = true,
  deviceName?: string
) {
  const cleanKey = key.trim();
  const dev = (deviceName || getStoredDeviceName()).slice(0, 80);
  if (persist) {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, cleanKey);
    localStorage.setItem(`${STORAGE_KEY_DEVICE_PREFIX}${userId}`, dev);
  } else {
    sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, cleanKey);
    sessionStorage.setItem(`${STORAGE_KEY_DEVICE_PREFIX}${userId}`, dev);
  }
  const existingRing = getStoredKeyring(userId);
  saveStoredKeyring(userId, [cleanKey, ...existingRing]);
}

export function clearJournalKey(userId: string) {
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${userId}`);
  sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${userId}`);
}

/**
 * Generates a random 4-digit numeric PIN for one-time message sharing (e.g. "4829")
 */
export function generateSharePin(): string {
  const bytes = window.crypto.getRandomValues(new Uint8Array(4));
  let pin = '';
  for (let i = 0; i < 4; i++) {
    // Avoid leading zero for clean 4-digit display if desired, or allow 0-9
    const digit = i === 0 ? (bytes[i] % 9) + 1 : bytes[i] % 10;
    pin += String(digit);
  }
  return pin;
}

/**
 * Computes SHA-256 verifier hash of (pin + "::" + saltHex) so the server can verify PIN correctness
 * before atomically burning the one-time ciphertext without ever knowing the raw PIN.
 */
export async function computePinVerifierHash(pin: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`momenty-share-v1::${pin.trim()}::${saltHex.trim()}`);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return bufToHex(digest);
}


