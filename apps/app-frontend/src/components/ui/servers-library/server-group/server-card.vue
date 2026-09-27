<script setup lang="ts">
import { KeyboardSensor, PointerSensor, useDraggable } from '@dnd-kit/vue'
import { CheckIcon, PlayIcon, StopCircleIcon } from '@modrinth/assets'
import { defineMessages, IconButton, useVIntl } from '@modrinth/ui'
import { useEventListener, useMagicKeys } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import ServerCardView from '@/components/ui/servers-library/server-group/server-card-view.vue'
import {
	getServerSelectionKey,
	useServersLibrary,
} from '@/components/ui/servers-library/use-server-library'
import { toggleServerStatus } from '@/helpers/fake-servers'
import type { FakeServer } from '@/helpers/types-servers'

const serverCardSensors = [
	PointerSensor.configure({
		preventActivation: () => false,
	}),
	KeyboardSensor,
]

const { formatMessage } = useVIntl()
const messages = defineMessages({
	selectServer: {
		id: 'app.servers-library.server.select-with-name',
		defaultMessage: 'Select {name}',
	},
	deselectServer: {
		id: 'app.servers-library.server.deselect-with-name',
		defaultMessage: 'Deselect {name}',
	},
	openServer: {
		id: 'app.servers-library.server.open-with-name',
		defaultMessage: 'Open {name}',
	},
	stop: { id: 'app.servers-library.server.stop', defaultMessage: 'Stop' },
	start: { id: 'app.servers-library.server.start', defaultMessage: 'Start' },
	select: { id: 'app.servers-library.server.select', defaultMessage: 'Select server' },
	deselect: { id: 'app.servers-library.server.deselect', defaultMessage: 'Deselect server' },
})
const { displayState, selectedLibraryInstances, isLibraryInstanceSelectionActive } =
	useServersLibrary()
const router = useRouter()

const props = defineProps<{
	server: FakeServer
	instanceGroupId: string
	isSelectionAnchor?: boolean
}>()

const emit = defineEmits<{
	(e: 'toggle-selection', shiftKey: boolean): void
}>()

const serverCardElement = ref<InstanceType<typeof ServerCardView> | null>(null)
const playing = computed(() => props.server.status === 'running')
const selectionKey = computed(() =>
	getServerSelectionKey({ instanceId: props.server.id, groupId: props.instanceGroupId }),
)
const selected = computed(() => selectedLibraryInstances.value.has(selectionKey.value))
const keys = useMagicKeys()
const holdingShift = computed(() => keys.shift.value)
const isPrimaryPointerDown = ref(false)
useDraggable({
	id: computed(() => `server:${props.instanceGroupId}:${props.server.id}`),
	element: serverCardElement,
	disabled: computed(() => displayState.value.group !== 'Group'),
	sensors: serverCardSensors,
	data: computed(() => ({
		instanceId: props.server.id,
		fromGroup: props.instanceGroupId,
	})),
})

const toggleSelection = (event?: MouseEvent) => {
	emit('toggle-selection', event?.shiftKey ?? false)
}

const handlePointerDown = (event: PointerEvent) => {
	isPrimaryPointerDown.value =
		event.button === 0 &&
		!(event.target instanceof Element && event.target.closest('.selection-button'))
}

const resetPrimaryPointer = () => {
	isPrimaryPointerDown.value = false
}

useEventListener(window, 'pointerup', resetPrimaryPointer)
useEventListener(window, 'pointercancel', resetPrimaryPointer)
useEventListener(window, 'blur', resetPrimaryPointer)

const play = (event: MouseEvent | null) => {
	event?.stopPropagation()
	toggleServerStatus(props.server.id)
}

const stop = (event: MouseEvent | null) => {
	event?.stopPropagation()
	toggleServerStatus(props.server.id)
}

const seeServer = async () => {
	await router.push(`/servers/${encodeURIComponent(props.server.id)}`)
}

const activateCard = (event: MouseEvent) => {
	if (isLibraryInstanceSelectionActive.value || event.shiftKey) {
		toggleSelection(event)
	} else {
		void seeServer()
	}
}

const handleCardKeydown = (event: KeyboardEvent) => {
	if (event.target !== event.currentTarget) return

	if (event.key === 'Enter') {
		event.preventDefault()
		if (isLibraryInstanceSelectionActive.value) {
			toggleSelection()
		} else {
			void seeServer()
		}
	} else if (event.key === ' ' && isLibraryInstanceSelectionActive.value) {
		event.preventDefault()
		toggleSelection()
	}
}

defineExpose({
	play,
	stop,
	server: props.server,
	get playing() {
		return playing.value
	},
})
</script>

<template>
	<ServerCardView
		ref="serverCardElement"
		class="group/card cursor-pointer -outline-offset-2 focus-visible:!outline-2 hover:brightness-110"
		:class="{
			'opacity-50': false,
			'scale-[0.95]': isPrimaryPointerDown && !isLibraryInstanceSelectionActive,
		}"
		:server="server"
		:selected="selected"
		data-servers-library-server-card
		:data-server-id="server.id"
		:data-server-group="instanceGroupId"
		role="button"
		tabindex="0"
		:aria-label="
			isLibraryInstanceSelectionActive
				? formatMessage(selected ? messages.deselectServer : messages.selectServer, {
						name: server.name,
					})
				: formatMessage(messages.openServer, { name: server.name })
		"
		:aria-pressed="isLibraryInstanceSelectionActive ? selected : undefined"
		@click="activateCard"
		@keydown="handleCardKeydown"
		@pointerdown="handlePointerDown"
	>
		<template #leading>
			<IconButton
				v-if="playing"
				v-tooltip="formatMessage(messages.stop)"
				:label="formatMessage(messages.stop)"
				type="colored"
				color="red"
				size="lg"
				@click="(e) => stop(e)"
			>
				<StopCircleIcon />
			</IconButton>
			<IconButton
				v-else-if="!isLibraryInstanceSelectionActive"
				v-tooltip="formatMessage(messages.start)"
				:label="formatMessage(messages.start)"
				type="colored"
				color="brand"
				size="lg"
				class="origin-bottom scale-75 opacity-0 transition-opacity group-hover/card:scale-100 group-hover/card:opacity-100"
				@click="(e) => play(e)"
			>
				<PlayIcon class="translate-x-px" />
			</IconButton>
		</template>
		<template #overlay>
			<button
				type="button"
				class="selection-button group/selection absolute right-2 top-1.5 z-[2] flex size-[50px] cursor-pointer items-start justify-center border-0 bg-transparent p-0 pt-4"
				:aria-label="formatMessage(selected ? messages.deselect : messages.select)"
				:aria-pressed="selected"
				@click.stop="toggleSelection"
			>
				<span
					v-tooltip="formatMessage(selected ? messages.deselect : messages.select)"
					class="relative flex size-[24px] items-center justify-center rounded-full opacity-0 transition-opacity duration-200 ease-out group-hover/card:opacity-100 group-hover/selection:brightness-125"
					:class="{
						'border-0 !opacity-100': selected,
						'border-2 border-solid border-primary bg-transparent': !selected,
						'[outline:3px_solid_var(--color-purple)] outline-offset-1':
							holdingShift && isSelectionAnchor,
					}"
				>
					<span v-if="selected" class="absolute inset-0 rounded-full bg-contrast" />
					<CheckIcon v-if="selected" class="relative size-4 invert [stroke-width:3]" />
				</span>
			</button>
		</template>
	</ServerCardView>
</template>
