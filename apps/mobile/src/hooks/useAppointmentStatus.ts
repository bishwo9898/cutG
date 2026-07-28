import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import { mobileApi } from '@/lib/apiClient';
import type { AppointmentTimeline } from '@/lib/types';

const activeTravelStatuses = ['CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'];

export const useAppointmentStatus = (appointmentId: string): UseQueryResult<AppointmentTimeline> =>
  useQuery({
    queryKey: ['appointments', 'status-updates', appointmentId],
    queryFn: () => mobileApi.client.appointmentStatusUpdates(appointmentId),
    enabled: appointmentId.length > 0,
    refetchInterval: (query) => {
      const timeline = query.state.data;
      if (timeline === undefined || !activeTravelStatuses.includes(timeline.currentStatus)) {
        return false;
      }
      return timeline.currentStatus === 'ON_THE_WAY' ? 5_000 : 10_000;
    },
  });
