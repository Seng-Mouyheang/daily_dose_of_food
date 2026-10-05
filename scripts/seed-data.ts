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
