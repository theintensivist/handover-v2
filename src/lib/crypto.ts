/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Helper to convert array buffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert base64 to array buffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper to derive a Key from passphrase using PBKDF2
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts plain text using a password with AES-GCM-256.
 * Returns a serialized JSON string containing the salt, IV, and ciphertext.
 */
export async function encryptData(plainText: string, passphrase: string): Promise<string> {
  if (!plainText) return "";
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(passphrase, salt);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    enc.encode(plainText)
  );

  // Package salt, iv, and ciphertext together
  const combined = {
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(encrypted)
  };
  return JSON.stringify(combined);
}

/**
 * Decrypts a serialized AES-GCM-256 string back to plain text.
 * Returns a descriptive error message if decryption fails.
 */
export async function decryptData(encryptedString: string, passphrase: string): Promise<string> {
  if (!encryptedString) return "";
  try {
    const parsed = JSON.parse(encryptedString);
    if (!parsed.salt || !parsed.iv || !parsed.ciphertext) {
      return "[Undecryptable / Corrupt Data]";
    }
    const salt = new Uint8Array(base64ToArrayBuffer(parsed.salt));
    const iv = new Uint8Array(base64ToArrayBuffer(parsed.iv));
    const ciphertext = base64ToArrayBuffer(parsed.ciphertext);

    const key = await deriveKey(passphrase, salt);
    const dec = new TextDecoder();
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );
    return dec.decode(decrypted);
  } catch (error) {
    console.warn("Client-side decryption failed: Passport key or passphrase does not match record.");
    return "[Incorrect Passphrase / Decryption Failed]";
  }
}
