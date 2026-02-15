# CallX OS - MVP Prototype

AI Voice Calling System for Angloville customer conversion.

## 🚀 Quick Start

### Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel
```

Or push to GitHub and import in Vercel dashboard.

## 📱 Features

- **Dashboard** - Overview stats and quick actions
- **Leads Management** - View and search 10 mock leads
- **Call Interface** - Start simulated calls with AI voices
- **Call Logs** - History of all calls with transcripts

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **API:** Next.js API Routes (serverless)
- **Data:** Mock JSON (10 leads)
- **Voice:** ElevenLabs API (future integration)
- **Transcription:** Deepgram API (future integration)

## 📊 Project Structure

```
callx-vercel/
├── pages/
│   ├── api/           # API endpoints
│   │   ├── health.ts
│   │   ├── leads.ts
│   │   ├── leads/[id].ts
│   │   └── calls.ts
│   ├── index.tsx      # Dashboard
│   ├── leads.tsx      # Leads list
│   ├── leads/[id].tsx # Lead detail + call
│   └── calls.tsx      # Call logs
├── data/
│   └── mock-leads.json
├── styles/
│   └── globals.css
└── package.json
```

## 🎯 MVP Scope (Phase 1)

### ✅ Implemented
- Dashboard with stats
- Lead list (10 mock)
- Lead detail page
- Call simulation (mock transcript)
- Call logs
- Responsive UI

### 🚧 Coming Next (Phase 2)
- Real ElevenLabs TTS
- Real Deepgram STT
- Twilio telephony integration
- Call recording storage
- Email automation
- CRM integration

## 📝 Environment Variables

For Phase 2 (voice integration):

```env
ELEVENLABS_API_KEY=your_key_here
DEEPGRAM_API_KEY=your_key_here
```

## 🐛 Known Limitations

- Calls are simulated (no real phone calls yet)
- Data is in-memory (lost on serverless cold start)
- No authentication
- No persistent storage

## 📅 Timeline

- **Phase 1 MVP:** 2026-02-15 (Today!)
- **Phase 2 Voice:** 2026-02-17-18
- **Phase 3 Testing:** 2026-02-23-25 (10 real calls)

## 👤 Developer

**Noa** - AI Assistant  
**Owner:** Michał Kelles-Krauz  
**Company:** Angloville

---

**Last Updated:** 2026-02-15 17:52
