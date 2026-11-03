<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import Stars from '#lib/components/Stars.svelte';
	import { money } from '#lib/dashboard/format.ts';
	import { MEAL_LABEL, VISIT_LABEL } from '#lib/review/card.ts';
	import { beforeTax, receipt, type Visit } from './visits.ts';

	/** One saved visit, opened from the day list: what you had, the bill like a receipt, how you
	 *  rated it and your note, with Delete (its toast offers Undo) and Write a review (opens the review form, filled in from it).
	 *  A bottom sheet on a phone and a 420px dialog on desktop: a native <dialog> opened with
	 *  showModal(), for the focus trap, Esc and an inert page behind it. */
	let {
		visit,
		onclose,
		ondelete,
		onreview
	}: {
		visit: Visit | null;
		onclose: () => void;
		ondelete: (visit: Visit) => void;
		onreview?: (visit: Visit) => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (visit && !dialog.open) dialog.showModal();
		else if (!visit && dialog.open) dialog.close();
	});

	const bill = $derived(visit ? receipt(visit.items) : null);
	const note = $derived(visit?.items.find((l) => l.note)?.note ?? null);
	const when = $derived(
		visit
			? new Date(`${visit.date}T00:00:00Z`).toLocaleDateString('en-GB', {
					weekday: 'short',
					day: 'numeric',
					month: 'short',
					timeZone: 'UTC'
				})
			: ''
	);
</script>

<dialog
	bind:this={dialog}
	{onclose}
	onclick={(e) => e.target === dialog && onclose()}
	aria-labelledby="visit-title"
	class="sheet sheet-fade-lg m-0 mt-auto w-full max-w-none bg-transparent p-0 text-ink lg:m-auto lg:w-[420px]"
>
	{#if visit && bill}
		<div
			class="flex flex-col gap-3.5 rounded-t-[20px] bg-surface px-[18px] pt-2 pb-[26px] shadow-card-lg lg:rounded-[18px] lg:p-5"
		>
			<div class="mx-auto mt-0.5 h-1 w-10 rounded-full bg-line lg:hidden" aria-hidden="true"></div>

			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0">
					<h2 id="visit-title" class="font-display text-[19px] font-semibold">{visit.place}</h2>
					<p class="mt-0.5 text-[13.5px] text-ink-2">
						{MEAL_LABEL[visit.meal]} · {VISIT_LABEL[visit.dining]} · {when}
					</p>
				</div>
				<IconButton icon="x" label="Close" size={18} onclick={onclose} class="-mt-1.5 -mr-2" />
			</div>

			<ul class="flex flex-col gap-2 text-[14.5px]">
				{#each visit.items as item (item.id)}
					<li class="flex justify-between gap-3">
						<span class="flex min-w-0 items-center gap-1.5">
							<span class="truncate">{item.qty > 1 ? `${item.qty}× ` : ''}{item.title}</span>
							{#if item.isFavorite}
								<Icon name="heart" size={14} filled class="text-fav" />
								<span class="sr-only">Favorite</span>
							{/if}
						</span>
						<span class="tabular-nums">{money(beforeTax(item))}</span>
					</li>
				{/each}
			</ul>

			<dl class="flex flex-col gap-1.5 border-t border-line pt-3 text-sm tabular-nums">
				{#if bill.tax > 0}
					<div class="flex justify-between text-ink-2">
						<dt>Subtotal</dt>
						<dd>{money(bill.subtotal)}</dd>
					</div>
					<div class="flex justify-between text-ink-2">
						<dt>Tax{bill.taxPercent ? ` · ${bill.taxPercent}%` : ''}</dt>
						<dd>{money(bill.tax)}</dd>
					</div>
				{/if}
				<div class="flex justify-between text-[15px] font-semibold">
					<dt>Total</dt>
					<dd>{money(bill.total)}</dd>
				</div>
			</dl>

			<div class="mt-1.5 flex items-center gap-2 text-sm font-semibold">
				<Stars value={visit.overall} size={17} />
				<span class="tabular-nums">{visit.overall.toFixed(1)}</span>
			</div>

			{#if note}
				<p class="rounded-input bg-bg px-3 py-2.5 text-sm leading-relaxed text-ink-2">{note}</p>
			{/if}

			<div class="mt-1 flex gap-2.5">
				<button
					type="button"
					onclick={() => ondelete(visit)}
					class="inline-flex h-[46px] flex-none items-center gap-2 rounded-input px-4 text-[15px] font-bold text-bad shadow-[inset_0_0_0_1px_var(--line-2)] transition-colors hover:bg-bad-soft"
				>
					<Icon name="trash" size={17} />Delete
				</button>
				<button
					type="button"
					disabled={!onreview}
					onclick={() => onreview?.(visit)}
					class="inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-input bg-accent text-[15px] font-bold text-on-accent enabled:hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Icon name="pencil" size={17} />Write a review
				</button>
			</div>
		</div>
	{/if}
</dialog>
