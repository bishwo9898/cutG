export const clerkErrorMessage = (error: unknown, fallback: string): string => {
  const clerkError = error as
    | { errors?: Array<{ message?: string; longMessage?: string }> }
    | null;
  const firstError = clerkError?.errors?.[0];
  return firstError?.longMessage ?? firstError?.message ?? fallback;
};
