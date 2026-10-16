<script lang="ts">
	import ReviewWizard from '#lib/review/wizard/ReviewWizard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Edit review — Daily Dose of Food</title>
</svelte:head>

<ReviewWizard
	mode="edit"
	initial={data.initial}
	lookups={data.lookups}
	user={data.user}
	formMessage={form?.message ?? null}
/>
