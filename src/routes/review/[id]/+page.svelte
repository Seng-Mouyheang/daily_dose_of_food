<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="mx-auto max-w-xl px-4 py-10">
	<p class="text-sm text-stone-500">Published review</p>
	<h1 class="mt-1 text-2xl font-semibold">{data.review.title ?? data.placeName}</h1>
	<p class="mt-2 text-stone-600">{data.placeName} · {data.review.visitType}</p>
	{#if data.review.description}
		<p class="mt-4 whitespace-pre-line text-stone-700">{data.review.description}</p>
	{/if}
</div>
