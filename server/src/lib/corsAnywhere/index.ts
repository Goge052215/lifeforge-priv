import { lookup } from 'dns/promises'
import net from 'net'
import z from 'zod'

import { createForge } from '@lifeforge/server-utils'

const forge = createForge({}, 'cors_anywhere')

function isPrivateIPv4(host: string) {
  const octets = host.split('.').map(Number)

  if (octets.length !== 4 || octets.some(Number.isNaN)) {
    return false
  }

  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  )
}

function isPrivateIPv6(host: string) {
  const normalized = host.toLowerCase()

  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  )
}

async function isUnsafeTarget(url: string) {
  const parsed = new URL(url)

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return true
  }

  const hostname = parsed.hostname.toLowerCase()

  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    return true
  }

  const directIpFamily = net.isIP(hostname)

  if (directIpFamily === 4) {
    return isPrivateIPv4(hostname)
  }

  if (directIpFamily === 6) {
    return isPrivateIPv6(hostname)
  }

  const resolved = await lookup(hostname, { all: true, verbatim: true }).catch(
    () => []
  )

  if (resolved.length === 0) {
    return true
  }

  return resolved.some(entry => {
    if (entry.family === 4) {
      return isPrivateIPv4(entry.address)
    }

    return isPrivateIPv6(entry.address)
  })
}

const corsAnywhere = forge
  .query({
    description: 'CORS Anywhere - Fetch external URL content',
    input: {
      query: z.object({
        url: z.url()
      })
    },
    output: {
      OK: z.any(),
      BAD_REQUEST: z.string()
    }
  })
  .callback(async ({ query: { url }, core: { logging }, response }) => {
    if (await isUnsafeTarget(url)) {
      logging.error(`Blocked unsafe proxy target: ${url}`)

      return response.badRequest('Blocked unsafe target URL')
    }

    const r = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
      }
    }).catch(() => {
      logging.error(`Failed to fetch URL: ${url}`)
    })

    if (!r) {
      return response.badRequest('Failed to fetch URL')
    }

    if (r.status >= 300 && r.status < 400) {
      return response.badRequest('Redirect responses are not allowed')
    }

    if (!r.ok) {
      return response.badRequest(`Failed to fetch URL: ${url}`)
    }

    if (r.headers.get('content-type')?.includes('application/json')) {
      const json = await r.json()

      return response.ok(json)
    }

    return response.ok(await r.text())
  })

export default corsAnywhere
