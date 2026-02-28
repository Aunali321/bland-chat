import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { apiUrl, apiKey, ...payload } = body;

	if (!apiUrl) {
		return new Response(JSON.stringify({ error: 'apiUrl is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const baseUrl = apiUrl.replace(/\/+$/, '');
	const url = `${baseUrl}/chat/completions`;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};

	if (apiKey) {
		headers['Authorization'] = `Bearer ${apiKey}`;
	}

	const upstream = await fetch(url, {
		method: 'POST',
		headers,
		body: JSON.stringify(payload)
	});

	if (!upstream.ok) {
		const errorText = await upstream.text();
		return new Response(errorText, {
			status: upstream.status,
			headers: { 'Content-Type': 'text/plain' }
		});
	}

	// Stream the SSE response through
	return new Response(upstream.body, {
		status: 200,
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		}
	});
};
