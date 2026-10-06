<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import Button from '#lib/components/Button.svelte';
	import ReviewCard from '#lib/review/ReviewCard.svelte';
	import { ReviewDraft } from '#lib/review/draft.svelte.ts';
	import { buildPublishPayload } from '#lib/review/payload.ts';
	import Step1Visit from './steps/Step1Visit.svelte';
	import Step2Rating from './steps/Step2Rating.svelte';
	import Step3Photos from './steps/Step3Photos.svelte';
	import Step4Review from './steps/Step4Review.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const draft = new ReviewDraft();
	let stepError = $state<string | null>(null);
	let submitting = $state(false);
	let savedFlash = $state(false);

	onMount(() => draft.restoreFromLocalStorage());

	$effect(() => {
		draft.saveToLocalStorage();
	});

	const STEPS = [
		{ t: 'Visit details', sub: 'Tell us what you had and where you had it.' },
		{
			t: 'Rating & details',
			sub: 'Rate each part of the visit. Tap tags to note what stood out, good or bad.'
		},
		{ t: 'Photos', sub: 'The cover photo leads your review card in the feed.' },
		{ t: 'Review', sub: 'Look it over once more and choose who can see it.' }
	];

	function validateStep(): string | null {
		if (draft.step === 1 && !draft.place && !draft.newPlaceName.trim()) {
			return 'Pick a place, or add one, so this review shows up with the rest of your visits.';
		}
		if (draft.step === 2) {
			if (draft.hasDish && !draft.dish.itemName.trim()) {
				return 'Add a name so you can find this in your journal later.';
			}
			if (draft.hasBev && !draft.drink.itemName.trim()) {
				return 'Add a name so you can find this in your journal later.';
			}
		}
		return null;
	}

	function goNext() {
		const error = validateStep();
		if (error) {
			stepError = error;
			return;
		}
		stepError = null;
		draft.step += 1;
	}

	function goTo(step: number) {
		stepError = null;
		draft.step = step;
	}

	function saveDraftNow() {
		draft.saveToLocalStorage();
		savedFlash = true;
		setTimeout(() => (savedFlash = false), 2200);
	}

	const payloadJson = $derived(JSON.stringify(buildPublishPayload(draft.toSnapshot())));
</script>

<div class="min-h-screen bg-bg">
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden"
	>
		<a href="/" aria-label="Leave without publishing" class="-ml-2 p-2 text-ink-2">
			<Icon name="chevL" />
		</a>
		<span class="text-sm font-semibold text-ink">New review</span>
		<button type="button" class="text-sm font-medium text-accent-strong" onclick={saveDraftNow}>
			{savedFlash ? 'Saved' : 'Save draft'}
		</button>
	</header>

	<div
		class="flex gap-1.5 px-4 py-3 lg:hidden"
		role="progressbar"
		aria-valuenow={draft.step}
		aria-valuemin={1}
		aria-valuemax={4}
	>
		{#each STEPS as s, i (s.t)}
			<button
				type="button"
				class={`h-1.5 flex-1 rounded-full transition-colors ${i < draft.step ? 'bg-accent' : 'bg-line'}`}
				aria-label={`Go to step ${i + 1}: ${s.t}`}
				onclick={() => goTo(i + 1)}
			></button>
		{/each}
	</div>

	<div
		class="mx-auto max-w-6xl px-4 py-6 lg:grid lg:grid-cols-[256px_1fr_380px] lg:gap-8 lg:px-8 lg:py-10"
	>
		<aside class="hidden lg:block">
			<nav class="flex flex-col gap-1">
				{#each STEPS as s, i (s.t)}
					{@const stepNum = i + 1}
					<button
						type="button"
						class="flex items-center gap-2.5 rounded-input px-3 py-2.5 text-left text-sm font-medium transition-colors"
						class:text-accent-strong={draft.step === stepNum}
						class:text-ink-3={draft.step !== stepNum}
						aria-current={draft.step === stepNum ? 'step' : undefined}
						onclick={() => goTo(stepNum)}
					>
						<span
							class={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
								draft.step > stepNum
									? 'bg-accent text-on-accent'
									: draft.step === stepNum
										? 'border-2 border-accent text-accent-strong'
										: 'border border-line text-ink-3'
							}`}
						>
							{#if draft.step > stepNum}<Icon
									name="check"
									size={12}
									weight={3}
								/>{:else}{stepNum}{/if}
						</span>
						{s.t}
					</button>
				{/each}
			</nav>
			<p class="mt-4 px-3 text-xs text-ink-3">Drafts save as you go.</p>
		</aside>

		<div class="flex flex-col gap-6">
			<div>
				<p class="text-sm font-semibold text-accent-strong lg:hidden">Step {draft.step} of 4</p>
				<h1 class="font-display text-2xl font-semibold text-ink">{STEPS[draft.step - 1]?.t}</h1>
				<p class="mt-1 text-sm text-ink-3">{STEPS[draft.step - 1]?.sub}</p>
			</div>

			{#if stepError}
				<p
					class="rounded-input bg-bad-soft px-3.5 py-2.5 text-[13px] font-medium text-bad"
					role="alert"
				>
					{stepError}
				</p>
			{/if}
			{#if form?.message}
				<p
					class="rounded-input bg-bad-soft px-3.5 py-2.5 text-[13px] font-medium text-bad"
					role="alert"
				>
					{form.message}
				</p>
			{/if}

			<form
				method="POST"
				action="?/publish"
				use:enhance={() => {
					submitting = true;
					return async ({ result, update }) => {
						submitting = false;
						if (result.type === 'redirect') ReviewDraft.clearLocalStorage();
						await update();
					};
				}}
			>
				<input type="hidden" name="payload" value={payloadJson} />

				{#if draft.step === 1}
					<Step1Visit {draft} />
				{:else if draft.step === 2}
					<Step2Rating
						{draft}
						categories={data.lookups.categories}
						cuisineTypes={data.lookups.cuisineTypes}
						foodTypes={data.lookups.foodTypes}
						drinkTypes={data.lookups.drinkTypes}
					/>
				{:else if draft.step === 3}
					<Step3Photos {draft} />
				{:else}
					<Step4Review {draft} onEdit={goTo} />
				{/if}

				<div
					class="sticky bottom-0 -mx-4 mt-8 flex gap-3 border-t border-line bg-surface px-4 py-3 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0"
				>
					{#if draft.step > 1}
						<Button variant="ghost" onclick={() => (draft.step -= 1)}>Back</Button>
					{/if}
					{#if draft.step < 4}
						<Button class="flex-1" onclick={goNext}>
							{draft.step === 3 && draft.photos.length === 0 ? 'Skip photos' : 'Continue'}
						</Button>
					{:else}
						<Button type="submit" class="flex-1" disabled={submitting}>
							{submitting ? 'Publishing…' : 'Publish review'}
						</Button>
					{/if}
				</div>
			</form>
		</div>

		<aside class="hidden lg:block">
			<p class="mb-2 text-xs font-medium text-ink-3">Live preview</p>
			<ReviewCard draft={draft.toSnapshot()} categories={data.lookups.categories} />
		</aside>
	</div>
</div>
