<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import ActionSheet, { type SheetAction } from '#lib/components/ActionSheet.svelte';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import { toast } from '#lib/components/toast.svelte.ts';
	import { JOURNAL_ACTIONS, runJournalAction, undoJournalAction } from '#lib/journal/actions.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import Button from '#lib/components/Button.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import CommentItem from '#lib/review/CommentItem.svelte';
	import FactsGrid from '#lib/review/FactsGrid.svelte';
	import LocationPanel from '#lib/review/LocationPanel.svelte';
	import PhotoCarousel from '#lib/review/PhotoCarousel.svelte';
	import RatingPanel from '#lib/review/RatingPanel.svelte';
	import ReviewCardActions from '#lib/review/ReviewCardActions.svelte';
	import TagGroups from '#lib/review/TagGroups.svelte';
	import { primaryItem, reviewTitle, totalWithTax, type ReviewComment } from '#lib/review/card.ts';
	import { timeAgo } from '#lib/review/format.ts';
	import { COMMENT_MAX_LENGTH } from '#lib/review/schema.ts';
	import {
		ACCEPTED_IMAGE,
		MAX_UPLOAD_BYTES,
		registerPhoto,
		signUploadParams,
		uploadToCloudinary
	} from '#lib/review/upload.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Comments posted from this page since the last load, newest first. Writable $derived: it
	// empties itself whenever `data` reloads (e.g. after a delete), when the server list already
	// includes them. A `pending` one is shown immediately and swapped for the server's on success.
	let localComments = $derived.by((): (ReviewComment & { pending?: boolean })[] => {
		void data.comments;
		return [];
	});
	const comments = $derived([...localComments, ...data.comments]);
	// Threads newest first; each thread's replies read top-down, oldest first.
	// The pinned comment leads (sort is stable, so the rest keep their newest-first order).
	const threads = $derived(
		comments
			.filter((c) => !c.parentId)
			.map((c) => ({ comment: c, replies: comments.filter((r) => r.parentId === c.id).reverse() }))
			.sort((a, b) => Number(b.comment.pinned) - Number(a.comment.pinned))
	);
	let replying = $state<{ id: string; name: string } | null>(null);

	// One optional photo per comment. Uploaded as soon as it's picked (straight to Cloudinary, then
	// registered), so posting only has to send its id. `preview` is a local object URL, shown
	// immediately and reused by the optimistic comment.
	let photo = $state<{
		publicId: string | null;
		preview: string;
		width: number | null;
		height: number | null;
	} | null>(null);
	let photoInput = $state<HTMLInputElement>();
	let photoError = $state('');
	const uploading = $derived(photo !== null && photo.publicId === null);

	async function pickPhoto(file: File | undefined) {
		if (!file) return;
		if (!ACCEPTED_IMAGE.test(file.type) || file.size > MAX_UPLOAD_BYTES) {
			photoError = 'Choose a PNG, JPG, WEBP or HEIC photo under 12 MB.';
			return;
		}
		photoError = '';
		const preview = URL.createObjectURL(file);
		photo = { publicId: null, preview, width: null, height: null };
		try {
			const uploaded = await uploadToCloudinary(file, await signUploadParams());
			// Unlike the wizard, registration isn't best-effort here: the comment action looks the
			// photo up by its registered row, so an unregistered upload can't be attached.
			if (!(await registerPhoto(uploaded))) throw new Error('register failed');
			// Still the same pick? (It may have been removed or replaced while uploading.)
			if (photo?.preview === preview) {
				photo = {
					publicId: uploaded.publicId,
					preview,
					width: uploaded.width,
					height: uploaded.height
				};
			}
		} catch {
			if (photo?.preview === preview) {
				photo = null;
				photoError = "Couldn't upload that photo. Try again.";
			}
		}
	}
	let bodyEl = $state<HTMLTextAreaElement>();
	let draftLength = $state(0);
	// Quiet until it matters: a counter on an empty box is noise, so it appears in the last fifth.
	const showCounter = $derived(draftLength >= COMMENT_MAX_LENGTH * 0.8);

	/** Height follows the content (and shrinks back after a post), capped by max-h on the
	 *  element so a long comment scrolls inside the field rather than pushing the page down. */
	function grow(el: HTMLTextAreaElement) {
		el.style.height = 'auto';
		el.style.height = `${el.scrollHeight}px`;
	}

	/** Points the composer at a thread (a reply to a reply joins the same thread), prefills
	 *  "@Name " and hands it focus. */
	function replyTo(target: ReviewComment) {
		if (!bodyEl) return;
		const name = target.author.displayName;
		replying = { id: target.parentId ?? target.id, name };
		bodyEl.value = `@${name} `;
		grow(bodyEl);
		draftLength = bodyEl.value.length;
		bodyEl.focus();
		bodyEl.setSelectionRange(bodyEl.value.length, bodyEl.value.length);
	}

	// Enter posts, Shift+Enter adds a line — the usual chat-composer split. `isComposing` keeps
	// an IME's own Enter (confirming a candidate) from submitting half a word.
	function submitOnEnter(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
		event.preventDefault();
		// requestSubmit() ignores the disabled send button, so hold Enter back while a photo uploads.
		if (uploading) return;
		(event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
	}

	const review = $derived(data.review);
	const title = $derived(reviewTitle(review));

	/* ------------------------- author actions: delete (and edit) ------------------------- */

	let sheetOpen = $state(false);
	let confirmingDelete = $state(false);

	const ownActions = $derived<SheetAction[]>([
		{ label: 'Edit review', icon: 'pencil', href: `/review/${review.id}/edit` },
		{
			label: 'Delete review',
			icon: 'trash',
			danger: true,
			onclick: () => (confirmingDelete = true)
		}
	]);

	// Back from a saved edit: say so once, then drop the flag so a reload doesn't repeat it.
	onMount(() => {
		if (page.url.searchParams.has('saved')) {
			toast.show('Changes saved');
			const url = new URL(page.url.href);
			url.searchParams.delete('saved');
			replaceState(url, page.state);
		}
	});

	/** Deleting leaves the page — the review is gone — for the journal, where the Undo message
	 *  is still on screen (it lives in the root layout). Undo brings the review back and returns
	 *  here. */
	async function deleteReview() {
		const id = review.id;
		const spec = JOURNAL_ACTIONS.delete;
		if (!(await runJournalAction('delete', id))) {
			toast.show(spec.failed);
			return;
		}
		await goto('/journal');
		toast.show(spec.done, async () => {
			if (await undoJournalAction('delete', id)) await goto(`/review/${id}`);
			else toast.show("Couldn't undo that. Try again.");
		});
	}
	const item = $derived(primaryItem(review.items));
	const total = $derived(totalWithTax(review.items));
	const published = $derived(timeAgo(review.publishedAt ?? review.visitedAt));

	const price = $derived(
		review.items.reduce<number | null>(
			(sum, i) => (i.price === null ? sum : (sum ?? 0) + i.price),
			null
		)
	);

	// A "both" review has two items that can carry different rates; one shared rate is shown as a
	// percentage, differing rates fall back to plain "incl. tax" rather than picking one.
	const taxLabel = $derived.by(() => {
		const rates = new Set(
			review.items.filter((i) => i.price !== null).map((i) => i.taxPercent ?? 0)
		);
		const [rate] = rates;
		return rates.size === 1 && rate ? `incl. ${rate}% tax` : 'incl. tax';
	});

	/** "French · Dessert · $7.02 total incl. 8% tax" — whichever of those three the review has. */
	const subtitle = $derived(
		[
			item?.cuisineLabel,
			item?.typeLabel,
			total === null ? null : `$${total.toFixed(2)} total ${taxLabel}`
		]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<svelte:head>
	<title>{title} — Daily Dose of Food</title>
</svelte:head>

<div class="mx-auto max-w-[1120px] px-4 pb-4 lg:px-8 lg:pb-6">
	<!-- Pinned so "back" is always one tap away on a long review. The solid background (bled out
	     to the container edges) keeps scrolled content from showing through behind it. -->
	<div class="sticky top-0 z-20 -mx-4 bg-bg px-4 pt-3 lg:-mx-8 lg:px-8">
		<div class="flex items-center justify-between">
			<a
				href="/"
				class="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent-strong"
			>
				<Icon name="chevL" size={16} weight={2.2} />
				Back to feed
			</a>
			{#if data.isOwnReview}
				<button
					type="button"
					onclick={() => (sheetOpen = true)}
					aria-label="More options"
					class="grid h-11 w-11 place-items-center rounded-input text-ink-2 hover:bg-sunken lg:hidden"
				>
					<Icon name="more" size={20} />
				</button>
			{/if}
		</div>
	</div>

	<!-- One column on mobile, in the handoff's order. On desktop the gallery and location move
	     into a left column that stays put while the write-up on the right scrolls. -->
	<div class="mt-2 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-10">
		{#if review.photos.length}
			<div class="flex flex-col gap-5 lg:sticky lg:top-16">
				<PhotoCarousel photos={review.photos} {title} showThumbnails />
				<div class="hidden lg:block">
					<LocationPanel place={review.place} visitType={review.visitType} />
				</div>
			</div>
		{/if}

		<div class="flex min-w-0 flex-col gap-5">
			<div class="flex items-center gap-3">
				<Avatar src={review.author.avatarUrl} name={review.author.displayName} size={40} />
				<div class="min-w-0 flex-1">
					<p class="font-bold text-ink">{review.author.displayName}</p>
					<p class="text-[13px] text-ink-2">
						{data.isOwnReview ? 'Your review' : 'Reviewer'} · {published}
					</p>
				</div>
				{#if data.isOwnReview}
					<div class="flex items-center gap-1.5">
						<Button
							variant="ghost"
							href={`/review/${review.id}/edit`}
							class="h-9 gap-1.5 bg-sunken px-3 text-sm text-ink"
						>
							<Icon name="pencil" size={15} />
							Edit
						</Button>
						<button
							type="button"
							onclick={() => (confirmingDelete = true)}
							aria-label="Delete review"
							title="Delete review"
							class="grid h-9 w-9 place-items-center rounded-input bg-bad-soft text-bad hover:brightness-95"
						>
							<Icon name="trash" size={18} />
						</button>
					</div>
				{:else}
					<Button variant="ghost" disabled class="h-9 px-3 text-sm">Follow</Button>
				{/if}
			</div>

			<div>
				<div class="flex items-baseline justify-between gap-3">
					<h1
						class="font-display text-[26px] leading-tight font-semibold tracking-tight text-balance text-ink"
					>
						{title}
					</h1>
					{#if price !== null}
						<span class="shrink-0 font-display text-[22px] font-semibold text-ink tabular-nums">
							${price.toFixed(2)}
						</span>
					{/if}
				</div>
				{#if subtitle}
					<p class="mt-1 text-sm text-ink-2">{subtitle}</p>
				{/if}
				{#if review.isFavorite}
					<p
						class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-fav-soft px-2.5 py-1 text-xs font-bold text-fav"
					>
						<Icon name="heart" size={13} />
						One of their favorites
					</p>
				{/if}
			</div>

			<RatingPanel overallRating={review.overallRating} categoryRatings={review.categoryRatings} />

			<TagGroups tags={review.tags} />

			{#if review.description}
				<!-- Set in the display serif, larger and looser than body copy: this is the part
				     someone came to read, and the rest of the page is data about it. -->
				<p
					class="max-w-[62ch] font-display text-[16.5px] leading-relaxed whitespace-pre-line text-ink"
				>
					{review.description}
				</p>
			{/if}

			<FactsGrid {review} />

			{#if !review.photos.length}
				<!-- With no gallery there is no left column, so location comes inline here. -->
				<LocationPanel place={review.place} visitType={review.visitType} />
			{:else}
				<div class="lg:hidden">
					<LocationPanel place={review.place} visitType={review.visitType} />
				</div>
			{/if}

			<div class="px-2.5">
				<ReviewCardActions
					reviewId={review.id}
					liked={review.viewerHasLiked}
					saved={review.viewerHasSaved}
					shareTitle={title}
					likeCount={review.likeCount}
					commentCount={review.commentCount + localComments.length}
					commentsHref="#comments"
					canLike={data.canInteract}
				/>
			</div>

			<section id="comments" class="flex scroll-mt-6 flex-col gap-4">
				<h2 class="font-display text-lg font-semibold text-ink">Comments</h2>

				{#if data.canInteract}
					<form
						method="POST"
						action="?/comment"
						class="flex flex-col gap-2"
						use:enhance={({ formData, formElement }) => {
							const body = String(formData.get('body') ?? '').trim();
							const tempId = `pending-${Date.now()}`;
							const sentPhoto = photo;
							const sentReplying = replying;
							if ((body || sentPhoto) && data.user) {
								localComments = [
									{
										id: tempId,
										body,
										createdAt: new Date().toISOString(),
										author: {
											displayName: data.user.displayName,
											avatarUrl: data.user.avatarUrl
										},
										parentId: sentReplying?.id ?? null,
										pinned: false,
										photo: sentPhoto
											? { url: sentPhoto.preview, width: sentPhoto.width, height: sentPhoto.height }
											: null,
										isOwn: true,
										editedAt: null,
										likeCount: 0,
										viewerHasLiked: false,
										pending: true
									},
									...localComments
								];
								formElement.reset();
								replying = null;
								photo = null;
								if (bodyEl) grow(bodyEl);
								draftLength = 0;
							}
							return async ({ result, update }) => {
								const saved =
									result.type === 'success'
										? (result.data as { comment?: ReviewComment } | undefined)?.comment
										: undefined;
								if (saved) {
									localComments = localComments.map((c) => (c.id === tempId ? saved : c));
									// Applies the success to `form` so an earlier failure's message goes away;
									// no reset (the form was already cleared) and no reload (keeps the optimistic list).
									await update({ reset: false, invalidateAll: false });
									return;
								}
								// Failed: drop the optimistic copy and give the text and photo back with the error.
								localComments = localComments.filter((c) => c.id !== tempId);
								photo = sentPhoto;
								replying = sentReplying;
								await update();
								if (bodyEl) {
									bodyEl.value = body;
									grow(bodyEl);
									draftLength = body.length;
								}
							};
						}}
					>
						{#if replying}
							<p class="flex items-center gap-1 pl-11 text-[13px] text-ink-2">
								Replying to <span class="font-semibold text-ink">{replying.name}</span>
								<button
									type="button"
									aria-label="Cancel reply"
									class="-my-2 inline-flex h-9 w-9 items-center justify-center text-ink-3 hover:text-ink"
									onclick={() => {
										replying = null;
										if (bodyEl) {
											bodyEl.value = '';
											grow(bodyEl);
											draftLength = 0;
										}
									}}
								>
									<Icon name="x" size={14} />
								</button>
							</p>
						{/if}
						<div class="flex items-start gap-3">
							{#if data.user}
								<!-- Pinned beside the first line (mt-2 centres 32px in the 48px minimum row) so it
								     stays put while the field grows downward. -->
								<Avatar
									src={data.user.avatarUrl}
									name={data.user.displayName}
									size={32}
									class="mt-2"
								/>
							{/if}
							<input type="hidden" name="parentId" value={replying?.id ?? ''} />
							<input type="hidden" name="mediaPublicId" value={photo?.publicId ?? ''} />
							<label class="sr-only" for="comment-body">
								{replying ? `Reply to ${replying.name}` : 'Write a comment'}
							</label>
							<div
								class="flex min-w-0 flex-1 items-end rounded-input border border-line bg-surface pr-1 pl-4 focus-within:border-accent"
							>
								<textarea
									id="comment-body"
									name="body"
									rows="1"
									maxlength={COMMENT_MAX_LENGTH}
									placeholder="Write a comment…"
									class="max-h-40 min-h-12 min-w-0 flex-1 resize-none [scrollbar-width:none] bg-transparent py-3 font-display text-[15px] leading-6 text-ink outline-none placeholder:font-semibold placeholder:text-ink-3 [&::-webkit-scrollbar]:hidden"
									bind:this={bodyEl}
									oninput={(e) => {
										grow(e.currentTarget);
										draftLength = e.currentTarget.value.length;
									}}
									onkeydown={submitOnEnter}
									onpaste={(e) => {
										// A pasted image (screenshot, copied photo) goes through the same picker path.
										const file = [...(e.clipboardData?.files ?? [])].find((f) =>
											f.type.startsWith('image/')
										);
										if (!file) return;
										e.preventDefault();
										void pickPhoto(file);
									}}>{form?.body ?? ''}</textarea
								>
								<div class="flex shrink-0 items-center pb-0.5">
									<input
										bind:this={photoInput}
										type="file"
										accept="image/png,image/jpeg,image/webp,image/heic"
										class="hidden"
										onchange={(e) => {
											void pickPhoto(e.currentTarget.files?.[0]);
											e.currentTarget.value = '';
										}}
									/>
									<button
										type="button"
										aria-label={photo ? 'Replace photo' : 'Add a photo'}
										title={photo ? 'Replace photo' : 'Add a photo'}
										class="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:text-ink"
										onclick={() => photoInput?.click()}
									>
										<Icon name="image" />
									</button>
									<button
										type="submit"
										disabled={uploading}
										aria-label="Post comment"
										class="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:text-accent-strong disabled:opacity-50"
									>
										<Icon name="send" />
									</button>
								</div>
							</div>
						</div>
						{#if photo}
							<div class="relative ml-11 w-fit">
								<img
									src={photo.preview}
									alt="Attachment preview"
									class="h-24 w-24 rounded-tile object-cover {uploading ? 'opacity-60' : ''}"
								/>
								{#if uploading}
									<span
										class="absolute inset-x-0 bottom-1.5 text-center text-xs font-semibold text-on-scrim"
										aria-live="polite">Uploading…</span
									>
								{/if}
								<button
									type="button"
									aria-label="Remove photo"
									class="absolute -top-2 -right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-scrim text-on-scrim"
									onclick={() => (photo = null)}
								>
									<Icon name="x" size={14} weight={2.4} />
								</button>
							</div>
						{/if}
						{#if photoError}
							<p role="alert" class="ml-11 text-[13px] font-medium text-bad">{photoError}</p>
						{/if}
						{#if showCounter}
							<p
								class="text-right text-xs tabular-nums {draftLength >= COMMENT_MAX_LENGTH
									? 'font-semibold text-bad'
									: 'text-ink-3'}"
								aria-live="polite"
							>
								{draftLength}/{COMMENT_MAX_LENGTH}
							</p>
						{/if}
						{#if form?.message}
							<p role="alert" class="text-[13px] font-medium text-bad">{form.message}</p>
						{/if}
					</form>
				{:else}
					<p class="text-sm text-ink-2">
						<a href="/sign-in" class="font-semibold text-accent-strong">Sign in</a> to join the conversation.
					</p>
				{/if}

				{#if threads.length}
					<ul class="flex flex-col gap-5">
						{#each threads as { comment, replies } (comment.id)}
							<CommentItem
								{comment}
								canInteract={data.canInteract}
								canPin={data.isOwnReview}
								onreply={replyTo}
							>
								{#if replies.length}
									<ul class="mt-3 flex flex-col gap-4">
										{#each replies as reply (reply.id)}
											<CommentItem
												comment={reply}
												canInteract={data.canInteract}
												onreply={replyTo}
											/>
										{/each}
									</ul>
								{/if}
							</CommentItem>
						{/each}
					</ul>
				{:else}
					<p class="text-sm text-ink-2">No comments yet. Start the conversation.</p>
				{/if}
			</section>
		</div>
	</div>
</div>

{#if data.isOwnReview}
	<ActionSheet open={sheetOpen} {title} actions={ownActions} onclose={() => (sheetOpen = false)} />
	<ConfirmDialog
		open={confirmingDelete}
		title="Delete this review?"
		message={`“${title}” will be removed from your journal and the feed, with its photos and ${review.commentCount} ${review.commentCount === 1 ? 'comment' : 'comments'}.`}
		confirmLabel="Delete"
		onconfirm={deleteReview}
		onclose={() => (confirmingDelete = false)}
	/>
{/if}
