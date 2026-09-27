<script setup lang="ts">
import { Avatar, TagItem, truncatedTooltip } from '@modrinth/ui'
import { ref } from 'vue'

import type { FakeServer } from '@/helpers/types-servers'

withDefaults(
	defineProps<{
		server: FakeServer
		selected?: boolean
	}>(),
	{
		selected: false,
	},
)

const nameRef = ref<HTMLElement | null>(null)
</script>

<template>
	<div
		class="relative flex w-full min-w-0 select-none flex-col items-start justify-end gap-3 overflow-clip rounded-[20px] border border-solid bg-surface-3 p-3 text-left transition-[background-color,border-color,filter]"
		:class="{
			'[border-color:color-mix(in_srgb,var(--color-text-primary)_40%,transparent)] brightness-110':
				selected,
			'border-surface-4': !selected,
		}"
	>
		<div class="relative flex aspect-square min-w-full shrink-0 items-center overflow-clip rounded-2xl">
			<Avatar
				class="pointer-events-none !rounded-2xl outline-none"
				size="100%"
				:src="server.icon_url ?? undefined"
				:tint-by="server.id"
				alt=""
				no-shadow
				pad-transparent-corners
			/>
			<div class="absolute bottom-1.5 right-1.5 z-[1] flex size-12 items-center justify-center">
				<slot name="leading" />
			</div>
		</div>
		<div class="flex w-full min-w-0 flex-col items-start justify-center gap-1 px-0.5">
			<p
				ref="nameRef"
				v-tooltip="truncatedTooltip(nameRef, server.name)"
				class="m-0 w-full truncate text-base font-semibold leading-5 text-contrast"
			>
				{{ server.name }}
			</p>
			<TagItem :class="server.status === 'running' ? '!text-brand' : ''">
				<span
					class="mr-1 inline-block size-1.5 rounded-full"
					:class="server.status === 'running' ? 'bg-brand' : 'bg-secondary'"
				/>
				{{ server.status === 'running' ? 'Running' : 'Stopped' }}
			</TagItem>
		</div>
		<slot name="overlay" />
	</div>
</template>
