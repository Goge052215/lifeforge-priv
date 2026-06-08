const DEFAULT_CORS_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'http://localhost'
]

const extraOrigins = [
  process.env.CLIENT_ORIGIN,
  ...(process.env.ADDITIONAL_CORS_ORIGINS?.split(',') ?? [])
]
  .map(origin => origin?.trim())
  .filter((origin): origin is string => Boolean(origin))

export const CORS_ALLOWED_ORIGINS = [
  ...new Set([...DEFAULT_CORS_ALLOWED_ORIGINS, ...extraOrigins])
]
