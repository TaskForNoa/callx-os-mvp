import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;
  if (!DEEPGRAM_KEY) {
    return res.status(500).json({ error: 'Deepgram API key not configured' });
  }

  try {
    const { audio } = req.body; // base64 encoded audio
    
    if (!audio) {
      return res.status(400).json({ error: 'audio (base64) required' });
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // Call Deepgram API
    const response = await fetch('https://api.deepgram.com/v1/listen?language=pl&model=nova-2&smart_format=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_KEY}`,
        'Content-Type': 'audio/webm',
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram error:', errorText);
      return res.status(500).json({ error: 'Deepgram API error', details: errorText });
    }

    const data = await response.json();
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    res.status(200).json({
      success: true,
      transcript,
      confidence: data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0,
    });

  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Transcription failed', details: error.message });
  }
}
