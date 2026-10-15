<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { STAR_PATH } from '#lib/components/star-path.ts';
	import { primaryItem, reviewTitle, totalBeforeTax, type FeedReview } from '#lib/review/card.ts';
	import { formatVisitDate } from '#lib/review/format.ts';
	import type { IconName } from '#lib/components/icons.ts';
	import { swipeReveal } from './swipe.ts';

	export interface RowAction {
		label: string;
		icon: IconName;
		tone: 'neutral' | 'bad' | 'good';
		run: () => void;
	}

	/** One journal list row: thumbnail with the score on it, title + favorite heart + price, then
	 *  place · type, then the visit date (My reviews) or who wrote it (Bookmarks). The tax rate
	 *  and full address are left for the review page, per the handoff, so the row stays three
	 *  short lines. */
	let {
		review,
		showAuthor,
		selected = false,
		onselect,
		action = null,
		open = false,
		onopenchange,
		onmore
	}: {
		review: FeedReview;
		/** Bookmarks show the author on the third line instead of the visit date. */
		showAuthor: boolean;
		/** The desktop preview pane is showing this row. */
		selected?: boolean;
		/** When set, a click selects the row instead of following the link (desktop two-pane).
		 *  Return true to swallow the navigation. */
		onselect?: (id: string) => boolean;
		/** Phone only: the action a left swipe reveals (Archive, Remove, Restore). */
		action?: RowAction | null;
		/** The swipe action is showing. Owned by the list, so only one row is open at a time. */
		open?: boolean;
		onopenchange?: (open: boolean) => void;
		/** Phone only: the ⋯ button, which opens the row's action sheet. */
		onmore?: () => void;
	} = $props();

	const ACTION_WIDTH = 96;
	const TONE = {
		neutral: 'bg-ink-2 text-bg',
		bad: 'bg-bad text-bg',
		good: 'bg-good text-bg'
	} as const;

	const title = $derived(reviewTitle(review));
	const item = $derived(primaryItem(review.items));
	const price = $derived(totalBeforeTax(review.items));
	const cover = $derived(review.photos[0]?.url ?? null);
	const isDrink = $derived(review.reviewType === 'drink');
	const meta = $derived([review.place.name, item?.typeLabel].filter(Boolean).join(' · '));

	function onclick(event: MouseEvent) {
		// A tap on an open row closes it rather than opening the review.
		if (open) {
			event.preventDefault();
			onopenchange?.(false);
			return;
		}
		// Leave modified clicks (new tab, etc.) to the browser.
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
		if (onselect?.(review.id)) event.preventDefault();
	}
</script>

<div class="relative overflow-hidden">
	{#if action}
		<!-- Behind the row, uncovered by the swipe. Out of the tab order while covered; the ⋯
		     sheet offers the same action to keyboard and screen-reader users. -->
		<button
			type="button"
			tabindex={open ? 0 : -1}
			aria-hidden={!open}
			onclick={() => action.run()}
			class="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1 text-[12.5px] font-bold lg:hidden {TONE[
				action.tone
			]}"
			style:width={`${ACTION_WIDTH}px`}
		>
			<Icon name={action.icon} size={20} />
			{action.label}
		</button>
	{/if}
	<div
		use:swipeReveal={{ open, width: ACTION_WIDTH, onchange: (o) => onopenchange?.(o) }}
		class="relative flex touch-pan-y items-center transition-[transform,background-color] duration-200 motion-reduce:transition-none {selected
			? 'bg-accent-soft'
			: 'bg-bg hover:bg-surface'}"
		style:transform={open ? `translateX(-${ACTION_WIDTH}px)` : undefined}
	>
		<a
			href={`/review/${review.id}`}
			{onclick}
			aria-current={selected ? 'true' : undefined}
			class="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 lg:px-5 {onmore ? 'pr-1' : 'pr-2.5'}"
			draggable="false"
		>
			<span
				class="relative grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-input bg-accent-soft text-accent-strong"
			>
				{#if cover}
					<img
						src={cover}
						alt=""
						class="absolute inset-0 h-full w-full object-cover"
						loading="lazy"
					/>
				{:else}
					<Icon name={isDrink ? 'coffee' : 'plate'} size={26} weight={1.5} />
				{/if}
				<span
					class="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-full bg-badge px-1.5 py-px text-[11px] font-bold text-on-badge tabular-nums"
				>
					<svg
						width="10"
						height="10"
						viewBox="0 0 24 24"
						fill="currentColor"
						class="text-accent"
						aria-hidden="true"
					>
						<path d={STAR_PATH} />
					</svg>
					{review.overallRating.toFixed(1)}
					<span class="sr-only">out of 5</span>
				</span>
			</span>

			<span class="flex min-w-0 flex-1 flex-col gap-[3px]">
				<span class="flex min-w-0 items-center gap-1.5">
					<b class="min-w-0 truncate font-display text-[16.5px] font-semibold text-ink">{title}</b>
					{#if review.isFavorite}
						<span class="flex shrink-0 text-fav" title="Favorite">
							<Icon name="heart" size={14} weight={2.4} />
							<span class="sr-only">Favorite</span>
						</span>
					{/if}
					{#if price !== null}
						<span class="ml-auto shrink-0 text-[14.5px] font-semibold text-ink tabular-nums">
							${price.toFixed(2)}
						</span>
					{/if}
				</span>
				<span class="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-2">
					<span class="shrink-0 text-ink-3"><Icon name="pin" size={13} /></span>
					<span class="truncate">{meta}</span>
				</span>
				<span class="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-2">
					{#if showAuthor}
						<Avatar src={review.author.avatarUrl} name={review.author.displayName} size={18} />
						<span class="truncate">{review.author.displayName}</span>
					{:else}
						<span class="shrink-0 text-ink-3"><Icon name="calendar" size={13} /></span>
						<span class="truncate">{formatVisitDate(review.visitedAt.slice(0, 10))}</span>
					{/if}
				</span>
			</span>
		</a>
		{#if onmore}
			<button
				type="button"
				data-no-swipe
				onclick={onmore}
				aria-label={`Actions for ${title}`}
				class="mr-1.5 grid h-11 w-9 shrink-0 place-items-center rounded-input text-ink-2 hover:bg-sunken lg:hidden"
			>
				<Icon name="more" size={18} />
			</button>
		{/if}
	</div>
</div>
