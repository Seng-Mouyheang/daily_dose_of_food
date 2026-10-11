<script lang="ts">
	/** A user's picture, falling back to their first initial on an accent disc when they have
	 *  no avatar (Clerk's avatarUrl is nullable, and a manually created user never has one).
	 *  `size` is in px rather than a t-shirt scale because the five call sites all want
	 *  different sizes from the mockups (24 in a grid card, 32 in a header, 40 in a feed card)
	 *  and a named scale would just be a lookup table over those numbers. */
	let {
		src = null,
		name,
		size = 40,
		class: extraClass = ''
	}: { src?: string | null; name: string; size?: number; class?: string } = $props();

	// Intl-safe: `name[0]` splits a surrogate pair (an emoji or an astral-plane script) into
	// half a character, which renders as a replacement glyph. Falling back to '?' keeps a
	// blank display name from producing an empty disc.
	const initial = $derived([...name.trim()][0]?.toUpperCase() ?? '?');
</script>

{#if src}
	<!-- alt="" because every call site renders the author's name as text immediately next to
	     this; an alt of the name would make a screen reader announce it twice. -->
	<img
		{src}
		alt=""
		width={size}
		height={size}
		class={`shrink-0 rounded-full object-cover ${extraClass}`}
		style={`width: ${size}px; height: ${size}px`}
	/>
{:else}
	<span
		aria-hidden="true"
		class={`flex shrink-0 items-center justify-center rounded-full bg-accent font-bold text-on-accent ${extraClass}`}
		style={`width: ${size}px; height: ${size}px; font-size: ${Math.round(size * 0.42)}px`}
	>
		{initial}
	</span>
{/if}
