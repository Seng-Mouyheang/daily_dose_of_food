<script lang="ts" generics="T extends string | number">
	import Icon from './Icon.svelte';
	import { portal } from './portal.ts';

	let {
		value = $bindable(),
		otherValue = $bindable(null),
		options,
		placeholder = 'Select',
		groupLabel,
		id,
		invalid = false,
		allowOther = false
	}: {
		value: T | null;
		/** A custom entry typed into the "Other…" field — mutually exclusive with `value`.
		 *  Carried as plain text; the caller resolves it to a real option (creating one if
		 *  needed) only once the user actually publishes, so typing here never writes
		 *  anything by itself. */
		otherValue?: string | null;
		options: { value: T; label: string }[];
		placeholder?: string;
		/** Accessible name for the listbox popup — pass the same text as the visible <Field>
		 *  label, since the popup renders outside it (see positioning note below). */
		groupLabel: string;
		id?: string;
		invalid?: boolean;
		/** Shows an "Other…" row at the end of the list for a curated-but-extensible field. */
		allowOther?: boolean;
	} = $props();

	let open = $state(false);
	let wrapperEl: HTMLDivElement | undefined;
	let triggerEl: HTMLButtonElement | undefined;
	let optionEls: (HTMLButtonElement | undefined)[] = [];
	let otherButtonEl = $state<HTMLButtonElement | undefined>(undefined);
	let panelStyle = $state('');
	// Top of the app header's clip line, in viewport px — the point the panel should visually
	// scroll up behind, same as any other scrolled content would.
	let clipTop = $state(0);

	const selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? null);
	const hasOther = $derived(!!otherValue?.trim());
	// The trigger always says "Other" once a custom entry is active — the typed value itself
	// is right there in the field next to it, so repeating it in the trigger too just reads
	// as a confusing duplicate.
	const triggerLabel = $derived(hasOther ? 'Other' : (selectedLabel ?? placeholder));

	// Starts open if otherValue already has content — e.g. after the wizard step that hosts
	// this Select remounts (switching steps and back), which resets this local flag but not
	// the bound otherValue itself. Without this, a typed "Other…" value would silently persist
	// in the draft while its input disappeared from view until re-triggered from the dropdown.
	let enteringOther = $state(!!otherValue?.trim());
	let otherInputEl = $state<HTMLInputElement | undefined>(undefined);
	// Remembers the real option that was selected (if any) before the user opened "Other…", so
	// Cancel can restore it instead of leaving `value` cleared.
	let valueBeforeOther: T | null = null;

	// `fixed` + a measured rect, the same fix InfoTooltip needed — this panel can open from
	// inside the wizard's scrolling center column, and an `overflow-y: auto` ancestor forces
	// `overflow-x` to clip too, cutting off anything `absolute` the moment it's taller than the
	// visible area. `fixed` escapes that clipping entirely.
	function syncPanelPosition() {
		if (!triggerEl) return;
		const rect = triggerEl.getBoundingClientRect();
		clipTop = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
		panelStyle = `top:${rect.bottom + 4}px; left:${rect.left}px; width:${rect.width}px;`;
	}

	function openPanel() {
		syncPanelPosition();
		open = true;
		// The panel is portaled to the end of <body> — without this, focus stays on the trigger
		// and the next Tab lands on whatever follows it in the wizard, nowhere near the options
		// that just appeared at the other end of the DOM. The options don't exist this tick yet
		// (same reason startOther below needs requestAnimationFrame), so wait a frame.
		requestAnimationFrame(() => {
			if (options.length === 0) {
				otherButtonEl?.focus();
				return;
			}
			const index = Math.max(
				0,
				options.findIndex((o) => o.value === value)
			);
			optionEls[index]?.focus();
		});
	}

	/** Moves focus among the option buttons (and the trailing "Other…" one, if present) by
	 *  Arrow Up/Down, wrapping at either end — the only keyboard navigation this listbox had
	 *  none of before. Selecting still happens via each button's own native Enter/Space click. */
	function focusOptionAt(index: number) {
		const total = options.length + (allowOther ? 1 : 0);
		const wrapped = ((index % total) + total) % total;
		if (wrapped < options.length) optionEls[wrapped]?.focus();
		else otherButtonEl?.focus();
	}

	function onOptionKeydown(e: KeyboardEvent, index: number) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			focusOptionAt(index + 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			focusOptionAt(index - 1);
		}
	}

	// `fixed` is positioned against the viewport, not the trigger, so scrolling the wizard's
	// center column would otherwise leave the panel floating wherever it first opened while the
	// trigger scrolls away under it. Re-measuring on every scroll keeps it glued to the trigger
	// — and the clip-path wrapper in the markup below (driven by `clipTop`) clips it at the
	// header line exactly like any other scrolled content, so it visually scrolls past and out
	// of view instead of vanishing the instant it touches the header, then reappears on its own
	// the moment the trigger scrolls back into view — no re-click needed, and nothing here ever
	// closes the dropdown on its own; only an explicit action does (outside click, Escape,
	// picking an option). Capture phase is required: the 'scroll' event doesn't bubble, so a
	// plain window listener never sees a descendant's scroll, only the window's own.
	$effect(() => {
		if (!open) return;
		window.addEventListener('scroll', syncPanelPosition, true);
		return () => window.removeEventListener('scroll', syncPanelPosition, true);
	});

	function choose(opt: T) {
		value = opt;
		otherValue = null;
		enteringOther = false;
		close();
		triggerEl?.focus();
	}

	function close() {
		open = false;
	}

	function cancelOther() {
		otherValue = null;
		enteringOther = false;
		value = valueBeforeOther;
	}

	// Only the dropdown list auto-closes on an outside click — the "Other" field stays open
	// (as the user asked) until they pick a real option instead or hit Cancel, not just
	// because focus moved elsewhere while typing.
	function onWindowClick(e: MouseEvent) {
		if (open && wrapperEl && !wrapperEl.contains(e.target as Node)) close();
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') {
			close();
			triggerEl?.focus();
		}
	}

	function startOther() {
		open = false;
		valueBeforeOther = value;
		value = null;
		enteringOther = true;
		// The input doesn't exist yet this tick (it's behind {#if enteringOther}); focus it
		// once Svelte has mounted it.
		requestAnimationFrame(() => otherInputEl?.focus());
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<div bind:this={wrapperEl} class={enteringOther ? 'grid grid-cols-2 gap-3' : 'flex'}>
	<div class="relative min-w-0 flex-1">
		<button
			bind:this={triggerEl}
			{id}
			type="button"
			aria-haspopup="listbox"
			aria-expanded={open}
			class={`flex h-12 w-full items-center justify-between gap-2 rounded-input border bg-surface px-3.5 text-left text-[15px] transition-colors focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-soft ${
				invalid ? 'border-bad' : 'border-line'
			} ${selectedLabel || hasOther ? 'text-ink' : 'text-ink-3'}`}
			onclick={() => (open ? close() : openPanel())}
		>
			<span class="truncate">{triggerLabel}</span>
			<Icon name="chevD" size={16} class="shrink-0 text-ink-3" />
		</button>
	</div>

	{#if enteringOther}
		<div
			class="flex h-12 min-w-0 items-center gap-1 rounded-input border border-line bg-surface py-1 pr-1 pl-3.5 transition-colors focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-soft"
		>
			<input
				bind:this={otherInputEl}
				type="text"
				placeholder="Your own…"
				value={otherValue ?? ''}
				oninput={(e) => (otherValue = e.currentTarget.value)}
				class="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
				onkeydown={(e) => {
					if (e.key === 'Enter') e.preventDefault();
					if (e.key === 'Escape') cancelOther();
				}}
			/>
			<button
				type="button"
				aria-label="Cancel"
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
				onclick={cancelOther}
			>
				<Icon name="x" size={16} weight={2.5} />
			</button>
		</div>
	{/if}
</div>

{#if open}
	<!-- Clips the panel at the header's bottom edge (and the viewport's own bottom, via this
	     box's own height) exactly like a normal scrolled descendant would — so it scrolls past
	     and disappears naturally instead of vanishing the instant it touches the header. A
	     `transform` is required for that clip to actually apply to a `fixed` descendant: `fixed`
	     elements are normally positioned (and clipped) against the viewport itself, ignoring
	     ordinary ancestor overflow — the same escape hatch this panel relies on to get past the
	     wizard column's own overflow-y clipping. A `transform` on this wrapper makes it the
	     containing block for `fixed` descendants instead, so its own clip-path now applies.
	     `portal` (see portal.ts) also moves this wrapper itself to `<body>`, the same fix
	     InfoTooltip needed — otherwise an ancestor that later gains its own CSS transform (e.g.
	     the wizard rail's collapse animation) would become the containing block for *this*
	     wrapper's `fixed` positioning instead of the viewport, re-trapping it behind that
	     ancestor's clipping. -->
	<div
		use:portal
		class="pointer-events-none fixed inset-0 z-50"
		style={`clip-path: inset(${clipTop}px 0 0 0); transform: translateZ(0);`}
	>
		<ul
			role="listbox"
			aria-label={groupLabel}
			class="no-scrollbar pointer-events-auto fixed max-h-60 overflow-y-auto rounded-input border border-line bg-surface p-1 shadow-card-lg"
			style={panelStyle}
		>
			{#each options as opt, i (opt.value)}
				{@const selected = opt.value === value}
				<li>
					<button
						bind:this={optionEls[i]}
						type="button"
						role="option"
						aria-selected={selected}
						class={`flex w-full items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 text-left text-sm transition-colors ${
							selected
								? 'bg-accent-soft font-semibold text-accent-strong'
								: 'text-ink hover:bg-sunken'
						}`}
						onclick={() => choose(opt.value)}
						onkeydown={(e) => onOptionKeydown(e, i)}
					>
						<span class="truncate">{opt.label}</span>
						{#if selected}<Icon name="check" size={14} weight={2.5} class="shrink-0" />{/if}
					</button>
				</li>
			{/each}
			{#if allowOther}
				<li class="mt-1 border-t border-line pt-1">
					<button
						bind:this={otherButtonEl}
						type="button"
						role="option"
						aria-selected={hasOther}
						class="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-sm text-ink-3 hover:bg-sunken"
						onclick={startOther}
						onkeydown={(e) => onOptionKeydown(e, options.length)}
					>
						<Icon name="plus" size={14} weight={2.5} class="shrink-0" />
						Other…
					</button>
				</li>
			{/if}
		</ul>
	</div>
{/if}
