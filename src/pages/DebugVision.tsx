import { useState, useRef } from 'react';
import {
  collection, addDoc, getDocs, query, orderBy,
  limit, serverTimestamp, updateDoc, doc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import toast from 'react-hot-toast';
import {
  Upload, Link, Play, RefreshCw, CheckCircle, XCircle,
  AlertTriangle, Eye, Database, TrendingUp, Tag, Trash2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Outcome = 'win' | 'loss' | 'draw' | 'unknown';
type LabelStatus = 'correct' | 'incorrect' | 'partial';

interface OcrResult {
  success: boolean;
  outcome?: Outcome;
  detectedScore?: string;
  score?: string;
  winnerName?: string;
  loserName?: string;
  confidence?: number;
  fullText?: string;
  error?: string;
  rawAnnotations?: any[];
  processingMs?: number;
  winner?: string;
  loser?: string;
  detectedPlayers?: string[];
  winnerCrowns?: number;
  loserCrowns?: number;
  details?: string;
}

interface TestEntry {
  id: string;
  imageUrl: string;
  game: string;
  result: OcrResult;
  trueOutcome?: Outcome;
  trueScore?: string;
  labelStatus?: LabelStatus;
  notes?: string;
  createdAt: any;
}

const GAMES = [
  'Call of Duty Mobile', 'Free Fire', 'eFootball Mobile',
  'Clash Royale', 'Brawl Stars', 'Roblox', 'Autre',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const confidenceColor = (c: number) => {
  if (c >= 0.8) return 'text-green-600 bg-green-50 border-green-200';
  if (c >= 0.6) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-red-600 bg-red-50 border-red-200';
};

const outcomeLabel: Record<Outcome, { label: string; color: string }> = {
  win:     { label: 'Victoire',  color: 'text-green-700 bg-green-100' },
  loss:    { label: 'Défaite',   color: 'text-red-700 bg-red-100' },
  draw:    { label: 'Nul',       color: 'text-blue-700 bg-blue-100' },
  unknown: { label: 'Inconnu',   color: 'text-gray-600 bg-gray-100' },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DebugVision() {
  // Input
  const [mode, setMode]         = useState<'upload' | 'url'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview]   = useState('');
  const [game, setGame]         = useState(GAMES[0]);
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');

  // Analysis
  const [running, setRunning]   = useState(false);
  const [result, setResult]     = useState<OcrResult | null>(null);

  // Labeling
  const [trueOutcome, setTrueOutcome] = useState<Outcome | ''>('');
  const [trueScore, setTrueScore]     = useState('');
  const [notes, setNotes]             = useState('');
  const [saving, setSaving]           = useState(false);

  // History
  const [history, setHistory]         = useState<TestEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Stats
  const [stats, setStats] = useState<{
    total: number; correct: number; incorrect: number; partial: number;
    byGame: Record<string, { total: number; correct: number }>;
  } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Fichier image requis'); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const runAnalysis = async () => {
    setRunning(true);
    setResult(null);
    const start = Date.now();

    try {
      let finalUrl = imageUrl;

      // Upload si fichier local
      if (mode === 'upload' && imageFile) {
        const storageRef = ref(storage, `debug_vision/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        finalUrl = await getDownloadURL(storageRef);
        setImageUrl(finalUrl);
      }

      if (!finalUrl) { toast.error('Aucune image fournie'); setRunning(false); return; }

      // Appel direct à la Cloud Function Firebase (Serverless)
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../firebase');
      const analyzeOcr = httpsCallable(functions, 'analyzeMatchOcr');

      const response = await analyzeOcr({
        imageUrl: finalUrl,
        game,
        player1Name: player1Name || undefined,
        player2Name: player2Name || undefined,
      });

      const data = response.data as any;
      const processingMs = Date.now() - start;

      setResult({ ...data, processingMs });

      if (data.success) {
        toast.success('Analyse terminée');
      } else {
        toast.error(data.error ?? 'Erreur d\'analyse');
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message, processingMs: Date.now() - start });
      toast.error('Erreur d\'analyse (Cloud Function)');
    } finally {
      setRunning(false);
    }
  };

  const saveLabel = async () => {
    if (!result || !imageUrl) { toast.error('Lance d\'abord une analyse'); return; }
    setSaving(true);
    try {
      const labelStatus: LabelStatus =
        trueOutcome === result.outcome && (!trueScore || trueScore === result.detectedScore)
          ? 'correct'
          : trueOutcome && result.outcome && trueOutcome !== result.outcome
            ? 'incorrect'
            : 'partial';

      await addDoc(collection(db, 'vision_training_data'), {
        imageUrl,
        game,
        result: {
          outcome: result.outcome ?? 'unknown',
          detectedScore: result.detectedScore ?? 'N/A',
          confidence: result.confidence ?? 0,
          fullText: (result.fullText ?? '').substring(0, 1000),
        },
        trueOutcome: trueOutcome || null,
        trueScore: trueScore || null,
        labelStatus,
        notes: notes || null,
        processingMs: result.processingMs ?? 0,
        createdAt: serverTimestamp(),
      });

      toast.success(`Exemple sauvegardé — label: ${labelStatus}`);
      setTrueOutcome('');
      setTrueScore('');
      setNotes('');
    } catch (err) {
      toast.error('Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'vision_training_data'), orderBy('createdAt', 'desc'), limit(50))
      );
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as TestEntry));
      setHistory(entries);

      // Calcul stats
      const byGame: Record<string, { total: number; correct: number }> = {};
      let correct = 0, incorrect = 0, partial = 0;
      entries.forEach(e => {
        if (e.labelStatus === 'correct') correct++;
        else if (e.labelStatus === 'incorrect') incorrect++;
        else if (e.labelStatus === 'partial') partial++;
        if (e.game) {
          if (!byGame[e.game]) byGame[e.game] = { total: 0, correct: 0 };
          byGame[e.game].total++;
          if (e.labelStatus === 'correct') byGame[e.game].correct++;
        }
      });
      setStats({ total: entries.length, correct, incorrect, partial, byGame });
      setShowHistory(true);
    } catch (err) {
      toast.error('Erreur de chargement');
    } finally {
      setHistoryLoading(false);
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await updateDoc(doc(db, 'vision_training_data', id), { deleted: true });
      setHistory(h => h.filter(e => e.id !== id));
      toast.success('Entrée supprimée');
    } catch { toast.error('Erreur'); }
  };

  const reset = () => {
    setImageFile(null);
    setImageUrl('');
    setPreview('');
    setResult(null);
    setTrueOutcome('');
    setTrueScore('');
    setNotes('');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Input panel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Eye className="w-5 h-5 text-violet-600" />
            Tester Gemini OCR
          </h2>
          <div className="flex gap-2">
            <button onClick={() => setMode('upload')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${mode === 'upload' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <Upload className="w-4 h-4 inline mr-1" />Upload
            </button>
            <button onClick={() => setMode('url')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${mode === 'url' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <Link className="w-4 h-4 inline mr-1" />URL
            </button>
          </div>
        </div>

        {/* Game selector */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Jeu</label>
          <select value={game} onChange={e => setGame(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-300 outline-none">
            {GAMES.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>

        {/* Player names (for Clash Royale) */}
        {game === 'Clash Royale' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Joueur 1</label>
              <input value={player1Name} onChange={e => setPlayer1Name(e.target.value)}
                placeholder="ex: PHalek"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-300 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Joueur 2</label>
              <input value={player2Name} onChange={e => setPlayer2Name(e.target.value)}
                placeholder="ex: Kirito"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-300 outline-none" />
            </div>
          </div>
        )}

        {/* Upload zone */}
        {mode === 'upload' && (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-violet-400 transition-colors"
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            {preview ? (
              <img src={preview} alt="preview" className="max-h-48 mx-auto rounded-lg object-contain" />
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-sm text-gray-500">Glisse une image ou clique pour sélectionner</p>
                <p className="text-xs text-gray-400">Gemini analysera l'image automatiquement</p>
              </div>
            )}
          </div>
        )}

        {/* URL input */}
        {mode === 'url' && (
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">URL de l'image</label>
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
              placeholder="https://firebasestorage.googleapis.com/..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-300 outline-none" />
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={runAnalysis} disabled={running || (!imageFile && !imageUrl)}
            className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50">
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? 'Analyse en cours...' : 'Lancer l\'analyse'}
          </button>
          <button onClick={reset} className="px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Result panel */}
      {result && (
        <div className={`bg-white rounded-2xl border shadow-sm p-6 space-y-4 ${result.success ? 'border-green-200' : 'border-red-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              {result.success ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
              Résultat de l'analyse
            </h2>
            {result.processingMs && (
              <span className="text-xs text-gray-400 font-mono">{result.processingMs}ms</span>
            )}
          </div>

          {result.success ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">Résultat détecté</p>
                  {result.outcome && (
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${outcomeLabel[result.outcome].color}`}>
                      {outcomeLabel[result.outcome].label}
                    </span>
                  )}
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">Score détecté</p>
                  <p className="font-mono font-bold text-lg text-primary">{result.score || result.detectedScore || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">Équipes détectées</p>
                  <p className="text-sm font-bold truncate">
                    {result.winnerName || 'N/A'} 
                    <span className="mx-1 text-gray-300">vs</span> 
                    {result.loserName || 'N/A'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">Confiance</p>
                  {result.confidence !== undefined && (
                    <span className={`px-3 py-1 rounded-full text-sm font-bold border ${confidenceColor(result.confidence)}`}>
                      {!isNaN(result.confidence) ? Math.round(result.confidence * 100) : 0}%
                    </span>
                  )}
                </div>
              </div>

              {/* Winner/Loser analysis (Clash Royale) */}
              {(result.winner || result.loser || result.detectedPlayers) && (
                <div className="bg-gradient-to-r from-green-50 to-red-50 rounded-xl p-4 border border-green-200">
                  <p className="text-xs text-gray-500 font-bold uppercase mb-2">🎮 Analyse Clash Royale</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-gray-400 font-semibold mb-1">Gagnant</p>
                      <p className="font-bold text-green-700">{result.winner || '—'}</p>
                      {result.winnerCrowns !== undefined && result.winnerCrowns !== null && (
                        <p className="text-xs text-green-600 mt-1">👑 {result.winnerCrowns} couronne{result.winnerCrowns > 1 ? 's' : ''}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-semibold mb-1">Perdant</p>
                      <p className="font-bold text-red-700">{result.loser || '—'}</p>
                      {result.loserCrowns !== undefined && result.loserCrowns !== null && (
                        <p className="text-xs text-red-600 mt-1">👑 {result.loserCrowns} couronne{result.loserCrowns > 1 ? 's' : ''}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-semibold mb-1">Joueurs détectés</p>
                      <p className="text-sm text-gray-700">{result.detectedPlayers?.join(', ') || '—'}</p>
                    </div>
                  </div>
                  {result.details && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <p className="text-xs text-gray-400 font-semibold mb-1">Détails de l'analyse</p>
                      <p className="text-xs text-gray-600 italic">{result.details}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="bg-red-50 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-700 text-sm">Erreur d'analyse</p>
                <p className="text-red-600 text-xs mt-1 font-mono break-all">{result.error}</p>
                {result.error?.includes('GEMINI_API_KEY') && (
                  <a href="https://makersuite.google.com/app/apikey"
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-violet-600 hover:underline">
                    Obtenir une clé Gemini API →
                  </a>
                )}
              </div>
            </div>
          )}

          {result.fullText && (
            <div className="bg-slate-900 rounded-2xl p-6 space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sortie Brute Gemini (Debug)</p>
                <div className="flex gap-1">
                   <div className="w-2 h-2 rounded-full bg-red-500"></div>
                   <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                   <div className="w-2 h-2 rounded-full bg-green-500"></div>
                </div>
              </div>
              <pre className="text-[11px] font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-[400px]">
                {result.fullText || "Aucune sortie brute disponible."}
              </pre>
            </div>
          )}

          {/* Labeling */}
          {result.success && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Tag className="w-4 h-4" /> Labelliser cet exemple (entraînement)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">Vrai résultat</label>
                  <select value={trueOutcome} onChange={e => setTrueOutcome(e.target.value as Outcome | '')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-300 outline-none">
                    <option value="">-- Sélectionner --</option>
                    <option value="win">Victoire</option>
                    <option value="loss">Défaite</option>
                    <option value="draw">Nul</option>
                    <option value="unknown">Inconnu</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-1 block">Vrai score</label>
                  <input value={trueScore} onChange={e => setTrueScore(e.target.value)}
                    placeholder="ex: 2-1"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-300 outline-none" />
                </div>
              </div>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Notes (optionnel)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-300 outline-none" />
              <button onClick={saveLabel} disabled={saving}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all disabled:opacity-50">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                Sauvegarder l'exemple
              </button>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-violet-600" />
            Historique des tests
          </h2>
          <button onClick={loadHistory} disabled={historyLoading}
            className="flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-700 hover:bg-violet-100 font-bold rounded-xl transition-all text-sm disabled:opacity-50">
            {historyLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Charger
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total', value: stats.total, color: 'text-gray-900' },
              { label: 'Corrects', value: stats.correct, color: 'text-green-600' },
              { label: 'Incorrects', value: stats.incorrect, color: 'text-red-600' },
              { label: 'Partiels', value: stats.partial, color: 'text-amber-600' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-400 font-semibold">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {showHistory && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {history.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">Aucun test enregistré</p>
            )}
            {history.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                <img src={entry.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-100"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-500">{entry.game}</span>
                    {entry.result?.outcome && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${outcomeLabel[entry.result.outcome]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                        IA: {outcomeLabel[entry.result.outcome]?.label ?? entry.result.outcome}
                      </span>
                    )}
                    {entry.trueOutcome && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                        Vrai: {outcomeLabel[entry.trueOutcome as Outcome]?.label ?? entry.trueOutcome}
                      </span>
                    )}
                    {entry.labelStatus && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        entry.labelStatus === 'correct' ? 'bg-green-100 text-green-700' :
                        entry.labelStatus === 'incorrect' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {entry.labelStatus}
                      </span>
                    )}
                  </div>
                  {entry.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{entry.notes}</p>}
                </div>
                <button onClick={() => deleteEntry(entry.id)}
                  className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
