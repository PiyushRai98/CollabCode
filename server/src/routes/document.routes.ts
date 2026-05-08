import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import * as docService from '../services/document.service';

const router = Router();

router.use(authenticate);

router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, language } = req.body;
    const doc = await docService.createDocument(req.user!.id, title || 'Untitled', language || 'javascript');
    res.status(201).json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/mine', async (req: Request, res: Response) => {
  try {
    const docs = await docService.getUserDocuments(req.user!.id);
    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const doc = await docService.getDocument(req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { title, language } = req.body;
    const doc = await docService.updateDocumentMeta(req.params.id, { title, language });
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/versions', async (req: Request, res: Response) => {
  try {
    const versions = await docService.getVersionHistory(req.params.id);
    res.json(versions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/versions', async (req: Request, res: Response) => {
  try {
    const state = await docService.loadYjsState(req.params.id);
    if (!state) {
      res.status(404).json({ error: 'No document state to snapshot' });
      return;
    }
    const version = await docService.createVersionSnapshot(
      req.params.id,
      req.user!.id,
      state,
      req.body.label
    );
    res.status(201).json(version);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/restore/:version', async (req: Request, res: Response) => {
  try {
    const version = parseInt(req.params.version, 10);
    const snapshot = await docService.restoreVersion(req.params.id, version);
    res.json(snapshot);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
