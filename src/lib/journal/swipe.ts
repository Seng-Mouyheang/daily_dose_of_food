/**
 * Swipe-left-to-reveal for a journal row on a phone, as a Svelte action on the sliding element.
 *
 * Follows the finger while dragging, then reports whether the row should end open or closed;
 * the caller owns that state and expresses it as a class. A drag that turns out to be mostly
 * vertical is let go at once so the list still scrolls, and the click that ends a real drag is
 * swallowed so it doesn't also open the review. Does nothing from `lg` up, where rows carry no
 * swipe action.
 */
export interface SwipeOptions {
	open: boolean;
	/** How far the action button reaches, in px. */
	width: number;
	onchange: (open: boolean) => void;
}

const SLOP = 6;
const MAX_OVERSHOOT = 28;

export function swipeReveal(node: HTMLElement, initial: SwipeOptions) {
	let opts = initial;
	let start: { x: number; y: number; open: boolean } | null = null;
	let moved = false;
	let dx = 0;

	function down(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		if (window.matchMedia('(min-width: 1024px)').matches) return;
		if ((e.target as HTMLElement).closest('[data-no-swipe]')) return;
		start = { x: e.clientX, y: e.clientY, open: opts.open };
		moved = false;
		dx = 0;
	}

	function move(e: PointerEvent) {
		if (!start) return;
		const ddx = e.clientX - start.x;
		const ddy = e.clientY - start.y;
		if (!moved) {
			if (Math.abs(ddx) < SLOP) return;
			if (Math.abs(ddy) > Math.abs(ddx)) {
				start = null;
				return;
			}
			moved = true;
			node.setPointerCapture(e.pointerId);
		}
		dx = ddx;
		const base = start.open ? -opts.width : 0;
		const x = Math.max(-opts.width - MAX_OVERSHOOT, Math.min(0, base + dx));
		node.style.transition = 'none';
		node.style.transform = `translateX(${x}px)`;
	}

	function up() {
		if (!start) return;
		const wasOpen = start.open;
		start = null;
		node.style.transition = '';
		// A tap leaves the row where it is. After a drag, snap to the resulting state here: the
		// caller only rewrites the transform when `open` changes, so clearing it would leave a
		// row that stays open drawn closed.
		if (!moved) return;
		const open = (wasOpen ? -opts.width : 0) + dx < -opts.width / 2;
		node.style.transform = open ? `translateX(-${opts.width}px)` : '';
		opts.onchange(open);
	}

	function click(e: MouseEvent) {
		if (!moved) return;
		moved = false;
		e.preventDefault();
		e.stopPropagation();
	}

	node.addEventListener('pointerdown', down);
	node.addEventListener('pointermove', move);
	node.addEventListener('pointerup', up);
	node.addEventListener('pointercancel', up);
	node.addEventListener('click', click, true);

	return {
		update(next: SwipeOptions) {
			opts = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', up);
			node.removeEventListener('pointercancel', up);
			node.removeEventListener('click', click, true);
		}
	};
}
