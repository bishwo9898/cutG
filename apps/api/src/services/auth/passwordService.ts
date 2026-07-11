import { compare, hash } from 'bcrypt';

const SALT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return hash(password, SALT_ROUNDS);
};

export const verifyPassword = async (password: string, passwordHash: string): Promise<boolean> => {
  if (passwordHash.trim() === '') {
    return false;
  }

  try {
    return await compare(password, passwordHash);
  } catch {
    return false;
  }
};
