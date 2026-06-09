import path from 'path'

export const PORT = process.env.PORT || 3636

const currentWorkingDirectory = process.cwd()

export const ROOT_DIR = `${path.basename(currentWorkingDirectory) === 'server' ? path.resolve(currentWorkingDirectory, '..') : currentWorkingDirectory}/`

export const MEDIA_DIR = process.env.VERCEL ? '/tmp/medium' : 'medium'
