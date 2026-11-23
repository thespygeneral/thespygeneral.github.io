// All encryption uses the browser's built-in Web Crypto (no third-party crypto code).
//   - A random 256-bit "data key" encrypts every trade, list and screenshot with AES-GCM.
//   - That data key is itself locked ("wrapped") twice: once by a key made from the member's passcode,
//     once by a key made from their recovery code. Either one can unlock; neither is ever stored.
//   - PBKDF2-SHA256 with 600,000 rounds makes guessing a passcode slow (OWASP 2023 guidance).

export const PBKDF2_ITERATIONS = 600_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

export function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function newDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function keyFromSecret(secret: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(secret.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"]
  );
}

export type WrappedKey = { salt: string; iv: string; wrapped: string; iterations: number };

export async function wrapDataKey(dataKey: CryptoKey, secret: string): Promise<WrappedKey> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const kek = await keyFromSecret(secret, salt, PBKDF2_ITERATIONS);
  const wrapped = await crypto.subtle.wrapKey("raw", dataKey, kek, { name: "AES-GCM", iv });
  return { salt: toB64(salt), iv: toB64(iv), wrapped: toB64(wrapped), iterations: PBKDF2_ITERATIONS };
}

/** Returns the data key, or null if the passcode/recovery code is wrong (AES-GCM authentication fails). */
export async function unwrapDataKey(w: WrappedKey, secret: string): Promise<CryptoKey | null> {
  try {
    const kek = await keyFromSecret(secret, fromB64(w.salt), w.iterations);
    return await crypto.subtle.unwrapKey(
      "raw",
      fromB64(w.wrapped),
      kek,
      { name: "AES-GCM", iv: fromB64(w.iv) },
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  } catch {
    return null;
  }
}

export type Sealed = { iv: Uint8Array<ArrayBuffer>; ct: ArrayBuffer };

export async function sealBytes(key: CryptoKey, bytes: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<Sealed> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return { iv, ct };
}

export async function openBytes(key: CryptoKey, s: Sealed): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: s.iv }, key, s.ct);
}

export async function sealJson(key: CryptoKey, value: unknown): Promise<Sealed> {
  return sealBytes(key, enc.encode(JSON.stringify(value)));
}

export async function openJson<T>(key: CryptoKey, s: Sealed): Promise<T> {
  return JSON.parse(dec.decode(await openBytes(key, s))) as T;
}

// Recovery code: 20 characters from an alphabet without look-alikes (no 0/O, 1/I/L), ~100 bits.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newRecoveryCode(): string {
  // Rejection sampling so every character is equally likely (no modulo bias).
  const limit = 256 - (256 % ALPHABET.length);
  const chars: string[] = [];
  while (chars.length < 20) {
    for (const b of randomBytes(32)) {
      if (b < limit && chars.length < 20) chars.push(ALPHABET[b % ALPHABET.length]);
    }
  }
  return [0, 5, 10, 15].map((i) => chars.slice(i, i + 5).join("")).join("-");
}

/** Accepts the code however the member types it (lower-case, missing dashes, spaces). */
export function normalizeRecoveryCode(input: string): string {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return [0, 5, 10, 15].map((i) => clean.slice(i, i + 5)).filter(Boolean).join("-");
}
