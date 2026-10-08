<script lang="ts">
	import Icon from './Icon.svelte';
	import type { IconName } from './icons.ts';
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		value = $bindable(),
		icon,
		iconClass = 'text-ink-3',
		prefix,
		suffix,
		invalid = false,
		...rest
	}: {
		value: string;
		icon?: IconName;
		/** Leading icon color — defaults to the neutral tertiary tone; pass an accent class
		 *  (e.g. "text-accent-strong") for a field where the icon should read as emphasized,
		 *  like the date field. */
		iconClass?: string;
		prefix?: string;
		suffix?: string;
		invalid?: boolean;
	} & Omit<HTMLInputAttributes, 'value'> = $props();

	// The browser's own date-picker glyph ignores `color` in every engine that matters here
	// (it's a fixed UA bitmap/SVG, not currentColor) — color-scheme only gets it to a visible
	// gray, never the accent. So for type="date" we make that native indicator an invisible,
	// full-size click target and draw our own accent calendar icon on top of it instead.
	const isDate = $derived(rest.type === 'date');
</script>

<div
	class={`relative flex h-12 items-center gap-2 rounded-input border bg-surface px-3.5 transition-colors focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-soft ${
		invalid ? 'border-bad' : 'border-line'
	}`}
>
	{#if icon}<Icon name={icon} size={18} class={iconClass} />{/if}
	{#if prefix}<span class="text-ink-3">{prefix}</span>{/if}
	<input
		bind:value
		class={`min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3 ${
			isDate
				? '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0'
				: ''
		}`}
		aria-invalid={invalid}
		{...rest}
	/>
	{#if isDate}
		<Icon
			name="calendar"
			size={18}
			class="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-accent-strong"
		/>
	{/if}
	{#if suffix}<span class="text-ink-3">{suffix}</span>{/if}
</div>
