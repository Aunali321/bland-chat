<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { loadUiPreferences, saveUiPreferences, generateTitle } from '$lib/storage';
	import { runStreamingChat } from '$lib/chat';
	import type { Conversation, Message, Settings, ImageAttachment } from '$lib/types';
	import { defaultApiSettings } from '$lib/types';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ChatMessage from '$lib/components/ChatMessage.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import MessageInput from '$lib/components/MessageInput.svelte';
	import TopBar from '$lib/components/TopBar.svelte';

	let { data } = $props();

	let settings = $state<Settings>({ ...defaultApiSettings, darkMode: false });
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

	const activeConversation = $derived(conversations.find((c) => c.id === activeId) ?? null);
	const sortedConversations = $derived(
		[...conversations].sort((a, b) => b.updatedAt - a.updatedAt)
	);

	let mounted = $state(false);
	let lastDataRef = $state<typeof data | null>(null);

	$effect(() => {
		const currentData = data;
		untrack(() => {
			if (isStreaming) return;
			if (currentData === lastDataRef) return;
			lastDataRef = currentData;

			conversations = currentData.conversations;
			if (currentData.settings) {
				const uiPrefs = loadUiPreferences();
				settings = { ...defaultApiSettings, ...currentData.settings, ...uiPrefs };
			}
			if (mounted && conversations.length > 0 && !activeId) {
				const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
				activeId = sorted[0]?.id ?? null;
			}
		});
	});

	onMount(async () => {
		const uiPrefs = loadUiPreferences();
		if (data.settings) {
			settings = { ...defaultApiSettings, ...data.settings, ...uiPrefs };
		} else {
			settings = { ...defaultApiSettings, ...uiPrefs };
		}

		if (!settings.apiUrl) settings.apiUrl = import.meta.env.VITE_API_URL ?? '';
		if (!settings.apiKey) settings.apiKey = import.meta.env.VITE_API_KEY ?? '';
		if (!settings.model) settings.model = import.meta.env.VITE_MODEL ?? '';

		if (settings.darkMode) {
			document.documentElement.classList.add('dark');
		}

		conversations = data.conversations;

		if (conversations.length === 0) {
			await newConversation();
		} else {
			activeId = sortedConversations[0]?.id ?? null;
		}

		mounted = true;
	});

	async function persistSettings() {
		saveUiPreferences({ darkMode: settings.darkMode });

		const formData = new FormData();
		formData.set('apiUrl', settings.apiUrl);
		formData.set('apiKey', settings.apiKey);
		formData.set('model', settings.model);
		formData.set('systemPrompt', settings.systemPrompt);
		formData.set('temperature', String(settings.temperature));
		formData.set('maxTokens', String(settings.maxTokens));
		formData.set('topP', String(settings.topP));
		formData.set('topK', String(settings.topK));
		formData.set('minP', String(settings.minP));
		formData.set('presencePenalty', String(settings.presencePenalty));
		formData.set('repetitionPenalty', String(settings.repetitionPenalty));

		await fetch('?/saveSettings', { method: 'POST', body: formData });
	}

	async function newConversation() {
		const id = crypto.randomUUID();
		const formData = new FormData();
		formData.set('id', id);
		await fetch('?/createConversation', { method: 'POST', body: formData });

		conversations = [
			...conversations,
			{ id, title: 'New chat', messages: [], createdAt: Date.now(), updatedAt: Date.now() }
		];
		activeId = id;
		input = '';
		images = [];
		error = null;
	}

	function selectConversation(id: string) {
		activeId = id;
		error = null;
		images = [];
	}

	async function deleteConversation(id: string) {
		const formData = new FormData();
		formData.set('id', id);
		fetch('?/deleteConversation', { method: 'POST', body: formData });

		conversations = conversations.filter((c) => c.id !== id);
		if (activeId === id) {
			activeId = sortedConversations[0]?.id ?? null;
			if (!activeId) await newConversation();
		}
	}

	function startEditTitle(id: string, currentTitle: string) {
		editingTitle = id;
		editTitleValue = currentTitle;
	}

	async function finishEditTitle() {
		if (editingTitle && editTitleValue.trim()) {
			const conv = conversations.find((c) => c.id === editingTitle);
			if (conv) {
				conv.title = editTitleValue.trim();
				conversations = [...conversations];

				const formData = new FormData();
				formData.set('id', editingTitle);
				formData.set('title', editTitleValue.trim());
				fetch('?/renameConversation', { method: 'POST', body: formData });
			}
		}
		editingTitle = null;
	}

	function toggleDarkMode() {
		settings.darkMode = !settings.darkMode;
		document.documentElement.classList.toggle('dark', settings.darkMode);
		saveUiPreferences({ darkMode: settings.darkMode });
	}

	async function scrollToBottom() {
		await tick();
		messagesEnd?.scrollIntoView({ behavior: 'smooth' });
	}

	function readImageFile(file: File) {
		if (!file.type.startsWith('image/')) return;
		const reader = new FileReader();
		reader.onload = () => {
			images = [...images, { dataUrl: reader.result as string, name: file.name }];
		};
		reader.readAsDataURL(file);
	}

	function handleImageUpload(files: FileList) {
		for (const file of files) readImageFile(file);
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
		for (const file of files) readImageFile(file);
	}

	function stopStreaming() {
		abortController?.abort();
		abortController = null;
		isStreaming = false;
	}

	async function saveMessage(conversationId: string, msg: Message): Promise<string | null> {
		const messageId = crypto.randomUUID();
		const formData = new FormData();
		formData.set('id', messageId);
		formData.set('conversationId', conversationId);
		formData.set('role', msg.role);
		formData.set('content', JSON.stringify(msg.content));
		if (msg.reasoning) formData.set('reasoning', msg.reasoning);
		if (msg.metrics) formData.set('metrics', JSON.stringify(msg.metrics));

		await fetch('?/addMessage', { method: 'POST', body: formData });
		return messageId;
	}

	async function sendMessage() {
		if ((!input.trim() && images.length === 0) || !activeConversation || isStreaming) return;

		if (!settings.apiUrl || !settings.model) {
			error = 'Set the API URL and model in settings first.';
			showSettings = true;
			return;
		}

		error = null;

		let userMessage: Message;
		if (images.length > 0) {
			const content: Message['content'] = [];
			if (input.trim()) content.push({ type: 'text', text: input.trim() });
			for (const img of images) {
				content.push({ type: 'image_url', image_url: { url: img.dataUrl, detail: 'auto' } });
			}
			userMessage = { role: 'user', content };
		} else {
			userMessage = { role: 'user', content: input.trim() };
		}

		activeConversation.messages = [...activeConversation.messages, userMessage];

		if (activeConversation.messages.filter((m) => m.role === 'user').length === 1) {
			const textContent =
				typeof userMessage.content === 'string'
					? userMessage.content
					: userMessage.content.find((c) => c.type === 'text')?.text || 'Image chat';
			activeConversation.title = generateTitle(textContent);

			const formData = new FormData();
			formData.set('id', activeConversation.id);
			formData.set('title', activeConversation.title);
			fetch('?/renameConversation', { method: 'POST', body: formData });
		}

		activeConversation.updatedAt = Date.now();
		conversations = [...conversations];

		input = '';
		images = [];
		await scrollToBottom();

		await saveMessage(activeConversation.id, userMessage);

		const assistantMsg: Message = { role: 'assistant', content: '', reasoning: '' };
		activeConversation.messages = [...activeConversation.messages, assistantMsg];
		conversations = [...conversations];

		isStreaming = true;
		const controller = new AbortController();
		abortController = controller;

		try {
			const messagesToSend = activeConversation.messages.slice(0, -1);

			const result = await runStreamingChat(
				messagesToSend,
				assistantMsg,
				settings,
				controller.signal,
				{
					onUpdate: () => {
						// Copy assistantMsg state into a new object in the messages array
						// to trigger Svelte 5 reactivity (it doesn't track in-place mutations)
						const lastIdx = activeConversation.messages.length - 1;
						activeConversation.messages[lastIdx] = { ...assistantMsg };
						activeConversation.messages = [...activeConversation.messages];
						conversations = [...conversations];
					},
					onToken: () => scrollToBottom()
				}
			);

			if (!result) {
				activeConversation.messages = activeConversation.messages.slice(0, -1);
				conversations = [...conversations];
			}
		} catch (err: any) {
			if (err.name !== 'AbortError') {
				error = err.message || 'Failed to get response';
				const lastMsg = activeConversation.messages[activeConversation.messages.length - 1];
				if (lastMsg.role === 'assistant' && !lastMsg.content) {
					activeConversation.messages = activeConversation.messages.slice(0, -1);
					conversations = [...conversations];
				}
			}
		} finally {
			isStreaming = false;
			abortController = null;

			const lastMsg = activeConversation.messages[activeConversation.messages.length - 1];
			if (lastMsg?.role === 'assistant' && lastMsg.content) {
				await saveMessage(activeConversation.id, lastMsg);
			}

			await scrollToBottom();
		}
	}

	async function deleteMessage(index: number) {
		if (!activeConversation) return;

		const formData = new FormData();
		formData.set('conversationId', activeConversation.id);
		formData.set('position', String(index));
		fetch('?/deleteMessage', { method: 'POST', body: formData });

		activeConversation.messages = activeConversation.messages.filter((_, i) => i !== index);
		conversations = [...conversations];
	}

	function handleSettingsUpdate(updated: Settings) {
		settings = updated;
		persistSettings();
	}
</script>

<div class="flex h-dvh overflow-hidden font-sans bg-(--color-bg) text-(--color-text)">
	{#if showSidebar}
		<Sidebar
			{conversations}
			{activeId}
			{editingTitle}
			{editTitleValue}
			darkMode={settings.darkMode}
			onSelect={selectConversation}
			onNew={newConversation}
			onDelete={deleteConversation}
			onStartEdit={startEditTitle}
			onFinishEdit={finishEditTitle}
			onEditValueChange={(v) => (editTitleValue = v)}
			onToggleSettings={() => (showSettings = !showSettings)}
			onToggleDarkMode={toggleDarkMode}
		/>
	{/if}

	<main class="flex-1 flex flex-col min-w-0">
		<TopBar
			title={activeConversation?.title ?? 'bland chat'}
			model={settings.model}
			{showSidebar}
			onToggleSidebar={() => (showSidebar = !showSidebar)}
		/>

		{#if showSettings}
			<SettingsPanel
				{settings}
				onUpdate={handleSettingsUpdate}
				onClose={() => (showSettings = false)}
			/>
		{/if}

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
						<p class="text-(--color-text-muted) text-sm">type something. paste an image. go wild.</p>
					</div>
				{/if}

				{#if activeConversation}
					{#each activeConversation.messages as msg, i (i)}
						<ChatMessage message={msg} index={i} onDelete={deleteMessage} />
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
					<div class="mx-auto max-w-md text-sm text-(--color-danger) bg-(--color-danger)/10 border border-(--color-danger)/20 rounded-lg px-4 py-3">
						{error}
					</div>
				{/if}

				<div bind:this={messagesEnd}></div>
			</div>
		</div>

		<MessageInput
			{input}
			{images}
			{isStreaming}
			onSend={sendMessage}
			onInputChange={(v) => (input = v)}
			onImageUpload={handleImageUpload}
			onRemoveImage={(i) => (images = images.filter((_, idx) => idx !== i))}
			onPaste={handlePaste}
			onDrop={handleDrop}
		/>
	</main>
</div>
