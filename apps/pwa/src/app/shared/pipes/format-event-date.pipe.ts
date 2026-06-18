import { Pipe, PipeTransform } from '@angular/core';

const DATE_FORMATTER = new Intl.DateTimeFormat('ca', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

@Pipe({ name: 'formatEventDate', standalone: true })
export class FormatEventDatePipe implements PipeTransform {
  transform(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return '';
    const formatted = DATE_FORMATTER.format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
}
