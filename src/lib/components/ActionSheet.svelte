<script lang="ts">
	import Icon from './Icon.svelte';
	import type { IconName } from './icons.ts';

	export interface SheetAction {
		label: string;
		icon: IconName;
		/** Red text: destructive (Delete review, Remove bookmark). */
		danger?: boolean;
		href?: string;
		onclick?: () => void;
	}

	/** A bottom sheet of actions for one item, with a Cancel at the foot — the journal row's ⋯
	 *  and the review page's header ⋯ on a phone.
	 *
	 *  A native <dialog> opened with showModal(): the browser provides the top layer (no portal),
	 *  the focus trap, Esc to close and inert content behind it. Clicking the dimmed backdrop
	 *  closes it too. Choosing an action closes the sheet before running it. */
	let {
		open,
		title,
		actions,
		onclose
	}: { open: boolean; title: string; actions: SheetAction[]; onclose: () => void } = $props();

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function choose(action: SheetAction) {
		onclose();
		action.onclick?.();
	}
</script>

<dialog
	bind:this={dialog}
	{onclose}
	onclick={(e) => e.target === dialog && onclose()}
	aria-label={title}
	class="sheet m-0 mt-auto w-full max-w-none bg-transparent p-0 lg:m-auto lg:w-[380px]"
>
	<div
		class="flex flex-col rounded-t-[20px] bg-surface px-3 pt-2 pb-[26px] text-ink lg:rounded-[20px]"
	>
		<div
			class="mx-auto mt-1 mb-2.5 h-1 w-10 rounded-full bg-line lg:hidden"
			aria-hidden="true"
		></div>
		<p
			class="mb-1.5 truncate border-b border-line px-3 pt-0.5 pb-3 font-display text-[17px] font-semibold"
		>
			{title}
		</p>
		{#each actions as action (action.label)}
			{@const classes = `flex min-h-12 items-center gap-3 rounded-input px-3 text-left text-[15.5px] font-semibold hover:bg-sunken ${action.danger ? 'text-bad' : ''}`}
			{#if action.href}
				<a href={action.href} class={classes} onclick={onclose}>
					<Icon name={action.icon} size={20} />{action.label}
				</a>
			{:else}
				<button type="button" class={classes} onclick={() => choose(action)}>
					<Icon name={action.icon} size={20} />{action.label}
				</button>
			{/if}
		{/each}
		<button
			type="button"
			onclick={onclose}
			class="mt-1.5 min-h-12 rounded-input bg-sunken text-[15.5px] font-semibold">Cancel</button
		>
	</div>
</dialog>

<style>
	.sheet::backdrop {
		background: var(--scrim);
	}
	.sheet[open] > div {
		animation: sheet-up 0.22s ease;
	}
	@keyframes sheet-up {
		from {
			transform: translateY(100%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sheet[open] > div {
			animation: none;
		}
	}
</style>
