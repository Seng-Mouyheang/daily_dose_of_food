<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import { addDays } from '#lib/dashboard/period.ts';
	import { clampDay, dayLabel, logHref, weekOf } from './day.ts';

	/** Mobile's way to move between days: the week around the day being looked at, one tap each.
	 *  Days are real links, so the choice is in the URL and survives a reload. Soft fill marks
	 *  days with logs, a ring marks today, solid orange is the day on screen. The date label
	 *  opens the month sheet for anything further away. */
	let {
		day,
		today,
		first,
		counts,
		onpickmonth
	}: {
		day: string;
		today: string;
		first: string;
		counts: Record<string, number>;
		onpickmonth: () => void;
	} = $props();

	const week = $derived(weekOf(day));
	const prev = $derived(
		addDays(week[0]!, -1) >= first ? clampDay(addDays(day, -7), first, today) : null
	);
	const next = $derived(
		addDays(week[0]!, 7) <= today ? clampDay(addDays(day, 7), first, today) : null
	);

	const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
</script>

<section
	aria-label="Pick a day"
	class="flex flex-col gap-3 rounded-card border border-line bg-surface px-2.5 py-3"
>
	<div class="flex items-center justify-between gap-1">
		<IconButton
			icon="chevL"
			label="Previous week"
			size={18}
			href={prev ? logHref(prev, today) : undefined}
			inert={!prev}
			class={prev ? '' : 'opacity-30'}
		/>
		<button
			type="button"
			onclick={onpickmonth}
			aria-haspopup="dialog"
			class="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-input px-2.5 text-[14.5px] hover:bg-sunken"
		>
			<Icon name="calendar" size={16} class="text-ink-3" />
			<b class="truncate font-semibold">{dayLabel(day, today, true)}</b>
			<Icon name="chevD" size={14} weight={2.2} class="text-ink-3" />
		</button>
		<IconButton
			icon="chevR"
			label="Next week"
			size={18}
			href={next ? logHref(next, today) : undefined}
			inert={!next}
			class={next ? '' : 'opacity-30'}
		/>
	</div>

	<ul class="grid grid-cols-7 gap-0.5">
		{#each week as d, i (d)}
			{@const off = d > today || d < first}
			{@const n = counts[d] ?? 0}
			{@const selected = d === day}
			<li class="flex">
				<svelte:element
					this={off ? 'span' : 'a'}
					href={off ? undefined : logHref(d, today)}
					aria-current={selected ? 'date' : undefined}
					aria-disabled={off ? 'true' : undefined}
					aria-label="{dayLabel(d, today)}{off ? '' : `, ${n} ${n === 1 ? 'log' : 'logs'}`}"
					data-sveltekit-reset="false"
					class="group flex min-h-[60px] flex-1 flex-col items-center gap-1.5 rounded-tile py-0.5 {off
						? 'opacity-45'
						: ''}"
				>
					<span
						class="grid h-10 w-10 place-items-center rounded-full text-[15.5px] font-semibold tabular-nums transition-colors {selected
							? 'bg-accent text-on-accent'
							: n
								? 'bg-accent-soft text-accent-strong'
								: 'text-ink-2'} {d === today && !selected
							? 'ring-[1.5px] ring-accent ring-inset'
							: ''} {off || selected ? '' : 'group-hover:bg-sunken'}">{Number(d.slice(8))}</span
					>
					<small
						class="text-[11px] font-bold tracking-[.06em] uppercase {selected
							? 'text-accent-strong'
							: 'text-ink-3'}">{WEEKDAY[i]}</small
					>
				</svelte:element>
			</li>
		{/each}
	</ul>
</section>
