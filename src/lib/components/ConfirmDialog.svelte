<script lang="ts">
	/** A yes/no question before something that can't be taken back in one tap — "Delete this
	 *  review?". Native <dialog> + showModal() for the same reasons as ActionSheet; role
	 *  alertdialog because it interrupts to ask. Cancel is focused first, so Enter never
	 *  confirms by accident. */
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
	class="confirm m-auto w-[min(360px,calc(100%-40px))] rounded-[18px] bg-surface p-[22px] text-ink shadow-card-lg"
>
	<h2 id="confirm-title" class="font-display text-xl font-semibold">{title}</h2>
	<p id="confirm-message" class="mt-2 text-[14.5px] leading-normal text-ink-2">{message}</p>
	<div class="mt-[18px] flex gap-2.5">
		<!-- svelte-ignore a11y_autofocus -->
		<button
			type="button"
			autofocus
			onclick={onclose}
			class="h-11 flex-1 rounded-input bg-sunken text-[15px] font-bold">Cancel</button
		>
		<button
			type="button"
			onclick={() => {
				onconfirm();
				onclose();
			}}
			class="h-11 flex-1 rounded-input bg-bad text-[15px] font-bold text-bg">{confirmLabel}</button
		>
	</div>
</dialog>

<style>
	.confirm::backdrop {
		background: var(--scrim);
	}
</style>
