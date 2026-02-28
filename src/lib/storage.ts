import { browser } from '$app/environment';
import type { UiPreferences } from './types';

const UI_PREFS_KEY = 'bland-chat-ui-prefs';

export const defaultUiPreferences: UiPreferences = {
	darkMode: false
};

export function loadUiPreferences(): UiPreferences {
	if (!browser) return { ...defaultUiPreferences };
	try {
		const raw = localStorage.getItem(UI_PREFS_KEY);
		if (raw) return { ...defaultUiPreferences, ...JSON.parse(raw) };
	} catch {}
	return { ...defaultUiPreferences };
}

export function saveUiPreferences(prefs: UiPreferences): void {
	if (!browser) return;
	localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
}

export function generateTitle(firstMessage: string): string {
	const cleaned = firstMessage.replace(/\n/g, ' ').trim();
	if (cleaned.length <= 40) return cleaned;
	return cleaned.substring(0, 40) + '…';
}
