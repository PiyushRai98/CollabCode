import { Router, Request, Response } from 'express';
import * as authService from '../services/auth.service';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      res.status(400).json({ error: 'username, email, and password are required' });
      return;
    }
    const result = await authService.register(username, email, password);
    res.status(201).json(result);
  } catch (err: any) {
    if (err.message?.includes('buffering timed out')) {
      res.status(503).json({ error: 'Database unavailable — please try again later' });
      return;
    }
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes('buffering timed out')) {
      res.status(503).json({ error: 'Database unavailable — please try again later' });
      return;
    }
    res.status(401).json({ error: err.message });
  }
});

export default router;
