import type { FileItem } from '@modrinth/ui'
import { useStorage } from '@vueuse/core'

const filesByServer = useStorage<Record<string, FileItem[]>>('fake-server-files', {}, localStorage)
const contentsByServer = useStorage<Record<string, Record<string, string>>>(
	'fake-server-file-contents',
	{},
	localStorage,
)

function parentOf(path: string): string {
	const lastSlash = path.lastIndexOf('/')
	return lastSlash === -1 ? '' : path.slice(0, lastSlash)
}

function nameOf(path: string): string {
	const lastSlash = path.lastIndexOf('/')
	return lastSlash === -1 ? path : path.slice(lastSlash + 1)
}

function joinPath(parent: string, name: string): string {
	return parent ? `${parent}/${name}` : name
}

function seedServer(serverId: string): FileItem[] {
	const now = Date.now()
	const seeded: FileItem[] = [
		{ name: 'world', type: 'directory', path: 'world', created: now, modified: now },
		{ name: 'logs', type: 'directory', path: 'logs', created: now, modified: now },
		{ name: 'plugins', type: 'directory', path: 'plugins', created: now, modified: now },
		{
			name: 'server.properties',
			type: 'file',
			path: 'server.properties',
			size: 512,
			created: now,
			modified: now,
		},
		{ name: 'eula.txt', type: 'file', path: 'eula.txt', size: 12, created: now, modified: now },
	]

	filesByServer.value = { ...filesByServer.value, [serverId]: seeded }
	contentsByServer.value = {
		...contentsByServer.value,
		[serverId]: {
			'server.properties': '# Minecraft server properties\nmotd=A Minecraft Server\n',
			'eula.txt': 'eula=true\n',
		},
	}

	return seeded
}

function getServerFiles(serverId: string): FileItem[] {
	return filesByServer.value[serverId] ?? seedServer(serverId)
}

function setServerFiles(serverId: string, items: FileItem[]) {
	filesByServer.value = { ...filesByServer.value, [serverId]: items }
}

export function listDirectory(serverId: string, dirPath: string): FileItem[] {
	const normalized = dirPath.startsWith('/') ? dirPath.slice(1) : dirPath
	return getServerFiles(serverId).filter((item) => parentOf(item.path) === normalized)
}

export function createItem(serverId: string, targetPath: string, type: 'file' | 'directory') {
	const now = Date.now()
	const items = getServerFiles(serverId)
	if (items.some((item) => item.path === targetPath)) return

	setServerFiles(serverId, [
		...items,
		{ name: nameOf(targetPath), type, path: targetPath, size: type === 'file' ? 0 : null, created: now, modified: now },
	])
}

export function renameItem(serverId: string, path: string, destination: string) {
	const now = Date.now()
	const items = getServerFiles(serverId)
	const prefix = `${path}/`

	setServerFiles(
		serverId,
		items.map((item) => {
			if (item.path === path) {
				return { ...item, path: destination, name: nameOf(destination), modified: now }
			}
			if (item.path.startsWith(prefix)) {
				return { ...item, path: destination + item.path.slice(path.length), modified: now }
			}
			return item
		}),
	)

	const contents = contentsByServer.value[serverId]
	if (contents?.[path] !== undefined) {
		const nextContents = { ...contents }
		nextContents[destination] = nextContents[path]
		delete nextContents[path]
		contentsByServer.value = { ...contentsByServer.value, [serverId]: nextContents }
	}
}

export function moveItem(serverId: string, source: string, destination: string) {
	renameItem(serverId, source, destination)
}

export function deleteItem(serverId: string, path: string) {
	const prefix = `${path}/`
	setServerFiles(
		serverId,
		getServerFiles(serverId).filter((item) => item.path !== path && !item.path.startsWith(prefix)),
	)

	const contents = contentsByServer.value[serverId]
	if (contents && (contents[path] !== undefined || Object.keys(contents).some((key) => key.startsWith(prefix)))) {
		const nextContents = Object.fromEntries(
			Object.entries(contents).filter(([key]) => key !== path && !key.startsWith(prefix)),
		)
		contentsByServer.value = { ...contentsByServer.value, [serverId]: nextContents }
	}
}

export function readFile(serverId: string, path: string): string {
	return contentsByServer.value[serverId]?.[path] ?? ''
}

export function writeFile(serverId: string, path: string, content: string, createOnly = false) {
	const contents = contentsByServer.value[serverId] ?? {}
	if (createOnly && contents[path] !== undefined) return

	contentsByServer.value = {
		...contentsByServer.value,
		[serverId]: { ...contents, [path]: content },
	}

	const now = Date.now()
	const items = getServerFiles(serverId)
	if (items.some((item) => item.path === path)) {
		setServerFiles(
			serverId,
			items.map((item) =>
				item.path === path ? { ...item, size: content.length, modified: now } : item,
			),
		)
	} else {
		setServerFiles(serverId, [
			...items,
			{ name: nameOf(path), type: 'file', path, size: content.length, created: now, modified: now },
		])
	}
}

export function joinPathForUpload(currentPath: string, fileName: string): string {
	return joinPath(currentPath, fileName)
}
