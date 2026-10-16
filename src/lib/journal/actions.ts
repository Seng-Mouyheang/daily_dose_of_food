/**
 * The four journal actions as data: which request does it, which request undoes it, what the
 * message says, and how the row's swipe button looks. Shared by the journal page and the review
 * page (which can delete too), so "Undo" means the same request wherever it's offered.
 */
import type { IconName } from '#lib/components/icons.ts';

export type JournalActionKind = 'archive' | 'restore' | 'unsave' | 'delete';

interface Request {
	method: 'PUT' | 'DELETE' | 'POST';
	path: (id: string) => string;
}

interface ActionSpec {
	label: string;
	icon: IconName;
	tone: 'neutral' | 'bad' | 'good';
	done: string;
	failed: string;
	run: Request;
	undo: Request;
}

const archive = (id: string) => `/api/reviews/${id}/archive`;
const save = (id: string) => `/api/reviews/${id}/save`;

export const JOURNAL_ACTIONS: Record<JournalActionKind, ActionSpec> = {
	archive: {
		label: 'Archive',
		icon: 'archive',
		tone: 'neutral',
		done: 'Review archived',
		failed: "Couldn't archive that review. Try again.",
		run: { method: 'PUT', path: archive },
		undo: { method: 'DELETE', path: archive }
	},
	restore: {
		label: 'Restore',
		icon: 'restore',
		tone: 'good',
		done: 'Review restored',
		failed: "Couldn't restore that review. Try again.",
		run: { method: 'DELETE', path: archive },
		undo: { method: 'PUT', path: archive }
	},
	unsave: {
		label: 'Remove',
		icon: 'bookmark',
		tone: 'bad',
		done: 'Removed from bookmarks',
		failed: "Couldn't remove that bookmark. Try again.",
		run: { method: 'DELETE', path: save },
		undo: { method: 'PUT', path: save }
	},
	delete: {
		label: 'Delete',
		icon: 'trash',
		tone: 'bad',
		done: 'Review deleted',
		failed: "Couldn't delete that review. Try again.",
		run: { method: 'DELETE', path: (id) => `/api/reviews/${id}` },
		undo: { method: 'POST', path: (id) => `/api/reviews/${id}/restore` }
	}
};

async function send(req: Request, id: string): Promise<boolean> {
	try {
		return (await fetch(req.path(id), { method: req.method })).ok;
	} catch {
		return false;
	}
}

export const runJournalAction = (kind: JournalActionKind, id: string) =>
	send(JOURNAL_ACTIONS[kind].run, id);

export const undoJournalAction = (kind: JournalActionKind, id: string) =>
	send(JOURNAL_ACTIONS[kind].undo, id);
