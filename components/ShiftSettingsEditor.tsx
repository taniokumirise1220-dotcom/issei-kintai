'use client';

import { useEffect, useState } from 'react';
import { BUILTIN_SHIFTS, ShiftSetting } from '@/lib/types';

const NAVY = '#1B2B5E';
const GOLD = '#C9A84C';

const BUILTIN_COLORS: Record<string, { bg: string; text: string }> = {
  day:        { bg: '#EFF6FF', text: '#1D4ED8' },
  night_full: { bg: '#F5F3FF', text: '#6D28D9' },
  night_only: { bg: '#EEF2FF', text: '#4338CA' },
  paid_leave: { bg: '#F0FDF4', text: '#166534' },
};

const CUSTOM_PALETTE = [
  { bg: '#FFF7ED', text: '#C2410C' },
  { bg: '#FFF1F2', text: '#BE123C' },
  { bg: '#F0FDFA', text: '#0F766E' },
  { bg: '#FEFCE8', text: '#A16207' },
  { bg: '#ECFEFF', text: '#0E7490' },
  { bg: '#F7FEE7', text: '#4D7C0F' },
];

type ExtShiftSetting = ShiftSetting & { is_builtin?: boolean; sort_order?: number };

function getColor(s: ExtShiftSetting, customIdx: number) {
  if (BUILTIN_COLORS[s.shift_type]) return BUILTIN_COLORS[s.shift_type];
  return CUSTOM_PALETTE[customIdx % CUSTOM_PALETTE.length];
}

function TimeInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? '例: 8:30'}
      className="w-full px-3 py-2 border rounded text-sm text-center focus:outline-none"
      style={{ borderColor: '#d1d5db' }}
      onFocus={e => (e.target.style.borderColor = GOLD)}
      onBlur={e => (e.target.style.borderColor = '#d1d5db')}
    />
  );
}

const EMPTY_NEW = { label: '', clock_in: '', clock_out: '', rest_time: '', actual_time: '' };

export default function ShiftSettingsEditor() {
  const [settings, setSettings] = useState<ExtShiftSetting[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newShift, setNewShift] = useState(EMPTY_NEW);
  const [adding, setAdding] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const load = () =>
    fetch('/api/shift-settings')
      .then(r => r.json())
      .then((data: ExtShiftSetting[]) => setSettings(data));

  useEffect(() => { load(); }, []);

  const update = (shift_type: string, field: keyof Omit<ExtShiftSetting, 'shift_type' | 'is_builtin' | 'sort_order'>, value: string) => {
    setSettings(prev => prev.map(s => s.shift_type === shift_type ? { ...s, [field]: value } : s));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...settings];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    // sort_order を配列インデックスに合わせて更新
    setSettings(next.map((s, i) => ({ ...s, sort_order: i + 1 })));
  };

  const save = async () => {
    setSaving(true);
    const payload = settings.map((s, i) => ({ ...s, sort_order: i + 1 }));
    await fetch('/api/shift-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    showToast('保存しました');
  };

  const addShift = async () => {
    if (!newShift.label.trim()) return;
    setAdding(true);
    await fetch('/api/shift-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newShift),
    });
    setAdding(false);
    setShowAdd(false);
    setNewShift(EMPTY_NEW);
    await load();
    showToast('シフトを追加しました');
  };

  const deleteShift = async (shift_type: string) => {
    if (!confirm('このシフト種別を削除しますか？過去の勤怠記録は残ります。')) return;
    await fetch('/api/shift-settings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shift_type }),
    });
    await load();
    showToast('削除しました');
  };

  let customIdx = 0;

  return (
    <div className="max-w-3xl mx-auto">
      {toast && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3 rounded shadow-lg text-sm font-medium text-white"
          style={{ background: NAVY, borderLeft: `4px solid ${GOLD}` }}>
          {toast}
        </div>
      )}

      {/* Header card */}
      <div className="rounded-xl overflow-hidden shadow-sm mb-6" style={{ background: NAVY }}>
        <div className="px-8 py-6">
          <div className="section-label mb-1">WORK HOURS SETTINGS</div>
          <h2 className="text-2xl font-bold text-white">労働時間設定</h2>
          <div className="mt-2" style={{ width: 40, height: 2, background: GOLD }} />
          <p className="mt-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
            シフト種別ごとの出勤・退社・休憩時間を設定します。↑↓で順番を変えると出勤簿プルダウンの表示順に反映されます。
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 px-6 py-3 text-xs font-bold tracking-wider" style={{ background: NAVY, color: GOLD }}>
          <div className="col-span-1 text-center">順序</div>
          <div className="col-span-2">シフト種別</div>
          <div className="col-span-2 text-center">出勤時刻</div>
          <div className="col-span-2 text-center">退社時刻</div>
          <div className="col-span-2 text-center">休憩時間</div>
          <div className="col-span-2 text-center">実働時間</div>
          <div className="col-span-1 text-center"></div>
        </div>

        <div className="divide-y divide-gray-100">
          {settings.map((s, i) => {
            const isBuiltin = BUILTIN_SHIFTS.includes(s.shift_type as never);
            const ci = isBuiltin ? -1 : customIdx++;
            const color = getColor(s, ci);

            return (
              <div key={s.shift_type} className="grid grid-cols-12 items-center px-6 py-4 gap-2">
                {/* 並べ替えボタン */}
                <div className="col-span-1 flex flex-col items-center gap-0.5">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="w-6 h-6 flex items-center justify-center rounded text-xs transition-colors hover:bg-gray-100 disabled:opacity-20"
                    style={{ color: NAVY }}
                  >▲</button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === settings.length - 1}
                    className="w-6 h-6 flex items-center justify-center rounded text-xs transition-colors hover:bg-gray-100 disabled:opacity-20"
                    style={{ color: NAVY }}
                  >▼</button>
                </div>

                <div className="col-span-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={s.label}
                      onChange={e => update(s.shift_type, 'label', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-xs font-bold focus:outline-none"
                      style={{ borderColor: '#d1d5db', background: color.bg, color: color.text }}
                      onFocus={e => (e.target.style.borderColor = GOLD)}
                      onBlur={e => (e.target.style.borderColor = '#d1d5db')}
                    />
                    {isBuiltin && (
                      <span className="absolute -top-2 right-1 text-xs px-1" style={{ color: '#d1d5db', fontSize: '9px' }}>固定</span>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <TimeInput value={s.clock_in} onChange={v => update(s.shift_type, 'clock_in', v)} placeholder="例: 8:30" />
                </div>
                <div className="col-span-2">
                  <TimeInput value={s.clock_out} onChange={v => update(s.shift_type, 'clock_out', v)} placeholder="例: 17:00" />
                </div>
                <div className="col-span-2">
                  <TimeInput value={s.rest_time} onChange={v => update(s.shift_type, 'rest_time', v)} placeholder="例: 2:00" />
                </div>
                <div className="col-span-2">
                  <TimeInput value={s.actual_time} onChange={v => update(s.shift_type, 'actual_time', v)} placeholder="例: 6:30" />
                </div>
                <div className="col-span-1 text-center">
                  {!isBuiltin && (
                    <button onClick={() => deleteShift(s.shift_type)}
                      className="text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      style={{ color: '#ef4444' }} title="削除">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="border-t px-6 py-4" style={{ background: '#FAFFF4', borderColor: '#d1fae5' }}>
            <div className="text-sm font-bold mb-3" style={{ color: NAVY }}>新しいシフト種別を追加</div>
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-1" />
              <div className="col-span-2">
                <input
                  type="text"
                  value={newShift.label}
                  onChange={e => setNewShift(p => ({ ...p, label: e.target.value }))}
                  placeholder="シフト名（例: 早番）"
                  className="w-full px-3 py-2 border rounded text-sm focus:outline-none"
                  style={{ borderColor: GOLD }}
                  autoFocus
                />
              </div>
              <div className="col-span-2">
                <TimeInput value={newShift.clock_in} onChange={v => setNewShift(p => ({ ...p, clock_in: v }))} placeholder="例: 7:00" />
              </div>
              <div className="col-span-2">
                <TimeInput value={newShift.clock_out} onChange={v => setNewShift(p => ({ ...p, clock_out: v }))} placeholder="例: 15:00" />
              </div>
              <div className="col-span-2">
                <TimeInput value={newShift.rest_time} onChange={v => setNewShift(p => ({ ...p, rest_time: v }))} placeholder="例: 1:00" />
              </div>
              <div className="col-span-2">
                <TimeInput value={newShift.actual_time} onChange={v => setNewShift(p => ({ ...p, actual_time: v }))} placeholder="例: 7:00" />
              </div>
              <div className="col-span-1 flex justify-center">
                <button onClick={addShift} disabled={adding || !newShift.label.trim()}
                  className="text-xs px-2 py-1.5 rounded font-bold transition-opacity hover:opacity-85"
                  style={{ background: NAVY, color: GOLD, opacity: (adding || !newShift.label.trim()) ? 0.5 : 1 }}>
                  追加
                </button>
              </div>
            </div>
            <button onClick={() => { setShowAdd(false); setNewShift(EMPTY_NEW); }}
              className="mt-2 text-xs" style={{ color: '#9ca3af' }}>キャンセル</button>
          </div>
        )}

        <div className="px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: '#e5e7eb', background: '#FAFAFA' }}>
          <button
            onClick={() => setShowAdd(true)}
            disabled={showAdd}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-bold transition-opacity hover:opacity-85"
            style={{ background: showAdd ? '#e5e7eb' : '#F0FDF4', color: showAdd ? '#9ca3af' : '#166534', border: '1px solid #bbf7d0' }}
          >
            ＋ シフト種別を追加
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-2.5 rounded text-sm font-bold transition-opacity hover:opacity-85"
            style={{ background: NAVY, color: GOLD, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? '保存中...' : '設定を保存'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        ▲▼で順番を変えて「設定を保存」すると出勤簿プルダウンの表示順に反映されます
      </p>
    </div>
  );
}
