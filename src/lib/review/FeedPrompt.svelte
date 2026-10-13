<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';

	/** The "what did you eat today?" row at the top of the feed. A link, not a form — it opens
	 *  the wizard, which is where a review is actually written. */
	let { displayName, avatarUrl = null }: { displayName: string; avatarUrl?: string | null } =
		$props();
</script>

<a
	href="/review/new"
	class="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 transition-colors hover:border-accent"
>
	<Avatar src={avatarUrl} name={displayName} size={36} />
	<span class="flex-1 text-ink-3">What did you eat today?</span>
	<span class="flex h-9 w-9 items-center justify-center rounded-input text-ink-2">
		<Icon name="camera" size={19} />
	</span>
</a>
