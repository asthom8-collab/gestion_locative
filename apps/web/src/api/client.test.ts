import { describe, it, expect, vi } from 'vitest'
import { api } from './client'

const reply = (status: number, body?: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status })))

describe('client API', () => {
  it('appelle /api/... et renvoie le JSON', async () => {
    reply(200, [{ id: 'p1' }])
    await expect(api.properties.list()).resolves.toEqual([{ id: 'p1' }])
    expect(fetch).toHaveBeenCalledWith('/api/properties', expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }))
  })

  it('envoie le corps en JSON pour une création', async () => {
    reply(201, { id: 't1' })
    await api.tenants.create({ firstName: 'Jean', lastName: 'Dupont', email: 'j@d.fr' })
    expect(fetch).toHaveBeenCalledWith('/api/tenants', expect.objectContaining({ method: 'POST', body: JSON.stringify({ firstName: 'Jean', lastName: 'Dupont', email: 'j@d.fr' }) }))
  })

  it('renvoie undefined sur un 204', async () => {
    reply(204)
    await expect(api.properties.delete('p1')).resolves.toBeUndefined()
  })

  it('remonte le message d’erreur de l’API', async () => {
    reply(409, { error: 'Ce bien a déjà un bail actif' })
    await expect(api.leases.list()).rejects.toThrow('Ce bien a déjà un bail actif')
  })

  it('gère une réponse d’erreur non JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Bad Gateway', { status: 502 })))
    await expect(api.leases.list()).rejects.toThrow('Erreur réseau')
  })
})
