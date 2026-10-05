import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { places, reviews } from '#lib/server/db/schema/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const [row] = await db
		.select({ review: reviews, placeName: places.name })
		.from(reviews)
		.innerJoin(places, eq(reviews.placeId, places.id))
		.where(eq(reviews.id, params.id))
		.limit(1);

	if (!row) error(404, 'Review not found');
	return row;
};
