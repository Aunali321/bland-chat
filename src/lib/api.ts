import type { Message, Settings } from './types';

export interface StreamEvent {
	type: 'text' | 'reasoning' | 'usage';
	text?: string;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

export async function* streamChat(
	messages: Message[],
	settings: Settings
): AsyncGenerator<StreamEvent, void, undefined> {
	const apiMessages = [...messages];

	if (settings.systemPrompt.trim()) {
		apiMessages.unshift({
			role: 'system',
			content: settings.systemPrompt.trim()
		});
	}

	const payload: Record<string, unknown> = {
		model: settings.model,
		messages: apiMessages,
		stream: true,
		stream_options: { include_usage: true },
		temperature: settings.temperature,
		top_p: settings.topP,
		top_k: settings.topK,
		min_p: settings.minP,
		presence_penalty: settings.presencePenalty,
		repetition_penalty: settings.repetitionPenalty
	};

	if (settings.maxTokens > 0) {
		payload.max_tokens = settings.maxTokens;
	}

	// Route through SvelteKit server endpoint to avoid CORS
	const response = await fetch('/api/chat', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			apiUrl: settings.apiUrl,
			apiKey: settings.apiKey,
			...payload
		})
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`API error ${response.status}: ${errorText}`);
	}

	const reader = response.body?.getReader();
	if (!reader) throw new Error('No response body');

	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || !trimmed.startsWith('data: ')) continue;

			const data = trimmed.slice(6);
			if (data === '[DONE]') return;

			try {
				const parsed = JSON.parse(data);

				// Check for usage data (final chunk with empty choices)
				if (parsed.usage) {
					yield {
						type: 'usage',
						usage: {
							prompt_tokens: parsed.usage.prompt_tokens ?? 0,
							completion_tokens: parsed.usage.completion_tokens ?? 0,
							total_tokens: parsed.usage.total_tokens ?? 0
						}
					};
				}

				const delta = parsed.choices?.[0]?.delta;
				if (!delta) continue;

				// Reasoning/thinking content (e.g. Qwen3, DeepSeek)
				if (delta.reasoning_content) {
					yield { type: 'reasoning', text: delta.reasoning_content };
				}

				// Regular content
				if (delta.content) {
					yield { type: 'text', text: delta.content };
				}
			} catch {
				// skip malformed chunks
			}
		}
	}
}
