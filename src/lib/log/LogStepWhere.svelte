<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import TextInput from '#lib/components/TextInput.svelte';
	import DatePicker from './DatePicker.svelte';
	import { addDays } from '#lib/dashboard/period.ts';
	import { money } from '#lib/dashboard/format.ts';
	import MapDoodle from '#lib/review/MapDoodle.svelte';
	import type { LogForm } from './form.svelte.ts';
	import {
		recentItems,
		searchItems,
		searchPlaces,
		usualAt,
		type HistoryRow,
		type ItemSuggestion,
		type PlaceSuggestion
	} from './suggest.ts';

	/** Step 1, "Where and what". Suggestions come from your own history (fetched when the form
	 *  opened): your regulars and matches for the place, your usual order there and matches for
	 *  the item. Anything not found is added as plain text, so a new place or dish is never a
	 *  dead end. */
	let {
		form,
		today,
		suggestions
	}: {
		form: LogForm;
		today: string;
		suggestions: { items: HistoryRow[]; places: PlaceSuggestion[] } | null;
	} = $props();

	let placeQ = $state('');
	let itemQ = $state('');

	const places = $derived(suggestions?.places ?? []);
	const history = $derived(suggestions?.items ?? []);
	const placeMatches = $derived(searchPlaces(places, placeQ));
	const usual = $derived(form.place ? usualAt(history, form.place.name) : []);
	const chips = $derived(usual.length ? usual : recentItems(history));
	const itemMatches = $derived(searchItems(history, itemQ));
	const yesterday = $derived(addDays(today, -1));

	function choosePlace(p: PlaceSuggestion | null) {
		form.pickPlace(p);
		placeQ = '';
	}
	function chooseItem(s: ItemSuggestion) {
		form.toggle(s);
		itemQ = '';
	}
	function addItem() {
		form.addNew(itemQ);
		itemQ = '';
	}
	function addPlace() {
		form.addPlace(placeQ);
		placeQ = '';
	}

	function onPlaceKey(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		if (placeMatches[0]) choosePlace(placeMatches[0]);
		else addPlace();
	}
	function onItemKey(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		if (itemMatches[0]) chooseItem(itemMatches[0]);
		else addItem();
	}

	const detail = (...parts: (string | null)[]) => parts.filter(Boolean).join(' · ');
</script>

{#snippet pill(label: string, on: boolean, onclick: () => void, extra?: string)}
	<button
		type="button"
		aria-pressed={on}
		{onclick}
		class="inline-flex h-[34px] items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors {on
			? 'border-transparent bg-accent-soft text-accent-strong'
			: 'border-line bg-surface text-ink-2 hover:border-ink-3'}"
	>
		{#if on}<Icon name="check" size={13} weight={2.4} />{/if}{label}{#if extra}<span
				class="tabular-nums opacity-75">{extra}</span
			>{/if}
	</button>
{/snippet}

<div class="flex flex-col gap-7">
	<Field label="Date" for="log-date">
		<DatePicker id="log-date" bind:value={form.date} max={today} />
		<div class="flex gap-2">
			{@render pill('Today', form.date === today, () => (form.date = today))}
			{@render pill('Yesterday', form.date === yesterday, () => (form.date = yesterday))}
		</div>
	</Field>

	<Field
		label="Where did you go?"
		for="log-place"
		error={form.error === 'place' ? 'Pick where you went.' : undefined}
	>
		{#if form.place}
			<div class="flex items-center gap-3 rounded-tile border border-line bg-surface p-3">
				<span
					class="grid h-[42px] w-[42px] flex-none place-items-center rounded-[11px] bg-accent-soft text-accent-strong"
				>
					<Icon name="pin" size={20} />
				</span>
				<span class="flex min-w-0 flex-1 flex-col">
					<b class="truncate text-[15px] font-semibold">{form.place.name}</b>
					<small class="truncate text-[13px] text-ink-2">
						{detail(
							form.place.address,
							form.place.visits
								? `Been ${form.place.visits} ${form.place.visits === 1 ? 'time' : 'times'}`
								: 'New place'
						)}
					</small>
				</span>
				<button
					type="button"
					onclick={() => choosePlace(null)}
					class="min-h-11 rounded-input px-2.5 text-sm font-semibold text-accent-strong hover:bg-accent-soft"
					>Change</button
				>
			</div>
			<MapDoodle />
		{:else}
			<TextInput
				id="log-place"
				bind:value={placeQ}
				icon="search"
				placeholder="Search places, restaurants, coffee shops"
				autocomplete="off"
				invalid={form.error === 'place'}
				onkeydown={onPlaceKey}
			/>
			{#if !placeQ.trim()}
				{#if places.length}
					<div class="flex flex-col gap-2">
						<span class="text-[13px] font-semibold text-ink-3">Your regulars</span>
						<div class="flex flex-wrap gap-1.5">
							{#each places.slice(0, 6) as p (p.name)}
								<button
									type="button"
									onclick={() => choosePlace(p)}
									class="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-medium text-ink-2 hover:border-ink-3"
									><Icon name="pin" size={14} class="text-ink-3" />{p.name}</button
								>
							{/each}
						</div>
					</div>
				{/if}
			{:else}
				<div class="overflow-hidden rounded-input border border-line bg-surface">
					{#each placeMatches as p (p.name)}
						<button
							type="button"
							onclick={() => choosePlace(p)}
							class="flex min-h-12 w-full items-center gap-3 border-t border-line px-3.5 py-2 text-left first:border-t-0 hover:bg-sunken"
						>
							<Icon name="pin" size={18} class="text-ink-3" />
							<span class="flex min-w-0 flex-1 flex-col">
								<b class="truncate text-sm font-semibold">{p.name}</b>
								<small class="truncate text-[12.5px] text-ink-2"
									>{detail(p.address, `${p.visits} ${p.visits === 1 ? 'visit' : 'visits'}`)}</small
								>
							</span>
						</button>
					{/each}
					<button
						type="button"
						onclick={addPlace}
						class="flex min-h-12 w-full items-center gap-3 border-t border-line px-3.5 py-2 text-left font-semibold text-accent-strong first:border-t-0 hover:bg-sunken"
					>
						<Icon name="plus" size={18} weight={2.2} />
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-sm"
								>Add “{placeQ.trim()}”{placeMatches.length ? '' : ' as a new place'}</span
							>
							<small class="text-[12.5px] font-normal text-ink-2">
								{placeMatches.length
									? 'A new place, just for your log'
									: "No matches yet. It's saved for next time."}
							</small>
						</span>
					</button>
				</div>
			{/if}
		{/if}
	</Field>

	<Field
		label="What did you have?"
		for="log-item"
		error={form.error === 'items' ? 'Add at least one thing you had.' : undefined}
	>
		{#if form.items.length}
			<ul class="flex flex-col gap-0.5 rounded-tile border border-line bg-surface p-1.5">
				{#each form.items as item, i (item.title)}
					<li class="flex items-center gap-3 rounded-input p-1.5">
						{#if item.custom}
							<button
								type="button"
								onclick={() => {
									item.itemType = item.itemType === 'drink' ? 'food' : 'drink';
								}}
								aria-label="{item.itemType === 'drink'
									? 'Drink'
									: 'Food'}. Switch to {item.itemType === 'drink' ? 'food' : 'drink'}"
								title="Food or drink? Tap to switch"
								class="ring-line-2 grid h-10 w-10 flex-none place-items-center rounded-[11px] bg-sunken text-ink-3 ring-[1.5px] ring-inset hover:text-ink-2"
							>
								<Icon
									name={item.itemType === 'drink' ? 'coffee' : 'plate'}
									size={19}
									weight={1.6}
								/>
							</button>
						{:else}
							<span
								class="grid h-10 w-10 flex-none place-items-center rounded-[11px] bg-sunken text-ink-3"
							>
								<Icon
									name={item.itemType === 'drink' ? 'coffee' : 'plate'}
									size={19}
									weight={1.6}
								/>
							</span>
						{/if}
						<span class="flex min-w-0 flex-1 flex-col">
							<b class="truncate text-[14.5px] font-semibold">{item.title}</b>
							<small class="truncate text-[12.5px] text-ink-3">
								{item.custom
									? `${item.itemType === 'drink' ? 'Drink' : 'Food'} · tap the icon to switch`
									: detail(item.cuisine, item.kind)}
							</small>
						</span>
						<IconButton
							icon="x"
							label="Remove {item.title}"
							size={16}
							onclick={() => form.items.splice(i, 1)}
						/>
					</li>
				{/each}
			</ul>
		{/if}

		<TextInput
			id="log-item"
			bind:value={itemQ}
			icon="search"
			placeholder="Search food, drinks, snacks"
			autocomplete="off"
			invalid={form.error === 'items'}
			onkeydown={onItemKey}
		/>

		{#if !itemQ.trim()}
			{#if chips.length}
				<div class="flex flex-col gap-2">
					<span class="text-[13px] font-semibold text-ink-3"
						>{usual.length ? `Your usual at ${form.place!.name}` : 'Recently'}</span
					>
					<div class="flex flex-wrap gap-1.5">
						{#each chips as s (s.title)}
							{@render pill(s.title, form.has(s.title), () => chooseItem(s), money(s.priceEach))}
						{/each}
					</div>
				</div>
			{/if}
		{:else}
			<div class="overflow-hidden rounded-input border border-line bg-surface">
				{#each itemMatches as s (s.title)}
					<button
						type="button"
						onclick={() => chooseItem(s)}
						class="flex min-h-12 w-full items-center gap-3 border-t border-line px-3.5 py-2 text-left first:border-t-0 hover:bg-sunken"
					>
						<Icon name={s.itemType === 'drink' ? 'coffee' : 'plate'} size={18} class="text-ink-3" />
						<span class="flex min-w-0 flex-1 flex-col">
							<b class="truncate text-sm font-semibold">{s.title}</b>
							<small class="truncate text-[12.5px] text-ink-2"
								>{detail(s.kind, `last paid ${money(s.priceEach)}`)}</small
							>
						</span>
						{#if form.has(s.title)}<Icon name="check" size={16} weight={2.4} />{/if}
					</button>
				{/each}
				<button
					type="button"
					onclick={addItem}
					class="flex min-h-12 w-full items-center gap-3 border-t border-line px-3.5 py-2 text-left font-semibold text-accent-strong first:border-t-0 hover:bg-sunken"
				>
					<Icon name="plus" size={18} weight={2.2} />
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-sm"
							>Add “{itemQ.trim()}”{itemMatches.length ? '' : ' as new'}</span
						>
						<small class="text-[12.5px] font-normal text-ink-2">
							{itemMatches.length
								? "Something you haven't logged before"
								: "No matches yet. You'll set the price on the next step."}
						</small>
					</span>
				</button>
			</div>
		{/if}
	</Field>
</div>
