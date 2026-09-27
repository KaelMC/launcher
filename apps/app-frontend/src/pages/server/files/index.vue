<script setup lang="ts">
import type { EditingFile, FileItem, UploadState } from '@modrinth/ui'
import { FilePageLayout, provideFileManager } from '@modrinth/ui'
import { computed, ref } from 'vue'

import * as fakeFiles from '@/helpers/fake-server-files'

import { injectServerPage } from '../server-context'

const serverPage = injectServerPage()
const serverId = serverPage.serverId

const items = ref<FileItem[]>([])
const loading = ref(false)
const error = ref<Error | null>(null)
const currentPath = ref('')
const editingFile = ref<EditingFile | null>(null)

function refresh() {
	items.value = fakeFiles.listDirectory(serverId.value, currentPath.value)
}

refresh()

function navigateTo(path: string) {
	currentPath.value = path.startsWith('/') ? path.slice(1) : path
	refresh()
}

function startEditing(file: EditingFile) {
	editingFile.value = file
}

function stopEditing() {
	editingFile.value = null
}

async function handleCreateItem(name: string, type: 'file' | 'directory') {
	const targetPath = currentPath.value ? `${currentPath.value}/${name}` : name
	fakeFiles.createItem(serverId.value, targetPath, type)
	refresh()
}

async function handleRenameItem(path: string, newName: string) {
	const parentDir = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : ''
	const newPath = parentDir ? `${parentDir}/${newName}` : newName
	fakeFiles.renameItem(serverId.value, path, newPath)
	refresh()
}

async function handleMoveItem(source: string, destination: string) {
	fakeFiles.moveItem(serverId.value, source, destination)
	refresh()
}

async function handleDeleteItem(path: string) {
	fakeFiles.deleteItem(serverId.value, path)
	refresh()
}

async function handleReadFile(path: string): Promise<string> {
	return fakeFiles.readFile(serverId.value, path)
}

async function handleReadFileAsBlob(path: string): Promise<Blob> {
	return new Blob([fakeFiles.readFile(serverId.value, path)])
}

async function handleWriteFile(path: string, content: string) {
	fakeFiles.writeFile(serverId.value, path, content)
	refresh()
}

async function handleDownloadFile() {
	// Not wired up: there is no real file on disk to save.
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

	for (const file of files) {
		const targetPath = fakeFiles.joinPathForUpload(currentPath.value, file.name)
		fakeFiles.writeFile(serverId.value, targetPath, '', true)
	}
	refresh()
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
