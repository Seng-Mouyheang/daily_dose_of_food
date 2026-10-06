<script lang="ts">
	import Icon from './Icon.svelte';
	import type { IconName } from './icons.ts';
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		value = $bindable(),
		icon,
		prefix,
		suffix,
		invalid = false,
		...rest
	}: {
		value: string;
		icon?: IconName;
		prefix?: string;
		suffix?: string;
		invalid?: boolean;
	} & Omit<HTMLInputAttributes, 'value'> = $props();
</script>

<div
	class={`flex h-12 items-center gap-2 rounded-input border bg-surface px-3.5 transition-colors focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-soft ${
		invalid ? 'border-bad' : 'border-line'
	}`}
>
	{#if icon}<Icon name={icon} size={18} class="text-ink-3" />{/if}
	{#if prefix}<span class="text-ink-3">{prefix}</span>{/if}
	<input
		bind:value
		class="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
		aria-invalid={invalid}
		{...rest}
	/>
	{#if suffix}<span class="text-ink-3">{suffix}</span>{/if}
</div>
