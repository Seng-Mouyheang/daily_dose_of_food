<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import TextInput from '#lib/components/TextInput.svelte';
	import TileGroup from '#lib/components/TileGroup.svelte';
	import { priceWithTax } from '#lib/review/format.ts';
	import type { ItemDraft } from '#lib/review/draft.svelte.ts';

	let {
		item,
		cuisineTypes,
		foodTypes,
		drinkTypes,
		invalid = false,
		onDismiss
	}: {
		item: ItemDraft;
		cuisineTypes: { id: number; name: string }[];
		foodTypes: { id: number; name: string }[];
		drinkTypes: { id: number; name: string }[];
		invalid?: boolean;
		onDismiss?: () => void;
	} = $props();

	const idPrefix = $derived(`f-${item.itemType}`);
	const withTax = $derived(priceWithTax(item.price, item.taxPercent));

	const SUGAR_PRESETS = [
		[0, 'Sugar-free'],
		[25, 'Less sweet'],
		[50, 'Regular'],
		[75, 'Sweet'],
		[100, 'Extra sweet']
	] as const;

	function sugarWord(pct: number): string {
		let closest: (typeof SUGAR_PRESETS)[number] = SUGAR_PRESETS[2];
		for (const preset of SUGAR_PRESETS) {
			if (Math.abs(preset[0] - pct) < Math.abs(closest[0] - pct)) closest = preset;
		}
		return closest[1];
	}

	// A single selected food type, stored as the 0-or-1-element array the schema's
	// many-to-many review_item_food_types expects.
	let selectedFoodTypeId = $derived(item.foodTypeIds[0] ?? '');
	function setFoodType(id: string) {
		item.foodTypeIds = id ? [Number(id)] : [];
	}
</script>

<div class="flex flex-col gap-5">
	<h3 class="font-display text-lg font-semibold text-ink">
		{item.itemType === 'food' ? 'The dish' : 'The drink'}
	</h3>

	<Field label={item.itemType === 'food' ? 'Dish name' : 'Drink name'} for={`${idPrefix}-name`}>
		<TextInput
			id={`${idPrefix}-name`}
			placeholder={item.itemType === 'food' ? 'e.g. Fish amok' : 'e.g. Iced latte'}
			bind:value={item.itemName}
			oninput={() => onDismiss?.()}
			{invalid}
		/>
	</Field>

	{#if item.itemType === 'food'}
		<div class="grid grid-cols-2 gap-3">
			<Field label="Cuisine" for={`${idPrefix}-cuisine`}>
				<select
					id={`${idPrefix}-cuisine`}
					class="h-12 rounded-input border border-line bg-surface px-3.5 text-[15px] text-ink"
					value={item.cuisineTypeId ?? ''}
					onchange={(e) =>
						(item.cuisineTypeId = e.currentTarget.value ? Number(e.currentTarget.value) : null)}
				>
					<option value="">Select</option>
					{#each cuisineTypes as c (c.id)}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
			</Field>
			<Field label="Type of dish" for={`${idPrefix}-foodtype`}>
				<select
					id={`${idPrefix}-foodtype`}
					class="h-12 rounded-input border border-line bg-surface px-3.5 text-[15px] text-ink"
					value={selectedFoodTypeId}
					onchange={(e) => setFoodType(e.currentTarget.value)}
				>
					<option value="">Select</option>
					{#each foodTypes as f (f.id)}
						<option value={f.id}>{f.name}</option>
					{/each}
				</select>
			</Field>
		</div>
	{:else}
		<Field label="Type of drink" for={`${idPrefix}-drinktype`}>
			<select
				id={`${idPrefix}-drinktype`}
				class="h-12 rounded-input border border-line bg-surface px-3.5 text-[15px] text-ink"
				value={item.drinkTypeId ?? ''}
				onchange={(e) =>
					(item.drinkTypeId = e.currentTarget.value ? Number(e.currentTarget.value) : null)}
			>
				<option value="">Select</option>
				{#each drinkTypes as d (d.id)}
					<option value={d.id}>{d.name}</option>
				{/each}
			</select>
		</Field>
	{/if}

	<div class="grid grid-cols-2 gap-3">
		<Field label="Price" for={`${idPrefix}-price`}>
			<TextInput
				id={`${idPrefix}-price`}
				inputmode="decimal"
				prefix="$"
				placeholder="0.00"
				bind:value={item.price}
			/>
		</Field>
		<Field label="Tax" optional for={`${idPrefix}-tax`}>
			<TextInput
				id={`${idPrefix}-tax`}
				inputmode="decimal"
				suffix="%"
				placeholder="0"
				bind:value={item.taxPercent}
			/>
		</Field>
	</div>
	{#if item.price.trim()}
		<div class="-mt-2 flex items-center justify-between text-sm">
			<span class="text-ink-3">Total with tax</span>
			<b class="font-semibold text-ink tabular-nums">${withTax.toFixed(2)}</b>
		</div>
	{/if}

	{#if item.itemType === 'drink'}
		<div class="flex flex-col gap-2.5">
			<span class="text-sm font-semibold text-ink">Size</span>
			<TileGroup
				groupLabel="Size"
				bind:value={item.sizeLabel}
				options={[
					{ value: 'Small', label: 'Small', sub: '12 oz' },
					{ value: 'Medium', label: 'Medium', sub: '16 oz' },
					{ value: 'Large', label: 'Large', sub: '20 oz' }
				]}
			/>
		</div>

		<div class="flex flex-col gap-2.5">
			<div class="flex items-center justify-between">
				<span class="text-sm font-semibold text-ink">Sweetness</span>
				<span class="text-sm text-ink-3"
					>{sugarWord(item.sugarLevelPercent ?? 50)} ({item.sugarLevelPercent ?? 50}% sugar)</span
				>
			</div>
			<input
				type="range"
				min="0"
				max="100"
				step="5"
				class="accent-accent"
				value={item.sugarLevelPercent ?? 50}
				oninput={(e) => (item.sugarLevelPercent = Number(e.currentTarget.value))}
				aria-label="Sweetness"
			/>
			<div class="flex flex-wrap gap-1.5">
				{#each SUGAR_PRESETS as [pct, presetLabel] (pct)}
					<button
						type="button"
						class={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
							item.sugarLevelPercent === pct
								? 'border-accent bg-accent-soft text-accent-strong'
								: 'border-line text-ink-2'
						}`}
						onclick={() => (item.sugarLevelPercent = pct)}
					>
						{presetLabel}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
