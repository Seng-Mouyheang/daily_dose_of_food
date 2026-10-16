<script lang="ts">
	import { enhance } from '$app/forms';
	import TextInput from '#lib/components/TextInput.svelte';

	let { open, current, onclose }: { open: boolean; current: number | null; onclose: () => void } =
		$props();

	let dialog = $state<HTMLDialogElement>();
	let value = $state('');
	let error = $state<string | null>(null);
	let saving = $state(false);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			value = current === null ? '' : String(current);
			error = null;
			dialog.showModal();
		} else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	{onclose}
	onclick={(e) => e.target === dialog && onclose()}
	aria-labelledby="budget-title"
	class="m-auto w-[min(22rem,calc(100%-2rem))] rounded-card border border-line bg-surface p-5 text-ink shadow-card-lg backdrop:bg-scrim"
>
	<form
		method="POST"
		action="?/setBudget"
		use:enhance={() => {
			saving = true;
			return async ({ result, update }) => {
				saving = false;
				if (result.type === 'failure') error = String(result.data?.error ?? '');
				else {
					await update();
					onclose();
				}
			};
		}}
	>
		<h2 id="budget-title" class="font-display text-lg font-semibold">Monthly budget</h2>
		<p class="mt-1 text-sm text-ink-2">
			What you'd like to spend eating out each month. Weekly and yearly budgets are worked out from
			it. Leave it empty to remove it.
		</p>
		<div class="mt-4">
			<TextInput
				bind:value
				name="budget"
				prefix="$"
				inputmode="decimal"
				aria-label="Monthly budget in dollars"
				aria-describedby={error ? 'budget-error' : undefined}
				invalid={error !== null}
				placeholder="350"
			/>
			{#if error}<p id="budget-error" role="alert" class="mt-1.5 text-[13px] text-bad">
					{error}
				</p>{/if}
		</div>
		<div class="mt-5 flex justify-end gap-2 text-sm font-semibold">
			<button
				type="button"
				onclick={onclose}
				class="h-10 rounded-full px-4 text-ink-2 hover:text-ink">Cancel</button
			>
			<button
				type="submit"
				disabled={saving}
				class="h-10 rounded-full bg-accent px-4 text-on-accent disabled:opacity-60"
				>{saving ? 'Saving…' : 'Save budget'}</button
			>
		</div>
	</form>
</dialog>
