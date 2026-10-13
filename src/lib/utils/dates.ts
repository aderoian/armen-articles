import { site } from '@/data/site';

const displayFormatter = new Intl.DateTimeFormat(site.locale, {
	year: 'numeric',
	month: 'long',
	day: 'numeric',
	timeZone: 'UTC'
});

/** Human-readable date, e.g. `March 4, 2026`. Dates are treated as UTC calendar days. */
export function formatDate(date: Date): string {
	return displayFormatter.format(date);
}

/** `YYYY-MM-DD`, suitable for the `datetime` attribute of `<time>`. */
export function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}
