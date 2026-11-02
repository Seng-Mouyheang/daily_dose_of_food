<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import Button from '#lib/components/Button.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import { LogForm } from './form.svelte.ts';
	import LogStepHow from './LogStepHow.svelte';
	import LogStepWhere from './LogStepWhere.svelte';
	import type { HistoryRow, PlaceSuggestion } from './suggest.ts';
	import type { DiningType, MealType } from './visits.ts';

	export interface Saved {
		ids: string[];
		date: string;
		meal: MealType;
		dining: DiningType;
		count: number;
		place: string;
	}

	/** Log a visit, in two steps: where and what, then how it was. A full-screen sheet on a
	 *  phone and a 600px dialog on desktop. A native <dialog> opened with showModal(): focus
	 *  trap, Esc and an inert page behind it come from the browser.
	 *
	 *  Saving posts the visit to the page's `save` action. "Save and log another" reopens a fresh
	 *  form on the same date and meal; its confirmation, with Undo, sits inside the form because
	 *  the app's toast would be hidden behind a modal. */
	let {
		date,
		meal,
		today,
		notice,
		onclose,
		onsaved
	}: {
		date: string;
		meal: MealType;
		today: string;
		/** What the last "Save and log another" saved, with a way to take it back */
		notice?: { text: string; undo: () => void };
		onclose: () => void;
		onsaved: (saved: Saved, another: boolean) => void;
	} = $props();

	// The parent mounts a fresh form each time it opens, so seeding from props once is the point.
	// svelte-ignore state_referenced_locally
	const form = new LogForm(date, meal);
	let dialog = $state<HTMLDialogElement>();
	let suggestions = $state<{ items: HistoryRow[]; places: PlaceSuggestion[] } | null>(null);
	let busy = $state(false);
	let failure = $state('');
	let scroller = $state<HTMLElement>();

	onMount(() => {
		dialog?.showModal();
		fetch('/api/log/suggestions')
			.then((r) => (r.ok ? r.json() : null))
			.then((s) => (suggestions = s))
			.catch(() => {}); // the form still works, just without suggestions
	});

	const TITLES = ['Where and what', 'How was it?'] as const;

	function go(step: 1 | 2) {
		if (step === 1) form.step = 1;
		else if (!form.next()) return;
		scroller?.scrollTo({ top: 0 });
	}

	// Enter inside a field must not submit the form: on step 2 it would save mid-edit.
	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault();
	}
</script>

<dialog
	bind:this={dialog}
	{onclose}
	onclick={(e) => e.target === dialog && onclose()}
	aria-labelledby="log-form-title"
	class="m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-ink lg:m-auto lg:h-auto lg:max-h-[calc(100dvh-64px)] lg:w-[600px]"
>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<form
		method="POST"
		action="/log?/save"
		{onkeydown}
		use:enhance={({ formData, cancel, submitter }) => {
			if (!form.canSave()) return cancel();
			const another = submitter?.getAttribute('value') === 'another';
			formData.set('payload', JSON.stringify(form.payload()));
			busy = true;
			failure = '';
			return async ({ result }) => {
				busy = false;
				if (result.type === 'success' && result.data?.saved) {
					onsaved({ ...result.data.saved, place: form.place!.name } as Saved, another);
				} else if (result.type === 'failure') {
					failure = String(result.data?.message ?? 'Could not save. Try again.');
				} else failure = 'Could not save. Check your connection and try again.';
			};
		}}
		class="flex h-full flex-col bg-bg lg:max-h-[inherit] lg:overflow-hidden lg:rounded-[20px] lg:shadow-card-lg"
	>
		<input type="hidden" name="payload" value="" />

		<header class="flex flex-col gap-3 border-b border-line bg-surface px-5 pt-4 pb-4 lg:px-6">
			<div class="flex items-start justify-between gap-3">
				<div>
					<p class="text-[13px] font-semibold text-accent-strong">
						Log a visit · Step {form.step} of 2
					</p>
					<h2 id="log-form-title" class="font-display text-[22px] font-semibold">
						{TITLES[form.step - 1]}
					</h2>
				</div>
				<IconButton icon="x" label="Close" size={20} onclick={onclose} />
			</div>
			<div class="grid grid-cols-2 gap-1.5" aria-hidden="true">
				<span class="h-1 rounded-full bg-accent"></span>
				<span class="h-1 rounded-full {form.step === 2 ? 'bg-accent' : 'bg-line'}"></span>
			</div>
		</header>

		<div bind:this={scroller} class="flex-1 overflow-y-auto px-5 pt-5 pb-8 lg:px-6">
			{#if notice && form.step === 1}
				<p
					role="status"
					class="mb-5 flex items-center justify-between gap-3 rounded-tile bg-accent-soft px-3.5 py-2.5 text-sm font-semibold"
				>
					<span class="flex items-center gap-2"
						><Icon
							name="check"
							size={16}
							weight={2.4}
							class="text-accent-strong"
						/>{notice.text}</span
					>
					<button
						type="button"
						onclick={notice.undo}
						class="min-h-9 rounded-md px-1.5 font-bold text-accent-strong hover:bg-surface"
						>Undo</button
					>
				</p>
			{/if}
			{#if form.step === 1}
				<LogStepWhere {form} {today} {suggestions} />
			{:else}
				<LogStepHow {form} />
			{/if}
		</div>

		<footer
			class="flex flex-col gap-2 border-t border-line bg-surface px-5 py-3 pb-5 lg:px-6 lg:pb-3"
		>
			{#if failure}<p role="alert" class="text-[13px] font-medium text-bad">{failure}</p>{/if}
			<div class="flex items-center justify-between gap-2">
				{#if form.step === 1}
					<Button variant="ghost" onclick={onclose}>Cancel</Button>
					<Button class="min-w-40" onclick={() => go(2)}
						>Continue<Icon name="chevR" size={18} weight={2.4} /></Button
					>
				{:else}
					<Button variant="ghost" onclick={() => go(1)} aria-label="Back"
						><Icon name="chevL" size={18} weight={2.2} /><span class="hidden sm:inline">Back</span
						></Button
					>
					<span class="flex items-center gap-1">
						<button
							type="submit"
							name="another"
							value="another"
							disabled={busy}
							class="min-h-11 rounded-input px-2.5 text-sm font-semibold text-ink-2 hover:bg-sunken hover:text-ink disabled:opacity-50"
							>Save and log another</button
						>
						<Button type="submit" disabled={busy} class="px-4"
							><Icon name="check" size={18} weight={2.4} />Save log</Button
						>
					</span>
				{/if}
			</div>
		</footer>
	</form>
</dialog>

<style>
	dialog::backdrop {
		background: var(--scrim);
	}
</style>
