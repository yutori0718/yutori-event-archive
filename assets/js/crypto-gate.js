// チーム詳細のパスワード保護:
// PBKDF2でパスワードから鍵を作り、AES-GCMで暗号化/復号する。
// パスワードが違うと復号に失敗するので、平文はサーバーなしで安全に守れる。

const PBKDF2_ITERATIONS = 150000;

export async function encryptWithPassword(password, plainObject) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(plainObject));
  const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    passwordSalt: toBase64(salt),
    passwordIv: toBase64(iv),
    passwordCipher: toBase64(new Uint8Array(cipherBuffer)),
  };
}

export async function decryptWithPassword(password, record) {
  const salt = fromBase64(record.passwordSalt);
  const iv = fromBase64(record.passwordIv);
  const key = await deriveKey(password, salt);
  const cipherBytes = fromBase64(record.passwordCipher);
  const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBytes);
  return JSON.parse(new TextDecoder().decode(plainBuffer));
}

// チーム詳細向けの名前付きラッパー（意味のわかりやすさのため）
export const encryptTeamDetail = encryptWithPassword;
export const decryptTeamDetail = decryptWithPassword;

async function deriveKey(password, salt) {
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

function toBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(base64) {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}
