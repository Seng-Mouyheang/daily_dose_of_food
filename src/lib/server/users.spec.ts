import { describe, expect, it } from 'vitest';
import { candidateUsernames, mapClerkUser, type ClerkUserInput } from './users.ts';

function user(overrides: Partial<ClerkUserInput> = {}): ClerkUserInput {
	return {
		id: 'user_123',
		username: null,
		firstName: null,
		lastName: null,
		primaryEmail: 'mimi@example.com',
		imageUrl: 'https://img.clerk.com/mimi.png',
		hasImage: true,
		...overrides
	};
}

describe('mapClerkUser', () => {
	it('uses the Clerk username when present', () => {
		expect(mapClerkUser(user({ username: 'mimi_doe' })).displayName).toBe('mimi_doe');
	});

	it('falls back to the full name when there is no username', () => {
		expect(mapClerkUser(user({ firstName: 'Mimi', lastName: 'Doe' })).displayName).toBe('Mimi Doe');
	});

	it('falls back to the email local part as a last resort', () => {
		expect(mapClerkUser(user()).displayName).toBe('mimi');
	});

	it('omits the avatar url when Clerk has no image', () => {
		expect(mapClerkUser(user({ hasImage: false })).avatarUrl).toBeNull();
	});

	it('throws when there is no email address', () => {
		expect(() => mapClerkUser(user({ primaryEmail: undefined }))).toThrow(/no email/);
	});
});

describe('candidateUsernames', () => {
	it('slugifies the Clerk username as the first candidate', () => {
		expect(candidateUsernames(user({ username: 'Mimi Doe!' }))[0]).toBe('mimi-doe');
	});

	it('generates numbered fallbacks after the base candidate', () => {
		const [base, second, third] = candidateUsernames(user({ username: 'mimi' }));
		expect([base, second, third]).toEqual(['mimi', 'mimi2', 'mimi3']);
	});

	it('falls back to the email local part when there is no username or name', () => {
		expect(candidateUsernames(user())[0]).toBe('mimi');
	});
});
