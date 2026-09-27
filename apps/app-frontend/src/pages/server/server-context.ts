import { createContext } from '@modrinth/ui'
import type { ComputedRef } from 'vue'

import type { FakeServer } from '@/helpers/types-servers'

export interface ServerPageContext {
	readonly serverId: ComputedRef<string>
	readonly server: ComputedRef<FakeServer | undefined>
	readonly playing: ComputedRef<boolean>
	toggleStatus: () => void
	openSettings: () => void
}

export const [injectServerPage, provideServerPage] =
	createContext<ServerPageContext>('ServerPage')
