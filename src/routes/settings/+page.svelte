<script lang="ts">
    import { onMount } from "svelte";
    import { loadUiPreferences, saveUiPreferences } from "$lib/storage";
    import type { ApiSettings } from "$lib/types";
    import { defaultApiSettings, hyperparamKeys } from "$lib/types";

    let { data } = $props();

    let settings = $state<ApiSettings>({ ...defaultApiSettings });
    let darkMode = $state(false);

    onMount(() => {
        const uiPrefs = loadUiPreferences();
        darkMode = uiPrefs.darkMode;

        if (data.settings) {
            settings = { ...defaultApiSettings, ...data.settings };
        }

        if (!settings.apiUrl)
            settings.apiUrl = import.meta.env.VITE_API_URL ?? "";
        if (!settings.apiKey)
            settings.apiKey = import.meta.env.VITE_API_KEY ?? "";
        if (!settings.model) settings.model = import.meta.env.VITE_MODEL ?? "";
    });

    async function persistSettings() {
        const formData = new FormData();
        formData.set("apiUrl", settings.apiUrl);
        formData.set("apiKey", settings.apiKey);
        formData.set("model", settings.model);
        formData.set("systemPrompt", settings.systemPrompt);

        for (const key of hyperparamKeys) {
            const val = settings[key];
            formData.set(key, val !== null ? String(val) : "");
        }

        await fetch("/settings?/saveSettings", {
            method: "POST",
            body: formData,
        });
    }

    function update() {
        persistSettings();
    }

    type HyperparamKey = (typeof hyperparamKeys)[number];

    function setParam(key: HyperparamKey, value: number | null) {
        settings = { ...settings, [key]: value };
        update();
    }

    function resetHyperparams() {
        settings = {
            ...settings,
            temperature: null,
            maxTokens: null,
            topP: null,
            topK: null,
            minP: null,
            presencePenalty: null,
            repetitionPenalty: null,
        };
        update();
    }

    function toggleDarkMode() {
        darkMode = !darkMode;
        document.documentElement.classList.toggle("dark", darkMode);
        saveUiPreferences({ darkMode });
    }

    const paramConfig: Record<
        HyperparamKey,
        {
            label: string;
            min: number;
            max: number;
            step: number;
            default: number;
            format: (v: number) => string;
        }
    > = {
        temperature: {
            label: "Temperature",
            min: 0,
            max: 2,
            step: 0.05,
            default: 1.0,
            format: (v) => v.toFixed(2),
        },
        topP: {
            label: "Top P",
            min: 0,
            max: 1,
            step: 0.05,
            default: 0.95,
            format: (v) => v.toFixed(2),
        },
        topK: {
            label: "Top K",
            min: 0,
            max: 200,
            step: 1,
            default: 20,
            format: (v) => String(v),
        },
        minP: {
            label: "Min P",
            min: 0,
            max: 1,
            step: 0.01,
            default: 0.0,
            format: (v) => v.toFixed(2),
        },
        presencePenalty: {
            label: "Presence Penalty",
            min: -2,
            max: 2,
            step: 0.05,
            default: 1.5,
            format: (v) => v.toFixed(2),
        },
        repetitionPenalty: {
            label: "Repetition Penalty",
            min: 0,
            max: 2,
            step: 0.05,
            default: 1.0,
            format: (v) => v.toFixed(2),
        },
        maxTokens: {
            label: "Max Tokens",
            min: 256,
            max: 128000,
            step: 256,
            default: 4096,
            format: (v) => String(v),
        },
    };

    const hasAnyHyperparam = $derived(
        hyperparamKeys.some((k) => settings[k] !== null),
    );
</script>

<div class="min-h-dvh bg-(--color-bg) text-(--color-text) font-sans">
    <div class="max-w-2xl mx-auto px-4 py-8">
        <div class="flex items-center justify-between mb-8">
            <div class="flex items-center gap-4">
                <a
                    href="/"
                    class="p-1.5 rounded-md hover:bg-(--color-bg-tertiary) transition-colors text-(--color-text-secondary)"
                    title="Back to chat"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </a>
                <h1 class="text-lg font-semibold tracking-tight">Settings</h1>
            </div>
            <button
                onclick={toggleDarkMode}
                class="px-3 py-2 text-sm rounded-lg hover:bg-(--color-bg-tertiary) transition-colors cursor-pointer text-(--color-text-secondary) bg-transparent border border-(--color-border)"
                title="Toggle dark mode"
            >
                {darkMode ? "☀" : "●"}
            </button>
        </div>

        <div class="space-y-6">
            <section class="space-y-4">
                <h2
                    class="text-sm font-semibold uppercase tracking-wider text-(--color-text-muted)"
                >
                    Connection
                </h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-1.5">
                        <label
                            class="block text-xs font-medium text-(--color-text-secondary)"
                            for="api-url">API Base URL</label
                        >
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
                        <label
                            class="block text-xs font-medium text-(--color-text-secondary)"
                            for="api-key">API Key</label
                        >
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
                        <label
                            class="block text-xs font-medium text-(--color-text-secondary)"
                            for="model">Model</label
                        >
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
            </section>

            <section class="space-y-4">
                <h2
                    class="text-sm font-semibold uppercase tracking-wider text-(--color-text-muted)"
                >
                    System Prompt
                </h2>
                <textarea
                    id="system-prompt"
                    bind:value={settings.systemPrompt}
                    oninput={update}
                    rows="3"
                    class="w-full px-3 py-2 text-sm rounded-lg bg-(--color-bg) border border-(--color-border) text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-(--color-accent) transition-colors resize-y font-sans"
                    placeholder="You are a helpful assistant."
                ></textarea>
            </section>

            <section class="space-y-4">
                <div class="flex items-center justify-between">
                    <h2
                        class="text-sm font-semibold uppercase tracking-wider text-(--color-text-muted)"
                    >
                        Hyperparameters
                    </h2>
                    {#if hasAnyHyperparam}
                        <button
                            onclick={resetHyperparams}
                            class="px-3 py-1.5 text-xs rounded-lg hover:bg-(--color-danger)/20 transition-colors cursor-pointer text-(--color-danger) bg-transparent border border-(--color-danger)/30"
                        >
                            Reset all
                        </button>
                    {/if}
                </div>

                <div
                    class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                    {#each hyperparamKeys as key}
                        {@const config = paramConfig[key]}
                        {@const value = settings[key]}
                        <div class="space-y-1.5">
                            <div class="flex items-center justify-between">
                                <label
                                    for={key}
                                    class="block text-xs font-medium text-(--color-text-secondary)"
                                >
                                    {config.label}
                                    {#if value !== null}
                                        <span class="text-(--color-text-muted)"
                                            >{config.format(value)}</span
                                        >
                                    {/if}
                                </label>
                                {#if value !== null}
                                    <button
                                        onclick={() => setParam(key, null)}
                                        class="p-0.5 rounded text-(--color-text-muted) hover:text-(--color-text) cursor-pointer bg-transparent border-none text-xs"
                                        title="Clear (use API default)"
                                    >
                                        &times;
                                    </button>
                                {/if}
                            </div>
                            {#if value !== null}
                                <input
                                    id={key}
                                    type="range"
                                    min={config.min}
                                    max={config.max}
                                    step={config.step}
                                    {value}
                                    oninput={(e) =>
                                        setParam(
                                            key,
                                            parseFloat(
                                                (e.target as HTMLInputElement)
                                                    .value,
                                            ),
                                        )}
                                    class="w-full accent-(--color-accent)"
                                />
                            {:else}
                                <button
                                    onclick={() =>
                                        setParam(key, config.default)}
                                    class="w-full px-3 py-1.5 text-xs rounded-lg border border-dashed border-(--color-border) text-(--color-text-muted) hover:border-(--color-accent) hover:text-(--color-text) transition-colors cursor-pointer bg-transparent"
                                >
                                    Not set — click to configure
                                </button>
                            {/if}
                        </div>
                    {/each}
                </div>
            </section>
        </div>
    </div>
</div>
