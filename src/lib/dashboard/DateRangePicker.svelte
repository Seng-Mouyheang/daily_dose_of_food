<script lang="ts">
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import {
		PRESETS,
		addDays,
		dashboardHref,
		MONTHS,
		labelFor,
		monthGrid,
		presetLabel,
		presetRange,
		short,
		type Preset
	} from './period.ts';

	/** Custom range picker: a bottom sheet on a phone, a popover under the period controls on
	 *  desktop. Native <dialog> + showModal() for the focus trap, Esc and inert page behind it.
	 *  The selection is a draft until Show, which navigates to the custom-range URL. */
	let {
		open,
		start,
		end,
		today,
		firstLog,
		anchor,
		onclose
	}: {
		open: boolean;
		/** The range to open on (the current period). */
		start: string;
		end: string;
		today: string;
		firstLog: string;
		/** Element the desktop popover hangs under, right-aligned. */
		anchor: HTMLElement | undefined;
		onclose: () => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let a = $state('');
	let b = $state<string | null>(null);
	let view = $state('');
	let pos = $state({ top: 0, right: 0 });

	const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			const from = start < firstLog ? firstLog : start;
			const to = end > today ? today : end;
			a = from;
			b = to < from ? from : to;
			view = b.slice(0, 7);
			if (anchor) {
				const r = anchor.getBoundingClientRect();
				pos = { top: r.bottom + 8, right: document.documentElement.clientWidth - r.right };
			}
			// After the sheet's contents render, so focus lands inside it, not on the bare dialog.
			void tick().then(() => dialog?.showModal());
		} else if (!open && dialog.open) dialog.close();
	});

	const grid = $derived(view ? monthGrid(view) : { lead: 0, days: [] });
	const shift = (n: number) => addDays(`${view}-15`, n * 30).slice(0, 7);
	const days = $derived(b ? Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1 : 0);
	/** A preset cut to start no earlier than the first log; unusable if it ends before it. */
	const presetOf = (k: Preset) => {
		const r = presetRange(k, today);
		return { from: r.from < firstLog ? firstLog : r.from, to: r.to, ok: r.to >= firstLog };
	};
	const preset = $derived(
		PRESETS.find((k) => {
			const r = presetOf(k);
			return r.ok && r.from === a && r.to === b;
		})
	);
	const full = (iso: string) =>
		new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		});

	function pick(iso: string) {
		if (!a || b || iso < a) {
			a = iso;
			b = null;
		} else b = iso;
	}
	function usePreset(k: Preset) {
		const r = presetOf(k);
		if (!r.ok) return;
		a = r.from;
		b = r.to;
		view = r.to.slice(0, 7);
	}
	function show() {
		if (!b) return;
		onclose();
		void goto(dashboardHref({ per: 'custom', off: 0, from: a, to: b }));
	}
</script>

<dialog
	bind:this={dialog}
	{onclose}
	onclick={(e) => e.target === dialog && onclose()}
	aria-labelledby="range-title"
	style:--top="{pos.top}px"
	style:--right="{pos.right}px"
	class="picker m-0 mt-auto w-full max-w-none bg-transparent p-0 text-ink lg:fixed lg:top-(--top) lg:right-(--right) lg:left-auto lg:mt-0 lg:w-[372px]"
>
	{#if open && a}
		<div
			class="flex flex-col gap-3 rounded-t-[20px] bg-surface px-[18px] pt-2 pb-[22px] shadow-card-lg lg:rounded-card lg:border lg:border-line lg:pt-4 lg:pb-[18px]"
		>
			<div class="mx-auto mt-0.5 h-1 w-10 rounded-full bg-line lg:hidden" aria-hidden="true"></div>
			<div class="flex items-center justify-between">
				<h2 id="range-title" class="font-display text-lg font-semibold">Custom range</h2>
				<IconButton icon="x" label="Close" size={18} onclick={onclose} />
			</div>

			<div
				class="-mx-[18px] flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-[18px] lg:flex-wrap lg:overflow-visible"
			>
				{#each PRESETS as k (k)}
					{@const on = preset === k}
					<button
						type="button"
						aria-pressed={on}
						disabled={!presetOf(k).ok}
						onclick={() => usePreset(k)}
						class={`h-[30px] flex-none rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors disabled:cursor-default disabled:opacity-45 ${
							on
								? 'border-transparent bg-accent-soft text-accent-strong'
								: 'border-line text-ink-2 hover:border-ink-3'
						}`}>{presetLabel(k, today)}</button
					>
				{/each}
			</div>

			<div class="flex items-center justify-between">
				<IconButton
					icon="chevL"
					label="Previous month"
					size={18}
					inert={view <= firstLog.slice(0, 7)}
					class={view <= firstLog.slice(0, 7) ? 'opacity-30' : ''}
					onclick={() => (view = shift(-1))}
				/>
				<b class="text-[15px] font-semibold" aria-live="polite"
					>{MONTHS[Number(view.slice(5, 7)) - 1]} {view.slice(0, 4)}</b
				>
				<IconButton
					icon="chevR"
					label="Next month"
					size={18}
					inert={view >= today.slice(0, 7)}
					class={view >= today.slice(0, 7) ? 'opacity-30' : ''}
					onclick={() => (view = shift(1))}
				/>
			</div>

			<div
				class="grid grid-cols-7 gap-y-0.5"
				style:--band="color-mix(in srgb, var(--color-accent) 20%, transparent)"
			>
				{#each WEEK as w (w)}
					<small class="pt-1 pb-1.5 text-center text-xs font-semibold text-ink-3">{w}</small>
				{/each}
				{#each { length: grid.lead }, i (i)}<span></span>{/each}
				{#each grid.days as iso (iso)}
					{@const off = iso > today || iso < firstLog}
					{@const isA = iso === a}
					{@const isB = b === iso}
					{@const edge = b !== null && a !== b}
					{@const inside = b !== null && iso > a && iso < b}
					{@const band = inside
						? 'bg-(color:--band)'
						: edge && isA
							? 'bg-[linear-gradient(90deg,transparent_50%,var(--band)_50%)]'
							: edge && isB
								? 'bg-[linear-gradient(90deg,var(--band)_50%,transparent_50%)]'
								: ''}
					<button
						type="button"
						disabled={off}
						aria-pressed={isA || isB}
						aria-label={full(iso)}
						onclick={() => pick(iso)}
						class={`group grid h-[42px] place-items-center text-[14.5px] font-medium tabular-nums disabled:cursor-default disabled:text-ink-3 disabled:opacity-45 ${band}`}
					>
						<span
							class={`grid h-[38px] w-[38px] place-items-center rounded-full ${
								isA || isB
									? 'bg-accent font-bold text-on-accent'
									: `group-enabled:group-hover:bg-sunken ${inside ? 'font-bold text-accent-strong' : ''}`
							} ${iso === today && !isA && !isB ? 'shadow-[inset_0_0_0_1.5px_var(--color-accent)]' : ''}`}
							>{Number(iso.slice(8))}</span
						>
					</button>
				{/each}
			</div>

			<div class="flex items-baseline justify-between gap-2.5 border-t border-line pt-3 text-sm">
				{#if b}
					<b class="font-semibold">{labelFor('custom', a, b)}</b>
					<span class="text-[13px] text-ink-2">{days} day{days === 1 ? '' : 's'}</span>
				{:else}
					<b class="font-semibold">{short(a)} –</b>
					<span class="text-[13px] text-ink-2">Pick an end date</span>
				{/if}
			</div>

			<div class="flex justify-end gap-2.5 text-sm font-semibold">
				<button
					type="button"
					onclick={onclose}
					class="h-11 rounded-input px-4 text-ink-2 hover:bg-sunken hover:text-ink">Cancel</button
				>
				<button
					type="button"
					disabled={!b}
					onclick={show}
					class="h-11 flex-1 rounded-input bg-accent px-4 font-bold text-white hover:brightness-95 disabled:opacity-45 lg:min-w-[150px] lg:flex-none"
					>Show {b ? `${days} day${days === 1 ? '' : 's'}` : 'range'}</button
				>
			</div>
		</div>
	{/if}
</dialog>

<style>
	.picker::backdrop {
		background: var(--scrim);
	}
	.picker[open] > div {
		animation: sheet-up 0.22s ease;
	}
	@keyframes sheet-up {
		from {
			transform: translateY(100%);
		}
	}
	@media (min-width: 64rem) {
		.picker::backdrop {
			background: rgba(20, 14, 10, 0.18);
		}
		.picker[open] > div {
			animation: fade 0.15s;
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.picker[open] > div {
			animation: none;
		}
	}
</style>
