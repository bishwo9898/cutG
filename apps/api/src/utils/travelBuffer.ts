const MINUTES_PER_DAY = 24 * 60;

export const calculateTravelBufferSlots = (
  travelMinutes: number,
  slotDurationMinutes: number,
): number => {
  if (travelMinutes <= 0) return 0;
  if (slotDurationMinutes <= 0) throw new Error('Slot duration must be greater than zero.');
  return Math.min(Math.ceil(travelMinutes / slotDurationMinutes), 4);
};

const addDays = (date: string, amount: number): string => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
};

const formatTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export const getTravelBufferSlotTimes = (
  appointmentDate: string,
  appointmentStartTime: string,
  bufferCount: number,
  slotDurationMinutes: number,
): Array<{ date: string; startTime: string; endTime: string }> => {
  if (bufferCount <= 0) return [];
  const [hours, minutes] = appointmentStartTime.split(':').map(Number);
  if (hours === undefined || minutes === undefined || slotDurationMinutes <= 0) {
    throw new Error('Invalid appointment time or slot duration.');
  }

  const appointmentMinutes = hours * 60 + minutes;
  return Array.from({ length: bufferCount }, (_, index) => {
    const rawStart = appointmentMinutes - (bufferCount - index) * slotDurationMinutes;
    const rawEnd = rawStart + slotDurationMinutes;
    const dayOffset = Math.floor(rawStart / MINUTES_PER_DAY);
    const normalizedStart = ((rawStart % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const normalizedEnd = ((rawEnd % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return {
      date: addDays(appointmentDate, dayOffset),
      startTime: formatTime(normalizedStart),
      endTime: formatTime(normalizedEnd),
    };
  });
};
