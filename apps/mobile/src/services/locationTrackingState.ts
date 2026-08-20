export type LocationBroadcastState = {
  state: 'idle' | 'requesting' | 'active' | 'error';
  lastPingAt: string | null;
  message: string;
};

export { getBackgroundTrackingSnapshot } from './backgroundLocation';
