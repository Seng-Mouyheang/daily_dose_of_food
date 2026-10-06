<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from 'svelte-clerk';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Explore/Favorites don't have pages yet, so they stay inert labels rather than dead links —
	// matching the prototype's own desktop chrome, where only "Write a review" is a real link.
	const navLabels = ['Journal', 'Explore', 'Favorites'];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ClerkProvider>
	<header class="border-b border-line bg-surface px-4 py-3">
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-4">
			<a href="/" class="font-display text-lg font-semibold text-ink">Daily Dose of Food</a>

			<Show when="signed-in">
				<nav class="flex items-center gap-4 text-sm font-medium text-ink-3 sm:gap-6">
					{#each navLabels as label (label)}
						<span class="hidden cursor-default sm:inline">{label}</span>
					{/each}
					<a href="/review/new" class="font-semibold text-accent-strong hover:underline"
						>Write a review</a
					>
				</nav>
			</Show>

			<div class="flex items-center gap-3">
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
					<UserButton />
				</Show>
			</div>
		</div>
	</header>

	{@render children()}
</ClerkProvider>
