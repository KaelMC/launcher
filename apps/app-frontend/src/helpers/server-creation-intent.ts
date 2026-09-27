import { ref } from 'vue'

const pending = ref(false)

export function beginServerCreationFromBrowse() {
	pending.value = true
}

export function cancelServerCreationFromBrowse() {
	pending.value = false
}

export function consumeServerCreationFromBrowse(): boolean {
	if (!pending.value) return false

	pending.value = false
	return true
}
