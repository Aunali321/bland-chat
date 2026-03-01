import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const conversations = sqliteTable('conversations', {
	id: text('id').primaryKey(),
	title: text('title').notNull().default('New chat'),
	createdAt: integer('created_at', { mode: 'number' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'number' }).notNull()
});

export const messages = sqliteTable('messages', {
	id: text('id').primaryKey(),
	conversationId: text('conversation_id')
		.notNull()
		.references(() => conversations.id, { onDelete: 'cascade' }),
	position: integer('position').notNull(),
	role: text('role', { enum: ['system', 'user', 'assistant'] }).notNull(),
	/** JSON string — either a plain string or MessageContent[] */
	content: text('content').notNull(),
	reasoning: text('reasoning'),
	/** JSON-serialized ResponseMetrics */
	metrics: text('metrics'),
	createdAt: integer('created_at', { mode: 'number' }).notNull()
});

export const settings = sqliteTable('settings', {
	id: text('id').primaryKey().default('default'),
	apiUrl: text('api_url').notNull().default(''),
	apiKey: text('api_key').notNull().default(''),
	model: text('model').notNull().default(''),
	systemPrompt: text('system_prompt').notNull().default('You are a helpful assistant.'),
	temperature: real('temperature'),
	maxTokens: integer('max_tokens'),
	topP: real('top_p'),
	topK: integer('top_k'),
	minP: real('min_p'),
	presencePenalty: real('presence_penalty'),
	repetitionPenalty: real('repetition_penalty')
});
