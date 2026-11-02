<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from 'svelte-clerk';
	import Icon from '#lib/components/Icon.svelte';
	import BottomTabBar from '#lib/components/BottomTabBar.svelte';
	import Toast from '#lib/components/Toast.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// The server runs in UTC; the dashboard's week/month/year bounds need the user's own zone.
	onMount(() => {
		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (!document.cookie.includes(`tz=${encodeURIComponent(tz)}`))
			document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
	});

	const isHome = $derived(page.url.pathname === '/');
	const isExplore = $derived(page.url.pathname.startsWith('/explore'));
	const isLog = $derived(page.url.pathname.startsWith('/log'));
	const isJournal = $derived(page.url.pathname.startsWith('/journal'));
	const isDashboard = $derived(page.url.pathname.startsWith('/dashboard'));
	const isWriteReview = $derived(page.url.pathname.startsWith('/review/new'));
	// The wizard, whether writing or editing: both have their own sticky footer and back link.
	const isWizard = $derived(isWriteReview || /^\/review\/[^/]+\/edit$/.test(page.url.pathname));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#snippet navLink(href: string, label: string, active: boolean)}
	<a
		{href}
		aria-current={active ? 'page' : undefined}
		class={`-mb-px hidden items-center border-b-2 px-3 py-0.5 lg:flex ${
			active ? 'border-accent text-ink' : 'border-transparent text-ink-2'
		}`}
	>
		{label}
	</a>
{/snippet}

<ClerkProvider>
	<!-- px-4 on a phone (the pages' own gutter) so the signed-out brand and buttons fit on one
	     line at 390px. -->
	<header class="border-b border-line bg-surface px-4 lg:h-16 lg:px-6">
		<div class="flex items-stretch justify-between gap-4">
			<a href="/" class="flex items-center gap-2 py-3">
				<span
					class="flex h-8 w-8 items-center justify-center rounded-input bg-accent text-on-accent"
				>
					<Icon name="logo" size={18} />
				</span>
				<span class="font-display text-lg font-semibold whitespace-nowrap text-ink"
					>Daily Dose of Food</span
				>
			</a>

			<Show when="signed-in">
				<nav class="flex items-stretch gap-6 text-sm font-medium">
					{@render navLink('/', 'Home', isHome)}
					{@render navLink('/explore', 'Explore', isExplore)}
					{@render navLink('/log', 'Log', isLog)}
					{@render navLink('/journal', 'My journal', isJournal)}
					{@render navLink('/dashboard', 'Dashboard', isDashboard)}
					{@render navLink('/review/new', 'Write a review', isWriteReview)}
				</nav>
			</Show>
			<!-- Explore is public, so it's the one destination a signed-out visitor gets. On a phone
			     there's no room beside Sign in / Sign up; the landing page links to it instead. -->
			<Show when="signed-out">
				<nav class="flex items-stretch gap-6 text-sm font-medium">
					{@render navLink('/explore', 'Explore', isExplore)}
				</nav>
			</Show>

			<div class="flex items-center gap-3 py-3">
				<Show when="signed-out">
					<SignInButton mode="modal">
						<button class="text-sm font-medium whitespace-nowrap text-ink-2">Sign in</button>
					</SignInButton>
					<SignUpButton mode="modal">
						<button
							class="rounded-input bg-accent px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-on-accent"
							>Sign up</button
						>
					</SignUpButton>
				</Show>
				<Show when="signed-in">
					<!-- Explore's way in on a phone: the tab bar has no slot for it (spec §1). -->
					<a
						href="/explore"
						aria-label="Explore"
						aria-current={isExplore ? 'page' : undefined}
						class="flex h-9 w-9 items-center justify-center rounded-full hover:bg-sunken lg:hidden {isExplore
							? 'text-accent-strong'
							: 'text-ink-2'}"
					>
						<Icon name="search" size={19} />
					</a>
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

	<Toast />

	<!-- Not on the wizard: its sticky Continue / Publish footer would sit under the bar at every
	     scroll position but the very end, and it has its own mobile header with a back link. -->
	{#if !isWizard}
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
