import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Hashes a plaintext password with BCrypt (cost factor 12)
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

/**
 * Compares plaintext password against BCrypt hash
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Computes SHA-256 hash for secure token storage in database
 */
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generates a cryptographically secure random token string
 */
export const generateSecureRandomString = (bytes = 32): string => {
  return crypto.randomBytes(bytes).toString('hex');
};
