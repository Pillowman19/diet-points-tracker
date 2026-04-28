'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Activity, Settings, ChevronRight, Loader2, TrendingDown, X } from 'lucide-react';

type Entry = {
  id: number;
  kind: 'food' | 'exercise';
  date: string;
  name: string;
  points: number;
  note: string | null;
  edited: boolean;
  created_at: string;
};

function getLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function TrackerClient({ secret }: { secret: string }) {
  const headers = { 'Content-Type': 'application/json', 'x-app-secret': secret };

  const [today, setToday] = useState(getLocalDate());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState('');
  const [exerciseInput, setExerciseInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [mode, setMode] = useState<'food' | 'exercise'>('food');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [dailyBudget, setDailyBudget] = useState(50);
  const [weeklyFlex, setWeeklyFlex] = useState(0);
  const [history, setHistory] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Day rollover detector
  useEffect(() => {
    function check() {
      const current = getLocalDate();
      if (current !== today) setToday(current);
    }
    const interval = setInterval(check, 30000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [today]);

  // Load settings on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings', { headers });
        if (res.ok) {
          const data = await res.json();
          setDailyBudget(data.daily_budget);
          setWeeklyFlex(data.weekly_flex);
        }
      } catch (e) { console.error(e); }
    })();
  }, []);

  // Load today's entries when date changes
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/entries?date=${today}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries || []);
        }
      } catch (e) { console.error(e); }
    })();
  }, [today]);

  const foodEntries = entries.filter((e) => e.kind === 'food');
  const exerciseEntries = entries.filter((e) => e.kind === 'exercise');
  const totalFood = foodEntries.reduce((s, e) => s + e.points, 0);
  const rawExercise = exerciseEntries.reduce((s, e) => s + e.points, 0);
  const totalExercise = Math.min(rawExercise, 4);
  const net = totalFood - totalExercise;
  const remaining = dailyBudget - net;
  const pctUsed = Math.min((net / dailyBudget) * 100, 100);
  const over = net > dailyBudget;

  async function scoreAndAdd(kind: 'food' | 'exercise', text: string) {
    const scoreRes = await fetch('/api/score', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, kind, secret }),
    });
    if (!scoreRes.ok) throw new Error('scoring failed');
    const parsed = await scoreRes.json();

    const addRes = await fetch('/api/entries', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        kind,
        date: today,
        name: parsed.name,
        points: parsed.points,
        note: parsed.note,
      }),
    });
    if (!addRes.ok) throw new Error('save failed');
    const { entry } = await addRes.json();
    setEntries((e) => [...e, entry]);
  }

  async function handleFood() {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await scoreAndAdd('food', input.trim());
      setInput('');
      inputRef.current?.focus();
    } catch (e) {
      console.error(e);
      setError("Couldn't score that. Try again or rephrase.");
    }
    setLoading(false);
  }

  async function handleExercise() {
    if (!exerciseInput.trim()) return;
    setExerciseLoading(true);
    setError(null);
    try {
      await scoreAndAdd('exercise', exerciseInput.trim());
      setExerciseInput('');
    } catch (e) {
      console.error(e);
      setError("Couldn't score that activity.");
    }
    setExerciseLoading(false);
  }

  async function deleteEntry(id: number) {
    setEntries((e) => e.filter((x) => x.id !== id));
    await fetch(`/api/entries?id=${id}`, { method: 'DELETE', headers }).catch(() => {});
  }

  function startEdit(id: number, points: number) {
    setEditingId(id);
    setEditValue(String(points));
  }

  async function commitEdit(id: number) {
    const n = parseInt(editValue);
    if (!isNaN(n) && n >= 0) {
      setEntries((e) =>
        e.map((x) => (x.id === id ? { ...x, points: n, edited: true } : x))
      );
      await fetch('/api/entries', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id, points: n }),
      }).catch(() => {});
    }
    setEditingId(null);
    setEditValue('');
  }

  async function saveSettings(newBudget: number, newFlex: number) {
    setDailyBudget(newBudget);
    setWeeklyFlex(newFlex);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ daily_budget: newBudget, weekly_flex: newFlex }),
    }).catch(() => {});
  }

  async function loadHistory() {
    try {
      const res = await fetch('/api/entries?all=1', { headers });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.entries || []);
      }
    } catch (e) { console.error(e); }
  }

  return (
    <div className="min-h-screen w-full grain" style={{
      background: 'linear-gradient(180deg, #f5f1ea 0%, #ebe4d6 100%)',
    }}>
      <div className="max-w-2xl mx-auto px-5 py-8 relative" style={{ zIndex: 2 }}>
        <header className="mb-8 pb-6 border-b" style={{ borderColor: '#c9bfa9' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="mono text-xs tracking-[0.25em] uppercase" style={{ color: '#8a7a5c' }}>
                The Daily Ledger
              </div>
              <h1 className="text-4xl md:text-5xl mt-1" style={{ fontWeight: 500, letterSpacing: '-0.02em' }}>
                {new Date(today + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h1>
            </div>
            <button onClick={() => setShowSettings(true)} className="pressable p-2 rounded-full" style={{ background: '#2b2420', color: '#f5f1ea' }}>
              <Settings size={16} />
            </button>
          </div>
        </header>

        <div className="mb-8 fade-up">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="mono text-xs tracking-widest uppercase" style={{ color: '#8a7a5c' }}>Remaining</div>
              <div className="text-6xl md:text-7xl num" style={{
                fontWeight: 500,
                color: over ? '#a33' : '#2b2420',
                letterSpacing: '-0.04em',
              }}>
                {remaining}
              </div>
            </div>
            <div className="text-right">
              <div className="mono text-xs tracking-widest uppercase" style={{ color: '#8a7a5c' }}>Budget</div>
              <div className="text-2xl num" style={{ color: '#5c4f3d' }}>{dailyBudget}</div>
            </div>
          </div>
          <div className="h-[3px] w-full relative" style={{ background: '#d8ceba' }}>
            <div style={{
              width: `${pctUsed}%`,
              height: '100%',
              background: over ? '#a33' : '#2b2420',
              transition: 'width 0.5s ease-out',
            }} />
          </div>
          <div className="flex justify-between mt-2 mono text-xs" style={{ color: '#8a7a5c' }}>
            <span>Eaten {totalFood}</span>
            <span>Earned {totalExercise}{rawExercise > 4 && ` (capped from ${rawExercise})`}</span>
          </div>
        </div>

        <div className="flex gap-1 mb-4 p-1 rounded-full" style={{ background: '#2b2420', width: 'fit-content' }}>
          <button
            onClick={() => setMode('food')}
            className="mono text-xs tracking-widest uppercase px-4 py-2 rounded-full pressable"
            style={{
              background: mode === 'food' ? '#f5f1ea' : 'transparent',
              color: mode === 'food' ? '#2b2420' : '#a89e87',
            }}>
            Food
          </button>
          <button
            onClick={() => setMode('exercise')}
            className="mono text-xs tracking-widest uppercase px-4 py-2 rounded-full pressable"
            style={{
              background: mode === 'exercise' ? '#f5f1ea' : 'transparent',
              color: mode === 'exercise' ? '#2b2420' : '#a89e87',
            }}>
            Activity
          </button>
        </div>

        {mode === 'food' ? (
          <div className="mb-6 fade-up">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleFood()}
                placeholder="salad with vinegar dressing..."
                className="w-full px-5 py-4 pr-14 italic text-lg"
                style={{ background: '#fbf8f1', border: '1px solid #c9bfa9', color: '#2b2420', outline: 'none' }}
                disabled={loading}
              />
              <button
                onClick={handleFood}
                disabled={loading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 pressable"
                style={{ background: '#2b2420', color: '#f5f1ea', opacity: loading || !input.trim() ? 0.4 : 1 }}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6 fade-up">
            <div className="relative">
              <input
                type="text"
                value={exerciseInput}
                onChange={(e) => setExerciseInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !exerciseLoading && handleExercise()}
                placeholder="walked 18 holes..."
                className="w-full px-5 py-4 pr-14 italic text-lg"
                style={{ background: '#fbf8f1', border: '1px solid #c9bfa9', color: '#2b2420', outline: 'none' }}
                disabled={exerciseLoading}
              />
              <button
                onClick={handleExercise}
                disabled={exerciseLoading || !exerciseInput.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 pressable"
                style={{ background: '#2b2420', color: '#f5f1ea', opacity: exerciseLoading || !exerciseInput.trim() ? 0.4 : 1 }}>
                {exerciseLoading ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-2 text-sm italic" style={{ background: '#f4dcdc', color: '#6b2020' }}>
            {error}
          </div>
        )}

        {foodEntries.length > 0 && (
          <div className="mb-8">
            <div className="mono text-xs tracking-[0.25em] uppercase mb-3" style={{ color: '#8a7a5c' }}>Consumed</div>
            <div className="space-y-1">
              {foodEntries.map((e) => (
                <EntryRow key={e.id} entry={e} editingId={editingId} editValue={editValue}
                  setEditValue={setEditValue} startEdit={startEdit} commitEdit={commitEdit}
                  cancelEdit={() => { setEditingId(null); setEditValue(''); }}
                  onDelete={() => deleteEntry(e.id)} />
              ))}
            </div>
          </div>
        )}

        {exerciseEntries.length > 0 && (
          <div className="mb-8">
            <div className="mono text-xs tracking-[0.25em] uppercase mb-3" style={{ color: '#8a7a5c' }}>Earned</div>
            <div className="space-y-1">
              {exerciseEntries.map((e) => (
                <EntryRow key={e.id} entry={e} editingId={editingId} editValue={editValue}
                  setEditValue={setEditValue} startEdit={startEdit} commitEdit={commitEdit}
                  cancelEdit={() => { setEditingId(null); setEditValue(''); }}
                  onDelete={() => deleteEntry(e.id)} isExercise />
              ))}
            </div>
          </div>
        )}

        {entries.length === 0 && (
          <div className="text-center py-12 italic" style={{ color: '#8a7a5c' }}>
            Nothing logged yet. Try "two eggs with toast" or "coffee with milk."
          </div>
        )}

        <div className="mt-12 pt-6 flex justify-center items-center" style={{ borderTop: '1px solid #c9bfa9' }}>
          <button onClick={() => { loadHistory(); setShowHistory(true); }} className="mono text-xs tracking-widest uppercase pressable flex items-center gap-1" style={{ color: '#5c4f3d' }}>
            <TrendingDown size={12} /> History
          </button>
        </div>

        <div className="mt-8 text-center mono text-[10px] tracking-[0.3em] uppercase" style={{ color: '#a89e87' }}>
          Discipline · Honesty · Patience
        </div>
      </div>

      {showSettings && (
        <SettingsModal dailyBudget={dailyBudget} weeklyFlex={weeklyFlex} onSave={saveSettings} onClose={() => setShowSettings(false)} />
      )}
      {showHistory && <HistoryModal history={history} dailyBudget={dailyBudget} onClose={() => setShowHistory(false)} />}
    </div>
  );
}

function EntryRow({ entry, editingId, editValue, setEditValue, startEdit, commitEdit, cancelEdit, onDelete, isExercise = false }: any) {
  const isEditing = editingId === entry.id;
  return (
    <div className="group flex items-center justify-between py-3 px-4 fade-up" style={{ borderBottom: '1px dotted #c9bfa9' }}>
      <div className="flex-1 min-w-0 pr-3">
        <div className="text-lg truncate" style={{ fontWeight: 500 }}>{entry.name}</div>
        <div className="text-xs italic mt-0.5" style={{ color: '#8a7a5c' }}>
          <span className="mono not-italic">{formatTime(entry.created_at)}</span> · {entry.note}{entry.edited && ' · edited'}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isEditing ? (
          <input
            type="number"
            value={editValue}
            onChange={(ev) => setEditValue(ev.target.value)}
            onBlur={() => commitEdit(entry.id)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') commitEdit(entry.id);
              if (ev.key === 'Escape') cancelEdit();
            }}
            autoFocus
            className="text-2xl num text-right w-16 px-1"
            style={{ background: '#fbf8f1', border: '1px solid #2b2420', outline: 'none', fontWeight: 500, color: isExercise ? '#3a6b3a' : '#2b2420' }}
          />
        ) : (
          <button
            onClick={() => startEdit(entry.id, entry.points)}
            className="text-2xl num hover:underline"
            style={{ fontWeight: 500, minWidth: isExercise ? '3ch' : '2ch', textAlign: 'right', color: isExercise ? '#3a6b3a' : '#2b2420' }}
            title="Click to edit"
          >
            {isExercise ? `−${entry.points}` : entry.points}
          </button>
        )}
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity p-1" style={{ color: '#a33' }}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function SettingsModal({ dailyBudget, weeklyFlex, onSave, onClose }: any) {
  const [budget, setBudget] = useState(String(dailyBudget));
  const [flex, setFlex] = useState(String(weeklyFlex));
  const [sex, setSex] = useState('male');
  const [age, setAge] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLb, setWeightLb] = useState('');
  const [activity, setActivity] = useState('moderate');
  const [showCalc, setShowCalc] = useState(false);

  function calculate() {
    const w = parseFloat(weightLb) / 2.205;
    const h = parseFloat(heightIn) * 2.54;
    const a = parseFloat(age);
    if (!w || !h || !a) return;
    const bmr = sex === 'male' ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
    const mult: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
    const tdee = bmr * mult[activity];
    const target = tdee - tdee * 0.2;
    const pts = Math.round(target / 35);
    setBudget(String(Math.max(pts, 23)));
  }

  function save() {
    onSave(parseInt(budget) || 23, parseInt(flex) || 0);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: 'rgba(20,16,12,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="max-w-md w-full p-6 fade-up" style={{ background: '#f5f1ea', border: '1px solid #2b2420' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl" style={{ fontWeight: 500 }}>Settings</h2>
          <button onClick={onClose} className="pressable"><X size={20} /></button>
        </div>

        <div className="mb-6">
          <label className="mono text-xs tracking-widest uppercase block mb-2" style={{ color: '#8a7a5c' }}>Daily Budget</label>
          <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
            className="w-full px-4 py-3 text-2xl num" style={{ background: '#fbf8f1', border: '1px solid #c9bfa9', outline: 'none' }} />
        </div>

        <div className="mb-6">
          <label className="mono text-xs tracking-widest uppercase block mb-2" style={{ color: '#8a7a5c' }}>Weekly Flex Points</label>
          <input type="number" value={flex} onChange={(e) => setFlex(e.target.value)}
            className="w-full px-4 py-3 text-2xl num" style={{ background: '#fbf8f1', border: '1px solid #c9bfa9', outline: 'none' }} />
          <p className="text-xs italic mt-2" style={{ color: '#8a7a5c' }}>Extra weekly points. Set to 0 to disable.</p>
        </div>

        <button onClick={() => setShowCalc(!showCalc)}
          className="mono text-xs tracking-widest uppercase mb-4 flex items-center gap-1 pressable" style={{ color: '#5c4f3d' }}>
          <ChevronRight size={12} style={{ transform: showCalc ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
          Calculate From Stats
        </button>

        {showCalc && (
          <div className="space-y-3 mb-6 p-4 fade-up" style={{ background: '#ebe4d6' }}>
            <div className="flex gap-2">
              <button onClick={() => setSex('male')} className="flex-1 py-2 mono text-xs tracking-widest uppercase pressable"
                style={{ background: sex === 'male' ? '#2b2420' : 'transparent', color: sex === 'male' ? '#f5f1ea' : '#2b2420', border: '1px solid #2b2420' }}>Male</button>
              <button onClick={() => setSex('female')} className="flex-1 py-2 mono text-xs tracking-widest uppercase pressable"
                style={{ background: sex === 'female' ? '#2b2420' : 'transparent', color: sex === 'female' ? '#f5f1ea' : '#2b2420', border: '1px solid #2b2420' }}>Female</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" placeholder="Age" value={age} onChange={(e) => setAge(e.target.value)} className="px-3 py-2 text-sm" style={{ background: '#fbf8f1', border: '1px solid #c9bfa9', outline: 'none' }} />
              <input type="number" placeholder="Height (in)" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} className="px-3 py-2 text-sm" style={{ background: '#fbf8f1', border: '1px solid #c9bfa9', outline: 'none' }} />
              <input type="number" placeholder="Weight (lb)" value={weightLb} onChange={(e) => setWeightLb(e.target.value)} className="px-3 py-2 text-sm" style={{ background: '#fbf8f1', border: '1px solid #c9bfa9', outline: 'none' }} />
            </div>
            <select value={activity} onChange={(e) => setActivity(e.target.value)} className="w-full px-3 py-2 text-sm" style={{ background: '#fbf8f1', border: '1px solid #c9bfa9', outline: 'none' }}>
              <option value="sedentary">Sedentary</option>
              <option value="light">Light (1-3 days/wk)</option>
              <option value="moderate">Moderate (3-5 days/wk)</option>
              <option value="active">Active (6-7 days/wk)</option>
            </select>
            <button onClick={calculate} className="w-full py-2 mono text-xs tracking-widest uppercase pressable" style={{ background: '#2b2420', color: '#f5f1ea' }}>Calculate</button>
          </div>
        )}

        <button onClick={save} className="w-full py-3 mono text-xs tracking-widest uppercase pressable" style={{ background: '#2b2420', color: '#f5f1ea' }}>Save</button>
      </div>
    </div>
  );
}

function HistoryModal({ history, dailyBudget, onClose }: { history: Entry[]; dailyBudget: number; onClose: () => void }) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  // Group by date
  const byDate: Record<string, Entry[]> = {};
  history.forEach((e) => {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a)).slice(0, 30);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: 'rgba(20,16,12,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="max-w-md w-full max-h-[80vh] overflow-y-auto p-6 fade-up" style={{ background: '#f5f1ea', border: '1px solid #2b2420' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl" style={{ fontWeight: 500 }}>History</h2>
          <button onClick={onClose} className="pressable"><X size={20} /></button>
        </div>
        {dates.length === 0 ? (
          <p className="italic text-center py-8" style={{ color: '#8a7a5c' }}>No history yet.</p>
        ) : (
          <div className="space-y-2">
            {dates.map((d) => {
              const dayEntries = byDate[d];
              const foodItems = dayEntries.filter((e) => e.kind === 'food');
              const exItems = dayEntries.filter((e) => e.kind === 'exercise');
              const food = foodItems.reduce((s, e) => s + e.points, 0);
              const ex = Math.min(exItems.reduce((s, e) => s + e.points, 0), 4);
              const net = food - ex;
              const over = net > dailyBudget;
              const isExpanded = expandedDate === d;

              // Color: green if at/under budget, red if over
              const netColor = over ? '#a33' : '#3a6b3a';
              const rowBg = over ? 'rgba(163, 51, 51, 0.06)' : 'rgba(58, 107, 58, 0.06)';

              return (
                <div key={d} style={{ background: rowBg, borderLeft: `3px solid ${netColor}` }}>
                  <button
                    onClick={() => setExpandedDate(isExpanded ? null : d)}
                    className="w-full flex justify-between items-center py-3 px-3 pressable text-left"
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-xs italic" style={{ color: '#8a7a5c' }}>
                        {foodItems.length} items · {exItems.length} activities
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xl num" style={{ fontWeight: 500, color: netColor }}>
                        {net}<span className="text-sm" style={{ color: '#8a7a5c' }}>/{dailyBudget}</span>
                      </div>
                      <ChevronRight size={14} style={{
                        color: '#8a7a5c',
                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s'
                      }} />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 fade-up" style={{ borderTop: '1px dotted #c9bfa9' }}>
                      {foodItems.length > 0 && (
                        <div className="mt-3">
                          <div className="mono text-[10px] tracking-[0.25em] uppercase mb-2" style={{ color: '#8a7a5c' }}>Consumed</div>
                          <div className="space-y-1">
                            {foodItems.map((e) => (
                              <div key={e.id} className="flex justify-between items-start py-1.5 text-sm">
                                <div className="flex-1 min-w-0 pr-3">
                                  <div className="truncate">{e.name}</div>
                                  {e.note && <div className="text-xs italic" style={{ color: '#8a7a5c' }}>{e.note}</div>}
                                </div>
                                <div className="num" style={{ fontWeight: 500 }}>{e.points}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {exItems.length > 0 && (
                        <div className="mt-3">
                          <div className="mono text-[10px] tracking-[0.25em] uppercase mb-2" style={{ color: '#8a7a5c' }}>Earned</div>
                          <div className="space-y-1">
                            {exItems.map((e) => (
                              <div key={e.id} className="flex justify-between items-start py-1.5 text-sm">
                                <div className="flex-1 min-w-0 pr-3">
                                  <div className="truncate">{e.name}</div>
                                  {e.note && <div className="text-xs italic" style={{ color: '#8a7a5c' }}>{e.note}</div>}
                                </div>
                                <div className="num" style={{ fontWeight: 500, color: '#3a6b3a' }}>−{e.points}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
