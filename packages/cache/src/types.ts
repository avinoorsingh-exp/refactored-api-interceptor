export interface CacheOptions {
	redisUrl?: string
	redisPassword?: string
	redisTls?: boolean
	keyPrefix?: string
	defaultTTL?: number
	logger?: {
		debug: (message: string, meta?: unknown) => void
		info: (message: string, meta?: unknown) => void
		warn: (message: string, meta?: unknown) => void
		error: (message: string, meta?: unknown) => void
	}
	onError?: (error: Error) => void
}

export interface CacheStats {
	keys: number
	memory: string
	uptime: number
	connected: boolean
}
