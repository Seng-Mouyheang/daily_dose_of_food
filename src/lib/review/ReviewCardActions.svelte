<script lang="ts">
	import IconButton from '#lib/components/IconButton.svelte';

	/** Like / comments / save / share, as the handoff draws them.
	 *
	 *  Everything except comments is deliberately inert: there are no review_likes,
	 *  review_saves or follows tables yet, so there is nothing to toggle and nothing to count.
	 *  Rendering them disabled with "not available yet" in the label is the honest version —
	 *  the alternative, a handler that silently drops the click next to a made-up "1.2K", tells
	 *  the user something false. The counts are omitted entirely for the same reason.
	 *
	 *  Comments is a real link to the review page's comments anchor, which is why it sits in
	 *  the middle of otherwise-dead controls. */
	let { commentsHref = null }: { commentsHref?: string | null } = $props();
</script>

<div class="-mx-2.5 flex items-center gap-0.5 border-t border-line pt-2">
	<IconButton icon="heart" label="Like — not available yet" inert />
	{#if commentsHref}
		<IconButton icon="comment" label="Comments" href={commentsHref} />
	{:else}
		<IconButton icon="comment" label="Comments — not available yet" inert />
	{/if}
	<span class="flex-1"></span>
	<IconButton icon="bookmark" label="Save — not available yet" inert />
	<IconButton icon="share" label="Share — not available yet" inert />
</div>
