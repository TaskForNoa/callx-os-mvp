import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY || process.env.TASKFORNOA_ELEVENLABS_KEY;
  if (!ELEVENLABS_KEY) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' });
  }

  try {
    const { text, voice } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text required' });
    }

    // Voices optimized for natural Polish speech
    // Sarah = warm professional female, Jessica = playful warm female
    // Roger = casual male, Eric = smooth trustworthy male
    const VOICE_IDS: Record<string, string> = {
      'Karolina': 'JPqeLnDkrDAHja5bUoLU', // Karolina (Sales Angloville) — cloned
      'Kasia': 'EXAVITQu4vr4xnSDxMaL',    // Sarah - Mature, Reassuring
      'Marek': 'cjVigY5qzO86Huf0OWal',    // Eric - Smooth, Trustworthy
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
          // Reduce latency between user turn end → agent speaks
          optimize_streaming_latency: 3,
          voice_settings: {
            stability: 0.35,          // Lower = more expressive, natural
            similarity_boost: 0.85,   // Higher = more consistent voice
            style: 0.3,              // Some style for naturalness
            use_speaker_boost: true,  // Enhance clarity
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs error:', errorText);
      return res.status(500).json({ error: 'ElevenLabs error', details: errorText });
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
