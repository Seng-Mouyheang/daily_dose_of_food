<script lang="ts">
	import { page } from '$app/state';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons.ts';

	/** The mobile app chrome: Home, Explore, a write button, Journal, Dashboard. Journal took
	 *  Favorites' slot — favorites are a filter inside the journal now — and Dashboard took
	 *  Profile's, since the avatar in the header already opens the profile.
	 *
	 *  Explore has no page yet, so it renders as a disabled button rather than a link to a
	 *  404 — the same choice the desktop header makes with its inert nav label. It stays
	 *  because the handoff's bar has five slots, and dropping one would move the write button
	 *  off centre, which is the one thing in this bar that has to be where the thumb expects
	 *  it. */
	const isHome = $derived(page.url.pathname === '/');
	const isJournal = $derived(page.url.pathname.startsWith('/journal'));
	const isDashboard = $derived(page.url.pathname.startsWith('/dashboard'));
</script>

{#snippet tab(icon: IconName, label: string, href: string | null, active: boolean)}
	{@const classes =
		'flex min-h-11 flex-col items-center gap-0.5 py-1.5 text-[11.5px] font-semibold'}
	{#if href}
		<a
			{href}
			aria-current={active ? 'page' : undefined}
			class="{classes} rounded-input {active ? 'text-accent-strong' : 'text-ink-3'}"
		>
			<Icon name={icon} size={23} weight={active ? 2.2 : 1.8} />
			{label}
		</a>
	{:else}
		<button
			type="button"
			disabled
			title="{label} — not available yet"
			class="{classes} cursor-default text-ink-3"
		>
			<Icon name={icon} size={23} />
			{label}
		</button>
	{/if}
{/snippet}

<!-- Fixed, so the feed scrolls under it; the layout adds matching bottom padding so the last
     card is never trapped behind this. pb-5 covers the iOS home-indicator inset. -->
<nav
	aria-label="Main"
	class="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 items-center border-t border-line bg-surface px-1.5 pt-1.5 pb-5 lg:hidden"
>
	{@render tab('home', 'Home', '/', isHome)}
	{@render tab('compass', 'Explore', null, false)}

	<a
		href="/review/new"
		aria-label="Write a review"
		class="flex min-h-11 items-center justify-center"
	>
		<span
			class="flex h-12 w-12 items-center justify-center rounded-tile bg-accent text-on-accent shadow-card"
		>
			<Icon name="plus" size={24} weight={2.4} />
		</span>
	</a>

	{@render tab('book', 'Journal', '/journal', isJournal)}
	{@render tab('chart', 'Dashboard', '/dashboard', isDashboard)}
</nav>
