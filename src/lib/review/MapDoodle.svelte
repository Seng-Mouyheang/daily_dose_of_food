<!--
	A decorative stand-in for a real map, ported from the design prototype.

	DESIGN.md §4 says never to inline raw <svg> in a component and to register glyphs in
	icons.ts instead. This is the deliberate exception: icons.ts holds 24x24 single-color
	glyphs rendered through Icon.svelte's shared stroke settings, and this is a multi-layer
	illustration with its own viewBox and six fills. Putting it there would mean giving Icon a
	second rendering mode for one entry. It gets its own component instead, whose whole body is
	that illustration.

	It is not a map of anywhere. Until real geocoding and a tile provider land, this stands in
	for the shape of the eventual map without pretending to show the place's actual streets —
	hence the generic road labels and `role="presentation"`, so a screen reader is not told
	there is a map here to read. The place's real address is rendered as text next to it.
-->
<script lang="ts">
	let { class: extraClass = '' }: { class?: string } = $props();
</script>

<div class={`overflow-hidden rounded-tile border border-line ${extraClass}`}>
	<svg viewBox="0 0 400 160" class="block aspect-[5/2] w-full" role="presentation">
		<rect width="400" height="160" fill="var(--sunken)" />
		<path d="M262 0h86l-18 58h-90z" fill="var(--good-soft)" />
		<path d="M0 128C80 112 140 152 220 137S350 120 400 142V160H0z" fill="var(--accent-soft)" />
		<g fill="none" stroke-linecap="round">
			<path
				d="M0 30H400M0 104H400M60 0V122M200 0V140M340 0V130"
				stroke="var(--line)"
				stroke-width="5"
			/>
			<path d="M0 70H400M128 0V160M318 0L278 160" stroke="var(--surface)" stroke-width="11" />
		</g>
		<circle cx="200" cy="70" r="22" fill="var(--accent)" opacity="0.18" />
		<path d="M200 74s-12-10-12-19a12 12 0 0 1 24 0c0 9-12 19-12 19z" fill="var(--accent)" />
		<circle cx="200" cy="55" r="4.5" fill="var(--surface)" />
	</svg>
</div>
