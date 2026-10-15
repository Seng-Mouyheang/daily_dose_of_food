<script lang="ts">
	import ReviewWizard from '#lib/review/wizard/ReviewWizard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<ReviewWizard lookups={data.lookups} user={data.user} formMessage={form?.message ?? null} />
