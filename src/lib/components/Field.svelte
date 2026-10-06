<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		hint,
		error,
		optional = false,
		for: forId,
		children
	}: {
		label: string;
		hint?: string;
		error?: string;
		optional?: boolean;
		for?: string;
		children: Snippet;
	} = $props();
</script>

<div class="flex flex-col gap-2.5">
	<label for={forId} class="text-sm font-semibold text-ink">
		{label}
		{#if optional}<span class="font-normal text-ink-3"> Optional</span>{/if}
	</label>
	{#if hint}<p class="text-[13px] text-ink-3">{hint}</p>{/if}
	{@render children()}
	{#if error}
		<p class="text-[13px] font-medium text-bad" role="alert">{error}</p>
	{/if}
</div>
