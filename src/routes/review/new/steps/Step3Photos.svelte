<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import type { PhotoDraft, ReviewDraft } from '#lib/review/draft.svelte.ts';

	let { draft }: { draft: ReviewDraft } = $props();

	const MAX_PHOTOS = 10;
	const ACCEPTED = /^image\/(png|jpe?g|webp|heic)$/;

	let fileInput: HTMLInputElement | undefined;
	let dragOver = $state(false);
	let uploadingCount = $state(0);
	let uploadError = $state<string | null>(null);

	interface SignedParams {
		timestamp: number;
		folder: string;
		allowed_formats: string;
		max_file_size: number;
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
		form.append('max_file_size', String(signed.max_file_size));

		const res = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, {
			method: 'POST',
			body: form
		});
		if (!res.ok) throw new Error('Upload failed');
		const data = await res.json();
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

	async function addFiles(fileList: FileList | null) {
		if (!fileList) return;
		const room = MAX_PHOTOS - draft.photos.length;
		const files = Array.from(fileList)
			.filter((f) => ACCEPTED.test(f.type))
			.slice(0, room);
		if (files.length === 0) return;

		uploadError = null;
		uploadingCount += files.length;
		try {
			const signRes = await fetch('/api/upload-signature', { method: 'POST' });
			if (!signRes.ok) throw new Error('Could not sign upload');
			const signed = (await signRes.json()) as SignedParams;

			const uploaded = await Promise.all(files.map((f) => uploadFile(f, signed)));
			const hadCover = draft.photos.some((p) => p.isCover);
			uploaded.forEach((photo, i) => {
				if (!hadCover && i === 0 && draft.photos.length === 0) photo.isCover = true;
				draft.photos.push(photo);
			});
		} catch {
			uploadError = "Couldn't upload one or more photos. Try again.";
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
</script>

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
			void addFiles(e.dataTransfer?.files ?? null);
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
		<span class="text-xs text-ink-3">PNG, JPG or WEBP, up to 12 MB each</span>
		<input
			bind:this={fileInput}
			type="file"
			accept="image/png,image/jpeg,image/webp,image/heic"
			multiple
			class="hidden"
			onchange={(e) => void addFiles(e.currentTarget.files)}
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
							class="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink shadow-card"
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
