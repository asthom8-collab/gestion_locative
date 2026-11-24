import { randomUUID } from 'node:crypto'
import { DocumentCategory } from '@prisma/client'
import { AppError } from '../middlewares/errorHandler'
import { removeFile, saveFile, storagePath } from '../lib/storage'
import { DocumentFilter, DocumentWithLinks, documentsRepository } from '../repositories/documents'

export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024

const PDF = [0x25, 0x50, 0x44, 0x46] // %PDF
const ZIP = [0x50, 0x4b, 0x03, 0x04] // docx, xlsx, odt, ods
const OLE = [0xd0, 0xcf, 0x11, 0xe0] // doc, xls

/**
 * Types acceptés : extension enregistrée, signature binaire attendue, affichage dans le navigateur.
 * La signature est vérifiée : le type annoncé par le navigateur ne suffit pas.
 */
const TYPES: Record<string, { ext: string; inline: boolean; matches: (b: Buffer) => boolean }> = {
  'application/pdf': { ext: 'pdf', inline: true, matches: (b) => starts(b, PDF) },
  'image/jpeg': { ext: 'jpg', inline: true, matches: (b) => starts(b, [0xff, 0xd8, 0xff]) },
  'image/png': { ext: 'png', inline: true, matches: (b) => starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  'image/webp': { ext: 'webp', inline: true, matches: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  'image/heic': { ext: 'heic', inline: false, matches: (b) => b.subarray(4, 8).toString('latin1') === 'ftyp' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', inline: false, matches: (b) => starts(b, ZIP) },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', inline: false, matches: (b) => starts(b, ZIP) },
  'application/vnd.oasis.opendocument.text': { ext: 'odt', inline: false, matches: (b) => starts(b, ZIP) },
  'application/vnd.oasis.opendocument.spreadsheet': { ext: 'ods', inline: false, matches: (b) => starts(b, ZIP) },
  'application/msword': { ext: 'doc', inline: false, matches: (b) => starts(b, OLE) },
  'application/vnd.ms-excel': { ext: 'xls', inline: false, matches: (b) => starts(b, OLE) },
}

function starts(b: Buffer, sig: number[]) {
  return b.length >= sig.length && sig.every((v, i) => b[i] === v)
}

/** Nom de fichier sans chemin ni caractères de contrôle, 200 caractères au plus. */
const cleanName = (name: string) => name.replace(/^.*[\\/]/, '').replace(/[\u0000-\u001f\u007f"]/g, '').trim().slice(0, 200)

/** Le chemin sur le disque reste côté serveur. */
const present = ({ filePath: _filePath, ...doc }: DocumentWithLinks) => doc

async function getOrThrow(id: string, userId: string) {
  const doc = await documentsRepository.findById(id, userId)
  if (!doc) throw new AppError(404, 'Document introuvable')
  return doc
}

export type UploadInput = {
  userId: string
  leaseId?: string
  propertyId?: string
  category: DocumentCategory
  label?: string
  fileName: string
  mimeType: string
  content: Buffer
}

export const documentsService = {
  async list(filter: DocumentFilter) {
    return (await documentsRepository.findMany(filter)).map(present)
  },

  async upload({ userId, leaseId, propertyId, category, label, fileName, mimeType, content }: UploadInput) {
    if (!leaseId === !propertyId) throw new AppError(400, 'Rattachez le document à un bail ou à un bien (l’un des deux)')
    if (leaseId && !(await documentsRepository.leaseExists(leaseId, userId))) throw new AppError(404, 'Bail introuvable')
    if (propertyId && !(await documentsRepository.propertyExists(propertyId, userId))) throw new AppError(404, 'Bien introuvable')
    if (!content.length) throw new AppError(400, 'Fichier vide')
    if (content.length > MAX_DOCUMENT_BYTES) throw new AppError(413, 'Fichier trop lourd (15 Mo au plus)')
    const type = TYPES[mimeType]
    if (!type) throw new AppError(415, 'Type de fichier non accepté (PDF, image, Word, Excel ou OpenDocument)')
    if (!type.matches(content)) throw new AppError(400, 'Le contenu du fichier ne correspond pas à son type')

    const name = cleanName(fileName) || `document.${type.ext}`
    const filePath = `documents/${randomUUID()}.${type.ext}`
    await saveFile(filePath, content)
    try {
      return present(await documentsRepository.create({
        label: label?.trim() || name, fileName: name, filePath, mimeType, size: content.length, category,
        leaseId: leaseId ?? null, propertyId: propertyId ?? null,
      }))
    } catch (err) {
      await removeFile(filePath)
      throw err
    }
  },

  async update(id: string, userId: string, data: { label?: string; category?: DocumentCategory }) {
    await getOrThrow(id, userId)
    return present(await documentsRepository.update(id, data))
  },

  /** Fichier à envoyer : chemin sur le disque, type, nom et mode d'affichage. */
  async file(id: string, userId: string) {
    const doc = await getOrThrow(id, userId)
    return { path: storagePath(doc.filePath), mimeType: doc.mimeType, fileName: doc.fileName, inline: TYPES[doc.mimeType]?.inline ?? false }
  },

  async remove(id: string, userId: string) {
    const doc = await getOrThrow(id, userId)
    await documentsRepository.delete(id)
    await removeFile(doc.filePath)
  },

  /** Supprime les documents rattachés à un bien (appelé à la suppression du bien). */
  async removeForProperty(propertyId: string) {
    const docs = await documentsRepository.findByProperty(propertyId)
    await documentsRepository.deleteByProperty(propertyId)
    await Promise.all(docs.map((d) => removeFile(d.filePath)))
  },
}
