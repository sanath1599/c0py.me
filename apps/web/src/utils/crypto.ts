// RSA key management utilities for secure file transmission

const KEY_STORAGE_KEY = 'sharedrop_rsa_keypair';

export async function generateRSAKeyPair() {
  return window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function exportPublicKeyPEM(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('spki', key);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  return `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
}

export async function importPublicKey(pem: string): Promise<CryptoKey> {
  const base64 = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
  const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    'spki',
    binary,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
}

export async function exportPrivateKeyJWK(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(exported);
}

export async function importPrivateKey(jwk: string): Promise<CryptoKey> {
  const keyData = JSON.parse(jwk);
  return window.crypto.subtle.importKey(
    'jwk',
    keyData,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );
}

export async function saveKeyPairToStorage(publicKey: CryptoKey, privateKey: CryptoKey) {
  const publicKeyPem = await exportPublicKeyPEM(publicKey);
  const privateKeyJwk = await exportPrivateKeyJWK(privateKey);
  
  localStorage.setItem(KEY_STORAGE_KEY, JSON.stringify({
    publicKeyPem,
    privateKeyJwk,
  }));
}

export async function loadKeyPairFromStorage(): Promise<{publicKey: CryptoKey, privateKey: CryptoKey, publicKeyPem: string} | null> {
  const stored = localStorage.getItem(KEY_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    const { publicKeyPem, privateKeyJwk } = JSON.parse(stored);
    const publicKey = await importPublicKey(publicKeyPem);
    const privateKey = await importPrivateKey(privateKeyJwk);
    
    return { publicKey, privateKey, publicKeyPem };
  } catch (error) {
    console.error('Failed to load key pair from storage:', error);
    localStorage.removeItem(KEY_STORAGE_KEY);
    return null;
  }
}

export async function getOrCreateRSAKeyPair(): Promise<{publicKey: CryptoKey, privateKey: CryptoKey, publicKeyPem: string}> {
  const existing = await loadKeyPairFromStorage();
  if (existing) return existing;
  
  const { publicKey, privateKey } = await generateRSAKeyPair();
  const publicKeyPem = await exportPublicKeyPEM(publicKey);
  
  await saveKeyPairToStorage(publicKey, privateKey);
  
  return { publicKey, privateKey, publicKeyPem };
}

// AES key helpers
export async function generateAESKey() {
  return window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function exportAESKey(key: CryptoKey): Promise<ArrayBuffer> {
  return window.crypto.subtle.exportKey('raw', key);
}

export async function importAESKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptWithPublicKey(data: ArrayBuffer, publicKey: CryptoKey): Promise<ArrayBuffer> {
  return window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    data
  );
}

export async function decryptWithPrivateKey(data: ArrayBuffer, privateKey: CryptoKey): Promise<ArrayBuffer> {
  return window.crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    data
  );
}

export async function encryptChunk(chunk: ArrayBuffer, aesKey: CryptoKey): Promise<{iv: Uint8Array, ciphertext: ArrayBuffer}> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    chunk
  );
  return { iv, ciphertext };
}

export async function decryptChunk(ciphertext: ArrayBuffer, iv: Uint8Array, aesKey: CryptoKey): Promise<ArrayBuffer> {
  return window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );
} 