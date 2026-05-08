import * as Y from 'yjs';
import { DocumentModel } from '../models/Document';
import { Version } from '../models/Version';
import { logger } from '../utils/logger';

export async function createDocument(ownerId: string, title: string, language: string) {
  const doc = await DocumentModel.create({ title, language, ownerId });
  return doc;
}

export async function getDocument(documentId: string) {
  return DocumentModel.findById(documentId);
}

export async function getUserDocuments(userId: string) {
  return DocumentModel.find({
    $or: [{ ownerId: userId }, { collaborators: userId }],
  }).sort({ updatedAt: -1 });
}

export async function persistYjsState(documentId: string, state: Uint8Array) {
  await DocumentModel.findByIdAndUpdate(documentId, {
    yjsState: Buffer.from(state),
    updatedAt: new Date(),
  });
}

export async function loadYjsState(documentId: string): Promise<Uint8Array | null> {
  const doc = await DocumentModel.findById(documentId);
  if (!doc || !doc.yjsState || doc.yjsState.length === 0) return null;
  return new Uint8Array(doc.yjsState);
}

export async function createVersionSnapshot(
  documentId: string,
  userId: string,
  yjsState: Uint8Array,
  label?: string
) {
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, yjsState);
  const content = ydoc.getText('monaco').toJSON();
  ydoc.destroy();

  const lastVersion = await Version.findOne({ documentId }).sort({ version: -1 });
  const version = (lastVersion?.version ?? 0) + 1;

  return Version.create({
    documentId,
    version,
    yjsState: Buffer.from(yjsState),
    content,
    createdBy: userId,
    label,
  });
}

export async function getVersionHistory(documentId: string) {
  return Version.find({ documentId })
    .sort({ version: -1 })
    .limit(50)
    .select('version label createdBy createdAt');
}

export async function restoreVersion(documentId: string, version: number) {
  const snapshot = await Version.findOne({ documentId, version });
  if (!snapshot) throw new Error('Version not found');

  await DocumentModel.findByIdAndUpdate(documentId, {
    yjsState: snapshot.yjsState,
  });

  logger.info({ documentId, version }, 'Document restored to version');
  return snapshot;
}

export async function updateDocumentMeta(
  documentId: string,
  updates: { title?: string; language?: string }
) {
  return DocumentModel.findByIdAndUpdate(documentId, updates, { new: true });
}
