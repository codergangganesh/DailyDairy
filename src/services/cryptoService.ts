// Web Crypto API based E2E Encryption Service
// Using PBKDF2 for key derivation and AES-256-GCM for encryption

// Helper to convert Uint8Array to Base64
export function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binString);
}

// Helper to convert Base64 to Uint8Array
export function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(binString, (char) => char.charCodeAt(0));
}

// Helper to convert string to Uint8Array
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Helper to convert Uint8Array to string
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// Generate random bytes (e.g. for IV or Salt)
export function generateRandomBytes(length: number): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(length));
}

// Derive a cryptographic key from a password using PBKDF2
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<CryptoKey> {
  const passwordBytes = stringToBytes(password);

  // Import the raw password as key-producing material
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBytes.buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive the AES-GCM key
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Generate a random 256-bit symmetric Master Key for entries
export async function generateMasterKey(): Promise<CryptoKey> {
  return window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  ) as Promise<CryptoKey>;
}

// Export a CryptoKey to a Base64 string
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return bytesToBase64(new Uint8Array(exported));
}

// Import a CryptoKey from a Base64 string
export async function importKeyFromBase64(base64Key: string): Promise<CryptoKey> {
  const keyBytes = base64ToBytes(base64Key);
  return window.crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    'AES-GCM',
    true,
    ['encrypt', 'decrypt']
  );
}

// Encrypt plaintext with a CryptoKey (AES-256-GCM)
export async function encryptWithKey(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const iv = generateRandomBytes(12); // GCM standard IV is 12 bytes
  const plaintextBytes = stringToBytes(plaintext);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    plaintextBytes.buffer as ArrayBuffer
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
    iv: bytesToBase64(iv),
    salt: '',
  };
}

// Decrypt ciphertext with a CryptoKey (AES-256-GCM)
export async function decryptWithKey(
  ciphertext: string,
  key: CryptoKey,
  ivBase64: string
): Promise<string> {
  const ciphertextBytes = base64ToBytes(ciphertext);
  const iv = base64ToBytes(ivBase64);

  const plaintextBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ciphertextBytes.buffer as ArrayBuffer
  );

  return bytesToString(new Uint8Array(plaintextBuffer));
}

// Hash a password/answer using PBKDF2 (for verification)
export async function hashPasswordForVerification(
  password: string,
  saltBase64: string
): Promise<string> {
  const salt = base64ToBytes(saltBase64);
  const key = await deriveKeyFromPassword(password, salt, 50000);
  return exportKeyToBase64(key);
}

// Encrypt the Master Key with a derived key (from password or recovery answer)
export async function wrapMasterKey(
  masterKey: CryptoKey,
  derivedKey: CryptoKey
): Promise<{ encryptedKey: string; iv: string }> {
  const masterKeyBuffer = await window.crypto.subtle.exportKey('raw', masterKey);
  const iv = generateRandomBytes(12);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    derivedKey,
    masterKeyBuffer
  );

  return {
    encryptedKey: bytesToBase64(new Uint8Array(encryptedBuffer)),
    iv: bytesToBase64(iv),
  };
}

// Decrypt the Master Key with a derived key
export async function unwrapMasterKey(
  encryptedKeyBase64: string,
  derivedKey: CryptoKey,
  ivBase64: string
): Promise<CryptoKey> {
  const encryptedKeyBytes = base64ToBytes(encryptedKeyBase64);
  const iv = base64ToBytes(ivBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    derivedKey,
    encryptedKeyBytes.buffer as ArrayBuffer
  );

  return window.crypto.subtle.importKey(
    'raw',
    decryptedBuffer,
    'AES-GCM',
    true,
    ['encrypt', 'decrypt']
  );
}
