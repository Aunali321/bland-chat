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
	ttft: number; // time to first visible token (ms)
	ttfrt: number | null; // time to first reasoning token (ms), null if no reasoning
	totalTime: number; // total generation time (ms)
	tokenCount: number; // visible output tokens
	reasoningTokenCount: number; // reasoning/thinking tokens
	promptTokens: number | null; // from API usage (null if unavailable)
	tps: number; // visible tokens per second
	totalTps: number; // all tokens per second (incl reasoning)
}

export interface Conversation {
	id: string;
	title: string;
	messages: Message[];
	createdAt: number;
	updatedAt: number;
}

export interface Settings {
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
	darkMode: boolean;
}

export interface ImageAttachment {
	dataUrl: string;
	name: string;
}
