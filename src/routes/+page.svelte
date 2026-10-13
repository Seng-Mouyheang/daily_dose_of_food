<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import Tabs from '#lib/components/Tabs.svelte';
	import ReviewCard from '#lib/review/ReviewCard.svelte';
	import FeedPrompt from '#lib/review/FeedPrompt.svelte';
	import HomeSidebar from '#lib/review/HomeSidebar.svelte';
	import { cardViewFromRow } from '#lib/review/card.ts';
	import { greetingFor, timeAgo } from '#lib/review/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Resolved after hydration, not on the server: the greeting depends on the *reader's* hour,
	 *  and the server's timezone is not theirs. Until then it's a neutral welcome rather than a
	 *  guess that would be wrong by seven hours for most of this app's users. */
	let greeting = $state('Welcome back');
	onMount(() => {
		greeting = greetingFor(new Date());
	});

	const reviews = $derived(data.reviews ?? []);

	// One `now` for the whole list, captured per render, so twenty cards can't disagree about
	// what "2h ago" means mid-render.
	const cards = $derived.by(() => {
		const now = new Date();
		return reviews.map((review) => ({
			id: review.id,
			view: cardViewFromRow(
				review,
				timeAgo(review.publishedAt ?? review.visitedAt, now),
				data.user !== null
			)
		}));
	});

	const tabs = $derived([
		{ value: 'for-you', label: 'For you', href: '/' },
		{ value: 'following', label: 'Following', href: '/?tab=following' }
	]);
</script>

<svelte:head>
	<title>Daily Dose of Food</title>
</svelte:head>

{#if !data.user}
	<div class="mx-auto max-w-xl px-4 py-16 text-center">
		<h1 class="font-display text-3xl font-semibold text-balance text-ink">
			A journal for everything you eat
		</h1>
		<p class="mx-auto mt-3 max-w-md text-ink-2">
			Rate a dish, keep the photo, remember what it cost — and see what the people you follow have
			been eating.
		</p>
		<div class="mt-8 flex justify-center gap-3">
			<Button href="/sign-up">Get started</Button>
			<Button href="/sign-in" variant="ghost">Sign in</Button>
		</div>
	</div>
{:else}
	<!-- Two columns on desktop, one on mobile. The widths come from the handoff (620 / 320) and
	     are fixed rather than fractional so the card column keeps the same measure whatever the
	     window does; `justify-center` keeps the pair centred in the leftover space. -->
	<div
		class="mx-auto grid max-w-[1000px] grid-cols-1 items-start gap-7 px-4 py-6 lg:grid-cols-[620px_320px] lg:justify-center lg:px-6 lg:py-8"
	>
		<main class="flex min-w-0 flex-col gap-4">
			<div>
				<h1 class="font-display text-[28px] font-semibold tracking-tight text-ink">
					{greeting}, {data.user.displayName}
				</h1>
				<p class="mt-1 text-ink-2">
					{#if data.tab === 'following'}
						Reviews from the people you follow.
					{:else if reviews.length}
						The latest from everyone on Daily Dose of Food.
					{:else}
						Your feed starts with your first review.
					{/if}
				</p>
			</div>

			<Tabs options={tabs} current={data.tab} ariaLabel="Feed" />

			{#if data.tab === 'for-you'}
				<FeedPrompt displayName={data.user.displayName} avatarUrl={data.user.avatarUrl} />
			{/if}

			{#if data.tab === 'following'}
				<!-- Honest empty state: there is no follows table yet, so this tab cannot have
				     content. Saying so beats an ambiguous "nothing here" that reads as a bug. -->
				<div class="rounded-card border border-line bg-surface p-6 text-center">
					<h2 class="font-display text-lg font-semibold text-ink">Following is on the way</h2>
					<p class="mx-auto mt-2 max-w-sm text-sm text-ink-2">
						You can't follow anyone just yet. Until then, <a
							href="/"
							class="font-semibold text-accent-strong underline">For you</a
						> has every public review.
					</p>
				</div>
			{:else if cards.length === 0}
				<div class="rounded-card border border-line bg-surface p-6 text-center">
					<h2 class="font-display text-lg font-semibold text-ink">No reviews yet</h2>
					<p class="mx-auto mt-2 max-w-sm text-sm text-ink-2">
						Nobody has published a public review so far. Be the first.
					</p>
					<Button href="/review/new" class="mt-5">Write a review</Button>
				</div>
			{:else}
				{#each cards as card (card.id)}
					<ReviewCard view={card.view} />
				{/each}

				{#if data.nextCursor}
					<!-- A link, not an infinite scroller: paging through the URL means the next page
					     is a plain navigation that works without JavaScript and can be linked to. -->
					<a
						href={`/?cursor=${encodeURIComponent(data.nextCursor)}`}
						class="self-center rounded-input px-4 py-2 text-sm font-semibold text-accent-strong hover:bg-accent-soft"
					>
						Show older reviews
					</a>
				{:else}
					<p class="mt-1 text-center text-sm text-ink-3">You're all caught up.</p>
				{/if}
			{/if}
		</main>

		<!-- sticky, not its own scroll container: the rail is shorter than the feed, so it just
		     needs to stop scrolling away. `self-start` is what gives it a height to stick within
		     inside a grid row. -->
		{#if data.stats && data.month}
			<aside class="hidden lg:sticky lg:top-6 lg:block lg:self-start">
				<HomeSidebar stats={data.stats} month={data.month} />
			</aside>
		{/if}
	</div>
{/if}
