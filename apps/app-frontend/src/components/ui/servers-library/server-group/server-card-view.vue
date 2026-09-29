<script setup lang="ts">
import { Avatar, TagItem, truncatedTooltip } from '@modrinth/ui'
import { computed, ref } from 'vue'

import { getServerIconUrl } from '@/helpers/server'
import type { FakeServer } from '@/helpers/types-servers'

const props = withDefaults(
	defineProps<{
		server: FakeServer
		playing?: boolean
		selected?: boolean
	}>(),
	{
		playing: false,
		selected: false,
	},
)

const nameRef = ref<HTMLElement | null>(null)
const statusLabel = computed(() => {
	if (props.server.install_stage === 'installing') return 'Downloading...'
	if (props.server.install_stage === 'failed') return 'Download failed'
	if (props.server.install_stage === 'not_installed') return 'Not installed'
	return props.playing ? 'Running' : 'Stopped'
})
const iconUrl = computed(() => getServerIconUrl(props.server.icon_path) ?? undefined)
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
				:src="iconUrl"
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
			<TagItem :class="playing ? '!text-brand' : ''">
				<span class="mr-1 inline-block size-1.5 rounded-full" :class="playing ? 'bg-brand' : 'bg-secondary'" />
				{{ statusLabel }}
			</TagItem>
		</div>
		<slot name="overlay" />
	</div>
</template>
