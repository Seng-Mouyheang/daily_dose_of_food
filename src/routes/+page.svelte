<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="mx-auto max-w-xl px-4 py-10">
	<h1 class="text-2xl font-semibold">Welcome to Daily Dose of Food</h1>

	{#if data.user}
		<div class="mt-6 rounded-lg border border-stone-200 p-4">
			<p class="text-sm text-stone-500">Signed in as, synced to the database:</p>
			<dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
				<dt class="text-stone-500">Username</dt>
				<dd>{data.user.username}</dd>
				<dt class="text-stone-500">Display name</dt>
				<dd>{data.user.displayName}</dd>
				<dt class="text-stone-500">Email</dt>
				<dd>{data.user.email}</dd>
				<dt class="text-stone-500">User id</dt>
				<dd class="truncate">{data.user.id}</dd>
			</dl>
		</div>
	{:else}
		<p class="mt-4 text-stone-600">
			<a href="/sign-up" class="underline">Sign up</a> or
			<a href="/sign-in" class="underline">sign in</a>
			to see your account synced from Clerk.
		</p>
	{/if}
</div>
