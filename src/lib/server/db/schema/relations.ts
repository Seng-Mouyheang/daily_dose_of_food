import { relations } from 'drizzle-orm';
import { mediaFiles } from './media.ts';
import { placeCategories, places } from './places.ts';
import { cuisineTypes, drinkTypes, foodTypes } from './lookups.ts';
import {
	ratingCategories,
	ratingCriteriaOptions,
	reviewCategoryRatings,
	reviewRatingCriteria
} from './ratings.ts';
import {
	drinkItemDetails,
	foodItemDetails,
	reviewItemFoodTypes,
	reviewItems,
	reviewMedia,
	reviews
} from './reviews.ts';
import { users } from './users.ts';

export const usersRelations = relations(users, ({ one, many }) => ({
	avatar: one(mediaFiles, { fields: [users.avatarMediaId], references: [mediaFiles.id] }),
	reviews: many(reviews)
}));

export const mediaFilesRelations = relations(mediaFiles, ({ one }) => ({
	owner: one(users, { fields: [mediaFiles.ownerUserId], references: [users.id] })
}));

export const placeCategoriesRelations = relations(placeCategories, ({ many }) => ({
	places: many(places)
}));

export const placesRelations = relations(places, ({ one, many }) => ({
	category: one(placeCategories, {
		fields: [places.placeCategoryId],
		references: [placeCategories.id]
	}),
	reviews: many(reviews)
}));

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
	author: one(users, { fields: [reviews.userId], references: [users.id] }),
	place: one(places, { fields: [reviews.placeId], references: [places.id] }),
	items: many(reviewItems),
	media: many(reviewMedia),
	categoryRatings: many(reviewCategoryRatings)
}));

export const reviewMediaRelations = relations(reviewMedia, ({ one }) => ({
	review: one(reviews, { fields: [reviewMedia.reviewId], references: [reviews.id] }),
	file: one(mediaFiles, { fields: [reviewMedia.mediaId], references: [mediaFiles.id] })
}));

export const reviewItemsRelations = relations(reviewItems, ({ one, many }) => ({
	review: one(reviews, { fields: [reviewItems.reviewId], references: [reviews.id] }),
	foodDetails: one(foodItemDetails),
	drinkDetails: one(drinkItemDetails),
	foodTypes: many(reviewItemFoodTypes)
}));

export const foodItemDetailsRelations = relations(foodItemDetails, ({ one }) => ({
	item: one(reviewItems, { fields: [foodItemDetails.reviewItemId], references: [reviewItems.id] }),
	cuisine: one(cuisineTypes, {
		fields: [foodItemDetails.cuisineTypeId],
		references: [cuisineTypes.id]
	})
}));

export const drinkItemDetailsRelations = relations(drinkItemDetails, ({ one }) => ({
	item: one(reviewItems, { fields: [drinkItemDetails.reviewItemId], references: [reviewItems.id] }),
	drinkType: one(drinkTypes, {
		fields: [drinkItemDetails.drinkTypeId],
		references: [drinkTypes.id]
	})
}));

export const reviewItemFoodTypesRelations = relations(reviewItemFoodTypes, ({ one }) => ({
	item: one(reviewItems, {
		fields: [reviewItemFoodTypes.reviewItemId],
		references: [reviewItems.id]
	}),
	foodType: one(foodTypes, {
		fields: [reviewItemFoodTypes.foodTypeId],
		references: [foodTypes.id]
	})
}));

export const ratingCategoriesRelations = relations(ratingCategories, ({ many }) => ({
	options: many(ratingCriteriaOptions)
}));

export const ratingCriteriaOptionsRelations = relations(ratingCriteriaOptions, ({ one }) => ({
	category: one(ratingCategories, {
		fields: [ratingCriteriaOptions.ratingCategoryId],
		references: [ratingCategories.id]
	})
}));

export const reviewCategoryRatingsRelations = relations(reviewCategoryRatings, ({ one, many }) => ({
	review: one(reviews, { fields: [reviewCategoryRatings.reviewId], references: [reviews.id] }),
	item: one(reviewItems, {
		fields: [reviewCategoryRatings.reviewItemId],
		references: [reviewItems.id]
	}),
	category: one(ratingCategories, {
		fields: [reviewCategoryRatings.ratingCategoryId],
		references: [ratingCategories.id]
	}),
	criteria: many(reviewRatingCriteria)
}));

export const reviewRatingCriteriaRelations = relations(reviewRatingCriteria, ({ one }) => ({
	rating: one(reviewCategoryRatings, {
		fields: [reviewRatingCriteria.reviewCategoryRatingId],
		references: [reviewCategoryRatings.id]
	}),
	option: one(ratingCriteriaOptions, {
		fields: [reviewRatingCriteria.criteriaOptionId],
		references: [ratingCriteriaOptions.id]
	})
}));
