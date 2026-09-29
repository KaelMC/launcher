<script setup lang="ts">
import { ConsolePageLayout, provideConsoleManager } from '@modrinth/ui'
import { computed, onMounted, ref, shallowRef, triggerRef, watchEffect } from 'vue'

import { useAppEvent } from '@/composables/use-app-event'
import { useInstanceConsole } from '@/composables/useInstanceConsole'
import { runningServerIds, sendServerCommand } from '@/helpers/server'

import { injectServerPage } from '../server-context'

const serverPage = injectServerPage()
const serverId = serverPage.serverId

const { liveConsole, hydrate, clearLive } = useInstanceConsole(serverId.value)

onMounted(() => {
	void hydrate()
})

const logLines = shallowRef(liveConsole.output.value)
watchEffect(() => {
	logLines.value = liveConsole.output.value
	triggerRef(logLines)
})

const playing = computed(() => runningServerIds.value.has(serverId.value))

function handleSendCommand(command: string) {
	void sendServerCommand(serverId.value, command)
}

provideConsoleManager({
	logLines,
	showCommandInput: playing,
	sendCommand: handleSendCommand,
	loading: ref(false),
	onClear: () => void clearLive(),
	emptyStateType: 'server',
})

useAppEvent('log', (payload) => {
	if (payload.instance_id !== serverId.value) return

	if (payload.type === 'log4j') {
		liveConsole.addLog4jEvent(payload)
	} else if (payload.type === 'legacy') {
		liveConsole.addLegacyLog(payload.message)
	}
})

useAppEvent('process', (event) => {
	if (event.instance_id !== serverId.value) return
	if (event.event === 'launched') {
		liveConsole.clear()
	}
})
</script>

<template>
	<div class="flex h-full flex-col gap-4">
		<ConsolePageLayout />
	</div>
</template>
