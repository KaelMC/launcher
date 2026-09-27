export type ServerStatus = 'stopped' | 'running'

export type FakeServer = {
	id: string
	name: string
	icon_url?: string | null
	status: ServerStatus
	group_ids: string[]
	created: string
	modified: string
	last_played?: string
}
