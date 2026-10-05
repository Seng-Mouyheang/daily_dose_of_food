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
