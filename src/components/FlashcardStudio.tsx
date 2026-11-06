import React, { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import {
  getFlashcardDecks,
  createFlashcardDeck,
  deleteFlashcardDeck,
  getFlashcards,
  saveFlashcards,
  reviewFlashcard,
  generateQuestionsFromImage,
  FlashcardDeck,
  Flashcard,
} from '../services/api.ts';

type Rating = 'again' | 'hard' | 'good' | 'easy';

type Attempt = {
  question: string;
  options: string[];
  answer: string;
  picked: number | null; // index of the option the student clicked
  selected: boolean; // keep this question as a flashcard
};

// Shrinks a phone photo so it stays small enough to send.
async function compressImage(file: File, maxSide = 1600): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { base64: canvas.toDataURL('image/jpeg', 0.8).split(',')[1], mimeType: 'image/jpeg' };
}

const errorText = (e: any) => e?.message || 'Something went wrong.';

const LOADING_MESSAGES = [
  'Reading your notes',
  'Finding the key ideas',
  'Writing your questions',
  'Almost ready',
];

// Animated loader shown while the photo is being turned into questions.
const NotesLoader: React.FC = () => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => (s + 1) % LOADING_MESSAGES.length), 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-3">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
        <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-blue-600 animate-pulse">
          <BookOpen className="w-6 h-6" aria-hidden="true" />
        </div>
      </div>

      <p key={step} className="text-sm font-bold text-slate-700 transition-opacity duration-500">
        {LOADING_MESSAGES[step]}...
      </p>

      <div className="w-40 h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full w-1/3 rounded-full bg-blue-600 animate-pulse" />
      </div>

      <p className="text-[11px] text-slate-500">This usually takes 20 to 40 seconds</p>
    </div>
  );
};

export const FlashcardStudio: React.FC = () => {
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // practice questions
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [suggestedDeck, setSuggestedDeck] = useState('General');
  const [saveDeck, setSaveDeck] = useState<string>('__new');
  const [saveDeckName, setSaveDeckName] = useState('General');

  // new deck
  const [newDeckName, setNewDeckName] = useState('');

  // study mode
  const [studyDeck, setStudyDeck] = useState<FlashcardDeck | null>(null);
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const loadDecks = async () => {
    try {
      const res = await getFlashcardDecks();
      setDecks(res.decks);
    } catch (e) {
      setError(errorText(e));
    }
  };

  useEffect(() => {
    loadDecks();
  }, []);

  // ---- make questions from a photo ----
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setGenerating(true);
    setError(null);
    setAttempts([]);
    try {
      const { base64, mimeType } = await compressImage(file);
      const res = await generateQuestionsFromImage(base64, mimeType, 10);
      if (res.questions.length === 0) {
        setError('No questions could be made from this photo. Try a clearer picture.');
      }
      setAttempts(
        res.questions.map((q) => ({
          question: q.question,
          options: q.options,
          answer: q.answer,
          picked: null,
          selected: false,
        }))
      );
      setSuggestedDeck(res.deckName);
      setSaveDeckName(res.deckName);
      const match = decks.find((d) => d.name.toLowerCase() === res.deckName.toLowerCase());
      setSaveDeck(match ? match.id : '__new');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setGenerating(false); // the photo only lived in memory, so nothing is kept
    }
  };

  const updateAttempt = (i: number, patch: Partial<Attempt>) =>
    setAttempts((list) => list.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  // Student clicks an option. The result shows straight away.
  const pickOption = (i: number, optionIndex: number) => {
    if (attempts[i].picked !== null) return; // one try per question
    updateAttempt(i, { picked: optionIndex, selected: true });
  };

  const answeredCount = attempts.filter((a) => a.picked !== null).length;
  const correctCount = attempts.filter(
    (a) => a.picked !== null && a.options[a.picked] === a.answer
  ).length;

  // ---- save kept questions as flashcards: question + answer only, no options ----
  const saveChosen = async () => {
    const chosen = attempts
      .filter((a) => a.selected && a.picked !== null)
      .map((a) => ({ question: a.question, answer: a.answer }));
    if (chosen.length === 0) {
      setError('Answer at least one question and keep it selected to save.');
      return;
    }
    const payload =
      saveDeck === '__new'
        ? { deckName: saveDeckName.trim() || 'General', cards: chosen }
        : { deckId: saveDeck, cards: chosen };
    setBusy(true);
    setError(null);
    try {
      await saveFlashcards(payload);
      setAttempts([]);
      await loadDecks();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // ---- decks ----
  const addDeck = async () => {
    const name = newDeckName.trim();
    if (!name) return;
    try {
      await createFlashcardDeck(name);
      setNewDeckName('');
      await loadDecks();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const removeDeck = async (deck: FlashcardDeck) => {
    if (!window.confirm(`Delete the deck "${deck.name}" and all its cards?`)) return;
    try {
      await deleteFlashcardDeck(deck.id);
      await loadDecks();
    } catch (e) {
      setError(errorText(e));
    }
  };

  // ---- study: flashcard, then show answer, then rate ----
  const startStudy = async (deck: FlashcardDeck) => {
    try {
      const res = await getFlashcards(deck.id);
      const now = Date.now();
      setStudyDeck(res.deck);
      setQueue(res.cards.filter((c) => new Date(c.dueAt).getTime() <= now));
      setIndex(0);
      setShowAnswer(false);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const rate = async (rating: Rating) => {
    const card = queue[index];
    if (!card) return;
    try {
      await reviewFlashcard(card.id, rating);
    } catch (e) {
      setError(errorText(e));
      return;
    }
    if (rating === 'again') setQueue((q) => [...q, card]); // comes back later this session
    setShowAnswer(false);
    setIndex((i) => i + 1);
  };

  const leaveStudy = async () => {
    setStudyDeck(null);
    setQueue([]);
    await loadDecks();
  };

  // ---- study screen ----
  if (studyDeck) {
    const card = queue[index];
    const done = index >= queue.length;
    return (
      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={leaveStudy} className="text-xs font-bold text-blue-600">Back to decks</button>
          <p className="text-xs text-slate-500">{studyDeck.name}</p>
        </div>

        {queue.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
            <p className="text-sm font-bold text-slate-900">Nothing due in this deck</p>
            <p className="text-xs text-slate-500 mt-1">Come back later, or add more cards.</p>
          </div>
        )}

        {queue.length > 0 && done && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
            <p className="text-sm font-bold text-slate-900">Session complete</p>
            <button onClick={leaveStudy} className="mt-3 bg-blue-600 text-white rounded-xl px-4 py-2 text-xs font-bold">
              Done
            </button>
          </div>
        )}

        {card && !done && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <p className="text-[11px] text-slate-500">{index + 1} of {queue.length}</p>
            <p className="text-base font-bold text-slate-900">{card.question}</p>

            {!showAnswer ? (
              <button
                onClick={() => setShowAnswer(true)}
                className="w-full bg-slate-900 text-white rounded-xl py-3 text-sm font-bold"
              >
                Show answer
              </button>
            ) : (
              <>
                <p className="text-sm text-slate-700 border-t border-slate-100 pt-3">{card.answer}</p>
                <div className="grid grid-cols-4 gap-2">
                  {(['again', 'hard', 'good', 'easy'] as Rating[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => rate(r)}
                      className={`rounded-xl py-2 text-xs font-bold capitalize ${
                        r === 'again'
                          ? 'bg-rose-50 text-rose-700'
                          : r === 'hard'
                          ? 'bg-amber-50 text-amber-700'
                          : r === 'good'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    );
  }

  // ---- main screen ----
  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div>
        <p className="text-lg font-extrabold text-slate-900">Flashcards</p>
        <p className="text-xs text-slate-500">Snap your notes, pick the right answers, then keep the questions you want as flashcards.</p>
      </div>

      {/* Step 1: snap */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        {generating ? (
          <NotesLoader />
        ) : (
          <label className="block w-full text-center rounded-xl py-3 text-sm font-bold cursor-pointer bg-blue-600 text-white">
            Snap notes to get questions
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhoto}
              disabled={busy}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Step 2: multiple-choice questions */}
      {attempts.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide">
            Pick the right answer · {correctCount} of {answeredCount} correct so far
          </p>

          {attempts.map((a, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <p className="text-sm font-bold text-slate-900">{i + 1}. {a.question}</p>

              <div className="space-y-2">
                {a.options.map((opt, oi) => {
                  const isAnswer = opt === a.answer;
                  const isPicked = a.picked === oi;
                  const answered = a.picked !== null;
                  let style = 'border-slate-300 text-slate-800 hover:bg-slate-50';
                  if (answered && isAnswer) style = 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold';
                  else if (answered && isPicked) style = 'border-rose-500 bg-rose-50 text-rose-800';
                  else if (answered) style = 'border-slate-200 text-slate-400';
                  return (
                    <button
                      key={oi}
                      onClick={() => pickOption(i, oi)}
                      disabled={answered}
                      className={`w-full text-left border rounded-xl px-3 py-2 text-xs ${style}`}
                    >
                      {String.fromCharCode(65 + oi)}. {opt}
                    </button>
                  );
                })}
              </div>

              {a.picked !== null && (
                <div className="flex items-center justify-between pt-1">
                  <span className={`text-[11px] font-bold ${a.options[a.picked] === a.answer ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {a.options[a.picked] === a.answer ? 'Correct' : 'Not quite, the right answer is green'}
                  </span>
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={a.selected}
                      onChange={(e) => updateAttempt(i, { selected: e.target.checked })}
                    />
                    Keep as flashcard
                  </label>
                </div>
              )}
            </div>
          ))}

          {/* Step 3: save kept questions to a deck */}
          {answeredCount > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <p className="text-sm font-extrabold text-slate-900">Save to a deck</p>
              <select
                value={saveDeck}
                onChange={(e) => setSaveDeck(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
                <option value="__new">New deck...</option>
              </select>
              {saveDeck === '__new' && (
                <input
                  value={saveDeckName}
                  onChange={(e) => setSaveDeckName(e.target.value)}
                  placeholder={`Deck name, e.g. ${suggestedDeck}`}
                  className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
                />
              )}
              <div className="flex gap-2">
                <button
                  onClick={saveChosen}
                  disabled={busy || attempts.filter((a) => a.selected && a.picked !== null).length === 0}
                  className="flex-1 bg-emerald-600 text-white rounded-xl py-2 text-xs font-bold disabled:opacity-50"
                >
                  Save {attempts.filter((a) => a.selected && a.picked !== null).length} card(s)
                </button>
                <button
                  onClick={() => setAttempts([])}
                  className="flex-1 border border-slate-300 text-slate-700 rounded-xl py-2 text-xs font-bold"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Decks */}
      <div className="space-y-2">
        <p className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide">My decks</p>

        {decks.length === 0 && (
          <p className="text-xs text-slate-500">No decks yet. Answer some questions above and save them, or create a deck below.</p>
        )}

        {decks.map((d) => (
          <div key={d.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-slate-900">{d.name}</p>
              <p className="text-[11px] text-slate-500">{d.cardCount} cards · {d.dueCount} due now</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startStudy(d)}
                disabled={d.cardCount === 0}
                className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40"
              >
                Study
              </button>
              <button
                onClick={() => removeDeck(d)}
                className="border border-slate-300 text-slate-600 rounded-lg px-3 py-1.5 text-xs font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <input
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            placeholder="New deck name"
            className="flex-1 border border-slate-300 rounded-lg px-2 py-2 text-sm"
          />
          <button onClick={addDeck} className="border border-slate-300 text-slate-700 rounded-lg px-3 text-xs font-bold">
            Add deck
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
};
