import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const verifyPassword = async (password: string, passwordHash: string): Promise<boolean> => {
  if (passwordHash.trim() === '') {
    return false;
  }

  try {
    return await bcrypt.compare(password, passwordHash);
  } catch {
    return false;
  }
};
