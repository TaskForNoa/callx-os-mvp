import type { NextApiRequest, NextApiResponse } from 'next';
import leadsData from '../../data/mock-leads.json';

// In-memory storage for MVP (will be lost on serverless cold start)
let calls: any[] = [];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { customer_id, voice, scenario } = req.body;
    
    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id required' });
    }
    
    const lead = leadsData.find(l => l.customer_id === customer_id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Create call record
    const call = {
      call_id: `call_${Date.now()}`,
      customer_id,
      customer_name: `${lead.first_name} ${lead.last_name}`,
      phone: lead.phone,
      voice: voice || 'Kasia',
      scenario: scenario || 'Paści - Early Bird Junior',
      status: 'completed',
      started_at: new Date().toISOString(),
      duration: 45,
      outcome: 'demo',
      transcript: [
        { speaker: 'agent', text: 'Dzień dobry, dzwonię Kasia z Angloville', timestamp: 0 },
        { speaker: 'agent', text: 'Ta rozmowa jest nagrywana', timestamp: 3 },
        { speaker: 'agent', text: `W ubiegłym sezonie byli Państwo na programie ${lead.past_programs[0]}`, timestamp: 6 },
        { speaker: 'customer', text: 'Tak, pamiętam. Dziecku bardzo się podobało.', timestamp: 10 },
        { speaker: 'agent', text: 'Wspaniale! Mamy teraz Early Bird promocję na Junior 2026.', timestamp: 14 }
      ]
    };
    
    calls.push(call);
    
    res.status(200).json({
      success: true,
      call
    });
    
  } else if (req.method === 'GET') {
    res.status(200).json({
      calls: calls.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
      total: calls.length
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
