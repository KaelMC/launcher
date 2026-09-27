import { useStorage } from '@vueuse/core'

import { fakeServers } from '@/helpers/fake-servers'

export const FAVORITES_GROUP_ID = 'group:favorites'
export const MAX_SERVER_GROUP_NAME_LENGTH = 256

export type ServerGroupDefinition = {
	id: string
	name: string
}

export type ServerGroupMembershipUpdate = {
	instance_id: string
	group_ids: string[]
}

const groups = useStorage<ServerGroupDefinition[]>('fake-server-groups', [], localStorage)

function generateGroupId() {
	return typeof crypto.randomUUID === 'function'
		? `group:${crypto.randomUUID()}`
		: `group:${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function list_groups(): Promise<ServerGroupDefinition[]> {
	return groups.value
}

export async function create_group(name: string): Promise<ServerGroupDefinition> {
	const group: ServerGroupDefinition = { id: generateGroupId(), name }
	groups.value = [group, ...groups.value]
	return group
}

export async function rename_group(id: string, newName: string): Promise<ServerGroupDefinition> {
	groups.value = groups.value.map((group) => (group.id === id ? { ...group, name: newName } : group))
	return groups.value.find((group) => group.id === id)!
}

export async function delete_group(id: string): Promise<void> {
	groups.value = groups.value.filter((group) => group.id !== id)
	fakeServers.value = fakeServers.value.map((server) =>
		server.group_ids.includes(id)
			? { ...server, group_ids: server.group_ids.filter((groupId) => groupId !== id) }
			: server,
	)
}

export async function set_group_order(groupIds: string[]): Promise<void> {
	const groupsById = new Map(groups.value.map((group) => [group.id, group]))
	groups.value = groupIds.flatMap((groupId) => {
		const group = groupsById.get(groupId)
		return group ? [group] : []
	})
}

export async function set_group_memberships(updates: ServerGroupMembershipUpdate[]): Promise<void> {
	const updatesByServerId = new Map(updates.map((update) => [update.instance_id, update.group_ids]))
	fakeServers.value = fakeServers.value.map((server) =>
		updatesByServerId.has(server.id)
			? { ...server, group_ids: updatesByServerId.get(server.id)!, modified: new Date().toISOString() }
			: server,
	)
}
