/**
 * Lightweight Web Push sender using only Web Crypto API.
 * Works on Vercel Edge Runtime (no Node.js crypto needed).
 *
 * Implements RFC 8291 (Message Encryption for Web Push)
 * and RFC 8292 (VAPID) using the Web Crypto API.
 */

// ── helpers ──────────────────────────────────────────────────────────
function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ── VAPID JWT ────────────────────────────────────────────────────────
async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  expSeconds = 12 * 3600
): Promise<string> {
  const header = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({ aud: audience, exp: now + expSeconds, sub: subject })
    )
  );
  const unsigned = `${header}.${payload}`;

  // Import VAPID private key (base64url-encoded raw 32-byte key)
  const rawKey = base64UrlDecode(privateKeyBase64);
  // ECDSA P-256 private key in JWK format
  const publicKeyRaw = await derivePublicKey(rawKey);
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: base64UrlEncode(rawKey),
    x: base64UrlEncode(publicKeyRaw.slice(1, 33)),
    y: base64UrlEncode(publicKeyRaw.slice(33, 65)),
  };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(unsigned)
    )
  );

  // WebCrypto returns DER-encoded signature, convert to raw r||s (64 bytes)
  const rawSig = derToRaw(sig);
  return `${unsigned}.${base64UrlEncode(rawSig)}`;
}

/** Convert DER ECDSA signature to raw 64-byte r||s */
function derToRaw(der: Uint8Array): Uint8Array {
  // If already 64 bytes, it's raw
  if (der.length === 64) return der;

  // DER: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
  let offset = 2; // skip 0x30 <len>
  offset += 1; // skip 0x02
  const rLen = der[offset++];
  const r = der.slice(offset, offset + rLen);
  offset += rLen;
  offset += 1; // skip 0x02
  const sLen = der[offset++];
  const s = der.slice(offset, offset + sLen);

  // Pad/trim to 32 bytes each
  const raw = new Uint8Array(64);
  raw.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
  raw.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  return raw;
}

/** Derive uncompressed public key (65 bytes) from raw 32-byte private key */
async function derivePublicKey(privateKeyRaw: Uint8Array): Promise<Uint8Array> {
  // Import as ECDH to derive public key via key export
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  // Export the generated private key to get format, then re-import ours
  const genJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  genJwk.d = base64UrlEncode(privateKeyRaw);

  // Re-import with our private key
  const ourKey = await crypto.subtle.importKey(
    'jwk',
    genJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // Export as JWK to get x,y
  const ourJwk = await crypto.subtle.exportKey('jwk', ourKey);
  const x = base64UrlDecode(ourJwk.x!);
  const y = base64UrlDecode(ourJwk.y!);

  // Uncompressed point: 0x04 || x || y
  return concat(new Uint8Array([0x04]), x, y);
}

// ── RFC 8291 Encryption ──────────────────────────────────────────────
async function encryptPayload(
  plaintext: Uint8Array,
  subscriptionPublicKey: Uint8Array, // 65 bytes, uncompressed
  authSecret: Uint8Array // 16 bytes
): Promise<{ ciphertext: Uint8Array; localPublicKey: Uint8Array; salt: Uint8Array }> {
  // Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // Export local public key (uncompressed)
  const localPubRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPubRaw);

  // Import subscription public key
  const subPubKey = await crypto.subtle.importKey(
    'raw',
    subscriptionPublicKey.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: subPubKey },
      localKeyPair.privateKey,
      256
    )
  );

  // Generate salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF to derive key material
  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" || client_pub || server_pub, 32)
  const authInfo = concat(
    new TextEncoder().encode('WebPush: info\0'),
    subscriptionPublicKey,
    localPublicKey
  );

  const ikm = await hkdf(authSecret, sharedSecret, authInfo, 32);

  // Content encryption key: HKDF(salt, ikm, "Content-Encoding: aes128gcm\0", 16)
  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const cek = await hkdf(salt, ikm, cekInfo, 16);

  // Nonce: HKDF(salt, ikm, "Content-Encoding: nonce\0", 12)
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // Pad plaintext: content || 0x02 (delimiter for aes128gcm)
  const padded = concat(plaintext, new Uint8Array([2]));

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    'raw',
    cek.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce.buffer as ArrayBuffer },
      aesKey,
      padded.buffer as ArrayBuffer
    )
  );

  // Build aes128gcm payload: salt(16) || rs(4) || idlen(1) || keyid(65) || encrypted
  const rs = new Uint8Array([0, 0, 16, 0]); // record size = 4096
  const idlen = new Uint8Array([65]); // length of keyid (uncompressed point)

  const ciphertext = concat(salt, rs, idlen, localPublicKey, encrypted);

  return { ciphertext, localPublicKey, salt };
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm.buffer as ArrayBuffer, { name: 'HKDF' }, false, [
    'deriveBits',
  ]);

  const hkdfParams: HkdfParams = {
    name: 'HKDF',
    hash: 'SHA-256',
    salt: salt.buffer as ArrayBuffer,
    info: info.buffer as ArrayBuffer,
  };

  return new Uint8Array(await crypto.subtle.deriveBits(hkdfParams, key, length * 8));
}

// ── Public API ───────────────────────────────────────────────────────
export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string; // base64url
    auth: string; // base64url
  };
  expirationTime?: number | null;
}

export interface SendResult {
  success: boolean;
  status?: number;
  statusText?: string;
}

/**
 * Send a Web Push notification using only Web Crypto API.
 */
export async function sendWebPush(
  subscription: PushSubscription,
  payload: string,
  vapidPublicKey: string, // base64url
  vapidPrivateKey: string, // base64url
  vapidContact: string // mailto:...
): Promise<SendResult> {
  const endpoint = subscription.endpoint;
  const audience = new URL(endpoint).origin;

  // Create VAPID Authorization header
  const jwt = await createVapidJwt(audience, vapidContact, vapidPrivateKey);
  const vapidAuth = `vapid t=${jwt}, k=${vapidPublicKey}`;

  // Encrypt payload
  const subPublicKey = base64UrlDecode(subscription.keys.p256dh);
  const authSecret = base64UrlDecode(subscription.keys.auth);
  const plaintext = new TextEncoder().encode(payload);

  const { ciphertext } = await encryptPayload(plaintext, subPublicKey, authSecret);

  // Send to push service
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': vapidAuth,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
      'Urgency': 'normal',
    },
    body: ciphertext.buffer as ArrayBuffer,
  });

  return {
    success: response.status >= 200 && response.status < 300,
    status: response.status,
    statusText: response.statusText,
  };
}
