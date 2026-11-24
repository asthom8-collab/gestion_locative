import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { existsSync } from 'node:fs'
import { api, resetDb, prisma, createProperty, createTenant, createLease, createUser } from './helpers'
import { storagePath } from '../src/lib/storage'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

const PDF = Buffer.from('%PDF-1.4\n%test\n')
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

async function setup() {
  const property = await createProperty()
  const tenant = await createTenant()
  const lease = await createLease(property.id, tenant.id)
  return { property, lease }
}

const upload = (query: string, body: Buffer, type = 'application/pdf', cookie?: string) =>
  (cookie ? api(cookie) : api()).post(`/api/documents?${query}`).set('Content-Type', type).send(body)

describe('/api/documents', () => {
  it('envoie un document de bail, le liste, le sert puis le supprime avec son fichier', async () => {
    const { property, lease } = await setup()
    const res = await upload(`leaseId=${lease.id}&category=LEASE_CONTRACT&fileName=${encodeURIComponent('Bail signé.pdf')}`, PDF).expect(201)
    expect(res.body).toMatchObject({ label: 'Bail signé.pdf', fileName: 'Bail signé.pdf', mimeType: 'application/pdf', size: PDF.length, category: 'LEASE_CONTRACT' })
    expect(res.body.lease.property.name).toBe(property.name)
    expect(res.body).not.toHaveProperty('filePath')
    const doc = await prisma.document.findUniqueOrThrow({ where: { id: res.body.id } })
    expect(existsSync(storagePath(doc.filePath))).toBe(true)

    // Liste par bail, et par bien (documents du bien et de ses baux)
    expect((await api().get(`/api/documents?leaseId=${lease.id}`).expect(200)).body).toHaveLength(1)
    expect((await api().get(`/api/documents?propertyId=${property.id}`).expect(200)).body).toHaveLength(1)

    const file = await api().get(`/api/documents/${doc.id}/file`).expect(200)
    expect(file.headers['content-type']).toBe('application/pdf')
    expect(file.headers['content-disposition']).toContain('inline')
    expect(file.headers['content-disposition']).toContain("filename*=UTF-8''Bail%20sign%C3%A9.pdf")
    expect(file.headers['x-content-type-options']).toBe('nosniff')
    expect((await api().get(`/api/documents/${doc.id}/file?download`).expect(200)).headers['content-disposition']).toMatch(/^attachment/)

    await api().delete(`/api/documents/${doc.id}`).expect(204)
    expect(existsSync(storagePath(doc.filePath))).toBe(false)
    expect((await api().get('/api/documents').expect(200)).body).toEqual([])
  })

  it('rattache un document à un bien, le renomme et change son type', async () => {
    const { property } = await setup()
    const { body } = await upload(`propertyId=${property.id}&category=OTHER&fileName=scan.png&label=DPE`, PNG, 'image/png').expect(201)
    expect(body).toMatchObject({ label: 'DPE', propertyId: property.id, leaseId: null })
    const updated = await api().patch(`/api/documents/${body.id}`).send({ label: 'DPE 2026', category: 'DIAGNOSTIC' }).expect(200)
    expect(updated.body).toMatchObject({ label: 'DPE 2026', category: 'DIAGNOSTIC' })
    expect((await api().get('/api/documents?category=DIAGNOSTIC').expect(200)).body).toHaveLength(1)
  })

  it('exige exactement un rattachement, un type accepté et un contenu conforme', async () => {
    const { property, lease } = await setup()
    await upload('category=OTHER&fileName=a.pdf', PDF).expect(400)
    await upload(`leaseId=${lease.id}&propertyId=${property.id}&category=OTHER&fileName=a.pdf`, PDF).expect(400)
    await upload(`leaseId=${lease.id}&category=INCONNUE&fileName=a.pdf`, PDF).expect(400)
    await upload(`leaseId=${lease.id}&category=OTHER&fileName=a.html`, Buffer.from('<script>'), 'text/html').expect(415)
    // Un faux PDF (contenu HTML annoncé comme PDF) est refusé
    await upload(`leaseId=${lease.id}&category=OTHER&fileName=a.pdf`, Buffer.from('<html></html>')).expect(400)
    await upload(`leaseId=${lease.id}&category=OTHER&fileName=a.pdf`, Buffer.alloc(0)).expect(400)
    expect(await prisma.document.count()).toBe(0)
  })

  it('refuse un fichier de plus de 15 Mo (413)', async () => {
    const { lease } = await setup()
    const big = Buffer.concat([PDF, Buffer.alloc(15 * 1024 * 1024)])
    const res = await upload(`leaseId=${lease.id}&category=OTHER&fileName=gros.pdf`, big).expect(413)
    expect(res.body.error).toMatch(/trop lourd/)
  })

  it("cache les documents d'un autre propriétaire (404)", async () => {
    const { property, lease } = await setup()
    const { body } = await upload(`leaseId=${lease.id}&category=OTHER&fileName=a.pdf`, PDF).expect(201)
    const claire = await createUser()
    expect((await api(claire.cookie).get('/api/documents').expect(200)).body).toEqual([])
    await api(claire.cookie).get(`/api/documents/${body.id}/file`).expect(404)
    await api(claire.cookie).delete(`/api/documents/${body.id}`).expect(404)
    await upload(`propertyId=${property.id}&category=OTHER&fileName=b.pdf`, PDF, 'application/pdf', claire.cookie).expect(404)
  })

  it('supprime les documents du bien avec le bien', async () => {
    const property = await createProperty()
    const { body } = await upload(`propertyId=${property.id}&category=PROPERTY_TAX&fileName=tf.pdf`, PDF).expect(201)
    const doc = await prisma.document.findUniqueOrThrow({ where: { id: body.id } })
    await api().delete(`/api/properties/${property.id}`).expect(204)
    expect(await prisma.document.count()).toBe(0)
    expect(existsSync(storagePath(doc.filePath))).toBe(false)
  })
})
