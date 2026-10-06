<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import type { ReviewDraft } from '#lib/review/draft.svelte.ts';

	let { draft, onEdit }: { draft: ReviewDraft; onEdit: (step: number) => void } = $props();

	const visibilityOptions = [
		{ value: 'public', icon: 'globe', label: 'Public', sub: 'Anyone on Daily Dose of Food' },
		{ value: 'friends', icon: 'users', label: 'Friends', sub: 'People you follow back' },
		{ value: 'private', icon: 'lock', label: 'Only me', sub: 'Stays in your private journal' }
	] as const;

	const visitLabel: Record<string, string> = {
		dine_in: 'Dine-in',
		takeaway: 'Takeaway',
		delivery: 'Delivery'
	};
</script>

<div class="flex flex-col gap-6">
	<section class="rounded-card border border-line bg-surface p-5">
		<div class="flex items-center justify-between">
			<h3 class="font-display text-lg font-semibold text-ink">Visit</h3>
			<button
				type="button"
				class="flex items-center gap-1 text-sm font-semibold text-accent-strong"
				onclick={() => onEdit(1)}
			>
				<Icon name="pencil" size={14} /> Edit
			</button>
		</div>
		<dl class="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
			<dt class="text-ink-3">Place</dt>
			<dd class="text-ink">{draft.place?.name ?? draft.newPlaceName ?? '—'}</dd>
			<dt class="text-ink-3">Visit</dt>
			<dd class="text-ink">{visitLabel[draft.visitType]}</dd>
			{#if draft.hasDish}
				<dt class="text-ink-3">Meal</dt>
				<dd class="text-ink capitalize">{draft.mealType}</dd>
			{/if}
			<dt class="text-ink-3">Date</dt>
			<dd class="text-ink">{draft.visitedAt}</dd>
		</dl>
	</section>

	<section class="rounded-card border border-line bg-surface p-5">
		<div class="flex items-center justify-between">
			<h3 class="font-display text-lg font-semibold text-ink">Rating & details</h3>
			<button
				type="button"
				class="flex items-center gap-1 text-sm font-semibold text-accent-strong"
				onclick={() => onEdit(2)}
			>
				<Icon name="pencil" size={14} /> Edit
			</button>
		</div>
		<div class="mt-3 flex flex-col gap-1 text-sm">
			{#if draft.hasDish}
				<p class="text-ink">
					{draft.dish.itemName || 'Untitled dish'}{#if draft.dish.price}<span class="text-ink-3">
							· ${draft.dish.price}</span
						>{/if}
				</p>
			{/if}
			{#if draft.hasBev}
				<p class="text-ink">
					{draft.drink.itemName || 'Untitled drink'}{#if draft.drink.price}<span class="text-ink-3">
							· ${draft.drink.price}</span
						>{/if}
				</p>
			{/if}
			{#if draft.description}
				<p class="mt-1 text-ink-2 italic">"{draft.description}"</p>
			{/if}
		</div>
	</section>

	<section class="rounded-card border border-line bg-surface p-5">
		<div class="flex items-center justify-between">
			<h3 class="font-display text-lg font-semibold text-ink">Photos</h3>
			<button
				type="button"
				class="flex items-center gap-1 text-sm font-semibold text-accent-strong"
				onclick={() => onEdit(3)}
			>
				<Icon name="pencil" size={14} /> Edit
			</button>
		</div>
		{#if draft.photos.length}
			<div class="mt-3 grid grid-cols-4 gap-2">
				{#each draft.photos.slice(0, 4) as photo (photo.publicId)}
					<img src={photo.previewUrl} alt="" class="aspect-square rounded-[10px] object-cover" />
				{/each}
			</div>
		{:else}
			<p class="mt-3 text-sm text-ink-3">No photos added.</p>
		{/if}
	</section>

	<section class="flex flex-col gap-3">
		<h3 class="font-display text-lg font-semibold text-ink">Who can see this?</h3>
		<div class="flex flex-col gap-2" role="radiogroup" aria-label="Visibility">
			{#each visibilityOptions as opt (opt.value)}
				{@const selected = draft.visibility === opt.value}
				<button
					type="button"
					role="radio"
					aria-checked={selected}
					class={`flex items-center gap-3 rounded-card border p-4 text-left transition-colors ${
						selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
					}`}
					onclick={() => (draft.visibility = opt.value)}
				>
					<Icon name={opt.icon} size={20} class={selected ? 'text-accent-strong' : 'text-ink-3'} />
					<span>
						<span class="block text-sm font-semibold text-ink">{opt.label}</span>
						<span class="block text-xs text-ink-3">{opt.sub}</span>
					</span>
				</button>
			{/each}
		</div>
	</section>
</div>
