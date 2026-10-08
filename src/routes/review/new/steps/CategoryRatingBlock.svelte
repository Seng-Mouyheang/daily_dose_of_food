<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import StarRating from '#lib/components/StarRating.svelte';
	import Chip from '#lib/components/Chip.svelte';
	import { ratingWord } from '#lib/review/format.ts';
	import {
		categoryIcon,
		categoryLabel,
		type RatingCategoryView,
		type RatingOption
	} from '#lib/review/categories.ts';
	import type { CategoryRatingDraft, VisitType } from '#lib/review/draft.svelte.ts';

	let {
		category,
		rating,
		visitType
	}: { category: RatingCategoryView; rating: CategoryRatingDraft; visitType: VisitType } = $props();

	const label = $derived(categoryLabel(category, visitType));
	const word = $derived(ratingWord(rating.ratingValue));

	let expanded = $state(false);

	const allOptions = $derived([...category.positive, ...category.negative]);
	const selectedOptions = $derived(
		allOptions.filter((o) => rating.criteriaOptionIds.includes(o.id))
	);
	const selectedPositiveIds = $derived(new Set(category.positive.map((o) => o.id)));

	function toggleTag(id: number) {
		const i = rating.criteriaOptionIds.indexOf(id);
		if (i === -1) rating.criteriaOptionIds.push(id);
		else rating.criteriaOptionIds.splice(i, 1);
	}

	// A custom tag typed into a group's "+" add pill. Unlike criteriaOptionIds (seeded option
	// ids), these exist only as labels until publish — see customCriteria on CategoryRatingDraft.
	let addingSentiment = $state<'positive' | 'negative' | null>(null);
	let newTagLabel = $state('');
	let addInputEl = $state<HTMLInputElement>();

	function startAdd(sentiment: 'positive' | 'negative') {
		addingSentiment = sentiment;
		newTagLabel = '';
		// The input doesn't exist yet this tick (it's behind {#if addingSentiment === sentiment}),
		// so focus it once Svelte has mounted it — same pattern as Select's "Other…" field.
		requestAnimationFrame(() => addInputEl?.focus());
	}

	function cancelAdd() {
		addingSentiment = null;
		newTagLabel = '';
	}

	function commitAdd() {
		const sentiment = addingSentiment;
		const label = newTagLabel.trim();
		if (!sentiment || !label) return cancelAdd();

		// If it matches an existing option for this sentiment (case-insensitively), just select
		// that one instead of creating a near-duplicate tag.
		const pool = sentiment === 'positive' ? category.positive : category.negative;
		const existing = pool.find((o) => o.label.toLowerCase() === label.toLowerCase());
		if (existing) {
			if (!rating.criteriaOptionIds.includes(existing.id))
				rating.criteriaOptionIds.push(existing.id);
		} else if (
			!rating.customCriteria.some(
				(c) => c.sentiment === sentiment && c.label.toLowerCase() === label.toLowerCase()
			)
		) {
			rating.customCriteria.push({ label, sentiment });
		}
		cancelAdd();
	}

	function removeCustomTag(sentiment: 'positive' | 'negative', label: string) {
		const i = rating.customCriteria.findIndex(
			(c) => c.sentiment === sentiment && c.label === label
		);
		if (i !== -1) rating.customCriteria.splice(i, 1);
	}
</script>

{#snippet tagGroup(heading: string, sentiment: 'positive' | 'negative', options: RatingOption[])}
	<div class="flex flex-col gap-1.5">
		<span class="text-xs font-semibold tracking-wide text-ink-3 uppercase">{heading}</span>
		<div class="flex flex-wrap items-center gap-1.5">
			{#each options as option (option.id)}
				<Chip
					label={option.label}
					variant={sentiment === 'positive' ? 'pos' : 'neg'}
					selected={rating.criteriaOptionIds.includes(option.id)}
					onclick={() => toggleTag(option.id)}
				/>
			{/each}
			{#each rating.customCriteria.filter((c) => c.sentiment === sentiment) as custom (custom.label)}
				<Chip
					label={custom.label}
					variant={sentiment === 'positive' ? 'pos' : 'neg'}
					selected
					onclick={() => removeCustomTag(sentiment, custom.label)}
				/>
			{/each}
			{#if addingSentiment === sentiment}
				<div
					class="flex h-[30px] items-center gap-1 rounded-full border border-line bg-surface py-1 pr-1 pl-3"
				>
					<input
						bind:this={addInputEl}
						type="text"
						placeholder="Your own…"
						bind:value={newTagLabel}
						class="w-24 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								commitAdd();
							}
							if (e.key === 'Escape') cancelAdd();
						}}
					/>
					<button
						type="button"
						aria-label="Add tag"
						class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-accent-strong hover:bg-accent-soft"
						onclick={commitAdd}
					>
						<Icon name="check" size={14} weight={2.5} />
					</button>
					<button
						type="button"
						aria-label="Cancel"
						class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-sunken"
						onclick={cancelAdd}
					>
						<Icon name="x" size={14} weight={2.5} />
					</button>
				</div>
			{:else}
				<Chip
					label="Add your own tag"
					variant="add"
					icon="plus"
					onclick={() => startAdd(sentiment)}
				/>
			{/if}
		</div>
	</div>
{/snippet}

<div class="flex flex-col gap-2.5 border-t border-line pt-4 first:border-t-0 first:pt-0">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<span class="flex items-center gap-2 text-sm font-semibold text-ink">
			<Icon name={categoryIcon(category.slug)} size={18} class="text-ink-3" />
			{label}
			{#if word}<span class="font-normal text-ink-3">{word}</span>{/if}
		</span>
		<StarRating bind:value={rating.ratingValue} size={20} label={`${label} rating`} />
	</div>

	{#if !expanded}
		<div class="flex flex-wrap gap-1.5">
			{#each selectedOptions as option (option.id)}
				<Chip
					label={option.label}
					variant={selectedPositiveIds.has(option.id) ? 'pos' : 'neg'}
					selected
					onclick={() => toggleTag(option.id)}
				/>
			{/each}
			{#each rating.customCriteria as custom (custom.sentiment + ':' + custom.label)}
				<Chip
					label={custom.label}
					variant={custom.sentiment === 'positive' ? 'pos' : 'neg'}
					selected
					onclick={() => removeCustomTag(custom.sentiment, custom.label)}
				/>
			{/each}
			<Chip label="Edit tags" variant="add" onclick={() => (expanded = true)} />
		</div>
	{:else}
		<div class="flex flex-col gap-3 rounded-input bg-sunken p-3.5">
			{@render tagGroup('What was good', 'positive', category.positive)}
			{@render tagGroup('What could be better', 'negative', category.negative)}
			<button
				type="button"
				class="flex w-fit items-center gap-1 self-end text-sm font-semibold text-accent-strong"
				onclick={() => (expanded = false)}
			>
				<Icon name="check" size={14} weight={3} />
				Done
			</button>
		</div>
	{/if}
</div>
