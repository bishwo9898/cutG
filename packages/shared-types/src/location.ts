import { z } from 'zod';

export const LocationPingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(100_000).optional(),
  headingDegrees: z.number().min(0).max(360).optional(),
  speedMs: z.number().min(0).max(500).optional(),
});
export type LocationPingRequest = z.infer<typeof LocationPingSchema>;

export const TrackingAppointmentParamsSchema = z.object({ appointmentId: z.string().uuid() });
