export type GeneratedTimeSlot = { startTime: string; endTime: string };

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

const toTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export const generateDaySlots = (
  startTime: string,
  endTime: string,
  slotDurationMinutes: number,
): GeneratedTimeSlot[] => {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const slots: GeneratedTimeSlot[] = [];

  for (let current = start; current + slotDurationMinutes <= end; current += slotDurationMinutes) {
    slots.push({
      startTime: toTime(current),
      endTime: toTime(current + slotDurationMinutes),
    });
  }

  return slots;
};

export const addDaysToDate = (date: string, days: number): string => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export const datesBetween = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  for (let date = startDate; date <= endDate; date = addDaysToDate(date, 1)) dates.push(date);
  return dates;
};

export const isoDayOfWeek = (date: string): number => {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
};

export const dayName = (day: number): string =>
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day - 1] ??
  'Unknown';
