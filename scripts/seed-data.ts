export const slugify = (s: string) =>
	s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

const names = (list: string[]) => list.map((name) => ({ name, slug: slugify(name) }));

export const placeCategorySeed = names([
	'Restaurant',
	'Café',
	'Bakery',
	'Street-food stall',
	'Bubble tea shop',
	'Food court',
	'Delivery-only kitchen'
]).map((c, i) => ({ ...c, displayOrder: i }));

export const cuisineSeed = names([
	'French',
	'Khmer',
	'Japanese',
	'Italian',
	'Thai',
	'Chinese',
	'Korean',
	'Vietnamese',
	'American'
]);

export const foodTypeSeed = names([
	'Dessert',
	'Main course',
	'Appetizer',
	'Soup',
	'Salad',
	'Noodles',
	'Pastry',
	'Street food'
]);

export const drinkTypeSeed = names([
	'Coffee',
	'Tea',
	'Milk tea',
	'Juice',
	'Smoothie',
	'Soda',
	'Cocktail',
	'Other'
]).map((d) => ({ ...d, isAgeRestricted: d.name === 'Cocktail' }));

interface CategorySeed {
	name: string;
	appliesToFood?: boolean;
	appliesToDrink?: boolean;
	appliesToPlace?: boolean;
	appliesToDineIn?: boolean;
	appliesToTakeaway?: boolean;
	appliesToDelivery?: boolean;
	positive: string[];
	negative: string[];
}

/** Mirrors the CAT object in the write-a-review prototype. */
export const ratingCategorySeed: CategorySeed[] = [
	{
		name: 'Food quality',
		appliesToFood: true,
		appliesToPlace: false,
		positive: ['Delicious', 'Fresh', 'Tasty', 'Generous portion', 'Well presented'],
		negative: ['Bland', 'Too salty', 'Served cold', 'Small portion']
	},
	{
		name: 'Drink quality',
		appliesToDrink: true,
		appliesToPlace: false,
		positive: ['Balanced', 'Refreshing', 'Strong', 'Smooth'],
		negative: ['Too sweet', 'Watery', 'Bitter', 'Lukewarm']
	},
	{
		name: 'Price',
		positive: ['Good value', 'Fair price'],
		negative: ['Too expensive', 'Overpriced extras']
	},
	{
		name: 'Service',
		positive: ['Attentive', 'Friendly', 'Fast'],
		negative: ['Slow', 'Unfriendly', 'Wrong order']
	},
	{
		name: 'Hygiene',
		positive: ['Clean', 'Tidy tables'],
		negative: ['Dirty', 'Sticky tables']
	},
	{
		name: 'Amenities',
		appliesToTakeaway: false,
		appliesToDelivery: false,
		positive: ['Outlets', 'Parking', 'Good location', 'Fast Wi-Fi', 'Quiet'],
		negative: ['Noisy', 'Few seats']
	}
];

/** WKT, longitude before latitude — matches src/lib/server/reviews.ts's pointWkt. Duplicated
 *  rather than imported because this script runs under plain Node (no SvelteKit/$app/env
 *  context), while reviews.ts pulls in modules (e.g. cloudinary.ts) that require it. */
function pointWkt(lat: number, lng: number): string {
	return `SRID=4326;POINT(${lng} ${lat})`;
}

export interface PlaceSeedEntry {
	name: string;
	slug: string;
	placeCategorySlug: string;
	addressLine1: string;
	city: string;
	countryCode: string;
	locationWkt: string;
}

/** The write-a-review prototype's 5 hard-coded Phnom Penh venues (its `PLACES` array), with
 *  real coordinates added so the place picker and its distance sort have something to search. */
export const placeSeed: PlaceSeedEntry[] = [
	{
		name: 'The Artisan Bakery & Cafe',
		slug: slugify('The Artisan Bakery & Cafe'),
		placeCategorySlug: 'bakery',
		addressLine1: 'Street 240',
		city: 'Phnom Penh',
		countryCode: 'KH',
		locationWkt: pointWkt(11.5633, 104.9195)
	},
	{
		name: 'Brown Coffee Riverside',
		slug: slugify('Brown Coffee Riverside'),
		placeCategorySlug: 'cafe',
		addressLine1: 'Sisowath Quay',
		city: 'Phnom Penh',
		countryCode: 'KH',
		locationWkt: pointWkt(11.5696, 104.9282)
	},
	{
		name: 'Malis Restaurant',
		slug: slugify('Malis Restaurant'),
		placeCategorySlug: 'restaurant',
		addressLine1: 'Norodom Blvd',
		city: 'Phnom Penh',
		countryCode: 'KH',
		locationWkt: pointWkt(11.5583, 104.923)
	},
	{
		name: 'Artillery Café',
		slug: slugify('Artillery Café'),
		placeCategorySlug: 'cafe',
		addressLine1: 'Street 240',
		city: 'Phnom Penh',
		countryCode: 'KH',
		locationWkt: pointWkt(11.563, 104.9198)
	},
	{
		name: 'Kinin Khmer Fusion',
		slug: slugify('Kinin Khmer Fusion'),
		placeCategorySlug: 'restaurant',
		addressLine1: 'Street 21',
		city: 'Phnom Penh',
		countryCode: 'KH',
		locationWkt: pointWkt(11.5675, 104.924)
	}
];

/* ------------------------------- dashboard demo data -------------------------------- */

/** Marks every review `db:seed-dashboard` writes, so `--remove` deletes exactly those. */
export const DASHBOARD_SEED_NOTE = 'Sample review added by the dashboard seed script.';

interface MenuItem {
	name: string;
	/** Food type or drink type name, matching foodTypeSeed / drinkTypeSeed. */
	kind: string;
	/** null = a drink. */
	cuisine: string | null;
	price: number;
	meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
	quality: number;
}

/** What each seeded place serves, keyed by place slug. */
const MENUS: Record<string, MenuItem[]> = {
	[slugify('The Artisan Bakery & Cafe')]: [
		{
			name: 'Croissant',
			kind: 'Pastry',
			cuisine: 'French',
			price: 2.8,
			meal: 'breakfast',
			quality: 4.3
		},
		{
			name: 'Mille-Feuille Cake',
			kind: 'Dessert',
			cuisine: 'French',
			price: 6.5,
			meal: 'snack',
			quality: 4.6
		},
		{
			name: 'Cappuccino',
			kind: 'Coffee',
			cuisine: null,
			price: 2.75,
			meal: 'breakfast',
			quality: 3.9
		}
	],
	[slugify('Brown Coffee Riverside')]: [
		{
			name: 'Iced Sea-Salt Latte',
			kind: 'Coffee',
			cuisine: null,
			price: 3.25,
			meal: 'breakfast',
			quality: 4.1
		},
		{
			name: 'Iced Milk Tea',
			kind: 'Milk tea',
			cuisine: null,
			price: 2.5,
			meal: 'snack',
			quality: 3.8
		},
		{
			name: 'Mango Smoothie',
			kind: 'Smoothie',
			cuisine: null,
			price: 2.0,
			meal: 'snack',
			quality: 4.0
		}
	],
	[slugify('Malis Restaurant')]: [
		{
			name: 'Fish Amok',
			kind: 'Main course',
			cuisine: 'Khmer',
			price: 9,
			meal: 'dinner',
			quality: 4.7
		},
		{
			name: 'Num Banh Chok',
			kind: 'Noodles',
			cuisine: 'Khmer',
			price: 4,
			meal: 'breakfast',
			quality: 4.3
		}
	],
	[slugify('Artillery Café')]: [
		{
			name: 'Grain Bowl',
			kind: 'Salad',
			cuisine: 'American',
			price: 6.5,
			meal: 'lunch',
			quality: 3.8
		},
		{
			name: 'Brownie',
			kind: 'Dessert',
			cuisine: 'American',
			price: 3.5,
			meal: 'snack',
			quality: 4.4
		},
		{
			name: 'Iced Matcha Latte',
			kind: 'Tea',
			cuisine: null,
			price: 3.75,
			meal: 'snack',
			quality: 3.4
		}
	],
	[slugify('Kinin Khmer Fusion')]: [
		{
			name: 'Beef Lok Lak',
			kind: 'Main course',
			cuisine: 'Khmer',
			price: 7.5,
			meal: 'lunch',
			quality: 4.2
		},
		{
			name: 'Kuy Teav',
			kind: 'Noodles',
			cuisine: 'Khmer',
			price: 3,
			meal: 'breakfast',
			quality: 4.1
		}
	]
};

export interface DashboardSeedReview {
	placeSlug: string;
	date: string;
	visitType: 'dine_in' | 'takeaway' | 'delivery';
	mealType: MenuItem['meal'] | null;
	overall: number;
	item: {
		name: string;
		kind: string;
		cuisine: string | null;
		isDrink: boolean;
		price: number;
		taxPercent: number;
	};
	/** Rating-category slug -> 1..5. */
	scores: Record<string, number>;
}

/** A deterministic year-ish of meals between two "YYYY-MM-DD" dates: 0–3 a day, more at
 *  weekends. Seeded PRNG so reruns produce the same data. */
export function dashboardSeed(from: string, to: string, seed = 20261016): DashboardSeedReview[] {
	let s = seed;
	const rnd = () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));
	const slugs = Object.keys(MENUS);
	const out: DashboardSeedReview[] = [];

	for (
		let d = new Date(`${from}T00:00:00Z`);
		d <= new Date(`${to}T00:00:00Z`);
		d.setUTCDate(d.getUTCDate() + 1)
	) {
		const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
		const n = Math.floor(rnd() * 2.2) + (weekend && rnd() < 0.5 ? 1 : 0);
		for (let i = 0; i < n; i++) {
			const placeSlug = slugs[Math.floor(rnd() * slugs.length)]!;
			const menu = MENUS[placeSlug]!;
			const m = menu[Math.floor(rnd() * menu.length)]!;
			const isDrink = m.cuisine === null;
			const r = rnd();
			const visitType = r < 0.55 ? 'dine_in' : r < 0.85 ? 'takeaway' : 'delivery';
			const overall = clamp(m.quality + (rnd() - 0.5) * 1.8);
			const price =
				Math.round(m.price * (visitType === 'delivery' ? 1.15 : 1) * (0.94 + rnd() * 0.12) * 4) / 4;
			out.push({
				placeSlug,
				date: d.toISOString().slice(0, 10),
				visitType,
				mealType: isDrink ? null : m.meal,
				overall,
				item: {
					name: m.name,
					kind: m.kind,
					cuisine: m.cuisine,
					isDrink,
					price,
					taxPercent: rnd() < 0.5 ? 0 : 10
				},
				scores: {
					[isDrink ? 'drink-quality' : 'food-quality']: clamp(overall + (rnd() - 0.5) * 1.6),
					price: clamp((price < 3 ? 5 : price < 6 ? 4.2 : 3) + (rnd() - 0.5)),
					service: clamp(overall - 0.2 + (rnd() - 0.5) * 1.8),
					hygiene: clamp(overall + (rnd() - 0.5) * 1.4)
				}
			});
		}
	}
	return out;
}
