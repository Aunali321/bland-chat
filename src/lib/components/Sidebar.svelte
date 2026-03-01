<script lang="ts">
	import type { Conversation } from '$lib/types';

	interface Props {
		conversations: Conversation[];
		activeId: string | null;
		editingTitle: string | null;
		editTitleValue: string;
		darkMode: boolean;
		onSelect: (id: string) => void;
		onNew: () => void;
		onDelete: (id: string) => void;
		onStartEdit: (id: string, title: string) => void;
		onFinishEdit: () => void;
		onEditValueChange: (value: string) => void;
		onToggleDarkMode: () => void;
	}

	let {
		conversations,
		activeId,
		editingTitle,
		editTitleValue,
		darkMode,
		onSelect,
		onNew,
		onDelete,
		onStartEdit,
		onFinishEdit,
		onEditValueChange,
		onToggleDarkMode
	}: Props = $props();

	const sorted = $derived([...conversations].sort((a, b) => b.updatedAt - a.updatedAt));

	/** Svelte action that focuses the node when it is mounted */
	function focusOnMount(node: HTMLElement) {
		node.focus();
	}
</script>

<aside
	class="flex flex-col border-r border-(--color-border) bg-(--color-bg-secondary) w-72 flex-shrink-0"
>
	<div class="flex items-center justify-between p-4 border-b border-(--color-border)">
		<h1 class="text-base font-semibold tracking-tight whitespace-nowrap">bland chat</h1>
		<button
			onclick={onNew}
			class="p-1.5 rounded-md hover:bg-(--color-bg-tertiary) transition-colors text-(--color-text-secondary) cursor-pointer"
			title="New chat"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 5v14M5 12h14" />
			</svg>
		</button>
	</div>

	<div class="flex-1 overflow-y-auto p-2">
		{#each sorted as conv (conv.id)}
			<div
				class="group flex items-center gap-1 rounded-lg mb-0.5 {activeId === conv.id
					? 'bg-(--color-bg-tertiary)'
					: 'hover:bg-(--color-surface-hover)'} transition-colors"
			>
				{#if editingTitle === conv.id}
				<input
					type="text"
					value={editTitleValue}
					oninput={(e) => onEditValueChange((e.target as HTMLInputElement).value)}
					onblur={onFinishEdit}
					onkeydown={(e) => e.key === 'Enter' && onFinishEdit()}
					class="flex-1 px-3 py-2 text-sm bg-transparent border-none outline-none"
					use:focusOnMount
				/>
				{:else}
					<button
						onclick={() => onSelect(conv.id)}
						ondblclick={() => onStartEdit(conv.id, conv.title)}
						class="flex-1 text-left px-3 py-2 text-sm truncate cursor-pointer bg-transparent border-none text-(--color-text)"
					>
						{conv.title}
					</button>
				{/if}
				<button
					onclick={() => onDelete(conv.id)}
					class="p-1 mr-1 rounded opacity-0 group-hover:opacity-100 hover:bg-(--color-danger)/20 transition-all cursor-pointer text-(--color-text-muted) hover:text-(--color-danger)"
					title="Delete"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</div>
		{/each}
	</div>

	<div class="p-3 border-t border-(--color-border) flex gap-2">
		<a
			href="/settings"
			class="flex-1 px-3 py-2 text-sm rounded-lg hover:bg-(--color-bg-tertiary) transition-colors text-(--color-text-secondary) border border-(--color-border) text-center no-underline"
		>
			Settings
		</a>
		<button
			onclick={onToggleDarkMode}
			class="px-3 py-2 text-sm rounded-lg hover:bg-(--color-bg-tertiary) transition-colors cursor-pointer text-(--color-text-secondary) bg-transparent border border-(--color-border)"
			title="Toggle dark mode"
		>
			{darkMode ? '☀' : '●'}
		</button>
	</div>
</aside>
