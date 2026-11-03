<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconButton from '#lib/components/IconButton.svelte';

	/** Mobile's "Pick a day": the month calendar in a bottom sheet. Native <dialog> + showModal()
	 *  for the focus trap, Esc and inert page behind it, as ActionSheet does. */
	let { open, onclose, children }: { open: boolean; onclose: () => void; children: Snippet } =
		$props();

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	{onclose}
	onclick={(e) => e.target === dialog && onclose()}
	aria-labelledby="month-sheet-title"
	class="sheet m-0 mt-auto w-full max-w-none bg-transparent p-0 text-ink"
>
	<div
		class="flex flex-col gap-3 rounded-t-[20px] bg-surface px-[18px] pt-2 pb-[26px] shadow-card-lg"
	>
		<div class="mx-auto mt-0.5 h-1 w-10 rounded-full bg-line" aria-hidden="true"></div>
		<div class="flex items-center justify-between">
			<h2 id="month-sheet-title" class="font-display text-lg font-semibold">Pick a day</h2>
			<IconButton icon="x" label="Close" size={18} onclick={onclose} />
		</div>
		{#if open}{@render children()}{/if}
	</div>
</dialog>
