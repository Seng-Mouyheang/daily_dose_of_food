/** Dashboard number formatting: always "$6.50", never "6.50$" or "$ 6.50". */
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd0 = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	maximumFractionDigits: 0
});

export const money = (n: number) => usd.format(n);
export const money0 = (n: number) => usd0.format(n);
export const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

/** "Oct 12" style short date from "YYYY-MM-DD". */
export const shortDate = (iso: string) =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	});
