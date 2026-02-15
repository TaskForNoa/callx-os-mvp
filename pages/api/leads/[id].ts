import type { NextApiRequest, NextApiResponse } from 'next';
import leadsData from '../../../data/mock-leads.json';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (req.method === 'GET') {
    const lead = leadsData.find(l => l.customer_id === id);
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.status(200).json({
      lead,
      callHistory: [] // Will implement call storage later
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
