<script lang="ts">
	import type { Message } from '$lib/types';
	import { renderMarkdown } from '$lib/markdown';

	interface Props {
		message: Message;
		index: number;
		onDelete: (index: number) => void;
	}

	let { message, index, onDelete }: Props = $props();

	function getMessageText(msg: Message): string {
		if (typeof msg.content === 'string') return msg.content;
		return msg.content
			.filter((c) => c.type === 'text')
			.map((c) => c.text)
			.join('\n');
	}

	function getMessageImages(msg: Message): string[] {
		if (typeof msg.content === 'string') return [];
		return msg.content
			.filter((c) => c.type === 'image_url')
			.map((c) => c.image_url!.url);
	}
</script>

<div class="flex gap-3 {message.role === 'user' ? 'justify-end' : 'justify-start'}">
	<div
		class="group relative max-w-[85%] {message.role === 'user'
			? 'bg-(--color-user-bubble) text-(--color-user-text) rounded-2xl rounded-br-sm px-4 py-2.5'
			: 'bg-(--color-assistant-bubble) text-(--color-assistant-text) rounded-2xl rounded-bl-sm px-4 py-2.5 border border-(--color-border)'}"
	>
		<button
			onclick={() => onDelete(index)}
			class="absolute -top-2 -right-2 p-0.5 rounded-full bg-(--color-bg-tertiary) border border-(--color-border) opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-(--color-text-muted) hover:text-(--color-danger)"
			title="Delete message"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M18 6 6 18M6 6l12 12" />
			</svg>
		</button>

		{#each getMessageImages(message) as imgUrl}
			<img src={imgUrl} alt="Attached" class="max-w-xs rounded-lg mb-2 border border-white/10" />
		{/each}

		{#if message.role === 'assistant'}
			{#if message.reasoning}
				<details class="mb-2">
					<summary class="text-[11px] text-(--color-text-muted) cursor-pointer select-none hover:text-(--color-text-secondary) transition-colors">
						thinking{#if message.metrics}&nbsp;&middot;&nbsp;{message.metrics.reasoningTokenCount} tok{/if}
					</summary>
					<div class="mt-1 pl-3 border-l-2 border-(--color-border)/50 text-xs text-(--color-text-muted) prose max-h-60 overflow-y-auto">
						{@html renderMarkdown(message.reasoning)}
					</div>
				</details>
			{/if}
			<div class="prose text-sm">
				{@html renderMarkdown(getMessageText(message))}
			</div>
			{#if message.metrics}
				<div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 pt-2 border-t border-(--color-border)/50 text-[10px] font-mono text-(--color-text-muted)">
					{#if message.metrics.ttfrt !== null}
						<span title="Time to first reasoning token">{message.metrics.ttfrt}ms ttfrt</span>
					{/if}
					<span title="Time to first visible token">{message.metrics.ttft}ms ttft</span>
					<span title="Total tokens per second (including reasoning)">{message.metrics.totalTps} t/s</span>
					{#if message.metrics.reasoningTokenCount > 0}
						<span title="Reasoning tokens">{message.metrics.reasoningTokenCount} think</span>
					{/if}
					<span title="Output tokens">{message.metrics.tokenCount} out</span>
					{#if message.metrics.promptTokens !== null}
						<span title="Prompt tokens">{message.metrics.promptTokens} in</span>
					{/if}
					<span title="Total generation time">{(message.metrics.totalTime / 1000).toFixed(1)}s</span>
				</div>
			{/if}
		{:else}
			<div class="text-sm whitespace-pre-wrap">{getMessageText(message)}</div>
		{/if}
	</div>
</div>
