<script setup lang="ts">
import { ServerStackIcon } from '@modrinth/assets'
import { defineMessages, useVIntl } from '@modrinth/ui'
import { onActivated, provide, ref } from 'vue'

import ServersLibrarySection from '@/components/ui/servers-library/index.vue'
import NewServerModal from '@/components/ui/servers-library/new-server-modal.vue'
import { fakeServers } from '@/helpers/fake-servers'
import { useRootBreadcrumb } from '@/providers/breadcrumbs'

defineOptions({ name: 'ServersPage' })

const { formatMessage } = useVIntl()
const messages = defineMessages({
	servers: { id: 'app.servers.heading', defaultMessage: 'Servers' },
})
const breadcrumb = useRootBreadcrumb({
	slot: 'root',
	id: 'servers',
	label: formatMessage(messages.servers),
	to: '/servers',
	visual: { type: 'icon', component: ServerStackIcon },
})
onActivated(breadcrumb.reset)

const isNewServerModalOpen = ref(false)
provide('showNewServerModal', () => {
	isNewServerModalOpen.value = true
})
</script>

<template>
	<div data-servers-library-page-background class="flex flex-col gap-3 p-6">
		<ServersLibrarySection :instances="fakeServers" />
	</div>
	<NewServerModal v-model="isNewServerModalOpen" />
</template>
