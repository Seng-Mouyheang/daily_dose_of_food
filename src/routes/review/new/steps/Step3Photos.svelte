<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import type { PhotoDraft, ReviewDraft } from '#lib/review/draft.svelte.ts';

	let { draft }: { draft: ReviewDraft } = $props();

	const MAX_PHOTOS = 10;
	const ACCEPTED = /^image\/(png|jpe?g|webp|heic)$/;
	// Cloudinary's upload API has no `max_file_size` request param (see signUpload's doc
	// comment in cloudinary.ts for how including one as a signed param broke every upload), so
	// the 12 MB ceiling this step advertises is enforced here instead, before anything uploads.
	const MAX_UPLOAD_BYTES = 12_000_000;

	let fileInput: HTMLInputElement | undefined;
	let dragOver = $state(false);
	let uploadingCount = $state(0);
	let uploadError = $state<string | null>(null);

	interface SignedParams {
		timestamp: number;
		folder: string;
		allowed_formats: string;
		signature: string;
		apiKey: string;
		cloudName: string;
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		const kb = bytes / 1024;
		if (kb < 1024) return `${Math.round(kb)} KB`;
		return `${(kb / 1024).toFixed(1)} MB`;
	}

	async function uploadFile(file: File, signed: SignedParams): Promise<PhotoDraft> {
		const form = new FormData();
		form.append('file', file);
		form.append('api_key', signed.apiKey);
		form.append('timestamp', String(signed.timestamp));
		form.append('signature', signed.signature);
		form.append('folder', signed.folder);
		form.append('allowed_formats', signed.allowed_formats);

		const res = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, {
			method: 'POST',
			body: form
		});
		if (!res.ok) throw new Error('Upload failed');
		const data = await res.json();

		// Registers the upload server-side (a `media_files` row, `mediaStatus: 'pending'`) well
		// before this review publishes — otherwise the asset exists only in this draft's
		// localStorage, indistinguishable to a cleanup run from a stray nobody ever finished
		// uploading, and the 24h grace period alone can't tell "still mid-wizard" from
		// "abandoned". Best-effort: a failed registration call just leaves this one photo on the
		// shorter grace period instead of the generous one — not worth failing the upload itself,
		// since the valuable part (the asset landing on Cloudinary) already succeeded.
		await fetch('/api/photos/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				publicId: data.public_id,
				version: data.version,
				signature: data.signature,
				format: data.format,
				width: data.width,
				height: data.height,
				bytes: data.bytes
			})
		}).catch(() => {});

		return {
			publicId: data.public_id,
			version: data.version,
			signature: data.signature,
			format: data.format,
			width: data.width,
			height: data.height,
			bytes: data.bytes,
			caption: null,
			isCover: false,
			previewUrl: data.secure_url
		};
	}

	async function addFiles(fileList: File[]) {
		const room = MAX_PHOTOS - draft.photos.length;
		const accepted = fileList.filter((f) => ACCEPTED.test(f.type) && f.size <= MAX_UPLOAD_BYTES);
		const files = accepted.slice(0, room);

		if (files.length === 0) {
			if (room <= 0 && accepted.length > 0) {
				// At capacity with otherwise-valid files (e.g. a paste, which doesn't check the drop
				// zone's disabled state the way a click/drag does) — don't claim they were the wrong
				// type/size when the real reason they didn't get added is there's no room left.
				uploadError = `You can have up to ${MAX_PHOTOS} photos.`;
			} else if (fileList.length > 0) {
				uploadError =
					"Those photos couldn't be added — check they're PNG/JPG/WEBP/HEIC under 12 MB.";
			}
			return;
		}
		if (accepted.length < fileList.length) {
			uploadError = 'Some photos were skipped — only PNG/JPG/WEBP/HEIC under 12 MB are supported.';
		} else if (files.length < accepted.length) {
			uploadError = `Only added ${files.length} — you can have up to ${MAX_PHOTOS} photos.`;
		} else {
			uploadError = null;
		}
		uploadingCount += files.length;
		try {
			const signRes = await fetch('/api/upload-signature', { method: 'POST' });
			if (!signRes.ok) throw new Error('Could not sign upload');
			const signed = (await signRes.json()) as SignedParams;

			// allSettled, not all: a batch of 3 where 1 fails must still keep the 2 that Cloudinary
			// already stored — Promise.all would reject on the first failure and this catch would
			// then drop every result, including already-uploaded photos, forcing a re-upload and
			// orphaning those stored assets.
			const results = await Promise.allSettled(files.map((f) => uploadFile(f, signed)));
			const hadCover = draft.photos.some((p) => p.isCover);
			let failedCount = 0;
			for (const result of results) {
				if (result.status === 'rejected') {
					failedCount++;
					continue;
				}
				const photo = result.value;
				if (!hadCover && draft.photos.length === 0) photo.isCover = true;
				draft.photos.push(photo);
			}
			if (failedCount > 0) {
				const succeededCount = files.length - failedCount;
				uploadError =
					succeededCount === 0
						? "Couldn't upload those photos. Try again."
						: `Uploaded ${succeededCount}, but ${failedCount} failed — try those again.`;
			}
		} catch {
			uploadError = "Couldn't upload those photos. Try again.";
		} finally {
			uploadingCount -= files.length;
		}
	}

	function makeCover(index: number) {
		draft.photos.forEach((p, i) => (p.isCover = i === index));
	}

	function removePhoto(index: number) {
		const wasCover = draft.photos[index]?.isCover;
		draft.photos.splice(index, 1);
		if (wasCover && draft.photos.length > 0) draft.photos[0]!.isCover = true;
	}

	// Lets a copied screenshot or image go straight in with Cmd/Ctrl+V — scoped to this step's
	// lifetime via svelte:window, so it's only live while Photos is the active step and never
	// steals a paste meant for a text field on another step. Only intercepts (preventDefault)
	// when the clipboard actually held an image; a text paste elsewhere is left alone.
	function onWindowPaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		const files: File[] = [];
		for (const item of items) {
			if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
			const file = item.getAsFile();
			if (file) files.push(file);
		}
		if (files.length === 0) return;
		e.preventDefault();
		void addFiles(files);
	}
</script>

<svelte:window onpaste={onWindowPaste} />

<div class="flex flex-col gap-5">
	<button
		type="button"
		class={`flex flex-col items-center gap-2.5 rounded-card border-2 border-dashed p-8 text-center transition-colors ${
			dragOver ? 'border-accent bg-accent-soft' : 'border-accent/50 bg-accent-soft/40'
		}`}
		ondragover={(e) => {
			e.preventDefault();
			dragOver = true;
		}}
		ondragleave={() => (dragOver = false)}
		ondrop={(e) => {
			e.preventDefault();
			dragOver = false;
			void addFiles(Array.from(e.dataTransfer?.files ?? []));
		}}
		onclick={() => fileInput?.click()}
		disabled={draft.photos.length >= MAX_PHOTOS}
	>
		<span class="flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-card">
			<Icon name="camera" size={22} class="text-ink-2" />
		</span>
		<span class="text-sm font-semibold text-ink">
			Drop photos here or <span class="text-accent-strong underline">browse</span>
		</span>
		<span class="text-xs text-ink-3">PNG, JPG or WEBP, up to 12 MB each — or paste to add</span>
		<input
			bind:this={fileInput}
			type="file"
			accept="image/png,image/jpeg,image/webp,image/heic"
			multiple
			class="hidden"
			onchange={(e) => void addFiles(Array.from(e.currentTarget.files ?? []))}
		/>
	</button>

	{#if uploadError}
		<p class="text-[13px] text-bad" role="alert">{uploadError}</p>
	{/if}

	{#if draft.photos.length === 0 && uploadingCount === 0}
		<p class="text-[13px] text-ink-3">
			No photos yet. Reviews with a photo get more attention in the feed, but you can skip this.
		</p>
	{/if}

	{#if draft.photos.length > 0 || uploadingCount > 0}
		<div class="flex items-center justify-between">
			<span class="text-sm font-semibold text-ink">Your photos</span>
			<span class="text-xs text-ink-3">{draft.photos.length} of {MAX_PHOTOS}</span>
		</div>
		<div class="grid grid-cols-3 gap-2.5">
			{#each draft.photos as photo, i (photo.publicId)}
				<div
					class={`group relative aspect-[4/3] overflow-hidden rounded-tile bg-sunken ${
						photo.isCover ? 'ring-2 ring-accent' : ''
					}`}
				>
					<img src={photo.previewUrl} alt="" class="h-full w-full object-cover" />
					{#if photo.isCover}
						<span
							class="absolute top-1.5 left-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wide text-on-accent uppercase"
							>Cover</span
						>
					{:else}
						<button
							type="button"
							class="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white"
							onclick={() => makeCover(i)}
						>
							Make cover
						</button>
					{/if}
					<span
						class="absolute right-1.5 bottom-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white"
						>{formatBytes(photo.bytes)}</span
					>
					<button
						type="button"
						aria-label={`Remove photo ${i + 1}`}
						class="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
						onclick={() => removePhoto(i)}
					>
						<Icon name="x" size={14} weight={2.5} />
					</button>
				</div>
			{/each}
			{#each Array.from({ length: uploadingCount }, (_, i) => i) as i (i)}
				<div
					class="flex aspect-[4/3] items-center justify-center rounded-tile border border-line bg-sunken text-ink-3"
				>
					<span class="text-xs">Uploading…</span>
				</div>
			{/each}
			{#if draft.photos.length < MAX_PHOTOS}
				<button
					type="button"
					class="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-tile border-2 border-dashed border-line text-ink-3 hover:bg-sunken"
					onclick={() => fileInput?.click()}
				>
					<Icon name="plus" size={18} />
					<span class="text-xs font-semibold">Add more</span>
				</button>
			{/if}
		</div>
	{/if}
</div>
