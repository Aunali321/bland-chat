import { browser } from '$app/environment';
import type { Conversation, Settings } from './types';

const CONVERSATIONS_KEY = 'bland-chat-conversations';
const SETTINGS_KEY = 'bland-chat-settings';

export const defaultSettings: Settings = {
	apiUrl: '',
	apiKey: '',
	model: '',
	systemPrompt: 'You are a helpful assistant.',
	temperature: 1.0,
	maxTokens: 4096,
	topP: 0.95,
	topK: 20,
	minP: 0.0,
	presencePenalty: 1.5,
	repetitionPenalty: 1.0,
	darkMode: false
};

export function loadSettings(): Settings {
	if (!browser) return { ...defaultSettings };
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		if (raw) {
			const saved = JSON.parse(raw);
			return { ...defaultSettings, ...saved };
		}
	} catch {}
	return { ...defaultSettings };
}

export function saveSettings(settings: Settings): void {
	if (!browser) return;
	localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadConversations(): Conversation[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(CONVERSATIONS_KEY);
		if (raw) return JSON.parse(raw);
	} catch {}
	return [];
}

export function saveConversations(conversations: Conversation[]): void {
	if (!browser) return;
	localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export function createConversation(): Conversation {
	return {
		id: crypto.randomUUID(),
		title: 'New chat',
		messages: [],
		createdAt: Date.now(),
		updatedAt: Date.now()
	};
}

export function generateTitle(firstMessage: string): string {
	const cleaned = firstMessage.replace(/\n/g, ' ').trim();
	if (cleaned.length <= 40) return cleaned;
	return cleaned.substring(0, 40) + '…';
}
