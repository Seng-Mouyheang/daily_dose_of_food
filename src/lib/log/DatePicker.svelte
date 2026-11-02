<script lang="ts">
	import { tick } from 'svelte';
	import Icon from '#lib/components/Icon.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import { MONTHS, monthGrid } from '#lib/dashboard/period.ts';
	import { dayLabel, shiftMonth } from './day.ts';

	/** One day, picked from a month grid. On desktop it's a small floating square anchored to the
	 *  right edge of the field, over the form rather than pushing it down; on a phone it's a
	 *  bottom sheet with thumb-sized days. Days after `max` (today) can't be picked; there's no
	 *  earliest day.
	 *
	 *  A native <dialog> opened with showModal(), as the dashboard's range picker does: the
	 *  browser gives the focus trap, Esc and the backdrop click. Opened from inside the form's own
	 *  dialog it stacks on top, and Esc closes only this one. */
	let { value = $bindable(), max, id }: { value: string; max: string; id?: string } = $props();

	let dialog = $state<HTMLDialogElement>();
	let anchor = $state<HTMLElement>();
	let open = $state(false);
	// The month on screen; starts at the picked day's and follows the arrows.
	let view = $state('');
	let pos = $state({ top: 0, right: 0 });

	const month = $derived(view || value.slice(0, 7));
	const grid = $derived(monthGrid(month));
	const title = $derived(`${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`);
	const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
	// Roughly the popover's height: it's kept on screen when the field is low in the window.
	const POPOVER_HEIGHT = 400;

	async function show() {
		if (!anchor) return;
		view = value.slice(0, 7);
		const r = anchor.getBoundingClientRect();
		pos = {
			top: Math.max(8, Math.min(r.bottom + 8, window.innerHeight - POPOVER_HEIGHT - 8)),
			right: document.documentElement.clientWidth - r.right
		};
		open = true;
		// After the contents render, so focus lands inside the calendar and not on the bare dialog.
		await tick();
		dialog?.showModal();
	}
	function pick(day: string) {
		value = day;
		dialog?.close();
	}
</script>

<button
	{id}
	bind:this={anchor}
	type="button"
	aria-expanded={open}
	aria-haspopup="dialog"
	onclick={show}
	class="flex h-12 items-center gap-2 rounded-input border bg-surface px-3.5 text-left text-[15px] text-ink transition-colors hover:border-ink-3 focus-visible:border-accent {open
		? 'border-accent ring-[3px] ring-accent-soft'
		: 'border-line'}"
>
	<Icon name="calendar" size={18} class="text-accent-strong" />
	<span class="flex-1">{dayLabel(value, max)}</span>
	<Icon name="chevD" size={16} weight={2.2} class="text-ink-3" />
</button>

<dialog
	bind:this={dialog}
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && dialog?.close()}
	aria-label="Pick a day"
	style:--top="{pos.top}px"
	style:--right="{pos.right}px"
	class="picker m-0 mt-auto w-full max-w-none bg-transparent p-0 text-ink lg:fixed lg:top-(--top) lg:right-(--right) lg:left-auto lg:mt-0 lg:w-[340px]"
>
	{#if open}
		<div
			class="flex flex-col gap-3 rounded-t-[20px] bg-surface px-[18px] pt-2 pb-[26px] shadow-card-lg lg:rounded-card lg:border lg:border-line lg:p-4"
		>
			<div class="mx-auto mt-0.5 h-1 w-10 rounded-full bg-line lg:hidden" aria-hidden="true"></div>
			<div class="flex items-center justify-between lg:hidden">
				<h2 class="font-display text-lg font-semibold">Pick a day</h2>
				<IconButton icon="x" label="Close" size={18} onclick={() => dialog?.close()} />
			</div>

			<!-- Phone: the grid fills the sheet for big tap targets. Desktop: seven 44px columns, a
			     compact square whose numbers stay close enough to scan. -->
			<div class="mx-auto flex w-full max-w-[350px] flex-col gap-2.5 lg:w-[308px] lg:max-w-none">
				<div class="flex items-center justify-between">
					<IconButton
						icon="chevL"
						label="Previous month"
						size={18}
						onclick={() => (view = shiftMonth(month, -1))}
					/>
					<b class="text-[15px] font-semibold" aria-live="polite">{title}</b>
					<IconButton
						icon="chevR"
						label="Next month"
						size={18}
						inert={month >= max.slice(0, 7)}
						class={month >= max.slice(0, 7) ? 'opacity-30' : ''}
						onclick={() => (view = shiftMonth(month, 1))}
					/>
				</div>
				<div class="grid grid-cols-7 justify-items-center gap-y-0.5">
					{#each WEEK as w (w)}
						<small class="pt-1 pb-1.5 text-center text-xs font-semibold text-ink-3">{w}</small>
					{/each}
					{#each grid.days as d (d)}
						{@const off = d > max}
						{@const selected = d === value}
						<button
							type="button"
							disabled={off}
							aria-pressed={selected}
							aria-label={dayLabel(d, max)}
							onclick={() => pick(d)}
							style:grid-column-start={d === grid.days[0] ? grid.lead + 1 : undefined}
							class="group grid h-12 w-full place-items-center text-[15px] font-medium tabular-nums disabled:opacity-45 lg:h-11 lg:w-11 lg:text-sm"
						>
							<span
								class="grid h-10 w-10 place-items-center rounded-full transition-colors lg:h-[38px] lg:w-[38px] {selected
									? 'bg-accent font-bold text-on-accent'
									: ''} {d === max && !selected
									? 'ring-[1.5px] ring-accent ring-inset'
									: ''} {off || selected ? '' : 'group-hover:bg-sunken'}">{Number(d.slice(8))}</span
							>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</dialog>

<style>
	.picker::backdrop {
		background: var(--scrim);
	}
	/* A popover over the form, not a modal moment: no dimming on desktop. */
	@media (min-width: 1024px) {
		.picker::backdrop {
			background: transparent;
		}
	}
	.picker[open] > div {
		animation: picker-in 0.2s ease;
	}
	@keyframes picker-in {
		from {
			transform: translateY(100%);
		}
	}
	@media (min-width: 1024px) {
		.picker[open] > div {
			animation-name: picker-fade;
		}
		@keyframes picker-fade {
			from {
				opacity: 0;
			}
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.picker[open] > div {
			animation: none;
		}
	}
</style>
