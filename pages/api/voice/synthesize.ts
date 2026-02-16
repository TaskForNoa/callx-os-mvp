import type { NextApiRequest, NextApiResponse } from 'next';

// ── Polish number-to-words for natural TTS pronunciation ──

const ONES = ['', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'];
const TEENS = ['dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
const TENS = ['', 'dziesięć', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
const HUNDREDS = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 'sześćset', 'siedemset', 'osiemset', 'dziewięćset'];

function numberToPolish(n: number): string {
  if (n === 0) return 'zero';
  if (n < 0) return 'minus ' + numberToPolish(-n);

  const parts: string[] = [];

  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    if (thousands === 1) parts.push('tysiąc');
    else if (thousands >= 2 && thousands <= 4) parts.push(numberToPolish(thousands) + ' tysiące');
    else parts.push(numberToPolish(thousands) + ' tysięcy');
    n %= 1000;
  }

  if (n >= 100) {
    parts.push(HUNDREDS[Math.floor(n / 100)]);
    n %= 100;
  }

  if (n >= 10 && n < 20) {
    parts.push(TEENS[n - 10]);
    n = 0;
  } else if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)]);
    n %= 10;
  }

  if (n > 0) {
    parts.push(ONES[n]);
  }

  return parts.filter(Boolean).join(' ');
}

function polishCurrency(n: number): string {
  const words = numberToPolish(n);
  const lastTwo = n % 100;
  const lastOne = n % 10;
  let unit: string;
  if (n === 1) unit = 'złoty';
  else if (lastTwo >= 12 && lastTwo <= 14) unit = 'złotych';
  else if (lastOne >= 2 && lastOne <= 4) unit = 'złote';
  else unit = 'złotych';
  return `${words} ${unit}`;
}

/** Convert a year like 2026 to natural Polish: "dwa tysiące dwudziesty szósty" */
function polishYear(y: number): string {
  if (y < 2000 || y > 2099) return numberToPolish(y);
  const r = y - 2000;
  const ordinalTens: Record<number, string> = {
    20: 'dwudziesty', 30: 'trzydziesty', 40: 'czterdziesty', 50: 'pięćdziesiąty',
  };
  const ordinalOnes: Record<number, string> = {
    0: '', 1: 'pierwszy', 2: 'drugi', 3: 'trzeci', 4: 'czwarty', 5: 'piąty',
    6: 'szósty', 7: 'siódmy', 8: 'ósmy', 9: 'dziewiąty',
  };
  const ordinalTeens: Record<number, string> = {
    10: 'dziesiąty', 11: 'jedenasty', 12: 'dwunasty', 13: 'trzynasty',
    14: 'czternasty', 15: 'piętnasty', 16: 'szesnasty', 17: 'siedemnasty',
    18: 'osiemnasty', 19: 'dziewiętnasty',
  };

  let suffix: string;
  if (r === 0) suffix = 'dwutysięczny';
  else if (r >= 10 && r < 20) suffix = ordinalTeens[r] || numberToPolish(r);
  else {
    const ten = Math.floor(r / 10) * 10;
    const one = r % 10;
    if (one === 0) suffix = ordinalTens[ten] || numberToPolish(r);
    else suffix = (ten > 0 ? ordinalTens[ten] + ' ' : '') + (ordinalOnes[one] || numberToPolish(one));
  }
  return 'dwa tysiące ' + suffix;
}

/** Prepare text for TTS: replace numbers, prices, years with Polish words */
function prepareForTTS(text: string): string {
  // Replace prices: "4 449 zł" or "4449 zł"
  text = text.replace(/(\d[\d\s]*\d)\s*zł/g, (_, num) => {
    const n = parseInt(num.replace(/\s/g, ''), 10);
    if (isNaN(n)) return _;
    return polishCurrency(n);
  });
  // Single digit + zł
  text = text.replace(/(\d)\s*zł/g, (_, num) => {
    const n = parseInt(num, 10);
    return polishCurrency(n);
  });

  // Replace standalone years (2020-2039)
  text = text.replace(/\b(20[2-3]\d)\b/g, (_, y) => polishYear(parseInt(y, 10)));

  // Replace remaining standalone numbers (up to 999 999)
  text = text.replace(/\b(\d{1,6})\b/g, (_, num) => {
    const n = parseInt(num, 10);
    if (isNaN(n) || n > 999999) return _;
    return numberToPolish(n);
  });

  return text;
}

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
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': ELEVENLABS_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: prepareForTTS(text),
          model_id: 'eleven_turbo_v2_5',  // Turbo = much lower latency (~300ms vs ~1.5s)
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.85,
            style: 0.15,                 // Less style = faster generation
            use_speaker_boost: false,    // Disable for speed
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
