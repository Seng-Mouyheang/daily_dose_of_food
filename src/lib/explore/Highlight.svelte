<script lang="ts">
	/** `text` with the part matching the search in bold `accent-strong`: no underline (that is
	 *  for hovered links) and no background. `q` is the normalized query. */
	import { highlight } from './search.ts';

	let { text, q }: { text: string; q: string } = $props();

	const parts = $derived(highlight(text, q));
</script>

{parts.before}{#if parts.match}<mark class="bg-transparent font-bold text-accent-strong"
		>{parts.match}</mark
	>{/if}{parts.after}
