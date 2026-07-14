import { z } from 'zod';

export const HairDesignCategorySchema = z.enum(['haircut', 'beard', 'color']);

export const CreateHairDesignSchema = z.object({
  styleName: z.string().trim().min(1).max(100),
  styleCategory: HairDesignCategorySchema,
  description: z.string().trim().max(2000).optional(),
  sourcePhotoUrl: z.string().url().max(2000).optional(),
});
export type CreateHairDesignRequest = z.infer<typeof CreateHairDesignSchema>;

export const HairDesignParamsSchema = z.object({ designId: z.string().uuid() });
export const AttachHairDesignSchema = z.object({ appointmentId: z.string().uuid() });
