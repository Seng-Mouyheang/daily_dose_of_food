<script lang="ts">
	import { untrack } from 'svelte';
	import { goto, invalidateAll, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import { toast } from '#lib/components/toast.svelte.ts';
	import { addDays } from '#lib/dashboard/period.ts';
	import { dayLabel, daySummary, defaultMeal, logHref, monthSummary } from '#lib/log/day.ts';
	import DayList from '#lib/log/DayList.svelte';
	import DaySummary from '#lib/log/DaySummary.svelte';
	import MonthCalendar from '#lib/log/MonthCalendar.svelte';
	import MonthSheet from '#lib/log/MonthSheet.svelte';
	import MonthSummary from '#lib/log/MonthSummary.svelte';
	import WeekStrip from '#lib/log/WeekStrip.svelte';
	import LogVisitForm, { type Saved } from '#lib/log/LogVisitForm.svelte';
	import { groupVisits, MEALS, visitKey, type MealType } from '#lib/log/visits.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let sheet = $state(false);
	// Picking a day in the month sheet lands on a new day: that's the cue to put the sheet away.
	$effect(() => {
		void data.day;
		sheet = false;
	});

	const dayEntries = $derived(data.entries.filter((e) => e.date === data.day));
	const visits = $derived(groupVisits(dayEntries));
	const day = $derived(daySummary(dayEntries));
	const month = $derived(
		monthSummary(
			data.entries.filter((e) => e.date.startsWith(data.month)),
			data.month,
			data.today
		)
	);
	const isToday = $derived(data.day === data.today);
	const loggedToday = $derived((data.counts[data.today] ?? 0) > 0);
	// The Log a visit form. `id` makes each opening a fresh form; `notice` is what "Save and log
	// another" just saved, shown inside the form because a modal covers the app's toast.
	let formInit = $state<{
		id: number;
		date: string;
		meal: MealType;
		notice?: { text: string; undo: () => void };
	} | null>(null);
	let formCount = 0;
	// The visit just saved, pulsed once in the list so you can see where it landed.
	let flash = $state<string | null>(null);

	function openForm(meal?: MealType, notice?: { text: string; undo: () => void }, date = data.day) {
		formInit = {
			id: ++formCount,
			date,
			meal: meal ?? defaultMeal(visits.map((v) => v.meal)),
			notice
		};
	}

	// The + button's chooser links here as /log?add (or ?add=lunch): open the form, then tidy the URL.
	$effect(() => {
		const add = page.url.searchParams.get('add');
		if (add === null) return;
		untrack(() => openForm(MEALS.find((m) => m === add)));
		const clean = new URL(page.url.href);
		clean.searchParams.delete('add');
		replaceState(clean, {});
	});

	async function undoSave(ids: string[]) {
		await fetch('/api/log', {
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ids })
		});
		await invalidateAll();
	}

	async function onsaved(s: Saved, another: boolean) {
		const text = `Logged ${s.count} ${s.count === 1 ? 'item' : 'items'} at ${s.place}`;
		const undo = () => undoSave(s.ids);
		if (another) {
			// A fresh form on the same date and meal; Undo takes this save back and drops the notice.
			const notice = {
				text,
				undo: () => {
					void undo();
					if (formInit) formInit = { ...formInit, notice: undefined };
				}
			};
			openForm(s.meal, notice, s.date);
		} else {
			formInit = null;
			toast.show(text, undo);
		}
		const key = visitKey({ ...s, reviewId: null });
		await goto(logHref(s.date, data.today), { invalidateAll: true });
		flash = key;
		setTimeout(() => {
			if (flash === key) flash = null;
		}, 2600);
	}

	const prevDay = $derived(data.day > data.first ? addDays(data.day, -1) : null);
	const nextDay = $derived(isToday ? null : addDays(data.day, 1));
</script>

<svelte:head><title>Log · Daily Dose of Food</title></svelte:head>

<main
	class="mx-auto flex max-w-[1120px] flex-col gap-3.5 px-3.5 pt-4 pb-7 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-[18px] lg:px-7 lg:pt-7 lg:pb-12"
>
	<header class="flex items-end justify-between gap-4 lg:col-span-2">
		<div>
			<h1 class="font-display text-[26px] font-semibold tracking-[-.01em] lg:text-[28px]">Log</h1>
			<p class="mt-1 hidden text-[14.5px] text-ink-2 lg:block">
				Everything you ate and drank, day by day.
			</p>
		</div>
		<button
			type="button"
			onclick={() => openForm()}
			class="hidden h-11 items-center gap-1.5 rounded-input bg-accent px-4 text-sm font-bold text-on-accent hover:brightness-90 lg:inline-flex"
		>
			<Icon name="plus" size={16} weight={2.4} />Log a visit
		</button>
	</header>

	<div class="lg:hidden">
		<WeekStrip
			day={data.day}
			today={data.today}
			first={data.first}
			counts={data.counts}
			onpickmonth={() => (sheet = true)}
		/>
	</div>

	<div class="hidden flex-col gap-[18px] lg:flex">
		<section aria-label="Calendar" class="rounded-card border border-line bg-surface p-4">
			<MonthCalendar
				month={data.month}
				day={data.day}
				today={data.today}
				first={data.first}
				counts={data.counts}
			/>
		</section>
		<MonthSummary
			summary={month}
			month={data.month}
			today={data.today}
			streak={data.streak}
			{loggedToday}
		/>
	</div>

	<div class="flex min-w-0 flex-col gap-3.5 lg:gap-[18px]">
		<div class="hidden min-h-11 items-center justify-between gap-3 px-0.5 lg:flex">
			<div class="flex min-w-0 items-center gap-1">
				<IconButton
					icon="chevL"
					label="Previous day"
					size={18}
					href={prevDay ? logHref(prevDay, data.today) : undefined}
					inert={!prevDay}
					class={prevDay ? '' : 'opacity-30'}
				/>
				<h2 class="truncate font-display text-[21px] font-semibold">
					{dayLabel(data.day, data.today)}
				</h2>
				<IconButton
					icon="chevR"
					label="Next day"
					size={18}
					href={nextDay ? logHref(nextDay, data.today) : undefined}
					inert={!nextDay}
					class={nextDay ? '' : 'opacity-30'}
				/>
			</div>
			{#if !isToday}
				<a
					href={logHref(data.today, data.today)}
					class="border-line-2 inline-flex h-[34px] flex-none items-center rounded-input border px-3 text-[13.5px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink"
					>Back to today</a
				>
			{/if}
		</div>

		{#if visits.length}
			<DaySummary
				summary={day}
				dailyBudget={data.dailyBudget}
				streak={data.streak}
				{loggedToday}
				showStreak={isToday}
			/>
		{/if}
		<DayList {visits} {isToday} {flash} onadd={openForm} />
	</div>
</main>

<MonthSheet open={sheet} onclose={() => (sheet = false)}>
	<MonthCalendar
		month={data.month}
		day={data.day}
		today={data.today}
		first={data.first}
		counts={data.counts}
	/>
	<a
		href={logHref(data.today, data.today)}
		onclick={() => (sheet = false)}
		class="inline-flex h-11 items-center justify-center rounded-input bg-sunken text-sm font-semibold"
		>Go to today</a
	>
</MonthSheet>

{#if formInit}
	{#key formInit.id}
		<LogVisitForm
			date={formInit.date}
			meal={formInit.meal}
			today={data.today}
			notice={formInit.notice}
			onclose={() => (formInit = null)}
			{onsaved}
		/>
	{/key}
{/if}
