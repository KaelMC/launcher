<script setup lang="ts">
import { defineMessages, injectNotificationManager, useVIntl } from '@modrinth/ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { get_default_user, users } from '@/helpers/auth'

const { formatMessage } = useVIntl()
const { handleError } = injectNotificationManager()

const messages = defineMessages({
	goodMorning: {
		id: 'app.home.greeting.morning',
		defaultMessage: 'Good morning{name, select, none {} other {, {name}}}',
	},
	goodAfternoon: {
		id: 'app.home.greeting.afternoon',
		defaultMessage: 'Good afternoon{name, select, none {} other {, {name}}}',
	},
	goodEvening: {
		id: 'app.home.greeting.evening',
		defaultMessage: 'Good evening{name, select, none {} other {, {name}}}',
	},
	goToSleep: {
		id: 'app.home.greeting.go-to-sleep',
		defaultMessage: 'go to sleep bleh',
	},
})

type MinecraftCredential = {
	profile: { id: string; name: string }
}

const accounts = ref<MinecraftCredential[]>([])
const defaultUser = ref<string | undefined>()

const selectedAccount = computed(() =>
	accounts.value.find((account) => account.profile.id === defaultUser.value),
)
const username = computed(() => selectedAccount.value?.profile.name)

const now = ref(new Date())
let intervalId: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
	defaultUser.value = await get_default_user().catch(handleError)
	const userList = await users().catch(handleError)
	accounts.value = Array.isArray(userList) ? [...userList] : []

	intervalId = setInterval(() => {
		now.value = new Date()
	}, 1000)
})

onUnmounted(() => {
	if (intervalId !== undefined) {
		clearInterval(intervalId)
	}
})

const greeting = computed(() => {
	const hours = now.value.getHours()
	const minutes = now.value.getMinutes()
	const nameParam = { name: username.value ?? 'none' }

	if (hours === 3 && minutes === 14) {
		return formatMessage(messages.goToSleep)
	}

	const isMorning = (hours === 3 && minutes >= 15) || (hours > 3 && hours < 12)
	if (isMorning) {
		return formatMessage(messages.goodMorning, nameParam)
	}

	const isAfternoon = hours >= 12 && hours < 18
	if (isAfternoon) {
		return formatMessage(messages.goodAfternoon, nameParam)
	}

	return formatMessage(messages.goodEvening, nameParam)
})
</script>

<template>
	<h1 class="m-0 text-4xl font-bold text-contrast">{{ greeting }}</h1>
</template>
