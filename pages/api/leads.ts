import type { NextApiRequest, NextApiResponse } from 'next';
import leadsData from '../../data/mock-leads.json';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    res.status(200).json({
      leads: leadsData,
      total: leadsData.length
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
