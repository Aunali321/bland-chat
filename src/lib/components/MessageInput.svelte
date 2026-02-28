<script lang="ts">
	import type { ImageAttachment } from '$lib/types';

	interface Props {
		input: string;
		images: ImageAttachment[];
		isStreaming: boolean;
		onSend: () => void;
		onInputChange: (value: string) => void;
		onImageUpload: (files: FileList) => void;
		onRemoveImage: (index: number) => void;
		onPaste: (e: ClipboardEvent) => void;
		onDrop: (e: DragEvent) => void;
	}

	let {
		input,
		images,
		isStreaming,
		onSend,
		onInputChange,
		onImageUpload,
		onRemoveImage,
		onPaste,
		onDrop
	}: Props = $props();

	let textareaEl: HTMLTextAreaElement;
	let fileInputEl: HTMLInputElement;

	function autoResize() {
		if (!textareaEl) return;
		textareaEl.style.height = 'auto';
		textareaEl.style.height = Math.min(textareaEl.scrollHeight, 200) + 'px';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			onSend();
		}
	}

	function handleFileInput(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files) {
			onImageUpload(target.files);
			target.value = '';
		}
	}

	export function resetHeight() {
		if (textareaEl) textareaEl.style.height = 'auto';
	}

	export function focus() {
		textareaEl?.focus();
	}
</script>

<div class="border-t border-(--color-border) bg-(--color-bg-secondary) px-4 py-3">
	<div class="max-w-3xl mx-auto">
		{#if images.length > 0}
			<div class="flex gap-2 mb-2 flex-wrap">
				{#each images as img, i (i)}
					<div class="relative group">
						<img src={img.dataUrl} alt={img.name} class="h-16 w-16 object-cover rounded-lg border border-(--color-border)" />
						<button
							onclick={() => onRemoveImage(i)}
							aria-label="Remove image"
							class="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-(--color-bg-tertiary) border border-(--color-border) cursor-pointer text-(--color-text-muted) hover:text-(--color-danger)"
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
					<circle cx="9" cy="9" r="2" />
					<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
				</svg>
			</button>
			<input bind:this={fileInputEl} type="file" accept="image/*" multiple class="hidden" onchange={handleFileInput} />
			<textarea
				bind:this={textareaEl}
				value={input}
				oninput={(e) => { onInputChange((e.target as HTMLTextAreaElement).value); autoResize(); }}
				onkeydown={handleKeydown}
				onpaste={onPaste}
				placeholder="message..."
				rows="1"
				class="flex-1 px-4 py-2.5 text-sm rounded-xl bg-(--color-bg) border border-(--color-border) text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-(--color-accent) transition-colors resize-none font-sans"
				disabled={isStreaming}
			></textarea>
			<button
				onclick={onSend}
				disabled={isStreaming || (!input.trim() && images.length === 0)}
				class="p-2.5 rounded-xl bg-(--color-accent) text-white hover:bg-(--color-accent-hover) transition-colors cursor-pointer border-none flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed mb-0.5"
				title="Send"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M5 12h14M12 5l7 7-7 7" />
				</svg>
			</button>
		</div>
	</div>
</div>
