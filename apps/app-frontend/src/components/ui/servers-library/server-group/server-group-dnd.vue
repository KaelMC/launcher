<script setup lang="ts">
import {
	DragDropProvider,
	type DragEndEvent,
	type DragMoveEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
} from '@dnd-kit/vue'
import { computed, nextTick } from 'vue'

import DragPreview from '@/components/ui/servers-library/server-group/drag-preview.vue'
import { useServersLibrary } from '@/components/ui/servers-library/use-server-library'
import type { FakeServer } from '@/helpers/types-servers'

type ServerDragData = {
	instanceId: string
	fromGroup: string
}

type ServerGroupDndDropData = {
	groupId: string
}

const props = defineProps<{
	instances: FakeServer[]
}>()

const {
	activeInstanceGroupDrag,
	startInstanceGroupDrag,
	updateInstanceGroupDrag,
	finishInstanceGroupDrag,
	setInstanceGroupDragTarget,
	getInstanceGroupDropState,
	moveDraggedInstancesToGroup,
} = useServersLibrary()

const draggedInstance = computed(() => {
	const drag = activeInstanceGroupDrag.value
	return drag ? props.instances.find((instance) => instance.id === drag.primaryInstanceId) : undefined
})

function handleDragStart(event: DragStartEvent) {
	const sourceData = event.operation.source?.data as ServerDragData | undefined
	if (!sourceData) return

	const pointer = event.operation.position.current
	startInstanceGroupDrag(sourceData.instanceId, sourceData.fromGroup, pointer)
}

function handleDragMove(event: DragMoveEvent) {
	const pointer = event.to ?? event.operation.position.current
	updateInstanceGroupDrag(pointer)
}

function handleDragOver(event: DragOverEvent) {
	const targetData = event.operation.target?.data as ServerGroupDndDropData | undefined
	setInstanceGroupDragTarget(targetData?.groupId ?? null)
}

async function handleDragEnd(event: DragEndEvent) {
	const targetData = event.operation.target?.data as ServerGroupDndDropData | undefined
	if (!event.canceled && targetData) {
		const dropState = getInstanceGroupDropState(targetData.groupId)
		if (dropState.canDrop) {
			void moveDraggedInstancesToGroup(targetData.groupId)
			await nextTick()
		}
	}

	finishInstanceGroupDrag()
}
</script>

<template>
	<DragDropProvider
		@drag-start="handleDragStart"
		@drag-move="handleDragMove"
		@drag-over="handleDragOver"
		@drag-end="handleDragEnd"
	>
		<slot />
		<Teleport to="body">
			<div class="pointer-events-none fixed inset-0 z-[9999]">
				<DragOverlay :drop-animation="null">
					<div v-if="draggedInstance" class="w-full">
						<DragPreview :server="draggedInstance" />
					</div>
				</DragOverlay>
			</div>
		</Teleport>
	</DragDropProvider>
</template>
