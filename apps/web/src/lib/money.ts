export const formatPrice = (value: number | string | null | undefined): string => {
  const amount = typeof value === 'string' ? Number.parseFloat(value) : (value ?? 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
};
