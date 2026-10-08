<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from 'svelte-clerk';
	import Icon from '#lib/components/Icon.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Explore/Favorites don't have pages yet, so they stay inert labels rather than dead links —
	// matching the prototype's own desktop chrome, where only "Write a review" is a real link.
	const navLabels = ['Journal', 'Explore', 'Favorites'];
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
					{#each navLabels as label (label)}
						<span class="hidden cursor-default self-center text-ink-2 sm:inline">{label}</span>
					{/each}
					<a
						href="/review/new"
						class={`-mb-px flex items-center border-b-2 ${
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
</ClerkProvider>
