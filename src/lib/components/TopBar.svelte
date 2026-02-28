<script lang="ts">
	interface Props {
		title: string;
		model: string;
		showSidebar: boolean;
		onToggleSidebar: () => void;
	}

	let { title, model, showSidebar, onToggleSidebar }: Props = $props();
</script>

<header class="flex items-center gap-3 px-4 py-3 border-b border-(--color-border) bg-(--color-bg-secondary)">
	<button
		onclick={onToggleSidebar}
		class="p-1.5 rounded-md hover:bg-(--color-bg-tertiary) transition-colors cursor-pointer text-(--color-text-secondary) bg-transparent border-none"
		title="Toggle sidebar"
	>
		<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M3 12h18M3 6h18M3 18h18" />
		</svg>
	</button>
	<span class="text-sm text-(--color-text-secondary) truncate">{title}</span>
	{#if model}
		<span class="ml-auto text-xs px-2 py-0.5 rounded-full bg-(--color-bg-tertiary) text-(--color-text-muted) font-mono">
			{model}
		</span>
	{/if}
</header>
