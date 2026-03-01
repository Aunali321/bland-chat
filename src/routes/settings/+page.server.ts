import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const row = db.select().from(settings).where(eq(settings.id, 'default')).get();

	return {
		settings: row
			? {
					apiUrl: row.apiUrl,
					apiKey: row.apiKey,
					model: row.model,
					systemPrompt: row.systemPrompt,
					temperature: row.temperature,
					maxTokens: row.maxTokens,
					topP: row.topP,
					topK: row.topK,
					minP: row.minP,
					presencePenalty: row.presencePenalty,
					repetitionPenalty: row.repetitionPenalty
				}
			: null
	};
};

function parseNullableFloat(value: string | null): number | null {
	if (value === null || value === '') return null;
	const n = parseFloat(value);
	return isNaN(n) ? null : n;
}

function parseNullableInt(value: string | null): number | null {
	if (value === null || value === '') return null;
	const n = parseInt(value, 10);
	return isNaN(n) ? null : n;
}

export const actions: Actions = {
	saveSettings: async ({ request }) => {
		const data = await request.formData();
		const values = {
			id: 'default',
			apiUrl: (data.get('apiUrl') as string) || '',
			apiKey: (data.get('apiKey') as string) || '',
			model: (data.get('model') as string) || '',
			systemPrompt: (data.get('systemPrompt') as string) || 'You are a helpful assistant.',
			temperature: parseNullableFloat(data.get('temperature') as string | null),
			maxTokens: parseNullableInt(data.get('maxTokens') as string | null),
			topP: parseNullableFloat(data.get('topP') as string | null),
			topK: parseNullableInt(data.get('topK') as string | null),
			minP: parseNullableFloat(data.get('minP') as string | null),
			presencePenalty: parseNullableFloat(data.get('presencePenalty') as string | null),
			repetitionPenalty: parseNullableFloat(data.get('repetitionPenalty') as string | null)
		};

		db.insert(settings)
			.values(values)
			.onConflictDoUpdate({ target: settings.id, set: values })
			.run();
	}
};
