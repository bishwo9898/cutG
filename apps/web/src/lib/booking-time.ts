export const combineSlotDateTime = (date: string, time: string): Date => {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(`${date}T00:00:00`);
  result.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return result;
};

export const addMinutes = (date: Date, minutes: number): Date => {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
};

export const slotStartsAt = (date: string, time: string): Date => combineSlotDateTime(date, time);

export const slotEndsAt = (date: string, time: string): Date => combineSlotDateTime(date, time);

export const appointmentEndsAt = (date: string, startTime: string, durationMinutes: number): Date =>
  addMinutes(slotStartsAt(date, startTime), durationMinutes);

export const travelLeadStartsAt = (date: string, startTime: string, travelMinutes: number): Date =>
  addMinutes(slotStartsAt(date, startTime), -travelMinutes);

export const formatShortDate = (date: Date): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(date);

export const formatClockTime = (date: Date): string =>
  new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

export const formatTimeRange = (start: Date, end: Date): string =>
  `${formatClockTime(start)} - ${formatClockTime(end)}`;
