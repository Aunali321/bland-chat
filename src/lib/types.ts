export interface Message {
	role: 'system' | 'user' | 'assistant';
	content: string | MessageContent[];
	reasoning?: string;
	metrics?: ResponseMetrics;
}

export interface MessageContent {
	type: 'text' | 'image_url';
	text?: string;
	image_url?: {
		url: string;
		detail?: 'auto' | 'low' | 'high';
	};
}

export interface ResponseMetrics {
	ttft: number;
	ttfrt: number | null;
	totalTime: number;
	tokenCount: number;
	reasoningTokenCount: number;
	promptTokens: number | null;
	tps: number;
	totalTps: number;
}

export interface Conversation {
	id: string;
	title: string;
	messages: Message[];
	createdAt: number;
	updatedAt: number;
}

/** Server-persisted API/model settings */
export interface ApiSettings {
	apiUrl: string;
	apiKey: string;
	model: string;
	systemPrompt: string;
	temperature: number;
	maxTokens: number;
	topP: number;
	topK: number;
	minP: number;
	presencePenalty: number;
	repetitionPenalty: number;
}

export const defaultApiSettings: ApiSettings = {
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
	repetitionPenalty: 1.0
};

/** Client-only UI preferences stored in localStorage */
export interface UiPreferences {
	darkMode: boolean;
}

/** Combined settings used in the UI */
export type Settings = ApiSettings & UiPreferences;

export interface ImageAttachment {
	dataUrl: string;
	name: string;
}
