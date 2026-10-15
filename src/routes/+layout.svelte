<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from 'svelte-clerk';
	import Icon from '#lib/components/Icon.svelte';
	import BottomTabBar from '#lib/components/BottomTabBar.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Explore doesn't have a page yet, so it stays an inert label rather than a dead link.
	const navLabels = ['Explore'];
	const isHome = $derived(page.url.pathname === '/');
	const isJournal = $derived(page.url.pathname.startsWith('/journal'));
	const isWriteReview = $derived(page.url.pathname.startsWith('/review/new'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ClerkProvider>
	<header class="border-b border-line bg-surface px-6 lg:h-16">
		<div class="flex items-stretch justify-between gap-4">
			<a href="/" class="flex items-center gap-2 py-3">
				<span
					class="flex h-8 w-8 items-center justify-center rounded-input bg-accent text-on-accent"
				>
					<Icon name="logo" size={18} />
				</span>
				<span class="font-display text-lg font-semibold text-ink">Daily Dose of Food</span>
			</a>

			<Show when="signed-in">
				<nav class="flex items-stretch gap-6 text-sm font-medium">
					<a
						href="/"
						class={`-mb-px hidden items-center border-b-2 px-3 py-0.5 lg:flex ${
							isHome ? 'border-accent text-ink' : 'border-transparent text-ink-2'
						}`}
					>
						Home
					</a>
					{#each navLabels as label (label)}
						<span
							class="-mb-px hidden cursor-default items-center border-b-2 border-transparent px-1 py-0.5 text-ink-2 sm:flex"
							>{label}</span
						>
					{/each}
					<a
						href="/journal"
						class={`-mb-px hidden items-center border-b-2 px-3 py-0.5 lg:flex ${
							isJournal ? 'border-accent text-ink' : 'border-transparent text-ink-2'
						}`}
					>
						My journal
					</a>
					<a
						href="/review/new"
						class={`-mb-px hidden items-center border-b-2 px-3 py-0.5 lg:flex ${
							isWriteReview ? 'border-accent text-ink' : 'border-transparent text-ink-2'
						}`}
					>
						Write a review
					</a>
				</nav>
			</Show>

			<div class="flex items-center gap-3 py-3">
				<Show when="signed-out">
					<SignInButton mode="modal">
						<button class="text-sm font-medium text-ink-2">Sign in</button>
					</SignInButton>
					<SignUpButton mode="modal">
						<button class="rounded-input bg-accent px-3.5 py-2 text-sm font-semibold text-on-accent"
							>Sign up</button
						>
					</SignUpButton>
				</Show>
				<Show when="signed-in">
					<button
						type="button"
						aria-label="Notifications"
						class="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-sunken"
					>
						<Icon name="bellN" size={19} />
					</button>
					<UserButton />
				</Show>
			</div>
		</div>
	</header>

	{@render children()}

	<!-- Not on the wizard: its sticky Continue / Publish footer would sit under the bar at every
	     scroll position but the very end, and it has its own mobile header with a back link. -->
	{#if !isWriteReview}
		<Show when="signed-in">
			<!-- The bar is `fixed`, so this spacer is what keeps the last feed card from sitting
			     behind it. A spacer rather than padding on a wrapper around {@render children()}:
			     it only exists when the bar does, and it avoids putting another block-level
			     ancestor above every page — one `overflow` on such a wrapper would silently kill
			     `position: sticky` in the pages below (the home sidebar, the review page's photo
			     column). -->
			<div class="h-24 lg:hidden" aria-hidden="true"></div>
			<BottomTabBar />
		</Show>
	{/if}
</ClerkProvider>
