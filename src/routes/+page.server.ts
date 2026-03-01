import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { conversations, messages, settings } from '$lib/server/schema';
import { eq, asc } from 'drizzle-orm';
import type { Message, ResponseMetrics } from '$lib/types';

/** Deserialize a message row from DB into the app Message type */
function rowToMessage(row: typeof messages.$inferSelect): Message {
	const content = JSON.parse(row.content);
	const msg: Message = { role: row.role, content };
	if (row.reasoning) msg.reasoning = row.reasoning;
	if (row.metrics) msg.metrics = JSON.parse(row.metrics) as ResponseMetrics;
	return msg;
}

export const load: PageServerLoad = async () => {
	const allConversations = db
		.select()
		.from(conversations)
		.orderBy(conversations.updatedAt)
		.all()
		.reverse();

	const conversationsWithMessages = allConversations.map((conv) => {
		const msgs = db
			.select()
			.from(messages)
			.where(eq(messages.conversationId, conv.id))
			.orderBy(asc(messages.position))
			.all();

		return {
			id: conv.id,
			title: conv.title,
			messages: msgs.map(rowToMessage),
			createdAt: conv.createdAt,
			updatedAt: conv.updatedAt
		};
	});

	const settingsRow = db.select().from(settings).where(eq(settings.id, 'default')).get();

	return {
		conversations: conversationsWithMessages,
		settings: settingsRow
			? {
					apiUrl: settingsRow.apiUrl,
					apiKey: settingsRow.apiKey,
					model: settingsRow.model,
					systemPrompt: settingsRow.systemPrompt,
					temperature: settingsRow.temperature,
					maxTokens: settingsRow.maxTokens,
					topP: settingsRow.topP,
					topK: settingsRow.topK,
					minP: settingsRow.minP,
					presencePenalty: settingsRow.presencePenalty,
					repetitionPenalty: settingsRow.repetitionPenalty
				}
			: null
	};
};

export const actions: Actions = {
	createConversation: async ({ request }) => {
		const data = await request.formData();
		const id = (data.get('id') as string) || crypto.randomUUID();
		const timestamp = Date.now();
		db.insert(conversations)
			.values({ id, title: 'New chat', createdAt: timestamp, updatedAt: timestamp })
			.run();
		return { id };
	},

	deleteConversation: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		if (!id) return { error: 'Missing id' };
		db.delete(messages).where(eq(messages.conversationId, id)).run();
		db.delete(conversations).where(eq(conversations.id, id)).run();
	},

	renameConversation: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		const title = data.get('title') as string;
		if (!id || !title) return { error: 'Missing id or title' };
		db.update(conversations)
			.set({ title, updatedAt: Date.now() })
			.where(eq(conversations.id, id))
			.run();
	},

	addMessage: async ({ request }) => {
		const data = await request.formData();
		const id = (data.get('id') as string) || crypto.randomUUID();
		const conversationId = data.get('conversationId') as string;
		const role = data.get('role') as 'system' | 'user' | 'assistant';
		const content = data.get('content') as string;
		const reasoning = (data.get('reasoning') as string) || null;
		const metrics = (data.get('metrics') as string) || null;

		if (!conversationId || !role || content === null) {
			return { error: 'Missing required fields' };
		}

		const existing = db
			.select()
			.from(messages)
			.where(eq(messages.conversationId, conversationId))
			.all();
		const position = existing.length;

		db.insert(messages)
			.values({
				id,
				conversationId,
				position,
				role,
				content,
				reasoning,
				metrics,
			createdAt: Date.now()
		})
		.run();

	db.update(conversations)
		.set({ updatedAt: Date.now() })
		.where(eq(conversations.id, conversationId))
		.run();

		return { messageId: id };
	},

	updateMessage: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		const content = data.get('content') as string | null;
		const reasoning = data.get('reasoning') as string | null;
		const metrics = data.get('metrics') as string | null;

		if (!id) return { error: 'Missing id' };

		const updates: Record<string, unknown> = {};
		if (content !== null) updates.content = content;
		if (reasoning !== null) updates.reasoning = reasoning;
		if (metrics !== null) updates.metrics = metrics;

		if (Object.keys(updates).length > 0) {
			db.update(messages).set(updates).where(eq(messages.id, id)).run();
		}
	},

	deleteMessage: async ({ request }) => {
		const data = await request.formData();
		const conversationId = data.get('conversationId') as string;
		const position = parseInt(data.get('position') as string, 10);

		if (!conversationId || isNaN(position)) return { error: 'Missing required fields' };

		const allMsgs = db
			.select()
			.from(messages)
			.where(eq(messages.conversationId, conversationId))
			.orderBy(asc(messages.position))
			.all();

		const target = allMsgs[position];
		if (!target) return { error: 'Message not found' };

		db.delete(messages).where(eq(messages.id, target.id)).run();

		const remaining = allMsgs.filter((_, i) => i !== position);
		for (let i = 0; i < remaining.length; i++) {
			if (remaining[i].position !== i) {
				db.update(messages).set({ position: i }).where(eq(messages.id, remaining[i].id)).run();
			}
		}

		db.update(conversations)
			.set({ updatedAt: Date.now() })
			.where(eq(conversations.id, conversationId))
			.run();
	}
};
