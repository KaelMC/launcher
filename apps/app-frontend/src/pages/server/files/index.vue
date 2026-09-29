<script setup lang="ts">
import type { EditingFile, FileItem, UploadState } from '@modrinth/ui'
import { FilePageLayout, provideFileManager } from '@modrinth/ui'
import { invoke } from '@tauri-apps/api/core'
import { computed, ref } from 'vue'

import { injectServerPage } from '../server-context'

const serverPage = injectServerPage()
const serverId = serverPage.serverId

const items = ref<FileItem[]>([])
const loading = ref(true)
const error = ref<Error | null>(null)
const currentPath = ref('')
const editingFile = ref<EditingFile | null>(null)

async function listDirectory(path: string): Promise<FileItem[]> {
	return invoke('plugin:server-files|server_file_list', {
		serverId: serverId.value,
		path,
	})
}

async function refresh() {
	loading.value = true
	try {
		items.value = await listDirectory(currentPath.value)
		error.value = null
	} catch (e) {
		error.value = e instanceof Error ? e : new Error(String(e))
	} finally {
		loading.value = false
	}
}

void refresh()

function navigateTo(path: string) {
	currentPath.value = path.startsWith('/') ? path.slice(1) : path
	void refresh()
}

function startEditing(file: EditingFile) {
	editingFile.value = file
}

function stopEditing() {
	editingFile.value = null
}

async function writeBytes(path: string, bytes: Uint8Array, createOnly = false) {
	await invoke('plugin:server-files|server_file_write', {
		serverId: serverId.value,
		path,
		bytes: Array.from(bytes),
		createOnly,
	})
}

async function handleCreateItem(name: string, type: 'file' | 'directory') {
	const targetPath = currentPath.value ? `${currentPath.value}/${name}` : name
	if (type === 'directory') {
		await invoke('plugin:server-files|server_file_create_directory', {
			serverId: serverId.value,
			path: targetPath,
		})
	} else {
		await writeBytes(targetPath, new Uint8Array(), true)
	}
	await refresh()
}

async function handleRenameItem(path: string, newName: string) {
	const parentDir = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : ''
	const newPath = parentDir ? `${parentDir}/${newName}` : newName
	await invoke('plugin:server-files|server_file_rename', {
		serverId: serverId.value,
		source: path,
		destination: newPath,
	})
	await refresh()
}

async function handleMoveItem(source: string, destination: string) {
	await invoke('plugin:server-files|server_file_rename', {
		serverId: serverId.value,
		source,
		destination,
	})
	await refresh()
}

async function handleDeleteItem(path: string, recursive: boolean) {
	await invoke('plugin:server-files|server_file_delete', {
		serverId: serverId.value,
		path,
		recursive,
	})
	await refresh()
}

async function handleReadFile(path: string): Promise<string> {
	const bytes = await invoke<number[]>('plugin:server-files|server_file_read', {
		serverId: serverId.value,
		path,
	})
	return new TextDecoder().decode(new Uint8Array(bytes))
}

async function handleReadFileAsBlob(path: string): Promise<Blob> {
	const bytes = await invoke<number[]>('plugin:server-files|server_file_read', {
		serverId: serverId.value,
		path,
	})
	return new Blob([new Uint8Array(bytes)])
}

async function handleWriteFile(path: string, content: string) {
	await writeBytes(path, new TextEncoder().encode(content))
	await refresh()
}

async function handleDownloadFile() {
	// Not wired up: no "save as" destination picker for server files yet.
}

const uploadState = ref<UploadState>({
	isUploading: false,
	currentFileName: null,
	currentFileProgress: 0,
	uploadedBytes: 0,
	totalBytes: 0,
	completedFiles: 0,
	totalFiles: 0,
})

async function handleUploadFiles(files: File[]) {
	if (files.length === 0) return

	uploadState.value = {
		isUploading: true,
		currentFileName: '',
		currentFileProgress: 0,
		uploadedBytes: 0,
		totalBytes: files.reduce((sum, f) => sum + f.size, 0),
		completedFiles: 0,
		totalFiles: files.length,
	}
	try {
		for (const file of files) {
			uploadState.value.currentFileName = file.name
			const buffer = await file.arrayBuffer()
			const targetPath = currentPath.value ? `${currentPath.value}/${file.name}` : file.name
			await writeBytes(targetPath, new Uint8Array(buffer))
			uploadState.value.completedFiles++
			uploadState.value.uploadedBytes += file.size
			uploadState.value.currentFileProgress = 1
		}
	} finally {
		uploadState.value.isUploading = false
		await refresh()
	}
}

provideFileManager({
	items,
	loading,
	error,
	currentPath,
	navigateTo,
	editingFile,
	startEditing,
	stopEditing,
	createItem: handleCreateItem,
	renameItem: handleRenameItem,
	moveItem: handleMoveItem,
	deleteItem: handleDeleteItem,
	readFile: handleReadFile,
	readFileAsBlob: handleReadFileAsBlob,
	writeFile: handleWriteFile,
	downloadFile: handleDownloadFile,
	uploadFiles: handleUploadFiles,
	uploadState,
	refresh,
	basePath: computed(() => ''),
})
</script>

<template>
	<div>
		<FilePageLayout :show-refresh-button="true" />
	</div>
</template>
