<script setup lang="ts">
import ServerCardView from '@/components/ui/servers-library/server-group/server-card-view.vue'
import type { FakeServer } from '@/helpers/types-servers'

defineProps<{
	server: FakeServer
}>()
</script>

<template>
	<div aria-hidden="true" class="relative w-full select-none">
		<ServerCardView :server="server" class="opacity-90 shadow-lg" />
	</div>
</template>
