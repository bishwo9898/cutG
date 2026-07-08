import { z } from 'zod';

export const UuidSchema = z.string().uuid();

export const NonEmptyStringSchema = z.string().trim().min(1);

export const MoneyAmountSchema = z.number().positive().multipleOf(0.01);

export const CentsAmountSchema = z.number().int().positive();

export const UsZipCodeSchema = z.string().regex(/^\d{5}(-\d{4})?$/, 'Expected a valid US ZIP code');

export const PhoneNumberSchema = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^[+()\-\s\d]+$/, 'Expected a valid phone number');

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
