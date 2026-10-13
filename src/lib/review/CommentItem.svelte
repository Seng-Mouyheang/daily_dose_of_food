<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import type { ReviewComment } from './card.ts';
	import { formatCount, timeAgo } from './format.ts';
	import { COMMENT_MAX_LENGTH } from './schema.ts';

	/** One comment: like, Reply, and a "more" menu (Edit/Delete for its author, Copy for
	 *  everyone else). Like and Edit are optimistic and never reload the page; Delete does, since
	 *  the list has to lose the row anyway. */
	let {
		comment,
		canInteract,
		canPin = false,
		onreply,
		children
	}: {
		comment: ReviewComment & { pending?: boolean };
		canInteract: boolean;
		/** The viewer wrote the review, so a top-level comment can be pinned or unpinned. */
		canPin?: boolean;
		onreply: (comment: ReviewComment) => void;
		/** The thread's replies, rendered under this comment's body. */
		children?: Snippet;
	} = $props();

	// Writable $derived: local, optimistic copies that reset if the page hands over fresh data.
	let liked = $derived(comment.viewerHasLiked);
	let likeCount = $derived(comment.likeCount);
	let likePending = false;
	let body = $derived(comment.body);
	let editedAt = $derived(comment.editedAt);

	let editing = $state(false);

	// Clamped to 3 lines (the YouTube/Instagram convention). "Show more" appears only when the
	// text is really cut off, so a short comment never gets a pointless button. Re-measured when
	// the text or the width changes; once expanded the clamp is off, so the flag is left alone.
	let expanded = $state(false);
	let overflowing = $state(false);
	let bodyEl = $state<HTMLElement>();
	$effect(() => {
		void body;
		const el = bodyEl;
		if (!el) return;
		const measure = () => {
			if (!expanded) overflowing = el.scrollHeight > el.clientHeight + 1;
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	});
	let draft = $state('');
	// Nothing to save until the text actually differs (ignoring edge whitespace, as the server does).
	const unchanged = $derived(draft.trim() === body.trim() || draft.trim() === '');
	let error = $state('');
	let menu = $state<HTMLElement>();
	let confirmDelete = $state<HTMLDialogElement>();
	const anchor = $derived(`--comment-${comment.id}`);

	function closeMenu() {
		menu?.hidePopover();
	}
</script>

<li class="flex gap-3 transition-opacity {comment.pending ? 'opacity-60' : ''}">
	<Avatar
		src={comment.author.avatarUrl}
		name={comment.author.displayName}
		size={comment.parentId ? 32 : 40}
	/>
	<div class="min-w-0 flex-1">
		<div class="flex items-start gap-2">
			<div class="min-w-0 flex-1">
				{#if comment.pinned}
					<p class="mb-0.5 flex items-center gap-1 text-xs font-semibold text-accent-strong">
						<Icon name="pushpin" size={13} />Pinned by author
					</p>
				{/if}
				<p class="text-[15px] font-bold text-ink">
					{comment.author.displayName}
					<span class="text-[13px] font-normal text-ink-3"
						>· {timeAgo(comment.createdAt)}{#if editedAt}&nbsp;· Edited{/if}</span
					>
				</p>
			</div>
			{#if !comment.pending}
				<button
					type="button"
					popovertarget="menu-{comment.id}"
					aria-label="More options"
					class="-my-3 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:text-ink"
					style="anchor-name: {anchor}"
				>
					<Icon name="more" />
				</button>
				<div
					bind:this={menu}
					id="menu-{comment.id}"
					popover
					class="anchored-menu min-w-36 rounded-input border border-line bg-surface p-1 text-sm text-ink shadow-card-lg"
					style="position-anchor: {anchor}"
				>
					{#if canPin && !comment.parentId}
						<form method="POST" action="?/pinComment" use:enhance>
							<input type="hidden" name="commentId" value={comment.id} />
							<input type="hidden" name="pinned" value={String(!comment.pinned)} />
							<button
								type="submit"
								class="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-sunken"
								onclick={closeMenu}
							>
								<Icon name="pushpin" size={16} />{comment.pinned ? 'Unpin' : 'Pin to top'}
							</button>
						</form>
					{/if}
					{#if comment.isOwn}
						<button
							type="button"
							class="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-sunken"
							onclick={() => {
								closeMenu();
								error = '';
								draft = body;
								editing = true;
							}}
						>
							<Icon name="pencil" size={16} />Edit
						</button>
						<button
							type="button"
							class="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-bad hover:bg-sunken"
							onclick={() => {
								closeMenu();
								confirmDelete?.showModal();
							}}
						>
							<Icon name="x" size={16} />Delete
						</button>
					{:else}
						<button
							type="button"
							class="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-sunken"
							onclick={() => {
								closeMenu();
								void navigator.clipboard.writeText(body);
							}}
						>
							<Icon name="comment" size={16} />Copy text
						</button>
					{/if}
				</div>
			{/if}
		</div>

		{#if editing}
			<form
				method="POST"
				action="?/editComment"
				class="mt-2 flex flex-col gap-2"
				use:enhance={({ formData }) => {
					const before = { body, editedAt };
					body = String(formData.get('body') ?? '').trim() || body;
					editedAt = new Date().toISOString();
					editing = false;
					return async ({ result }) => {
						if (result.type === 'success') return;
						body = before.body;
						editedAt = before.editedAt;
						editing = true;
						error =
							(result.type === 'failure' && (result.data?.message as string)) ||
							'Your edit could not be saved.';
					};
				}}
			>
				<input type="hidden" name="commentId" value={comment.id} />
				<!-- svelte-ignore a11y_autofocus -->
				<textarea
					name="body"
					rows="3"
					maxlength={COMMENT_MAX_LENGTH}
					aria-label="Edit your comment"
					autofocus
					class="w-full resize-none rounded-input border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
					bind:value={draft}></textarea>
				{#if error}<p role="alert" class="text-[13px] font-medium text-bad">{error}</p>{/if}
				<div class="flex justify-end gap-2 text-sm font-semibold">
					<button
						type="button"
						class="h-9 rounded-full px-3 text-ink-2 hover:text-ink"
						onclick={() => (editing = false)}>Cancel</button
					>
					<button
						type="submit"
						disabled={unchanged}
						class="h-9 rounded-full bg-accent px-4 text-on-accent disabled:cursor-not-allowed disabled:opacity-50"
						>Save</button
					>
				</div>
			</form>
		{:else}
			{#if comment.photo}
				<a
					href={comment.photo.url}
					target="_blank"
					rel="noopener"
					aria-label="View photo larger"
					class="mt-2 block max-w-full cursor-zoom-in"
				>
					<img
						src={comment.photo.url}
						alt="Attached by {comment.author.displayName}"
						width={comment.photo.width}
						height={comment.photo.height}
						loading="lazy"
						class="h-auto max-h-72 w-auto max-w-full rounded-tile object-cover"
					/>
				</a>
			{/if}
			<p
				bind:this={bodyEl}
				class="mt-0.5 text-[15px] leading-normal wrap-anywhere whitespace-pre-line text-ink"
				class:line-clamp-3={!expanded}
			>
				{body}
			</p>
			{#if overflowing}
				<button
					type="button"
					class="mt-0.5 inline-flex h-9 items-center text-[13px] font-semibold text-ink-3 transition-colors hover:text-ink"
					aria-expanded={expanded}
					onclick={() => (expanded = !expanded)}
				>
					{expanded ? 'Show less' : 'Show more'}
				</button>
			{/if}
		{/if}

		{#if !comment.pending && !editing}
			<div class="mt-1 -ml-2.5 flex items-center gap-1 text-sm font-semibold text-ink-2">
				{#if canInteract}
					<form
						method="POST"
						action="?/likeComment"
						use:enhance={({ cancel }) => {
							// One request at a time, so responses can't land out of order.
							if (likePending) return cancel();
							likePending = true;
							const before = { liked, likeCount };
							liked = !liked;
							likeCount = Math.max(0, likeCount + (liked ? 1 : -1));
							return async ({ result }) => {
								const settled =
									result.type === 'success'
										? (result.data?.commentLike as { liked: boolean; likeCount: number })
										: null;
								liked = settled ? settled.liked : before.liked;
								likeCount = settled ? settled.likeCount : before.likeCount;
								likePending = false;
							};
						}}
					>
						<input type="hidden" name="commentId" value={comment.id} />
						<input type="hidden" name="liked" value={String(!liked)} />
						<button
							type="submit"
							aria-pressed={liked}
							aria-label={`Like comment, ${likeCount} ${likeCount === 1 ? 'like' : 'likes'}`}
							class="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 px-2.5 tabular-nums transition-colors {liked
								? 'text-fav'
								: 'hover:text-ink'}"
						>
							<Icon name="heart" filled={liked} />
							{#if likeCount > 0}<span>{formatCount(likeCount)}</span>{/if}
						</button>
					</form>
					<button
						type="button"
						class="inline-flex h-11 items-center px-2.5 transition-colors hover:text-ink"
						onclick={() => onreply(comment)}
					>
						Reply
					</button>
				{:else if likeCount > 0}
					<span class="inline-flex h-11 items-center gap-1.5 px-2.5 tabular-nums">
						<Icon name="heart" />{formatCount(likeCount)}
					</span>
				{/if}
			</div>
		{/if}
		{@render children?.()}
		{#if comment.isOwn}
			<!-- Native modal <dialog>: focus trap, Esc to close and an inert page behind it for free. -->
			<dialog
				bind:this={confirmDelete}
				aria-labelledby="delete-title-{comment.id}"
				class="m-auto w-[min(22rem,calc(100%-2rem))] rounded-card border border-line bg-surface p-5 text-ink shadow-card-lg backdrop:bg-scrim"
			>
				<h2 id="delete-title-{comment.id}" class="font-display text-lg font-semibold">
					Delete comment
				</h2>
				<p class="mt-1 text-sm text-ink-2">Delete your comment permanently?</p>
				<form
					method="POST"
					action="?/deleteComment"
					class="mt-5 flex justify-end gap-2 text-sm font-semibold"
					use:enhance={() => {
						confirmDelete?.close();
					}}
				>
					<input type="hidden" name="commentId" value={comment.id} />
					<button
						type="button"
						class="h-10 rounded-full px-4 text-ink-2 hover:text-ink"
						onclick={() => confirmDelete?.close()}>Cancel</button
					>
					<button type="submit" class="h-10 rounded-full bg-bad px-4 text-on-accent">Delete</button>
				</form>
			</dialog>
		{/if}
	</div>
</li>
