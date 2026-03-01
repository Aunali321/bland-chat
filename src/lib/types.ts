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
	temperature: number | null;
	maxTokens: number | null;
	topP: number | null;
	topK: number | null;
	minP: number | null;
	presencePenalty: number | null;
	repetitionPenalty: number | null;
}

export const defaultApiSettings: ApiSettings = {
	apiUrl: '',
	apiKey: '',
	model: '',
	systemPrompt: 'You are a helpful assistant.',
	temperature: null,
	maxTokens: null,
	topP: null,
	topK: null,
	minP: null,
	presencePenalty: null,
	repetitionPenalty: null
};

/** Hyperparam field names for iteration */
export const hyperparamKeys = [
	'temperature',
	'maxTokens',
	'topP',
	'topK',
	'minP',
	'presencePenalty',
	'repetitionPenalty'
] as const satisfies readonly (keyof ApiSettings)[];

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
