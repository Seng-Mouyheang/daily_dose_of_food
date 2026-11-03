<script lang="ts">
	import { tick } from 'svelte';
	import Field from '#lib/components/Field.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import SegmentedControl from '#lib/components/SegmentedControl.svelte';
	import StarRating from '#lib/components/StarRating.svelte';
	import TileGroup from '#lib/components/TileGroup.svelte';
	import { money } from '#lib/dashboard/format.ts';
	import { MEAL_LABEL } from '#lib/review/card.ts';
	import { ratingWord } from '#lib/review/format.ts';
	import { priceOf, type LogForm } from './form.svelte.ts';
	import { lineTotal, MEALS } from './visits.ts';

	/** Step 2, "How was it?": meal, how you had it, what you paid, a rating that counts in your
	 *  averages, and a note. Each item has its price before tax (from last time), a quantity and
	 *  a heart for the ones you loved; the bill's tax and total sit under them like a receipt.
	 *  The last card offers the long version, a full review, for anything worth sharing. */
	let { form, busy = false }: { form: LogForm; busy?: boolean } = $props();

	// Most visits have no tax, so the row stays out of the way until asked for: "Add tax" opens it,
	// and clearing it puts the link back. A tax carried over from the item's last visit opens it too.
	let editingTax = $state(false);
	let taxInput = $state<HTMLInputElement>();
	const showTax = $derived(editingTax || form.taxPercent.trim() !== '');

	async function addTax() {
		editingTax = true;
		await tick();
		taxInput?.focus();
	}

	const mealOptions = MEALS.map((m) => ({ value: m, label: MEAL_LABEL[m]! }));
	const shortDay = $derived(
		new Date(`${form.date}T00:00:00Z`).toLocaleDateString('en-GB', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			timeZone: 'UTC'
		})
	);
</script>

<div class="flex flex-col gap-7">
	<div class="flex items-center gap-3 rounded-tile border border-line bg-surface p-3">
		<span
			class="grid h-[42px] w-[42px] flex-none place-items-center rounded-[11px] bg-accent-soft text-accent-strong"
		>
			<Icon name="pin" size={20} />
		</span>
		<span class="flex min-w-0 flex-1 flex-col">
			<b class="truncate text-[15px] font-semibold">{form.place?.name}</b>
			<small class="text-[13px] text-ink-2"
				>{shortDay} · {form.items.length} {form.items.length === 1 ? 'item' : 'items'}</small
			>
		</span>
		<button
			type="button"
			onclick={() => (form.step = 1)}
			class="min-h-11 rounded-input px-2.5 text-sm font-semibold text-accent-strong hover:bg-accent-soft"
			>Edit</button
		>
	</div>

	<Field label="Meal">
		<SegmentedControl options={mealOptions} bind:value={form.meal} groupLabel="Meal" />
	</Field>

	<Field label="How did you have it?">
		<TileGroup
			groupLabel="How you had it"
			bind:value={form.dining}
			options={[
				{ value: 'dine_in', label: 'Dine-in', icon: 'dine' },
				{ value: 'takeaway', label: 'Takeaway', icon: 'bag' },
				{ value: 'delivery', label: 'Delivery', icon: 'bike' }
			]}
		/>
	</Field>

	<Field label="What you paid" hint="Price each before tax, from last time">
		<!-- One card: the items, then the bill under them, split by hairlines. -->
		<div class="overflow-hidden rounded-tile border border-line bg-surface">
			<ul class="divide-y divide-line">
				{#each form.items as item (item.title)}
					<li class="flex flex-col gap-2.5 p-3.5">
						<div class="flex flex-col">
							<div class="-my-1.5 flex items-center">
								<b class="min-w-0 truncate text-[15px] font-semibold">{item.title}</b>
								<button
									type="button"
									aria-pressed={item.isFavorite}
									aria-label="Favorite: {item.title}"
									title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
									onclick={() => (item.isFavorite = !item.isFavorite)}
									class="grid h-11 w-11 flex-none place-items-center rounded-full transition-colors hover:bg-sunken {item.isFavorite
										? 'text-fav'
										: 'text-ink-3'}"
								>
									<Icon name="heart" size={18} filled={item.isFavorite} />
								</button>
							</div>
							<small class="text-[12.5px] text-ink-3 tabular-nums">
								{#if item.qty > 1}
									<b class="font-semibold text-ink-2"
										>{money(lineTotal(priceOf(item.price), item.qty))} for {item.qty}</b
									>
								{:else}
									Each
								{/if}
							</small>
						</div>
						<div class="flex items-center justify-between gap-3">
							<div
								role="group"
								aria-label="Quantity of {item.title}"
								class="flex flex-none items-center rounded-input bg-sunken"
							>
								<button
									type="button"
									disabled={item.qty <= 1}
									onclick={() => item.qty--}
									aria-label="One less"
									class="grid h-11 w-10 place-items-center rounded-input text-ink-2 enabled:hover:text-ink disabled:opacity-35"
									><Icon name="minus" size={15} weight={2.2} /></button
								>
								<b class="min-w-6 text-center text-sm font-semibold tabular-nums">{item.qty}</b>
								<button
									type="button"
									onclick={() => item.qty++}
									aria-label="One more"
									class="grid h-11 w-10 place-items-center rounded-input text-ink-2 hover:text-ink"
									><Icon name="plus" size={15} weight={2.2} /></button
								>
							</div>
							<label
								class="flex h-11 w-36 max-w-[55%] items-center gap-1.5 rounded-input bg-sunken px-3 focus-within:ring-[3px] focus-within:ring-accent-soft"
							>
								<span class="text-ink-3" aria-hidden="true">$</span>
								<input
									bind:value={item.price}
									inputmode="decimal"
									placeholder="0.00"
									aria-label="Price of one {item.title}, before tax"
									class="min-w-0 flex-1 bg-transparent text-right text-[15px] text-ink tabular-nums outline-none placeholder:text-ink-3"
								/>
							</label>
						</div>
					</li>
				{/each}
			</ul>

			<!-- The bill, like the receipt: what the items came to, the tax on it, what you paid. -->
			<dl class="flex flex-col gap-2 border-t border-line px-3.5 py-3 text-sm tabular-nums">
				<div class="flex justify-between text-ink-2">
					<dt>Subtotal</dt>
					<dd>{money(form.subtotal)}</dd>
				</div>
				{#if showTax}
					<!-- The tax % sits with its label on the left, so every amount stays flush right. -->
					<div class="flex items-center justify-between gap-3 text-ink-2">
						<dt class="flex items-center gap-3">
							<label for="log-tax">Tax</label>
							<label
								class="flex h-9 w-[76px] items-center gap-1.5 rounded-input bg-sunken px-2.5 focus-within:ring-[3px] focus-within:ring-accent-soft"
							>
								<input
									id="log-tax"
									bind:this={taxInput}
									bind:value={form.taxPercent}
									onblur={() => {
										if (!form.taxPercent.trim()) editingTax = false;
									}}
									inputmode="decimal"
									placeholder="0"
									class="min-w-0 flex-1 bg-transparent text-right text-sm text-ink tabular-nums outline-none placeholder:text-ink-3"
								/>
								<span class="text-ink-3" aria-hidden="true">%</span>
							</label>
						</dt>
						<dd>{money(form.tax)}</dd>
					</div>
				{:else}
					<div class="flex">
						<dt>
							<button
								type="button"
								onclick={addTax}
								class="group flex min-h-9 items-center gap-2.5 text-[13.5px] font-medium text-ink-3 transition-colors hover:text-ink"
							>
								<span
									class="grid h-6 w-6 place-items-center rounded-[8px] border border-dashed border-line-2 transition-colors group-hover:border-ink-2"
								>
									<Icon name="plus" size={14} weight={2} />
								</span>
								Add tax
							</button>
						</dt>
						<dd></dd>
					</div>
				{/if}
				<div class="flex justify-between border-t border-line pt-2 font-semibold text-ink">
					<dt>Total</dt>
					<dd>{money(form.total)}</dd>
				</div>
			</dl>
		</div>
	</Field>

	<Field
		label="How was it?"
		error={form.error === 'rate' ? 'Tap a star so this counts in your averages.' : undefined}
	>
		<div class="flex items-center justify-between gap-3">
			<StarRating bind:value={form.overall} label="Overall rating" size={32} />
			{#if form.overall}
				<span class="text-sm font-semibold text-ink-2">{ratingWord(form.overall)}</span>
			{/if}
		</div>
	</Field>

	<Field label="Note" optional for="log-note">
		<div class="relative">
			<textarea
				id="log-note"
				maxlength="200"
				rows="2"
				placeholder="Anything to remember? Less ice next time…"
				class="w-full rounded-input border border-line bg-surface px-3.5 py-3 pb-7 text-[15px] text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
				bind:value={form.note}></textarea>
			<p class="pointer-events-none absolute right-3 bottom-2.5 text-xs text-ink-3 tabular-nums">
				{form.note.length}/200
			</p>
		</div>
	</Field>

	<div class="flex flex-wrap items-center gap-3 rounded-tile bg-accent-soft p-3.5">
		<Icon name="sparkle" size={20} class="text-accent-strong" />
		<span class="flex min-w-40 flex-1 flex-col">
			<b class="text-[14.5px] font-semibold">Worth sharing?</b>
			<small class="text-[13px] text-ink-2"
				>Save this log, then turn it into a full review with photos and detailed ratings.</small
			>
		</span>
		<button
			type="submit"
			name="after"
			value="review"
			disabled={busy}
			class="min-h-11 rounded-input px-2.5 text-sm font-semibold text-accent-strong enabled:hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
			>Write a review</button
		>
	</div>
</div>
