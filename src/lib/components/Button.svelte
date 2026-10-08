<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	let {
		variant = 'primary',
		href,
		children,
		class: extraClass = '',
		...rest
	}: {
		variant?: 'primary' | 'ghost';
		/** Renders a single <a> instead of a <button> — for a primary action that's actually
		 *  navigation (e.g. "Write a review"). HTML forbids nesting a <button> inside an <a>
		 *  (interactive content inside interactive content), and browsers don't reliably
		 *  forward keyboard activation (Enter/Space) from the inner button up to the anchor, so
		 *  a caller that wants link behavior gets real link semantics here instead of wrapping
		 *  a `<Button>` in its own `<a>`. */
		href?: string;
		children: Snippet;
		class?: string;
	} & Omit<HTMLButtonAttributes, 'class'> = $props();

	// `accent-strong` is the *text* accent (see DESIGN.md) — in dark mode it's lighter than
	// `accent`, not darker, so using it as a hover fill would brighten the button instead of
	// darkening it and wash out light button text. A brightness filter darkens correctly in
	// both themes without repurposing that token.
	const variantClass = $derived(
		variant === 'primary'
			? 'bg-accent text-on-accent transition-[filter] hover:brightness-90'
			: 'bg-transparent text-ink-2 transition-colors hover:bg-sunken'
	);
	const classes = $derived(
		`inline-flex h-[50px] min-w-[44px] items-center justify-center gap-2 rounded-input px-5 text-[15.5px] font-bold disabled:cursor-not-allowed disabled:opacity-50 ${variantClass} ${extraClass}`
	);
</script>

{#if href}
	<!-- `rest` is typed against HTMLButtonAttributes (the common case); its event handlers are
	     structurally identical for an <a> except for which element type they hand back as
	     currentTarget, so this cast is just satisfying that mismatch, not papering over a real
	     type error. -->
	<a {href} class={classes} {...rest as HTMLAnchorAttributes}>
		{@render children()}
	</a>
{:else}
	<button type="button" class={classes} {...rest}>
		{@render children()}
	</button>
{/if}
