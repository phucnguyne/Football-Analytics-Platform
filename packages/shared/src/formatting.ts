import { format, parseISO } from 'date-fns';

export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'PPp');
  } catch {
    return dateStr;
  }
}

export function formatGD(goalsFor: number, goalsAgainst: number): string {
  const gd = goalsFor - goalsAgainst;
  return gd > 0 ? `+${gd}` : `${gd}`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
