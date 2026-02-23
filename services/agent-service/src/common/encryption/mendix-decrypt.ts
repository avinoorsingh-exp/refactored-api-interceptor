import { createDecipheriv, createHash } from 'node:crypto';

const AES3_PREFIX = '{AES3}';

/**
 * Decrypt Mendix AES-128-CBC `{AES3}` format.
 *
 * The Buffer may contain UTF-8 text starting with `{AES3}` followed by
 * base64(IV || ciphertext), raw plaintext, or null.
 * Returns null on any failure — never throws.
 *
 * NOTE: Exact Mendix key derivation must be verified against dev data (P5-2).
 * Initial implementation uses MD5-derived AES-128-CBC key.
 */
export function decryptMendixV0(ciphertext: Buffer, passphrase: string): string | null {
	try {
		const text = ciphertext.toString('utf8');

		// If no {AES3} prefix, treat as raw plaintext (pre-encryption legacy data)
		if (!text.startsWith(AES3_PREFIX)) {
			return text || null;
		}

		const b64 = text.slice(AES3_PREFIX.length);
		const raw = Buffer.from(b64, 'base64');

		// AES-128-CBC: 16-byte IV followed by ciphertext
		if (raw.length < 17) return null;

		const iv = raw.subarray(0, 16);
		const encrypted = raw.subarray(16);

		// Mendix derives a 16-byte key via MD5 of the passphrase
		const key = createHash('md5').update(passphrase).digest();

		const decipher = createDecipheriv('aes-128-cbc', key, iv);
		const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

		return decrypted.toString('utf8');
	} catch {
		return null;
	}
}
