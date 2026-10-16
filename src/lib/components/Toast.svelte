<script lang="ts">
	import { toast } from './toast.svelte.ts';

	/** The single message slot. Sits above the mobile tab bar, bottom-right on desktop.
	 *  role="status" so a screen reader announces it without stealing focus. */
</script>

<div
	role="status"
	aria-live="polite"
	class="pointer-events-none fixed inset-x-3 bottom-[92px] z-40 flex justify-center lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-80"
>
	{#if toast.current}
		{#key toast.current.id}
			<div
				class="toast-in pointer-events-auto flex w-full items-center justify-between gap-3 rounded-input border border-line bg-surface px-3.5 py-3 text-sm font-semibold text-ink shadow-card-lg"
			>
				<span>{toast.current.text}</span>
				{#if toast.current.undo}
					<button
						type="button"
						onclick={() => toast.runUndo()}
						class="min-h-8 rounded-md px-1.5 font-bold text-accent-strong hover:bg-accent-soft"
						>Undo</button
					>
				{/if}
			</div>
		{/key}
	{/if}
</div>

<style>
	.toast-in {
		animation: toast-in 0.2s ease;
	}
	@keyframes toast-in {
		from {
			transform: translateY(8px);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.toast-in {
			animation: none;
		}
	}
</style>
