<script lang="ts">
	import type { Settings } from '$lib/types';

	interface Props {
		settings: Settings;
		onUpdate: (settings: Settings) => void;
		onClose: () => void;
	}

	let { settings, onUpdate, onClose }: Props = $props();

	function update() {
		onUpdate(settings);
	}
</script>

<div class="border-b border-(--color-border) bg-(--color-surface) p-5 overflow-y-auto max-h-[50vh]">
	<div class="max-w-2xl mx-auto space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-semibold uppercase tracking-wider text-(--color-text-muted)">
				Configuration
			</h2>
			<button
				onclick={onClose}
				class="text-(--color-text-muted) hover:text-(--color-text) cursor-pointer bg-transparent border-none text-lg"
			>
				&times;
			</button>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<div class="space-y-1.5">
				<label class="block text-xs font-medium text-(--color-text-secondary)" for="api-url">API Base URL</label>
				<input
					id="api-url"
					type="text"
					bind:value={settings.apiUrl}
					oninput={update}
					placeholder="https://api.openai.com/v1"
					class="w-full px-3 py-2 text-sm rounded-lg bg-(--color-bg) border border-(--color-border) text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-(--color-accent) transition-colors"
				/>
			</div>
			<div class="space-y-1.5">
				<label class="block text-xs font-medium text-(--color-text-secondary)" for="api-key">API Key</label>
				<input
					id="api-key"
					type="password"
					bind:value={settings.apiKey}
					oninput={update}
					placeholder="sk-..."
					class="w-full px-3 py-2 text-sm rounded-lg bg-(--color-bg) border border-(--color-border) text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-(--color-accent) transition-colors"
				/>
			</div>
			<div class="space-y-1.5 sm:col-span-2">
				<label class="block text-xs font-medium text-(--color-text-secondary)" for="model">Model</label>
				<input
					id="model"
					type="text"
					bind:value={settings.model}
					oninput={update}
					placeholder="gpt-4o, claude-3-opus, etc."
					class="w-full px-3 py-2 text-sm rounded-lg bg-(--color-bg) border border-(--color-border) text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-(--color-accent) transition-colors"
				/>
			</div>
		</div>

		<div class="space-y-1.5">
			<label class="block text-xs font-medium text-(--color-text-secondary)" for="system-prompt">System Prompt</label>
			<textarea
				id="system-prompt"
				bind:value={settings.systemPrompt}
				oninput={update}
				rows="3"
				class="w-full px-3 py-2 text-sm rounded-lg bg-(--color-bg) border border-(--color-border) text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-(--color-accent) transition-colors resize-y font-sans"
				placeholder="You are a helpful assistant."
			></textarea>
		</div>

		<div class="grid grid-cols-3 gap-4">
			<div class="space-y-1.5">
				<label for="temperature" class="block text-xs font-medium text-(--color-text-secondary)">
					Temperature <span class="text-(--color-text-muted)">{settings.temperature.toFixed(2)}</span>
				</label>
				<input id="temperature" type="range" min="0" max="2" step="0.05" bind:value={settings.temperature} oninput={update} class="w-full accent-(--color-accent)" />
			</div>
			<div class="space-y-1.5">
				<label for="top-p" class="block text-xs font-medium text-(--color-text-secondary)">
					Top P <span class="text-(--color-text-muted)">{settings.topP.toFixed(2)}</span>
				</label>
				<input id="top-p" type="range" min="0" max="1" step="0.05" bind:value={settings.topP} oninput={update} class="w-full accent-(--color-accent)" />
			</div>
			<div class="space-y-1.5">
				<label for="top-k" class="block text-xs font-medium text-(--color-text-secondary)">
					Top K <span class="text-(--color-text-muted)">{settings.topK}</span>
				</label>
				<input id="top-k" type="range" min="0" max="200" step="1" bind:value={settings.topK} oninput={update} class="w-full accent-(--color-accent)" />
			</div>
			<div class="space-y-1.5">
				<label for="min-p" class="block text-xs font-medium text-(--color-text-secondary)">
					Min P <span class="text-(--color-text-muted)">{settings.minP.toFixed(2)}</span>
				</label>
				<input id="min-p" type="range" min="0" max="1" step="0.01" bind:value={settings.minP} oninput={update} class="w-full accent-(--color-accent)" />
			</div>
			<div class="space-y-1.5">
				<label for="presence-penalty" class="block text-xs font-medium text-(--color-text-secondary)">
					Presence Penalty <span class="text-(--color-text-muted)">{settings.presencePenalty.toFixed(2)}</span>
				</label>
				<input id="presence-penalty" type="range" min="-2" max="2" step="0.05" bind:value={settings.presencePenalty} oninput={update} class="w-full accent-(--color-accent)" />
			</div>
			<div class="space-y-1.5">
				<label for="repetition-penalty" class="block text-xs font-medium text-(--color-text-secondary)">
					Repetition Penalty <span class="text-(--color-text-muted)">{settings.repetitionPenalty.toFixed(2)}</span>
				</label>
				<input id="repetition-penalty" type="range" min="0" max="2" step="0.05" bind:value={settings.repetitionPenalty} oninput={update} class="w-full accent-(--color-accent)" />
			</div>
			<div class="space-y-1.5">
				<label for="max-tokens" class="block text-xs font-medium text-(--color-text-secondary)">
					Max Tokens <span class="text-(--color-text-muted)">{settings.maxTokens}</span>
				</label>
				<input id="max-tokens" type="range" min="256" max="128000" step="256" bind:value={settings.maxTokens} oninput={update} class="w-full accent-(--color-accent)" />
			</div>
		</div>
	</div>
</div>
