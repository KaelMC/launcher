import { useStorage } from '@vueuse/core'

import type { FakeServer } from '@/helpers/types-servers'

export const fakeServers = useStorage<FakeServer[]>('fake-servers-list', [], localStorage)

function generateId() {
	return typeof crypto.randomUUID === 'function'
		? crypto.randomUUID()
		: `server-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createServer(name: string, iconUrl?: string | null) {
	const now = new Date().toISOString()
	const server: FakeServer = {
		id: generateId(),
		name,
		icon_url: iconUrl ?? null,
		status: 'stopped',
		group_ids: [],
		created: now,
		modified: now,
		last_played: now,
	}

	fakeServers.value = [server, ...fakeServers.value]
	return server
}

export function removeServer(id: string) {
	fakeServers.value = fakeServers.value.filter((server) => server.id !== id)
}

export function toggleServerStatus(id: string) {
	fakeServers.value = fakeServers.value.map((server) =>
		server.id === id
			? {
					...server,
					status: server.status === 'running' ? 'stopped' : 'running',
					modified: new Date().toISOString(),
					last_played: new Date().toISOString(),
				}
			: server,
	)
}

export function editServer(id: string, patch: Partial<Pick<FakeServer, 'name' | 'group_ids'>>) {
	fakeServers.value = fakeServers.value.map((server) =>
		server.id === id ? { ...server, ...patch, modified: new Date().toISOString() } : server,
	)
}
