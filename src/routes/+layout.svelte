<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from 'svelte-clerk';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ClerkProvider>
	<header class="flex items-center justify-between border-b border-stone-200 px-4 py-3">
		<a href="/" class="font-semibold">Daily Dose of Food</a>
		<nav class="flex items-center gap-3">
			<Show when="signed-out">
				<SignInButton mode="modal">
					<button class="text-sm font-medium">Sign in</button>
				</SignInButton>
				<SignUpButton mode="modal">
					<button class="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white">
						Sign up
					</button>
				</SignUpButton>
			</Show>
			<Show when="signed-in">
				<UserButton />
			</Show>
		</nav>
	</header>

	{@render children()}
</ClerkProvider>
