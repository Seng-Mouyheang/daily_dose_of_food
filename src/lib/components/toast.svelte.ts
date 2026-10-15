/**
 * One app-wide message at a time ("Review archived · Undo"), shown by Toast.svelte, which the
 * root layout mounts once — so a message raised just before a navigation (delete on the review
 * page, then off to the journal) is still on screen after it.
 *
 * A new message replaces the current one, and its Undo with it: undo is only ever offered for
 * the most recent action, which is the one the person is looking at.
 */
export interface ToastMessage {
	id: number;
	text: string;
	/** When present, the message carries an Undo button that runs this and then dismisses. */
	undo?: () => void | Promise<void>;
}

const DURATION_MS = 5000;

let current = $state<ToastMessage | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;
let nextId = 1;

export const toast = {
	get current() {
		return current;
	},
	show(text: string, undo?: ToastMessage['undo']) {
		clearTimeout(timer);
		current = { id: nextId++, text, undo };
		timer = setTimeout(() => toast.dismiss(), DURATION_MS);
	},
	dismiss() {
		clearTimeout(timer);
		current = null;
	},
	async runUndo() {
		const undo = current?.undo;
		toast.dismiss();
		await undo?.();
	}
};
