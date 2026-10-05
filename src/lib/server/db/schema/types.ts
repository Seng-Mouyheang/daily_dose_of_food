import { customType } from 'drizzle-orm/pg-core';

export const citext = customType<{ data: string }>({
	dataType: () => 'citext'
});

/** PostGIS geography(Point, 4326). Read/write as WKT or EWKT strings via sql`` helpers. */
export const geographyPoint = customType<{ data: string }>({
	dataType: () => 'geography(Point, 4326)'
});
