<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { splitTags, type ReviewCardTag } from './card.ts';

	/** Highlights and complaints, kept apart and color-coded. On the card these are one flat
	 *  row capped at three; here the full set is shown, grouped, because this is the page
	 *  someone opened to read the detail. */
	let { tags }: { tags: ReviewCardTag[] } = $props();

	const groups = $derived(splitTags(tags));
</script>

{#if tags.length}
	<div class="flex flex-col gap-3">
		{#each [{ heading: 'Highlights', items: groups.positive, tone: 'pos' }, { heading: 'Could be better', items: groups.negative, tone: 'neg' }] as group (group.heading)}
			{#if group.items.length}
				<div>
					<h3 class="text-[13px] font-semibold text-ink-2">{group.heading}</h3>
					<ul class="mt-2 flex flex-wrap gap-1.5">
						{#each group.items as tag, i (i)}
							<li
								class="flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium {group.tone ===
								'pos'
									? 'bg-good-soft text-good'
									: 'bg-bad-soft text-bad'}"
							>
								<Icon name={group.tone === 'pos' ? 'plus' : 'minus'} size={12} weight={2.4} />
								{tag.label}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/each}
	</div>
{/if}
