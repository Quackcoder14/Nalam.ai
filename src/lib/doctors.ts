export const DOCTOR_SCHEDULES: Record<string, string[]> = {
  dr_dhanush: ['Mon', 'Wed', 'Fri'],
  dr_monissha: ['Tue', 'Thu', 'Sat'],
};

export function getNextSlots(days: string[]): string[] {
  const today = new Date();
  const dates: string[] = [];
  for (let i = 1; i <= 30 && dates.length < 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    if (days.includes(dayName)) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }
  return dates;
}

export const AVAILABLE_TIME_SLOTS = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
  '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM',
  '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM'
];
