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

/**
 * Stream a chat completion via the SvelteKit `/api/chat` server endpoint.
 *
 * Routing through the server endpoint avoids CORS restrictions when calling
 * third-party OpenAI-compatible APIs directly from the browser.
 *
 * @param signal - An `AbortSignal` to cancel the underlying HTTP request.
 */
export async function* streamChat(
	messages: Message[],
	settings: Settings,
	signal: AbortSignal
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
		stream_options: { include_usage: true }
	};

	if (settings.temperature !== null) payload.temperature = settings.temperature;
	if (settings.topP !== null) payload.top_p = settings.topP;
	if (settings.topK !== null) payload.top_k = settings.topK;
	if (settings.minP !== null) payload.min_p = settings.minP;
	if (settings.presencePenalty !== null) payload.presence_penalty = settings.presencePenalty;
	if (settings.repetitionPenalty !== null) payload.repetition_penalty = settings.repetitionPenalty;
	if (settings.maxTokens !== null && settings.maxTokens > 0) payload.max_tokens = settings.maxTokens;

	const response = await fetch('/api/chat', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			apiUrl: settings.apiUrl,
			apiKey: settings.apiKey,
			...payload
		}),
		signal
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

				// Reasoning/thinking content
				// sglang uses delta.reasoning_content, OpenRouter uses delta.reasoning
				const reasoningText = delta.reasoning_content || delta.reasoning;
				if (reasoningText) {
					yield { type: 'reasoning', text: reasoningText };
				}

				// Regular content (check for non-empty string, not just truthiness)
				if (typeof delta.content === 'string' && delta.content.length > 0) {
					yield { type: 'text', text: delta.content };
				}
			} catch {}
		}
	}
}
