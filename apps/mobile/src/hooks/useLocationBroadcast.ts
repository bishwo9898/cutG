import { useEffect, useState } from 'react';

import {
  getBackgroundTrackingSnapshot,
  type LocationBroadcastState,
} from '@/services/locationTrackingState';

const idleState: LocationBroadcastState = {
  state: 'idle',
  lastPingAt: null,
  message: 'Location sharing starts with the journey.',
};

export const useLocationBroadcast = (
  appointmentId: string,
  status?: string,
): LocationBroadcastState => {
  const [broadcast, setBroadcast] = useState<LocationBroadcastState>(idleState);

  useEffect(() => {
    let cancelled = false;
    const refresh = async (): Promise<void> => {
      if (status !== 'ON_THE_WAY' || appointmentId.length === 0) {
        if (!cancelled) setBroadcast(idleState);
        return;
      }
      const snapshot = await getBackgroundTrackingSnapshot();
      if (cancelled) return;
      if (!snapshot.active || snapshot.appointmentId !== appointmentId) {
        setBroadcast({
          state: 'error',
          lastPingAt: snapshot.lastPingAt,
          message: 'Background sharing is not active. Start or resume the journey again.',
        });
      } else if (snapshot.error !== null) {
        setBroadcast({ state: 'error', lastPingAt: snapshot.lastPingAt, message: snapshot.error });
      } else {
        setBroadcast({
          state: 'active',
          lastPingAt: snapshot.lastPingAt,
          message: 'Live location is reaching the client, including in the background.',
        });
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 3_000);
    return (): void => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [appointmentId, status]);

  return broadcast;
};
