<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import Button from '#lib/components/Button.svelte';
	import CollapsibleRail from '#lib/components/CollapsibleRail.svelte';
	import ReviewCard from '#lib/review/ReviewCard.svelte';
	import { cardViewFromDraft } from '#lib/review/card.ts';
	import { ReviewDraft } from '#lib/review/draft.svelte.ts';
	import { buildPublishPayload, type ReviewDraftSnapshot } from '#lib/review/payload.ts';
	// Type-only: erased at build, so this never pulls server code into the client bundle.
	import type { getReviewFormLookups } from '#lib/server/lookups.ts';
	import Step1Visit from './steps/Step1Visit.svelte';
	import Step2Rating from './steps/Step2Rating.svelte';
	import Step3Photos from './steps/Step3Photos.svelte';
	import Step4Review from './steps/Step4Review.svelte';
	import VisibilityPicker from './steps/VisibilityPicker.svelte';
	import InfoTooltip from '#lib/components/InfoTooltip.svelte';

	/** The four-step review form, shared by Write a review (`mode: 'new'`) and Edit review
	 *  (`mode: 'edit'`). Edit starts filled in from `initial`, opens on step 4 so every section's
	 *  Edit link works as a shortcut, never touches the new-review draft in localStorage, and
	 *  posts to the edit route's `save` action instead of `publish`. */
	let {
		lookups,
		user,
		formMessage = null,
		mode = 'new',
		initial = null
	}: {
		lookups: Awaited<ReturnType<typeof getReviewFormLookups>>;
		user: { displayName: string; avatarUrl: string | null } | null;
		formMessage?: string | null;
		mode?: 'new' | 'edit';
		/** Required in edit mode: the review as it stands, in the wizard's own shape. */
		initial?: ReviewDraftSnapshot | null;
	} = $props();

	const isEdit = $derived(mode === 'edit');
	const draft = new ReviewDraft();
	// Read once, on purpose: the form owns its state from here on.
	// svelte-ignore state_referenced_locally
	if (initial) draft.loadFrom(initial);
	/** The step a failed Continue/sidebar jump last landed on, or null if none has failed
	 *  since. Paired with `stepError` below (derived, not stored) rather than a plain message
	 *  string, so the banner — and the red field outlines driven by the same checks — clear
	 *  themselves the instant the underlying field becomes valid, without waiting for another
	 *  navigation attempt. */
	let attemptedStep = $state<number | null>(null);
	let submitting = $state(false);
	let savedFlash = $state(false);

	/** The live preview card. `user` is null only for the split second before the layout's
	 *  load resolves (and this page redirects a signed-out visitor anyway), so "You" is the
	 *  placeholder name rather than a real anonymous state. */
	const previewView = $derived(
		cardViewFromDraft(draft.toSnapshot(), lookups, {
			displayName: user?.displayName ?? 'You',
			avatarUrl: user?.avatarUrl ?? null
		})
	);

	// The localStorage draft is the new-review one only. An edit must never overwrite (or be
	// overwritten by) a half-written new review.
	onMount(() => {
		if (!isEdit) draft.restoreFromLocalStorage();
	});

	$effect(() => {
		if (!isEdit) draft.saveToLocalStorage();
	});

	const STEPS = $derived([
		{
			t: 'Visit details',
			sub: 'What, where and when',
			body: 'Tell us what you had and where you had it.'
		},
		{
			t: 'Rating & details',
			sub: 'Score it and add notes',
			body: 'Rate each part of the visit. Tap tags to note what stood out, good or bad.'
		},
		{
			t: 'Photos',
			sub: 'Add photos, pick a cover',
			body: 'The cover photo leads your review card in the feed.'
		},
		{
			t: 'Review',
			sub: isEdit ? 'Check it and save' : 'Check it and publish',
			body: 'Look it over once more and choose who can see it.'
		}
	]);

	function validateStep(step: number): string | null {
		if (step === 1) {
			if (!draft.visitedAt.trim()) {
				return 'Please choose when you visited.';
			}
			if (!draft.place && !draft.newPlaceName.trim()) {
				return 'Please enter the name or location of the place.';
			}
		}
		if (step === 2) {
			if (draft.hasDish && !draft.dish.itemName.trim()) {
				return 'Please enter the name of the dish or drink.';
			}
			if (draft.hasBev && !draft.drink.itemName.trim()) {
				return 'Please enter the name of the dish or drink.';
			}
		}
		return null;
	}

	/** The first step (1-based) that isn't satisfied yet, or null once every step up to and
	 *  including `upTo` passes — the furthest a jump is allowed to land without passing
	 *  through unfinished required fields. */
	function firstInvalidStep(upTo: number): number | null {
		for (let step = 1; step <= upTo; step++) {
			if (validateStep(step)) return step;
		}
		return null;
	}

	// Re-evaluated live against the current draft rather than frozen at the moment Continue
	// was clicked, so it (and the field-level `invalid` flags built on the same checks below)
	// disappear as soon as the user fixes the field — not just on the next failed attempt.
	const stepError = $derived(attemptedStep === draft.step ? validateStep(draft.step) : null);

	/** Clears the red/banner immediately on the first sign the user is engaging with the
	 *  flagged field — typing, picking a search result, clicking "Change" — rather than only
	 *  once the field happens to already hold a valid value. Without this, `attemptedStep`
	 *  stays pinned from the original failed attempt: typing in a field that doesn't yet
	 *  satisfy the check keeps it stuck red, and later clearing an already-valid field (e.g.
	 *  "Change" on a chosen place) makes the stale attempt immediately re-fire. Re-flagged only
	 *  by the next real Continue/sidebar attempt, same as before. */
	function dismissAttempt() {
		attemptedStep = null;
	}
	const dateInvalid = $derived(attemptedStep === 1 && !draft.visitedAt.trim());
	const placeInvalid = $derived(attemptedStep === 1 && !draft.place && !draft.newPlaceName.trim());
	const dishNameInvalid = $derived(
		attemptedStep === 2 && draft.hasDish && !draft.dish.itemName.trim()
	);
	const drinkNameInvalid = $derived(
		attemptedStep === 2 && draft.hasBev && !draft.drink.itemName.trim()
	);

	function goNext() {
		if (validateStep(draft.step)) {
			attemptedStep = draft.step;
			return;
		}
		draft.step += 1;
	}

	/** Used by both the sidebar step list and the mobile progress dots. Moving backward (or
	 *  staying put) is always allowed — there's nothing to bypass there. Moving forward re-runs
	 *  validation for every step along the way, the same checks `goNext` already enforces, so
	 *  jumping ahead in the sidebar can't skip past a required field `goNext` would have caught. */
	function goTo(step: number) {
		if (step <= draft.step) {
			draft.step = step;
			return;
		}
		const blockedAt = firstInvalidStep(step - 1);
		if (blockedAt) {
			attemptedStep = blockedAt;
			draft.step = blockedAt;
			return;
		}
		draft.step = step;
	}

	function saveDraftNow() {
		draft.saveToLocalStorage();
		savedFlash = true;
		setTimeout(() => (savedFlash = false), 2200);
	}

	const payloadJson = $derived(JSON.stringify(buildPublishPayload(draft.toSnapshot())));
</script>

<div class="min-h-screen bg-bg lg:flex lg:h-[calc(100dvh_-_4rem)] lg:min-h-0 lg:overflow-hidden">
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden"
	>
		<a
			href={isEdit ? `/review/${draft.reviewId}` : '/'}
			aria-label={isEdit ? 'Leave without saving' : 'Leave without publishing'}
			class="-ml-2 p-2 text-ink-2"
		>
			<Icon name="chevL" />
		</a>
		<span class="text-sm font-semibold text-ink">{isEdit ? 'Edit review' : 'New review'}</span>
		{#if isEdit}
			<span class="w-9" aria-hidden="true"></span>
		{:else}
			<button type="button" class="text-sm font-medium text-accent-strong" onclick={saveDraftNow}>
				{savedFlash ? 'Saved' : 'Save draft'}
			</button>
		{/if}
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

	<!-- Left rail: step nav (desktop only). -->
	<CollapsibleRail
		side="left"
		widthPx={280}
		storageKey="ddf-review-left-collapsed"
		label="step navigation"
		asideClass="px-6 py-8 lg:overflow-y-auto"
	>
		<h2 class="font-display text-xl font-semibold text-ink">
			{isEdit ? 'Edit review' : 'New review'}
		</h2>
		<nav class="mt-6 flex flex-col gap-1">
			{#each STEPS as s, i (s.t)}
				{@const stepNum = i + 1}
				<button
					type="button"
					class={`flex items-start gap-3 rounded-input px-3 py-2.5 text-left transition-colors ${
						draft.step === stepNum ? 'bg-accent-soft' : 'hover:bg-sunken'
					}`}
					aria-current={draft.step === stepNum ? 'step' : undefined}
					onclick={() => goTo(stepNum)}
				>
					<span
						class={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
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
					<span class="flex flex-col">
						<span
							class={`text-sm font-semibold ${draft.step === stepNum ? 'text-accent-strong' : 'text-ink'}`}
							>{s.t}</span
						>
						<span class="text-xs text-ink-3">{s.sub}</span>
					</span>
				</button>
			{/each}
		</nav>
	</CollapsibleRail>

	<!-- Centre: the step content + sticky action footer. -->
	<div class="no-scrollbar flex min-w-0 flex-1 flex-col lg:h-full lg:overflow-y-auto">
		<form
			method="POST"
			action={isEdit ? '?/save' : '?/publish'}
			class="flex flex-1 flex-col"
			use:enhance={() => {
				submitting = true;
				return async ({ result, update }) => {
					submitting = false;
					if (result.type === 'redirect' && !isEdit) ReviewDraft.clearLocalStorage();
					await update();
				};
			}}
		>
			<input type="hidden" name="payload" value={payloadJson} />

			<div class="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 lg:px-10 lg:py-10">
				<div>
					<p class="text-sm font-semibold text-accent-strong">Step {draft.step} of 4</p>
					<h1 class="mt-1 font-display text-2xl font-semibold text-ink lg:text-4xl">
						{STEPS[draft.step - 1]?.t}
					</h1>
					<p class="mt-1 text-sm text-ink-3">{STEPS[draft.step - 1]?.body}</p>
				</div>

				{#if stepError}
					<p
						class="rounded-input bg-bad-soft px-3.5 py-2.5 text-[13px] font-medium text-bad"
						role="alert"
					>
						{stepError}
					</p>
				{/if}
				{#if formMessage}
					<p
						class="rounded-input bg-bad-soft px-3.5 py-2.5 text-[13px] font-medium text-bad"
						role="alert"
					>
						{formMessage}
					</p>
				{/if}

				{#if draft.step === 1}
					<Step1Visit {draft} {dateInvalid} invalid={placeInvalid} onDismiss={dismissAttempt} />
				{:else if draft.step === 2}
					<Step2Rating
						{draft}
						categories={lookups.categories}
						cuisineTypes={lookups.cuisineTypes}
						foodTypes={lookups.foodTypes}
						drinkTypes={lookups.drinkTypes}
						{dishNameInvalid}
						{drinkNameInvalid}
						onDismiss={dismissAttempt}
					/>
				{:else if draft.step === 3}
					<Step3Photos {draft} />
				{:else}
					<Step4Review
						{draft}
						categories={lookups.categories}
						cuisineTypes={lookups.cuisineTypes}
						foodTypes={lookups.foodTypes}
						drinkTypes={lookups.drinkTypes}
						onEdit={goTo}
					/>
				{/if}
			</div>

			<div
				class="sticky bottom-0 flex gap-3 border-t border-line bg-surface px-4 py-3 lg:gap-5 lg:pr-10 lg:pl-6"
			>
				{#if draft.step > 1}
					<Button variant="ghost" onclick={() => (draft.step -= 1)}>
						<Icon name="chevL" size={16} />
						Back
					</Button>
				{/if}
				<span class="hidden flex-1 lg:block"></span>
				{#if !isEdit}
					<button
						type="button"
						class="hidden text-sm font-medium text-accent-strong lg:inline"
						onclick={saveDraftNow}
					>
						{savedFlash ? 'Saved' : 'Save draft'}
					</button>
				{/if}
				{#if draft.step < 4}
					<Button class="flex-1 justify-center lg:flex-none" onclick={goNext}>
						{draft.step === 3 && draft.photos.length === 0 ? 'Skip photos' : 'Continue'}
						<Icon name="chevR" size={16} />
					</Button>
				{:else}
					<Button type="submit" class="flex-1 justify-center lg:flex-none" disabled={submitting}>
						{#if isEdit}
							{submitting ? 'Saving…' : 'Save changes'}
						{:else}
							{submitting ? 'Publishing…' : 'Publish review'}
						{/if}
					</Button>
				{/if}
			</div>
		</form>
	</div>

	<!-- Right rail: live card preview (+ visibility picker on step 4). -->
	<CollapsibleRail
		side="right"
		widthPx={420}
		storageKey="ddf-review-right-collapsed"
		label="card preview"
		asideClass="gap-4 px-6 pt-8 lg:overflow-hidden"
	>
		<div class="flex shrink-0 items-center justify-between">
			<span class="flex items-center gap-1.5">
				<p class="text-xs font-semibold tracking-wide text-ink-3 uppercase">Card preview</p>
				<InfoTooltip
					text="The card updates as you type. This is how friends will see it in their feed."
				/>
			</span>
		</div>
		<!-- min-h-0 lets this flex child shrink below its content height so overflow-y-auto can
		     actually kick in, instead of the content just growing the aside past the viewport.
		     Each child below also needs shrink-0 — otherwise flexbox's default flex-shrink:1
		     squeezes the (overflow-hidden) card shorter than its content to fit the available
		     space before scrolling ever kicks in, clipping the card's own footer/description
		     instead of the parent actually scrolling. -->
		<div class="no-scrollbar flex flex-col gap-4 pb-8 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
			<div class="shrink-0">
				<ReviewCard view={previewView} />
			</div>
			{#if draft.step === 4}
				<div class="shrink-0">
					<VisibilityPicker bind:value={draft.visibility} />
				</div>
			{/if}
		</div>
	</CollapsibleRail>
</div>
