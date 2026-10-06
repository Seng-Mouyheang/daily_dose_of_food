<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import type { IconName } from '#lib/components/icons.ts';

	let { value = $bindable() }: { value: 'public' | 'friends' | 'private' } = $props();

	const options: {
		value: 'public' | 'friends' | 'private';
		icon: IconName;
		label: string;
		sub: string;
	}[] = [
		{ value: 'public', icon: 'globe', label: 'Public', sub: 'Anyone on Daily Dose of Food' },
		{ value: 'friends', icon: 'users', label: 'Friends', sub: 'People you follow back' },
		{ value: 'private', icon: 'lock', label: 'Only me', sub: 'Stays in your private journal' }
	];
</script>

<section class="flex flex-col gap-3">
	<h3 class="font-display text-lg font-semibold text-ink">Who can see this?</h3>
	<div
		class="flex flex-col gap-2 rounded-card border border-line bg-surface"
		role="radiogroup"
		aria-label="Visibility"
	>
		{#each options as opt, i (opt.value)}
			{@const selected = value === opt.value}
			<button
				type="button"
				role="radio"
				aria-checked={selected}
				class={`flex items-center justify-between gap-3 p-4 text-left transition-colors ${
					i > 0 ? 'border-t border-line' : ''
				} ${selected ? 'bg-accent-soft' : ''}`}
				onclick={() => (value = opt.value)}
			>
				<span class="flex items-center gap-3">
					<Icon name={opt.icon} size={20} class={selected ? 'text-accent-strong' : 'text-ink-3'} />
					<span>
						<span class="block text-sm font-semibold text-ink">{opt.label}</span>
						<span class="block text-xs text-ink-3">{opt.sub}</span>
					</span>
				</span>
				<span
					class={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
						selected ? 'border-accent' : 'border-line'
					}`}
				>
					{#if selected}<span class="h-2.5 w-2.5 rounded-full bg-accent"></span>{/if}
				</span>
			</button>
		{/each}
	</div>
</section>
