<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		loadSettings,
		saveSettings,
		loadConversations,
		saveConversations,
		createConversation,
		generateTitle,
		defaultSettings
	} from '$lib/storage';
	import { streamChat } from '$lib/api';
	import { renderMarkdown } from '$lib/markdown';
	import type { Conversation, Message, Settings, ImageAttachment } from '$lib/types';

	let settings = $state<Settings>({ ...defaultSettings });
	let conversations = $state<Conversation[]>([]);
	let activeId = $state<string | null>(null);
	let input = $state('');
	let isStreaming = $state(false);
	let showSettings = $state(false);
	let showSidebar = $state(true);
	let error = $state<string | null>(null);
	let images = $state<ImageAttachment[]>([]);
	let abortController = $state<AbortController | null>(null);
	let editingTitle = $state<string | null>(null);
	let editTitleValue = $state('');

	let messagesEnd: HTMLDivElement;
	let textareaEl: HTMLTextAreaElement;
	let fileInputEl: HTMLInputElement;

	const activeConversation = $derived(conversations.find((c) => c.id === activeId) ?? null);
	const sortedConversations = $derived(
		[...conversations].sort((a, b) => b.updatedAt - a.updatedAt)
	);

	onMount(() => {
		// Load env defaults first, then override with saved settings
		settings = loadSettings();

		// Apply env defaults if settings are empty
		if (!settings.apiUrl) settings.apiUrl = import.meta.env.VITE_API_URL ?? '';
		if (!settings.apiKey) settings.apiKey = import.meta.env.VITE_API_KEY ?? '';
		if (!settings.model) settings.model = import.meta.env.VITE_MODEL ?? '';

		conversations = loadConversations();

		if (settings.darkMode) {
			document.documentElement.classList.add('dark');
		}

		// If no conversations, create one
		if (conversations.length === 0) {
			newConversation();
		} else {
			activeId = sortedConversations[0]?.id ?? null;
		}
	});

	function persist() {
		saveSettings(settings);
		saveConversations(conversations);
	}

	function newConversation() {
		const conv = createConversation();
		conversations = [...conversations, conv];
		activeId = conv.id;
		input = '';
		images = [];
		error = null;
		persist();
	}

	function selectConversation(id: string) {
		activeId = id;
		error = null;
		images = [];
	}

	function deleteConversation(id: string) {
		conversations = conversations.filter((c) => c.id !== id);
		if (activeId === id) {
			activeId = sortedConversations[0]?.id ?? null;
			if (!activeId) newConversation();
		}
		persist();
	}

	function startEditTitle(id: string, currentTitle: string) {
		editingTitle = id;
		editTitleValue = currentTitle;
	}

	function finishEditTitle() {
		if (editingTitle) {
			const conv = conversations.find((c) => c.id === editingTitle);
			if (conv && editTitleValue.trim()) {
				conv.title = editTitleValue.trim();
				conversations = [...conversations];
				persist();
			}
		}
		editingTitle = null;
	}

	function toggleDarkMode() {
		settings.darkMode = !settings.darkMode;
		document.documentElement.classList.toggle('dark', settings.darkMode);
		persist();
	}

	async function scrollToBottom() {
		await tick();
		messagesEnd?.scrollIntoView({ behavior: 'smooth' });
	}

	function autoResize() {
		if (!textareaEl) return;
		textareaEl.style.height = 'auto';
		textareaEl.style.height = Math.min(textareaEl.scrollHeight, 200) + 'px';
	}

	function handleImageUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		const files = target.files;
		if (!files) return;
		for (const file of files) {
			readImageFile(file);
		}
		target.value = '';
	}

	function readImageFile(file: File) {
		if (!file.type.startsWith('image/')) return;
		const reader = new FileReader();
		reader.onload = () => {
			images = [...images, { dataUrl: reader.result as string, name: file.name }];
		};
		reader.readAsDataURL(file);
	}

	function removeImage(index: number) {
		images = images.filter((_, i) => i !== index);
	}

	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const file = item.getAsFile();
				if (file) readImageFile(file);
			}
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		const files = e.dataTransfer?.files;
		if (!files) return;
		for (const file of files) {
			readImageFile(file);
		}
	}

	function stopStreaming() {
		abortController?.abort();
		abortController = null;
		isStreaming = false;
	}

	async function sendMessage() {
		if ((!input.trim() && images.length === 0) || !activeConversation || isStreaming) return;

		if (!settings.apiUrl || !settings.model) {
			error = 'Set the API URL and model in settings first.';
			showSettings = true;
			return;
		}

		error = null;

		// Build user message
		let userMessage: Message;

		if (images.length > 0) {
			const content: Message['content'] = [];
			if (input.trim()) {
				content.push({ type: 'text', text: input.trim() });
			}
			for (const img of images) {
				content.push({
					type: 'image_url',
					image_url: { url: img.dataUrl, detail: 'auto' }
				});
			}
			userMessage = { role: 'user', content };
		} else {
			userMessage = { role: 'user', content: input.trim() };
		}

		activeConversation.messages = [...activeConversation.messages, userMessage];

		// Update title from first message
		if (activeConversation.messages.filter((m) => m.role === 'user').length === 1) {
			const textContent =
				typeof userMessage.content === 'string'
					? userMessage.content
					: userMessage.content.find((c) => c.type === 'text')?.text || 'Image chat';
			activeConversation.title = generateTitle(textContent);
		}

		activeConversation.updatedAt = Date.now();
		conversations = [...conversations];

		const sentInput = input;
		const sentImages = [...images];
		input = '';
		images = [];
		if (textareaEl) {
			textareaEl.style.height = 'auto';
		}

		await scrollToBottom();

		// Add empty assistant message
		const assistantMsg: Message = { role: 'assistant', content: '', reasoning: '' };
		activeConversation.messages = [...activeConversation.messages, assistantMsg];
		conversations = [...conversations];

		isStreaming = true;
		const controller = new AbortController();
		abortController = controller;

		// Metrics tracking
		const startTime = performance.now();
		let firstReasoningTokenTime: number | null = null;
		let firstVisibleTokenTime: number | null = null;
		let visibleTokenCount = 0;
		let reasoningTokenCount = 0;
		let apiUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null = null;

		try {
			const messagesToSend = activeConversation.messages.slice(0, -1); // exclude empty assistant
			const stream = streamChat(messagesToSend, settings);

			for await (const event of stream) {
				if (controller.signal.aborted) break;

				if (event.type === 'usage' && event.usage) {
					apiUsage = event.usage;
					continue;
				}

				const lastMsg =
					activeConversation.messages[activeConversation.messages.length - 1];
				if (lastMsg.role !== 'assistant') continue;

				if (event.type === 'reasoning' && event.text) {
					if (firstReasoningTokenTime === null) {
						firstReasoningTokenTime = performance.now();
					}
					reasoningTokenCount++;
					lastMsg.reasoning = (lastMsg.reasoning || '') + event.text;
				}

				if (event.type === 'text' && event.text) {
					if (firstVisibleTokenTime === null) {
						firstVisibleTokenTime = performance.now();
					}
					visibleTokenCount++;
					lastMsg.content = (lastMsg.content as string) + event.text;
				}

				// Update live metrics
				const now = performance.now();
				const totalTime = now - startTime;
				const ttft = firstVisibleTokenTime ? firstVisibleTokenTime - startTime : totalTime;
				const ttfrt = firstReasoningTokenTime ? firstReasoningTokenTime - startTime : null;

				// Calculate TPS based on generation time after first token arrived
				const firstAny = firstReasoningTokenTime ?? firstVisibleTokenTime ?? now;
				const genElapsed = now - firstAny;
				const totalTokens = visibleTokenCount + reasoningTokenCount;
				const totalTps = genElapsed > 0 ? (totalTokens / genElapsed) * 1000 : 0;

				// Visible-only TPS (from first visible token)
				const visibleElapsed = firstVisibleTokenTime ? now - firstVisibleTokenTime : 0;
				const visTps = visibleElapsed > 0 ? (visibleTokenCount / visibleElapsed) * 1000 : 0;

				lastMsg.metrics = {
					ttft: Math.round(ttft),
					ttfrt: ttfrt !== null ? Math.round(ttfrt) : null,
					totalTime: Math.round(totalTime),
					tokenCount: visibleTokenCount,
					reasoningTokenCount: reasoningTokenCount,
					promptTokens: apiUsage?.prompt_tokens ?? null,
					tps: Math.round(visTps * 10) / 10,
					totalTps: Math.round(totalTps * 10) / 10
				};

				activeConversation.messages = [...activeConversation.messages];
				conversations = [...conversations];
				await scrollToBottom();
			}

			// Final metrics update with API usage if available
			const lastMsg =
				activeConversation.messages[activeConversation.messages.length - 1];
			if (lastMsg.role === 'assistant' && lastMsg.metrics) {
				const totalTime = performance.now() - startTime;
				const firstAny = firstReasoningTokenTime ?? firstVisibleTokenTime ?? performance.now();
				const genElapsed = performance.now() - firstAny;

				if (apiUsage) {
					const apiCompletionTokens = apiUsage.completion_tokens;
					const totalTps = genElapsed > 0 ? (apiCompletionTokens / genElapsed) * 1000 : 0;

					// Visible-only TPS
					const visibleElapsed = firstVisibleTokenTime ? performance.now() - firstVisibleTokenTime : 0;
					const apiVisibleTokens = apiCompletionTokens - reasoningTokenCount;
					const visTps = visibleElapsed > 0 ? (Math.max(0, apiVisibleTokens) / visibleElapsed) * 1000 : 0;

					lastMsg.metrics = {
						...lastMsg.metrics,
						totalTime: Math.round(totalTime),
						tokenCount: Math.max(0, apiVisibleTokens > 0 ? apiVisibleTokens : visibleTokenCount),
						reasoningTokenCount: reasoningTokenCount > 0 ? reasoningTokenCount : (apiCompletionTokens - visibleTokenCount),
						promptTokens: apiUsage.prompt_tokens,
						tps: Math.round(visTps * 10) / 10,
						totalTps: Math.round(totalTps * 10) / 10
					};
				} else {
					lastMsg.metrics = {
						...lastMsg.metrics,
						totalTime: Math.round(totalTime)
					};
				}

				// Clean up empty reasoning
				if (!lastMsg.reasoning) {
					delete lastMsg.reasoning;
				}

				activeConversation.messages = [...activeConversation.messages];
				conversations = [...conversations];
			}
		} catch (err: any) {
			if (err.name !== 'AbortError') {
				error = err.message || 'Failed to get response';
				// Remove empty assistant message on error
				const lastMsg =
					activeConversation.messages[activeConversation.messages.length - 1];
				if (lastMsg.role === 'assistant' && !lastMsg.content) {
					activeConversation.messages = activeConversation.messages.slice(0, -1);
					conversations = [...conversations];
				}
			}
		} finally {
			isStreaming = false;
			abortController = null;
			persist();
			await scrollToBottom();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

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

	function deleteMessage(index: number) {
		if (!activeConversation) return;
		activeConversation.messages = activeConversation.messages.filter((_, i) => i !== index);
		conversations = [...conversations];
		persist();
	}
</script>

<div class="flex h-dvh overflow-hidden font-sans bg-(--color-bg) text-(--color-text)">
	<!-- Sidebar -->
	<aside
		class="flex flex-col border-r border-(--color-border) bg-(--color-bg-secondary) transition-all duration-200 {showSidebar
			? 'w-72'
			: 'w-0'} overflow-hidden flex-shrink-0"
	>
		<div class="flex items-center justify-between p-4 border-b border-(--color-border)">
			<h1 class="text-base font-semibold tracking-tight whitespace-nowrap">bland chat</h1>
			<button
				onclick={newConversation}
				class="p-1.5 rounded-md hover:bg-(--color-bg-tertiary) transition-colors text-(--color-text-secondary) cursor-pointer"
				title="New chat"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M12 5v14M5 12h14" />
				</svg>
			</button>
		</div>

		<div class="flex-1 overflow-y-auto p-2">
			{#each sortedConversations as conv (conv.id)}
				<div
					class="group flex items-center gap-1 rounded-lg mb-0.5 {activeId === conv.id
						? 'bg-(--color-bg-tertiary)'
						: 'hover:bg-(--color-surface-hover)'} transition-colors"
				>
					{#if editingTitle === conv.id}
						<input
							type="text"
							bind:value={editTitleValue}
							onblur={finishEditTitle}
							onkeydown={(e) => e.key === 'Enter' && finishEditTitle()}
							class="flex-1 px-3 py-2 text-sm bg-transparent border-none outline-none"
							autofocus
						/>
					{:else}
						<button
							onclick={() => selectConversation(conv.id)}
							ondblclick={() => startEditTitle(conv.id, conv.title)}
							class="flex-1 text-left px-3 py-2 text-sm truncate cursor-pointer bg-transparent border-none text-(--color-text)"
						>
							{conv.title}
						</button>
					{/if}
					<button
						onclick={() => deleteConversation(conv.id)}
						class="p-1 mr-1 rounded opacity-0 group-hover:opacity-100 hover:bg-(--color-danger)/20 transition-all cursor-pointer text-(--color-text-muted) hover:text-(--color-danger)"
						title="Delete"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M18 6 6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/each}
		</div>

		<div class="p-3 border-t border-(--color-border) flex gap-2">
			<button
				onclick={() => (showSettings = !showSettings)}
				class="flex-1 px-3 py-2 text-sm rounded-lg hover:bg-(--color-bg-tertiary) transition-colors cursor-pointer text-(--color-text-secondary) bg-transparent border border-(--color-border)"
			>
				Settings
			</button>
			<button
				onclick={toggleDarkMode}
				class="px-3 py-2 text-sm rounded-lg hover:bg-(--color-bg-tertiary) transition-colors cursor-pointer text-(--color-text-secondary) bg-transparent border border-(--color-border)"
				title="Toggle dark mode"
			>
				{settings.darkMode ? '☀' : '●'}
			</button>
		</div>
	</aside>

	<!-- Main area -->
	<main class="flex-1 flex flex-col min-w-0">
		<!-- Top bar -->
		<header class="flex items-center gap-3 px-4 py-3 border-b border-(--color-border) bg-(--color-bg-secondary)">
			<button
				onclick={() => (showSidebar = !showSidebar)}
				class="p-1.5 rounded-md hover:bg-(--color-bg-tertiary) transition-colors cursor-pointer text-(--color-text-secondary) bg-transparent border-none"
				title="Toggle sidebar"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M3 12h18M3 6h18M3 18h18" />
				</svg>
			</button>
			<span class="text-sm text-(--color-text-secondary) truncate">
				{activeConversation?.title ?? 'bland chat'}
			</span>
			{#if settings.model}
				<span
					class="ml-auto text-xs px-2 py-0.5 rounded-full bg-(--color-bg-tertiary) text-(--color-text-muted) font-mono"
				>
					{settings.model}
				</span>
			{/if}
		</header>

		<!-- Settings panel -->
		{#if showSettings}
			<div class="border-b border-(--color-border) bg-(--color-surface) p-5 overflow-y-auto max-h-[50vh]">
				<div class="max-w-2xl mx-auto space-y-4">
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-semibold uppercase tracking-wider text-(--color-text-muted)">
							Configuration
						</h2>
						<button
							onclick={() => (showSettings = false)}
							class="text-(--color-text-muted) hover:text-(--color-text) cursor-pointer bg-transparent border-none text-lg"
						>
							&times;
						</button>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="space-y-1.5">
							<label class="block text-xs font-medium text-(--color-text-secondary)" for="api-url"
								>API Base URL</label
							>
							<input
								id="api-url"
								type="text"
								bind:value={settings.apiUrl}
								oninput={persist}
								placeholder="https://api.openai.com/v1"
								class="w-full px-3 py-2 text-sm rounded-lg bg-(--color-bg) border border-(--color-border) text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-(--color-accent) transition-colors"
							/>
						</div>
						<div class="space-y-1.5">
							<label class="block text-xs font-medium text-(--color-text-secondary)" for="api-key"
								>API Key</label
							>
							<input
								id="api-key"
								type="password"
								bind:value={settings.apiKey}
								oninput={persist}
								placeholder="sk-..."
								class="w-full px-3 py-2 text-sm rounded-lg bg-(--color-bg) border border-(--color-border) text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-(--color-accent) transition-colors"
							/>
						</div>
						<div class="space-y-1.5 sm:col-span-2">
							<label class="block text-xs font-medium text-(--color-text-secondary)" for="model"
								>Model</label
							>
							<input
								id="model"
								type="text"
								bind:value={settings.model}
								oninput={persist}
								placeholder="gpt-4o, claude-3-opus, etc."
								class="w-full px-3 py-2 text-sm rounded-lg bg-(--color-bg) border border-(--color-border) text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-(--color-accent) transition-colors"
							/>
						</div>
					</div>

					<div class="space-y-1.5">
						<label class="block text-xs font-medium text-(--color-text-secondary)" for="system-prompt"
							>System Prompt</label
						>
						<textarea
							id="system-prompt"
							bind:value={settings.systemPrompt}
							oninput={persist}
							rows="3"
							class="w-full px-3 py-2 text-sm rounded-lg bg-(--color-bg) border border-(--color-border) text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-(--color-accent) transition-colors resize-y font-sans"
							placeholder="You are a helpful assistant."
						></textarea>
					</div>

					<div class="grid grid-cols-3 gap-4">
						<div class="space-y-1.5">
							<label for="temperature" class="block text-xs font-medium text-(--color-text-secondary)"
								>Temperature <span class="text-(--color-text-muted)">{settings.temperature.toFixed(2)}</span
								></label
							>
							<input
								id="temperature"
								type="range"
								min="0"
								max="2"
								step="0.05"
								bind:value={settings.temperature}
								oninput={persist}
								class="w-full accent-(--color-accent)"
							/>
						</div>
						<div class="space-y-1.5">
							<label for="top-p" class="block text-xs font-medium text-(--color-text-secondary)"
								>Top P <span class="text-(--color-text-muted)">{settings.topP.toFixed(2)}</span></label
							>
							<input
								id="top-p"
								type="range"
								min="0"
								max="1"
								step="0.05"
								bind:value={settings.topP}
								oninput={persist}
								class="w-full accent-(--color-accent)"
							/>
						</div>
						<div class="space-y-1.5">
							<label for="top-k" class="block text-xs font-medium text-(--color-text-secondary)"
								>Top K <span class="text-(--color-text-muted)">{settings.topK}</span></label
							>
							<input
								id="top-k"
								type="range"
								min="0"
								max="200"
								step="1"
								bind:value={settings.topK}
								oninput={persist}
								class="w-full accent-(--color-accent)"
							/>
						</div>
						<div class="space-y-1.5">
							<label for="min-p" class="block text-xs font-medium text-(--color-text-secondary)"
								>Min P <span class="text-(--color-text-muted)">{settings.minP.toFixed(2)}</span></label
							>
							<input
								id="min-p"
								type="range"
								min="0"
								max="1"
								step="0.01"
								bind:value={settings.minP}
								oninput={persist}
								class="w-full accent-(--color-accent)"
							/>
						</div>
						<div class="space-y-1.5">
							<label for="presence-penalty" class="block text-xs font-medium text-(--color-text-secondary)"
								>Presence Penalty <span class="text-(--color-text-muted)">{settings.presencePenalty.toFixed(2)}</span></label
							>
							<input
								id="presence-penalty"
								type="range"
								min="-2"
								max="2"
								step="0.05"
								bind:value={settings.presencePenalty}
								oninput={persist}
								class="w-full accent-(--color-accent)"
							/>
						</div>
						<div class="space-y-1.5">
							<label for="repetition-penalty" class="block text-xs font-medium text-(--color-text-secondary)"
								>Repetition Penalty <span class="text-(--color-text-muted)">{settings.repetitionPenalty.toFixed(2)}</span></label
							>
							<input
								id="repetition-penalty"
								type="range"
								min="0"
								max="2"
								step="0.05"
								bind:value={settings.repetitionPenalty}
								oninput={persist}
								class="w-full accent-(--color-accent)"
							/>
						</div>
						<div class="space-y-1.5">
							<label for="max-tokens" class="block text-xs font-medium text-(--color-text-secondary)"
								>Max Tokens <span class="text-(--color-text-muted)">{settings.maxTokens}</span></label
							>
							<input
								id="max-tokens"
								type="range"
								min="256"
								max="128000"
								step="256"
								bind:value={settings.maxTokens}
								oninput={persist}
								class="w-full accent-(--color-accent)"
							/>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Messages -->
		<div
			class="flex-1 overflow-y-auto px-4 py-6"
			role="region"
			aria-label="Chat messages"
			ondragover={(e) => e.preventDefault()}
			ondrop={handleDrop}
		>
			<div class="max-w-3xl mx-auto space-y-5">
				{#if activeConversation && activeConversation.messages.length === 0}
					<div class="flex flex-col items-center justify-center h-full text-center py-20">
						<div class="text-5xl mb-4 opacity-20">~</div>
						<p class="text-(--color-text-muted) text-sm">
							type something. paste an image. go wild.
						</p>
					</div>
				{/if}

				{#if activeConversation}
					{#each activeConversation.messages as msg, i (i)}
						<div class="flex gap-3 {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
							<div
								class="group relative max-w-[85%] {msg.role === 'user'
									? 'bg-(--color-user-bubble) text-(--color-user-text) rounded-2xl rounded-br-sm px-4 py-2.5'
									: 'bg-(--color-assistant-bubble) text-(--color-assistant-text) rounded-2xl rounded-bl-sm px-4 py-2.5 border border-(--color-border)'}"
							>
								<!-- Delete button -->
								<button
									onclick={() => deleteMessage(i)}
									class="absolute -top-2 -right-2 p-0.5 rounded-full bg-(--color-bg-tertiary) border border-(--color-border) opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-(--color-text-muted) hover:text-(--color-danger)"
									title="Delete message"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M18 6 6 18M6 6l12 12" />
									</svg>
								</button>

								<!-- Images -->
								{#each getMessageImages(msg) as imgUrl}
									<img
										src={imgUrl}
										alt="Attached"
										class="max-w-xs rounded-lg mb-2 border border-white/10"
									/>
								{/each}

								<!-- Text -->
								{#if msg.role === 'assistant'}
									{#if msg.reasoning}
										<details class="mb-2">
											<summary class="text-[11px] text-(--color-text-muted) cursor-pointer select-none hover:text-(--color-text-secondary) transition-colors">
												thinking{#if msg.metrics}&nbsp;&middot;&nbsp;{msg.metrics.reasoningTokenCount} tok{/if}
											</summary>
											<div class="mt-1 pl-3 border-l-2 border-(--color-border)/50 text-xs text-(--color-text-muted) prose max-h-60 overflow-y-auto">
												{@html renderMarkdown(msg.reasoning)}
											</div>
										</details>
									{/if}
									<div class="prose text-sm">
										{@html renderMarkdown(getMessageText(msg))}
									</div>
									{#if msg.metrics}
										<div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 pt-2 border-t border-(--color-border)/50 text-[10px] font-mono text-(--color-text-muted)">
											{#if msg.metrics.ttfrt !== null}
												<span title="Time to first reasoning token">{msg.metrics.ttfrt}ms ttfrt</span>
											{/if}
											<span title="Time to first visible token">{msg.metrics.ttft}ms ttft</span>
											<span title="Total tokens per second (including reasoning)">{msg.metrics.totalTps} t/s</span>
											{#if msg.metrics.reasoningTokenCount > 0}
												<span title="Reasoning tokens">{msg.metrics.reasoningTokenCount} think</span>
											{/if}
											<span title="Output tokens">{msg.metrics.tokenCount} out</span>
											{#if msg.metrics.promptTokens !== null}
												<span title="Prompt tokens">{msg.metrics.promptTokens} in</span>
											{/if}
											<span title="Total generation time">{(msg.metrics.totalTime / 1000).toFixed(1)}s</span>
										</div>
									{/if}
								{:else}
									<div class="text-sm whitespace-pre-wrap">{getMessageText(msg)}</div>
								{/if}
							</div>
						</div>
					{/each}
				{/if}

				{#if isStreaming}
					<div class="flex justify-center">
						<button
							onclick={stopStreaming}
							class="px-3 py-1.5 text-xs rounded-full border border-(--color-border) text-(--color-text-muted) hover:text-(--color-text) hover:border-(--color-accent) transition-colors cursor-pointer bg-(--color-surface)"
						>
							stop generating
						</button>
					</div>
				{/if}

				{#if error}
					<div
						class="mx-auto max-w-md text-sm text-(--color-danger) bg-(--color-danger)/10 border border-(--color-danger)/20 rounded-lg px-4 py-3"
					>
						{error}
					</div>
				{/if}

				<div bind:this={messagesEnd}></div>
			</div>
		</div>

		<!-- Input area -->
		<div class="border-t border-(--color-border) bg-(--color-bg-secondary) px-4 py-3">
			<div class="max-w-3xl mx-auto">
				<!-- Image previews -->
				{#if images.length > 0}
					<div class="flex gap-2 mb-2 flex-wrap">
						{#each images as img, i (i)}
							<div class="relative group">
								<img
									src={img.dataUrl}
									alt={img.name}
									class="h-16 w-16 object-cover rounded-lg border border-(--color-border)"
								/>
								<button
									onclick={() => removeImage(i)}
									aria-label="Remove image"
									class="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-(--color-bg-tertiary) border border-(--color-border) cursor-pointer text-(--color-text-muted) hover:text-(--color-danger)"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="10"
										height="10"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M18 6 6 18M6 6l12 12" />
									</svg>
								</button>
							</div>
						{/each}
					</div>
				{/if}

				<div class="flex items-end gap-2">
					<button
						onclick={() => fileInputEl.click()}
						class="p-2 rounded-lg hover:bg-(--color-bg-tertiary) transition-colors cursor-pointer text-(--color-text-muted) hover:text-(--color-text) bg-transparent border-none flex-shrink-0 mb-0.5"
						title="Attach image"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
							<circle cx="9" cy="9" r="2" />
							<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
						</svg>
					</button>
					<input
						bind:this={fileInputEl}
						type="file"
						accept="image/*"
						multiple
						class="hidden"
						onchange={handleImageUpload}
					/>
					<textarea
						bind:this={textareaEl}
						bind:value={input}
						oninput={autoResize}
						onkeydown={handleKeydown}
						onpaste={handlePaste}
						placeholder="message..."
						rows="1"
						class="flex-1 px-4 py-2.5 text-sm rounded-xl bg-(--color-bg) border border-(--color-border) text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-(--color-accent) transition-colors resize-none font-sans"
						disabled={isStreaming}
					></textarea>
					<button
						onclick={sendMessage}
						disabled={isStreaming || (!input.trim() && images.length === 0)}
						class="p-2.5 rounded-xl bg-(--color-accent) text-white hover:bg-(--color-accent-hover) transition-colors cursor-pointer border-none flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed mb-0.5"
						title="Send"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M5 12h14M12 5l7 7-7 7" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	</main>
</div>
