import { streamChat } from '$lib/api';
import type { Message, Settings, ResponseMetrics } from '$lib/types';

interface StreamState {
	startTime: number;
	firstReasoningTokenTime: number | null;
	firstVisibleTokenTime: number | null;
	visibleTokenCount: number;
	reasoningTokenCount: number;
	apiUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
}

/** Compute live metrics from current stream state */
function computeMetrics(state: StreamState): ResponseMetrics {
	const now = performance.now();
	const totalTime = now - state.startTime;
	const ttft = state.firstVisibleTokenTime ? state.firstVisibleTokenTime - state.startTime : totalTime;
	const ttfrt = state.firstReasoningTokenTime ? state.firstReasoningTokenTime - state.startTime : null;
	const firstAny = state.firstReasoningTokenTime ?? state.firstVisibleTokenTime ?? now;
	const genElapsed = now - firstAny;
	const totalTokens = state.visibleTokenCount + state.reasoningTokenCount;
	const totalTps = genElapsed > 0 ? (totalTokens / genElapsed) * 1000 : 0;
	const visibleElapsed = state.firstVisibleTokenTime ? now - state.firstVisibleTokenTime : 0;
	const visTps = visibleElapsed > 0 ? (state.visibleTokenCount / visibleElapsed) * 1000 : 0;

	return {
		ttft: Math.round(ttft),
		ttfrt: ttfrt !== null ? Math.round(ttfrt) : null,
		totalTime: Math.round(totalTime),
		tokenCount: state.visibleTokenCount,
		reasoningTokenCount: state.reasoningTokenCount,
		promptTokens: state.apiUsage?.prompt_tokens ?? null,
		tps: Math.round(visTps * 10) / 10,
		totalTps: Math.round(totalTps * 10) / 10
	};
}

/** Finalize metrics using API usage data when available */
function finalizeMetrics(state: StreamState, existing: ResponseMetrics): ResponseMetrics {
	const totalTime = performance.now() - state.startTime;

	if (!state.apiUsage) {
		return { ...existing, totalTime: Math.round(totalTime) };
	}

	const firstAny = state.firstReasoningTokenTime ?? state.firstVisibleTokenTime ?? performance.now();
	const genElapsed = performance.now() - firstAny;
	const apiCompletionTokens = state.apiUsage.completion_tokens;
	const totalTps = genElapsed > 0 ? (apiCompletionTokens / genElapsed) * 1000 : 0;
	const visibleElapsed = state.firstVisibleTokenTime ? performance.now() - state.firstVisibleTokenTime : 0;
	const apiVisibleTokens = apiCompletionTokens - state.reasoningTokenCount;
	const visTps = visibleElapsed > 0 ? (Math.max(0, apiVisibleTokens) / visibleElapsed) * 1000 : 0;

	return {
		...existing,
		totalTime: Math.round(totalTime),
		tokenCount: Math.max(0, apiVisibleTokens > 0 ? apiVisibleTokens : state.visibleTokenCount),
		reasoningTokenCount: state.reasoningTokenCount > 0
			? state.reasoningTokenCount
			: apiCompletionTokens - state.visibleTokenCount,
		promptTokens: state.apiUsage.prompt_tokens,
		tps: Math.round(visTps * 10) / 10,
		totalTps: Math.round(totalTps * 10) / 10
	};
}

export interface StreamCallbacks {
	/** Called whenever the assistant message is updated (content, reasoning, or metrics changed) */
	onUpdate: () => void;
	/** Called after each token to allow UI scrolling */
	onToken: () => Promise<void>;
}

/**
 * Run the streaming chat loop, updating the assistant message in-place.
 * Returns the final assistant message (or null if aborted/errored with no content).
 */
export async function runStreamingChat(
	messagesToSend: Message[],
	assistantMsg: Message,
	settings: Settings,
	signal: AbortSignal,
	callbacks: StreamCallbacks
): Promise<Message | null> {
	const state: StreamState = {
		startTime: performance.now(),
		firstReasoningTokenTime: null,
		firstVisibleTokenTime: null,
		visibleTokenCount: 0,
		reasoningTokenCount: 0,
		apiUsage: null
	};

	const stream = streamChat(messagesToSend, settings);

	for await (const event of stream) {
		if (signal.aborted) break;

		if (event.type === 'usage' && event.usage) {
			state.apiUsage = event.usage;
			continue;
		}

		if (event.type === 'reasoning' && event.text) {
			if (state.firstReasoningTokenTime === null) state.firstReasoningTokenTime = performance.now();
			state.reasoningTokenCount++;
			assistantMsg.reasoning = (assistantMsg.reasoning || '') + event.text;
		}

		if (event.type === 'text' && event.text) {
			if (state.firstVisibleTokenTime === null) state.firstVisibleTokenTime = performance.now();
			state.visibleTokenCount++;
			assistantMsg.content = (assistantMsg.content as string) + event.text;
		}

		assistantMsg.metrics = computeMetrics(state);
		callbacks.onUpdate();
		await callbacks.onToken();
	}

	if (assistantMsg.metrics) {
		assistantMsg.metrics = finalizeMetrics(state, assistantMsg.metrics);
	}
	if (!assistantMsg.reasoning) delete assistantMsg.reasoning;
	callbacks.onUpdate();

	return assistantMsg.content ? assistantMsg : null;
}
