import type { NextApiRequest, NextApiResponse } from 'next';
import { scenarios } from '../../lib/scenarioFlow';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.status(200).json({ scenarios });
}
