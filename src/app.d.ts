// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionAuthObject } from '@clerk/backend';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			auth: () => SessionAuthObject;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
