export const clerkErrorMessage = (error: unknown, fallback: string): string => {
  const clerkError = error as { errors?: Array<{ message?: string }> } | null;
  return clerkError?.errors?.[0]?.message ?? fallback;
};
