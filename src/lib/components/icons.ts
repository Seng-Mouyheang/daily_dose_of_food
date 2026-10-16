/** Inline stroke-icon path data, ported from the write-a-review prototype's `P` map
 *  (~/Downloads/write-a-review-prototype.html). Kept as plain path strings rather than one
 *  .svelte file per icon — these are rendered through Icon.svelte's {@html}, which is safe
 *  here because every entry is a fixed, developer-authored constant, never user input. */
export const ICONS = {
	/** Brand mark: concentric rings, rendered on-accent in the header logo tile. */
	logo: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3"/>',
	chevL: '<path d="M15 18l-6-6 6-6"/>',
	chevR: '<path d="M9 18l6-6-6-6"/>',
	chevD: '<path d="M6 9l6 6 6-6"/>',
	check: '<path d="M20 6L9 17l-5-5"/>',
	x: '<path d="M18 6L6 18M6 6l12 12"/>',
	plus: '<path d="M12 5v14M5 12h14"/>',
	minus: '<path d="M6 12h12"/>',
	heart: '<path d="M19.5 12.6L12 20l-7.5-7.4A4.8 4.8 0 1 1 12 6.3a4.8 4.8 0 1 1 7.5 6.3z"/>',
	pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
	calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
	search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
	dine: '<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 21V3c-2 1-3.5 3.5-3.5 7 0 1.7 1.2 3 3.5 3"/>',
	bag: '<path d="M5 8h14l-1 13H6L5 8zM9 8V6a3 3 0 0 1 6 0v2"/>',
	bike: '<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M5.5 17l4-8h5l4 8M9.5 9H7M14.5 9l-1-3h-2"/>',
	cup: '<path d="M6 8h12l-1.4 12.2A2 2 0 0 1 14.6 22H9.4a2 2 0 0 1-2-1.8L6 8zM5 5h14v3H5zM12 2v3"/>',
	plate: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>',
	coffee:
		'<path d="M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6V8zM17 9h1.5a2.5 2.5 0 0 1 0 5H17M8 2.5v3M12 2.5v3"/>',
	both: '<circle cx="9" cy="13" r="6"/><circle cx="9" cy="13" r="2.5"/><path d="M16 6h5l-.8 12.5a1.5 1.5 0 0 1-1.5 1.5H17"/>',
	tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
	bell: '<path d="M4 18h16M6 18a6 6 0 0 1 12 0M12 12V9.5M10 9.5h4"/>',
	sparkle:
		'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z"/>',
	wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><circle cx="12" cy="19.5" r=".8"/>',
	camera:
		'<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
	globe:
		'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
	users:
		'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
	lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
	pencil: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
	bellN: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
	cloud:
		'<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5H7z"/><path d="M9.5 13.5l2 2 3.5-3.5"/>',
	info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.8" r=".2" fill="currentColor" stroke-width="2.4"/>',
	comment: '<path d="M20.5 12a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1-4.3A8.5 8.5 0 1 1 20.5 12z"/>',
	bookmark: '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',
	share:
		'<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 13.2l7.6 4.6M15.8 6.2l-7.6 4.6"/>',
	/** Three dots. Filled with the stroke switched off, rather than stroked — at r=1.3 a stroked
	 *  ring at Icon.svelte's default 1.8 weight fills in as a smudge. */
	more: '<circle cx="5" cy="12" r="1.3" fill="currentColor" stroke-width="0"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke-width="0"/><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke-width="0"/>',
	/** Navigation arrow — the "Directions" action on a place. */
	nav: '<path d="M3 11l18-8-8 18-2-8z"/>',
	home: '<path d="M3.5 10.5L12 4l8.5 6.5V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
	compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
	user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
	image:
		'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="15.5" cy="8.5" r="1.5"/><path d="M3.5 17l5-5 4.5 4.5 3-3 4.5 4.5"/>',
	pushpin:
		'<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
	/** The journal: an open notebook with a ribbon line. */
	book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H19v-3"/><path d="M8 7h7"/>',
	archive:
		'<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>',
	restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
	sort: '<path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3"/>',
	trash:
		'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
	send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
	link: '<path d="M9 15l6-6"/><path d="M11 6.5l1-1a4 4 0 0 1 5.5 5.5l-1.5 1.5"/><path d="M13 17.5l-1 1a4 4 0 0 1-5.5-5.5l1.5-1.5"/>',
	/** The dashboard: three bars on a baseline. */
	chart: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>',
	/** Change chips: up, down, unchanged. */
	trendUp: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
	trendDown: '<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
	flat: '<path d="M4 12h16"/>',
	/** A simplified "f" wordmark, for the Facebook share link. */
	facebook:
		'<path d="M10 21v-9H7v-3h3V7.5A4 4 0 0 1 14 3.5h2v3h-1.5A1.5 1.5 0 0 0 13 8v1h3l-.5 3H13v9"/>',
	/** A speech bubble with a call-wave inside — evokes WhatsApp's chat-plus-call mark for its
	 *  share link, without reproducing the logo itself. */
	whatsapp:
		'<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z"/><path d="M9 9.7c0-.5.4-1 .9-1h.5c.3 0 .6.2.7.5l.5 1.3c.1.3.1.6-.1.8l-.5.5c.4.9 1.1 1.6 2 2l.5-.5c.2-.2.5-.2.8-.1l1.3.5c.3.1.5.4.5.7v.5c0 .5-.5.9-1 .9-3.3 0-6-2.7-6-6z"/>'
} as const;

export type IconName = keyof typeof ICONS;
