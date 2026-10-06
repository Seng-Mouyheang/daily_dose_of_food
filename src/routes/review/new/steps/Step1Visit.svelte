<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import TextInput from '#lib/components/TextInput.svelte';
	import SegmentedControl from '#lib/components/SegmentedControl.svelte';
	import TileGroup from '#lib/components/TileGroup.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import type { PlaceOption, ReviewDraft } from '#lib/review/draft.svelte.ts';

	let {
		draft,
		invalid = false,
		onDismiss
	}: { draft: ReviewDraft; invalid?: boolean; onDismiss?: () => void } = $props();

	let results = $state<PlaceOption[]>([]);
	let searching = $state(false);
	let searchError = $state(false);
	let showAddNew = $state(false);
	let searchToken = 0;
	let debounceHandle: ReturnType<typeof setTimeout> | undefined;

	async function runSearch(query: string) {
		const token = ++searchToken;
		searching = true;
		searchError = false;
		try {
			const res = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`);
			if (token !== searchToken) return;
			if (!res.ok) throw new Error('search failed');
			results = (await res.json()) as PlaceOption[];
			showAddNew = results.length === 0;
		} catch {
			if (token === searchToken) {
				searchError = true;
				results = [];
			}
		} finally {
			if (token === searchToken) searching = false;
		}
	}

	function scheduleSearch(query: string) {
		clearTimeout(debounceHandle);
		if (query.trim().length < 2) {
			results = [];
			showAddNew = false;
			return;
		}
		debounceHandle = setTimeout(() => void runSearch(query), 300);
	}

	function choosePlace(place: PlaceOption) {
		draft.place = place;
		draft.placeQuery = '';
		results = [];
		showAddNew = false;
		onDismiss?.();
	}

	function changePlace() {
		draft.place = null;
		draft.newPlaceName = '';
		onDismiss?.();
	}

	const today = new Date().toISOString().slice(0, 10);
</script>

<div class="flex flex-col gap-7">
	<div class="flex flex-col gap-2.5">
		<span class="text-sm font-semibold text-ink">What are you reviewing?</span>
		<SegmentedControl
			groupLabel="What are you reviewing?"
			bind:value={draft.reviewType}
			options={[
				{ value: 'dish', label: 'Dish', icon: 'plate' },
				{ value: 'beverage', label: 'Drink', icon: 'coffee' },
				{ value: 'both', label: 'Both', icon: 'both' }
			]}
		/>
	</div>

	<div class="flex flex-col gap-2.5">
		<span class="text-sm font-semibold text-ink">How did you have it?</span>
		<TileGroup
			groupLabel="How did you have it?"
			bind:value={draft.visitType}
			options={[
				{ value: 'dine_in', label: 'Dine-in', icon: 'dine' },
				{ value: 'takeaway', label: 'Takeaway', icon: 'bag' },
				{ value: 'delivery', label: 'Delivery', icon: 'bike' }
			]}
		/>
	</div>

	{#if draft.hasDish}
		<div class="flex flex-col gap-2.5">
			<span class="text-sm font-semibold text-ink">Meal</span>
			<SegmentedControl
				groupLabel="Meal"
				bind:value={draft.mealType}
				options={[
					{ value: 'breakfast', label: 'Breakfast' },
					{ value: 'lunch', label: 'Lunch' },
					{ value: 'dinner', label: 'Dinner' },
					{ value: 'snack', label: 'Snack' }
				]}
			/>
		</div>
	{/if}

	<Field label="Date" for="f-date">
		<TextInput
			id="f-date"
			type="date"
			icon="calendar"
			iconClass="text-accent-strong"
			max={today}
			bind:value={draft.visitedAt}
		/>
	</Field>

	<Field label={draft.visitType === 'delivery' ? 'Ordered from' : 'Place'} for="f-place">
		{#if draft.place}
			<div
				class="flex items-center justify-between gap-3 rounded-input border border-line bg-surface px-3.5 py-3"
			>
				<div class="flex items-center gap-2.5 text-sm">
					<Icon name="pin" size={18} class="text-accent-strong" />
					<div>
						<p class="font-semibold text-ink">{draft.place.name}</p>
						{#if draft.place.addressLine1}<p class="text-ink-3">{draft.place.addressLine1}</p>{/if}
					</div>
				</div>
				<button type="button" class="text-sm font-semibold text-accent-strong" onclick={changePlace}
					>Change</button
				>
			</div>
		{:else}
			<TextInput
				id="f-place"
				icon="search"
				iconClass="text-accent-strong"
				placeholder="Search restaurants, cafés, stalls"
				bind:value={draft.placeQuery}
				oninput={() => {
					scheduleSearch(draft.placeQuery);
					onDismiss?.();
				}}
				{invalid}
			/>
			{#if searching}
				<p class="text-[13px] text-ink-3">Searching…</p>
			{/if}
			{#if results.length}
				<ul class="flex flex-col gap-1 rounded-input border border-line bg-surface p-1">
					{#each results as place (place.id)}
						<li>
							<button
								type="button"
								class="flex w-full items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm hover:bg-sunken"
								onclick={() => choosePlace(place)}
							>
								<Icon name="pin" size={16} class="mt-0.5 text-ink-3" />
								<span>
									<span class="block font-medium text-ink">{place.name}</span>
									{#if place.addressLine1}<span class="block text-xs text-ink-3"
											>{place.addressLine1}</span
										>{/if}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else if showAddNew}
				<div class="rounded-input border border-dashed border-line p-3 text-sm text-ink-2">
					<p>
						No places match "{draft.placeQuery}" — check the spelling, or add it as a new place.
					</p>
					<div class="mt-2">
						<TextInput
							placeholder="Place name"
							bind:value={draft.newPlaceName}
							oninput={() => onDismiss?.()}
							{invalid}
						/>
					</div>
				</div>
			{:else if searchError}
				<p class="text-[13px] text-bad">Couldn't search places. Try again.</p>
			{/if}
		{/if}
	</Field>
</div>
