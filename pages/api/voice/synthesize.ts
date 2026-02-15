import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVENLABS_KEY) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' });
  }

  try {
    const { text, voice } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text required' });
    }

    // ElevenLabs voice IDs - using multilingual voices for Polish
    const VOICE_IDS: Record<string, string> = {
      'Kasia': '21m00Tcm4TlvDq8ikWAM',  // Rachel - multilingual
      'Marek': 'ErXwobaYiN019PkySvjV',   // Antoni - multilingual
    };

    const voiceId = VOICE_IDS[voice || 'Kasia'] || VOICE_IDS['Kasia'];

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': ELEVENLABS_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs error:', errorText);
      return res.status(500).json({ error: 'ElevenLabs API error', details: errorText });
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    res.status(200).json({
      success: true,
      audio: base64Audio,
      contentType: 'audio/mpeg',
      size: audioBuffer.byteLength,
    });

  } catch (error: any) {
    console.error('Synthesis error:', error);
    res.status(500).json({ error: 'Synthesis failed', details: error.message });
  }
}
