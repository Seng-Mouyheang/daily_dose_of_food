<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	import TextInput from '#lib/components/TextInput.svelte';
	import TileGroup from '#lib/components/TileGroup.svelte';
	import Select from '#lib/components/Select.svelte';
	import Slider from '#lib/components/Slider.svelte';
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
		[25, 'Barely sweet'],
		[50, 'Less sweet'],
		[75, 'Mild'],
		[100, 'Regular'],
		[125, 'Sweet'],
		[150, 'Extra sweet']
	] as const;

	function sugarWord(pct: number): string {
		let closest: (typeof SUGAR_PRESETS)[number] = SUGAR_PRESETS[2];
		for (const preset of SUGAR_PRESETS) {
			if (Math.abs(preset[0] - pct) < Math.abs(closest[0] - pct)) closest = preset;
		}
		return closest[1];
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
		<div class="flex flex-col gap-5">
			<Field label="Cuisine" for={`${idPrefix}-cuisine`}>
				<Select
					id={`${idPrefix}-cuisine`}
					groupLabel="Cuisine"
					bind:value={item.cuisineTypeId}
					bind:otherValue={item.cuisineTypeOther}
					options={cuisineTypes.map((c) => ({ value: c.id, label: c.name }))}
					allowOther
				/>
			</Field>
			<Field label="Type of dish" for={`${idPrefix}-foodtype`}>
				<Select
					id={`${idPrefix}-foodtype`}
					groupLabel="Type of dish"
					bind:value={
						() => item.foodTypeIds[0] ?? null, (v) => (item.foodTypeIds = v === null ? [] : [v])
					}
					bind:otherValue={item.foodTypeOther}
					options={foodTypes.map((f) => ({ value: f.id, label: f.name }))}
					allowOther
				/>
			</Field>
		</div>
	{:else}
		<Field label="Type of drink" for={`${idPrefix}-drinktype`}>
			<Select
				id={`${idPrefix}-drinktype`}
				groupLabel="Type of drink"
				bind:value={item.drinkTypeId}
				bind:otherValue={item.drinkTypeOther}
				options={drinkTypes.map((d) => ({ value: d.id, label: d.name }))}
				allowOther
			/>
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
					>{sugarWord(item.sugarLevelPercent ?? 100)} ({item.sugarLevelPercent ?? 100}% sugar)</span
				>
			</div>
			<Slider
				min={0}
				max={150}
				step={5}
				label="Sweetness"
				bind:value={() => item.sugarLevelPercent ?? 100, (v) => (item.sugarLevelPercent = v)}
			/>
			<div class="flex flex-wrap justify-center gap-1.5">
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
