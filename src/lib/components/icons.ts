/** Inline stroke-icon path data, ported from the write-a-review prototype's `P` map
 *  (~/Downloads/write-a-review-prototype.html). Kept as plain path strings rather than one
 *  .svelte file per icon — these are rendered through Icon.svelte's {@html}, which is safe
 *  here because every entry is a fixed, developer-authored constant, never user input. */
export const ICONS = {
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
		'<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5H7z"/><path d="M9.5 13.5l2 2 3.5-3.5"/>'
} as const;

export type IconName = keyof typeof ICONS;
