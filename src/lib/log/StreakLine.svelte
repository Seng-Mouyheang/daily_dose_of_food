<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';

	/** Days in a row with a log. Once today has one it's a celebration; before that it's a nudge
	 *  to keep yesterday's streak alive. Nothing at all when there is no streak to talk about. */
	let { streak, loggedToday }: { streak: number; loggedToday: boolean } = $props();
</script>

{#if streak > 0}
	<p class="flex items-center gap-2 text-[13.5px] text-ink-2">
		<Icon name="sparkle" size={17} class="text-accent-strong" />
		<span>
			{#if loggedToday}
				<b class="font-semibold text-ink">{streak} {streak === 1 ? 'day' : 'days'} in a row.</b>
				Nice going.
			{:else}
				<b class="font-semibold text-ink">{streak}-day streak.</b> Log something today to keep it going.
			{/if}
		</span>
	</p>
{/if}
