import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// Polyfill global.crypto for crypto-js to fix "Native crypto module could not be used"
if (typeof global.crypto !== 'object') {
  (global as any).crypto = {};
}
if (typeof (global as any).crypto.getRandomValues !== 'function') {
  (global as any).crypto.getRandomValues = Crypto.getRandomValues;
}

import CryptoJS from 'crypto-js';
const VAULT_KEY_STORE = 'vault_master_key';
const VAULT_PASSCODE_SALT = 'vault_passcode_salt';

class VaultEncryptionService {
  private masterKey: string | null = null;

  /**
   * Initialize or retrieve the master encryption key from secure store
   */
  async initKey(): Promise<void> {
    let key = await SecureStore.getItemAsync(VAULT_KEY_STORE);
    if (!key) {
      // Generate a new 256-bit key
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      key = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      await SecureStore.setItemAsync(VAULT_KEY_STORE, key);
    }
    this.masterKey = key;
  }

  /**
   * Encrypt a plain text string
   */
  async encrypt(text: string): Promise<string> {
    if (!this.masterKey) await this.initKey();
    if (!this.masterKey) throw new Error('Master key not initialized');
    
    return CryptoJS.AES.encrypt(text, this.masterKey).toString();
  }

  /**
   * Decrypt an encrypted string
   */
  async decrypt(ciphertext: string): Promise<string> {
    if (!this.masterKey) await this.initKey();
    if (!this.masterKey) throw new Error('Master key not initialized');
    
    const bytes = CryptoJS.AES.decrypt(ciphertext, this.masterKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Set a new passcode for the vault
   * Returns the hashed passcode to store in the database
   */
  async setPasscode(passcode: string): Promise<string> {
    // Generate salt if doesn't exist
    let salt = await SecureStore.getItemAsync(VAULT_PASSCODE_SALT);
    if (!salt) {
      const randomBytes = await Crypto.getRandomBytesAsync(16);
      salt = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      await SecureStore.setItemAsync(VAULT_PASSCODE_SALT, salt);
    }

    // Hash passcode with salt
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      passcode + salt
    );
    
    return digest;
  }

  /**
   * Verify the entered passcode against the stored hash
   */
  async verifyPasscode(enteredPasscode: string, storedHash: string): Promise<boolean> {
    const salt = await SecureStore.getItemAsync(VAULT_PASSCODE_SALT);
    if (!salt) return false;

    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      enteredPasscode + salt
    );

    return digest === storedHash;
  }
}

export const vaultEncryptionService = new VaultEncryptionService();
