<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let {
		variant = 'primary',
		children,
		class: extraClass = '',
		...rest
	}: {
		variant?: 'primary' | 'ghost';
		children: Snippet;
		class?: string;
	} & Omit<HTMLButtonAttributes, 'class'> = $props();

	const variantClass = $derived(
		variant === 'primary'
			? 'bg-accent text-on-accent hover:bg-accent-strong'
			: 'bg-transparent text-ink-2 hover:bg-sunken'
	);
</script>

<button
	type="button"
	class={`inline-flex h-[50px] min-w-[44px] items-center justify-center gap-2 rounded-input px-5 text-[15.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClass} ${extraClass}`}
	{...rest}
>
	{@render children()}
</button>
