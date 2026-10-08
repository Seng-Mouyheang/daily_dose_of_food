/** Moves a node to `<body>`, clear of every ancestor — including one that gains a CSS
 *  transform, which would otherwise become the containing block for any `position: fixed`
 *  descendant (per spec) and re-trap it behind that ancestor's own clipping/overflow, exactly
 *  like `absolute` would be. Used by any floating panel (Select's listbox, InfoTooltip's
 *  popover) that needs to escape a scrolling/clipping ancestor for good, regardless of what
 *  transforms that ancestor gains later (e.g. the wizard rail's collapse animation). */
export function portal(node: HTMLElement) {
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		}
	};
}
