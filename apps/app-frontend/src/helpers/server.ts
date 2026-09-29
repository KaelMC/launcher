import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { useStorage } from '@vueuse/core'
import { ref } from 'vue'

export type ServerLoader =
	| 'vanilla'
	| 'paper'
	| 'spigot'
	| 'fabric'
	| 'quilt'
	| 'forge'
	| 'neoforge'

export type ServerInstallStage = 'not_installed' | 'installing' | 'installed' | 'failed'

export type RealServer = {
	id: string
	name: string
	icon_path: string | null
	loader: ServerLoader
	loader_version: string | null
	game_version: string
	jar_path: string | null
	install_stage: ServerInstallStage
	install_error: string | null
	install_job_id: string | null
	eula_accepted: boolean
	created: string
	modified: string
	last_played: string | null
	/** Frontend-only: which local groups this server belongs to (see helpers/server-groups.ts). */
	group_ids: string[]
}

export function getServerIconUrl(iconPath: string | null | undefined): string | null {
	if (!iconPath) return null
	if (iconPath.startsWith('http://') || iconPath.startsWith('https://')) return iconPath
	return convertFileSrc(iconPath)
}

export const servers = ref<RealServer[]>([])
export const runningServerIds = ref<Set<string>>(new Set())

const groupMemberships = useStorage<Record<string, string[]>>(
	'fake-server-group-memberships',
	{},
	localStorage,
)

export function getStoredGroupIds(serverId: string): string[] {
	return groupMemberships.value[serverId] ?? []
}

export function setStoredGroupIds(serverId: string, groupIds: string[]) {
	groupMemberships.value = { ...groupMemberships.value, [serverId]: groupIds }
	servers.value = servers.value.map((server) =>
		server.id === serverId ? { ...server, group_ids: groupIds } : server,
	)
}

export function clearGroupFromAllServers(groupId: string) {
	for (const [serverId, groupIds] of Object.entries(groupMemberships.value)) {
		if (groupIds.includes(groupId)) {
			setStoredGroupIds(
				serverId,
				groupIds.filter((id) => id !== groupId),
			)
		}
	}
}

export async function refreshServers() {
	const fetched: Omit<RealServer, 'group_ids'>[] = await invoke('plugin:server|server_list')
	servers.value = fetched.map((server) => ({
		...server,
		group_ids: getStoredGroupIds(server.id),
	}))
}

export async function refreshRunningServers() {
	const ids: string[] = await invoke('plugin:server|server_list_running')
	runningServerIds.value = new Set(ids)
}

export function applyServerProcessEvent(payload: {
	instance_id: string
	event: string
}) {
	const isKnownServer = servers.value.some((server) => server.id === payload.instance_id)
	if (!isKnownServer) return

	const nextRunning = new Set(runningServerIds.value)
	if (payload.event === 'launched') {
		nextRunning.add(payload.instance_id)
	} else if (payload.event === 'finished') {
		nextRunning.delete(payload.instance_id)
	}
	runningServerIds.value = nextRunning
}

void refreshServers()
void refreshRunningServers()

export async function createServer(
	name: string,
	iconPath: string | null,
	loader: ServerLoader,
	loaderVersion: string | null,
	gameVersion: string,
): Promise<RealServer> {
	const server: Omit<RealServer, 'group_ids'> = await invoke('plugin:server|server_create', {
		name,
		iconPath,
		loader,
		loaderVersion,
		gameVersion,
	})
	await refreshServers()
	return { ...server, group_ids: [] }
}

export async function retryServerInstall(id: string) {
	await invoke('plugin:server|server_retry_install', { id })
	await refreshServers()
}

export async function renameServer(id: string, name: string) {
	await invoke('plugin:server|server_rename', { id, name })
	await refreshServers()
}

export async function removeServer(id: string) {
	await invoke('plugin:server|server_remove', { id })
	await refreshServers()
}

const EULA_AGREED_KEY = 'minecraft-server-eula-agreed'

export function hasAgreedToMojangEula(): boolean {
	return localStorage.getItem(EULA_AGREED_KEY) === 'true'
}

/** Shows a one-time confirmation before a server is ever started. Returns
 *  whether the user agreed (and the agreement is now on file). */
export function confirmMojangEula(): boolean {
	if (hasAgreedToMojangEula()) return true

	const agreed = window.confirm(
		'Running a Minecraft server requires agreeing to the Mojang EULA (https://www.minecraft.net/en-us/eula). Continue?',
	)
	if (agreed) localStorage.setItem(EULA_AGREED_KEY, 'true')
	return agreed
}

export async function startServer(id: string) {
	if (!confirmMojangEula()) return

	await invoke('plugin:server|server_start', { id })
	await refreshRunningServers()
	await refreshServers()
}

export async function stopServer(id: string) {
	await invoke('plugin:server|server_stop', { id })
	await refreshRunningServers()
}

export async function sendServerCommand(id: string, command: string) {
	await invoke('plugin:server|server_send_command', { id, command })
}

export async function isServerRunning(id: string): Promise<boolean> {
	return await invoke('plugin:server|server_is_running', { id })
}

export async function getServerLogBuffer(id: string): Promise<string[]> {
	return await invoke('plugin:server|server_get_log_buffer', { id })
}
