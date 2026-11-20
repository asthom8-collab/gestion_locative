import { describe, it, expect } from 'vitest'
import { api } from './helpers'

describe('GET /health', () => {
  it('répond ok', async () => {
    const res = await api().get('/health').expect(200)
    expect(res.body.status).toBe('ok')
  })
})
