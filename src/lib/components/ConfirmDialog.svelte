<script lang="ts">
	/** A yes/no question before something that can't be taken back in one tap — "Delete review".
	 *  Same look as the comment delete dialog in CommentItem: short title, one-line question,
	 *  text Cancel and a red pill confirm on the right.
	 *
	 *  A native modal dialog opened with showModal(): the browser provides the top layer, the
	 *  focus trap, Esc to close and an inert page behind it. role alertdialog because it
	 *  interrupts to ask. Cancel is focused first, so Enter never confirms by accident. */
	let {
		open,
		title,
		message,
		confirmLabel,
		onconfirm,
		onclose
	}: {
		open: boolean;
		title: string;
		message: string;
		confirmLabel: string;
		onconfirm: () => void;
		onclose: () => void;
	} = $props();

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
	role="alertdialog"
	aria-labelledby="confirm-title"
	aria-describedby="confirm-message"
	class="m-auto w-[min(22rem,calc(100%-2rem))] rounded-card border border-line bg-surface p-5 text-ink shadow-card-lg backdrop:bg-scrim"
>
	<h2 id="confirm-title" class="font-display text-lg font-semibold">{title}</h2>
	<p id="confirm-message" class="mt-1 text-sm text-ink-2">{message}</p>
	<div class="mt-5 flex justify-end gap-2 text-sm font-semibold">
		<!-- svelte-ignore a11y_autofocus -->
		<button
			type="button"
			autofocus
			onclick={onclose}
			class="h-10 rounded-full px-4 text-ink-2 hover:text-ink">Cancel</button
		>
		<button
			type="button"
			onclick={() => {
				onconfirm();
				onclose();
			}}
			class="h-10 rounded-full bg-bad px-4 text-on-accent">{confirmLabel}</button
		>
	</div>
</dialog>
