import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  status: 'uploaded' | 'transcribing' | 'done' | 'error';
  transcript?: string;
}

export default function Training() {
  const [authed, setAuthed] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [serverMode, setServerMode] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('callx-auth');
      if (saved === '1') setAuthed(true);
      else window.location.href = '/';
      
      // Load from server (preferred) or fallback to localStorage
      fetch('/api/training/list?limit=100')
        .then(r => r.json())
        .then(data => {
          if (data?.transcripts) {
            const mapped: UploadedFile[] = data.transcripts.map((t: any) => ({
              id: t.id,
              name: t.file_name || '(upload)',
              size: 0,
              uploadedAt: t.created_at,
              status: t.transcript_text ? 'done' : 'error',
              transcript: t.transcript_text || 'Brak transkrypcji',
            }));
            setFiles(mapped);
            setServerMode(true);
            return;
          }
          throw new Error('no server data');
        })
        .catch(() => {
          setServerMode(false);
          const savedFiles = localStorage.getItem('callx-training-files');
          if (savedFiles) setFiles(JSON.parse(savedFiles));
        });
    }
  }, []);

  const saveFiles = (newFiles: UploadedFile[]) => {
    setFiles(newFiles);
    // Fallback only when server not available
    if (!serverMode) localStorage.setItem('callx-training-files', JSON.stringify(newFiles));
  };

  const handleFiles = async (fileList: FileList) => {
    setUploading(true);
    const newFiles: UploadedFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.name.match(/\.(mp3|wav|ogg|m4a|webm)$/i)) continue;

      const id = `file_${Date.now()}_${i}`;
      const entry: UploadedFile = {
        id,
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        status: 'uploaded',
      };
      newFiles.push(entry);
    }

    const updated = [...files, ...newFiles];
    saveFiles(updated);
    setUploading(false);

    // Auto-transcribe each file
    for (const f of newFiles) {
      const file = Array.from(fileList).find(fl => fl.name === f.name);
      if (!file) continue;

      // Update status to transcribing
      const idx = updated.findIndex(u => u.id === f.id);
      if (idx !== -1) {
        updated[idx].status = 'transcribing';
        saveFiles([...updated]);
      }

      try {
        // 1) Get signed upload URL (private bucket)
        const s1 = await fetch('/api/training/signed-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, contentType: file.type || undefined }),
        });
        const d1 = await s1.json();
        if (!s1.ok) throw new Error(d1?.details || d1?.error || 'Nie udało się uzyskać signed URL');

        // 2) Upload file directly to Supabase Storage (avoids Vercel size limits)
        const put = await fetch(d1.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!put.ok) {
          const t = await put.text().catch(() => '');
          throw new Error(`Upload do storage nie powiódł się (${put.status}). ${t}`);
        }

        // 3) Ask backend to download->Deepgram->store transcript->delete audio
        const s2 = await fetch('/api/training/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: d1.path, fileName: file.name, contentType: file.type || undefined }),
        });
        const d2 = await s2.json();

        if (idx !== -1) {
          if (!s2.ok) {
            updated[idx].status = 'error';
            updated[idx].transcript = d2?.details || d2?.error || 'Błąd transkrypcji';
            if (d2?.transcriptId) updated[idx].id = d2.transcriptId;
          } else {
            updated[idx].status = d2.transcript ? 'done' : 'error';
            updated[idx].transcript = d2.transcript || 'Brak transkrypcji';
            if (d2.transcriptId) updated[idx].id = d2.transcriptId;
            if (d2.createdAt) updated[idx].uploadedAt = d2.createdAt;
          }
          saveFiles([...updated]);
        }
      } catch (e: any) {
        if (idx !== -1) {
          updated[idx].status = 'error';
          updated[idx].transcript = e?.message ? `Błąd: ${e.message}` : 'Błąd';
          saveFiles([...updated]);
        }
      }
    }
  };

  const removeFile = (id: string) => {
    saveFiles(files.filter(f => f.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  if (!authed) return null;

  return (
    <div className="min-h-screen bg-av-blue-bg">
      <header className="bg-av-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-blue-300 hover:text-white text-sm">← Panel główny</Link>
          <h1 className="text-lg font-bold">Dane treningowe</h1>
          <span className="text-blue-300 text-sm">({files.length} plików)</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* Upload zone */}
        <div
          className={`bg-white rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition ${
            dragOver ? 'border-av-blue bg-av-blue/5' : 'border-gray-200 hover:border-av-blue'
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".mp3,.wav,.ogg,.m4a,.webm"
            multiple
            className="hidden"
            onChange={e => e.target.files && handleFiles(e.target.files)}
          />
          <div className="text-5xl mb-4">{uploading ? '⏳' : '📁'}</div>
          <div className="text-av-navy font-semibold text-lg mb-1">
            {uploading ? 'Przesyłanie...' : 'Przeciągnij pliki audio tutaj'}
          </div>
          <div className="text-gray-400 text-sm">
            lub kliknij aby wybrać • MP3, WAV, OGG, M4A, WebM
          </div>
          <div className="text-gray-300 text-xs mt-2">
            Nagrania rozmów sprzedażowych — system automatycznie je transkrybuje
          </div>
        </div>

        {/* Info */}
        <div className="bg-av-cream rounded-xl p-5 text-sm text-gray-600">
          <div className="font-semibold text-av-navy mb-2">💡 Jak to działa</div>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Załaduj nagrania rozmów sprzedażowych (MP3, WAV itp.)</li>
            <li>System automatycznie transkrybuje audio na tekst (Deepgram)</li>
            <li>Transkrypcje służą jako materiał treningowy dla AI</li>
            <li>Im więcej rozmów, tym lepiej AI uczy się wzorców sprzedażowych</li>
          </ol>
        </div>

        {/* Files list */}
        {files.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Przesłane pliki</h2>
            {files.map(file => (
              <div key={file.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {file.status === 'done' ? '✅' :
                       file.status === 'transcribing' ? '⏳' :
                       file.status === 'error' ? '❌' : '📎'}
                    </span>
                    <div>
                      <div className="font-medium text-av-navy text-sm">{file.name}</div>
                      <div className="text-gray-400 text-xs">
                        {formatSize(file.size)} • {new Date(file.uploadedAt).toLocaleString('pl-PL')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      file.status === 'done' ? 'bg-green-50 text-green-700' :
                      file.status === 'transcribing' ? 'bg-yellow-50 text-yellow-700' :
                      file.status === 'error' ? 'bg-red-50 text-red-700' :
                      'bg-gray-50 text-gray-700'
                    }`}>
                      {file.status === 'done' ? 'Gotowe' :
                       file.status === 'transcribing' ? 'Transkrybuję...' :
                       file.status === 'error' ? 'Błąd' : 'Przesłano'}
                    </span>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="text-gray-300 hover:text-red-500 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Transcript */}
                {file.transcript && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Transkrypcja</div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {file.transcript}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {files.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
            <div className="text-5xl mb-4">🎙️</div>
            <div className="text-gray-400 mb-2">Brak przesłanych plików</div>
            <div className="text-gray-300 text-sm">
              Załaduj nagrania rozmów sprzedażowych aby trenować system
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
