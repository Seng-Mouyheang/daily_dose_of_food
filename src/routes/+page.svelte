<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="mx-auto max-w-xl px-4 py-10">
	<h1 class="font-display text-2xl font-semibold text-ink">Welcome to Daily Dose of Food</h1>

	{#if data.user}
		<p class="mt-2 text-ink-2">Signed in as {data.user.displayName}.</p>

		<a href="/review/new" class="mt-6 inline-block">
			<Button>Write a review</Button>
		</a>

		<details class="mt-8 text-sm text-ink-3">
			<summary class="cursor-pointer font-medium">Account details</summary>
			<dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
				<dt class="text-ink-3">Username</dt>
				<dd class="text-ink-2">{data.user.username}</dd>
				<dt class="text-ink-3">Email</dt>
				<dd class="text-ink-2">{data.user.email}</dd>
				<dt class="text-ink-3">User id</dt>
				<dd class="truncate text-ink-2">{data.user.id}</dd>
			</dl>
		</details>
	{:else}
		<p class="mt-4 text-ink-2">
			<a href="/sign-up" class="font-semibold text-accent-strong underline">Sign up</a> or
			<a href="/sign-in" class="font-semibold text-accent-strong underline">sign in</a>
			to start writing reviews.
		</p>
	{/if}
</div>
