<script lang="ts">
	/** A People result: avatar, name, "@handle · 4 reviews", a one-line bio, and Follow /
	 *  Following. The name and avatar are plain until profile pages exist. Signed out, Follow is a
	 *  link to sign in, as like and bookmark are. The viewer is never in their own results, so
	 *  there is no "You" case. */
	import Avatar from '#lib/components/Avatar.svelte';
	import { createFollow } from '#lib/review/engagement.svelte.ts';
	import Highlight from './Highlight.svelte';
	import type { PersonResult } from './search.ts';

	let { person, q, signedIn }: { person: PersonResult; q: string; signedIn: boolean } = $props();

	const follow = createFollow(() => ({ userId: person.id, following: person.youFollow }));

	const buttonClass =
		'inline-flex h-9 shrink-0 items-center rounded-[10px] px-3.5 text-sm font-bold transition-colors';
</script>

<div class="flex items-center gap-3 py-2">
	<Avatar src={person.avatarUrl} name={person.displayName} tone="soft" />
	<div class="flex min-w-0 flex-1 flex-col gap-px">
		<span class="text-[15px] font-semibold text-ink"
			><Highlight text={person.displayName} {q} /></span
		>
		<small class="truncate text-[12.5px] text-ink-3"
			>@<Highlight text={person.username} {q} /> · {person.reviewCount}
			{person.reviewCount === 1 ? 'review' : 'reviews'}</small
		>
		{#if person.bio}
			<small class="truncate text-[12.5px] text-ink-2">{person.bio}</small>
		{/if}
	</div>
	{#if signedIn}
		<button
			type="button"
			aria-pressed={follow.on}
			onclick={follow.toggle}
			class="{buttonClass} {follow.on
				? 'bg-sunken text-ink-2'
				: 'bg-accent-soft text-accent-strong'}"
		>
			{follow.on ? 'Following' : 'Follow'}
		</button>
	{:else}
		<a href="/sign-in" class="{buttonClass} bg-accent-soft text-accent-strong">Follow</a>
	{/if}
</div>
