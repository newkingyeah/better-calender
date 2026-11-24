const DAY = 86_400_000;

export function localDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month, day);
  return date;
}

export function monthStart(date: Date, offset = 0): Date {
  return localDate(date.getFullYear(), date.getMonth() + offset, 1);
}

function offsetDay(date: Date, offset: number): Date {
  return localDate(date.getFullYear(), date.getMonth(), date.getDate() + offset);
}

export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function monthWeeks(month: Date): Date[][] {
  const first = monthStart(month);
  const firstWeekday = (first.getDay() + 6) % 7;
  const rows = Math.ceil((firstWeekday + offsetDay(monthStart(first, 1), -1).getDate()) / 7);
  const start = offsetDay(first, -firstWeekday);

  return Array.from({ length: rows }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => offsetDay(start, 7 * week + day)),
  );
}

export function isoWeek(date: Date): number {
  // Thursday determines the ISO week-year. UTC arithmetic avoids DST-length days.
  const thursday = new Date(0);
  thursday.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const january = new Date(0);
  january.setUTCFullYear(thursday.getUTCFullYear(), 0, 1);
  return Math.ceil(((thursday.getTime() - january.getTime()) / DAY + 1) / 7);
}

export function dateLabel(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}
