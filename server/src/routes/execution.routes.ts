import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { executeCode } from '../services/execution.service';

const router = Router();

router.use(authenticate);

router.post('/', async (req: Request, res: Response) => {
  try {
    const { code, language, stdin } = req.body;
    if (!code || !language) {
      res.status(400).json({ error: 'code and language are required' });
      return;
    }
    if (!['javascript', 'python', 'cpp'].includes(language)) {
      res.status(400).json({ error: 'Supported languages: javascript, python, cpp' });
      return;
    }
    const result = await executeCode({ code, language, stdin });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
