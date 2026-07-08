'use client';

import { useEffect, useState } from 'react';
import { BUILTIN_SHIFTS, Employee, ShiftSetting } from '@/lib/types';

interface Props {
  employees: Employee[];
  onUpdated: () => void;
}

const NAVY = '#1B2B5E';
const GOLD = '#C9A84C';

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      step={500}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full px-3 py-2 border rounded text-sm text-right focus:outline-none"
      style={{ borderColor: '#d1d5db' }}
      onFocus={e => (e.target.style.borderColor = GOLD)}
      onBlur={e => (e.target.style.borderColor = '#d1d5db')}
    />
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border rounded text-sm focus:outline-none"
      style={{ borderColor: '#d1d5db' }}
      onFocus={e => (e.target.style.borderColor = GOLD)}
      onBlur={e => (e.target.style.borderColor = '#d1d5db')}
    />
  );
}

const EMPTY_NEW = { label: '', night_allowance: 0 };

export default function AllowanceSettings({ employees: _employees, onUpdated: _onUpdated }: Props) {
  const [settings, setSettings] = useState<ShiftSetting[]>([]);
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
    fetch('/api/shift-settings', { cache: 'no-store' })
      .then(r => r.json())
      .then(setSettings);

  useEffect(() => { load(); }, []);

  const updateLabel = (shift_type: string, label: string) =>
    setSettings(prev => prev.map(s => s.shift_type === shift_type ? { ...s, label } : s));

  const updateNight = (shift_type: string, value: number) =>
    setSettings(prev => prev.map(s => s.shift_type === shift_type ? { ...s, night_allowance: value } : s));

  const save = async () => {
    setSaving(true);
    await fetch('/api/shift-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
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
      body: JSON.stringify({ label: newShift.label, night_allowance: newShift.night_allowance,
        clock_in: '', clock_out: '', rest_time: '', actual_time: '' }),
    });
    setAdding(false);
    setShowAdd(false);
    setNewShift(EMPTY_NEW);
    await load();
    showToast('シフト種別を追加しました');
  };

  const deleteShift = async (shift_type: string) => {
    if (!confirm('このシフト種別を削除しますか？')) return;
    await fetch('/api/shift-settings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shift_type }),
    });
    await load();
    showToast('削除しました');
  };

  return (
    <div className="max-w-2xl mx-auto">
      {toast && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3 rounded shadow-lg text-sm font-medium text-white"
          style={{ background: NAVY, borderLeft: `4px solid ${GOLD}` }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="rounded-xl overflow-hidden shadow-sm mb-6" style={{ background: NAVY }}>
        <div className="px-8 py-6">
          <div className="section-label mb-1">ALLOWANCE SETTINGS</div>
          <h2 className="text-2xl font-bold text-white">手当設定</h2>
          <div className="mt-2" style={{ width: 40, height: 2, background: GOLD }} />
          <p className="mt-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
            シフト種別の追加・編集・削除と、夜間手当単価を設定します。給与計算・前借①に反映されます。
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 px-6 py-3 text-xs font-bold tracking-wider" style={{ background: NAVY, color: GOLD }}>
          <div className="col-span-5">シフト種別名</div>
          <div className="col-span-4 text-right">夜間手当単価 (円/回)</div>
          <div className="col-span-2 text-center">夜間</div>
          <div className="col-span-1" />
        </div>

        <div className="divide-y divide-gray-100">
          {settings.filter(s =>
            !BUILTIN_SHIFTS.includes(s.shift_type as never) || (s.night_allowance ?? 0) > 0
          ).map((s, i) => {
            const isBuiltin = BUILTIN_SHIFTS.includes(s.shift_type as never);
            return (
              <div key={s.shift_type} className="grid grid-cols-12 items-center px-6 py-3 gap-2"
                style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                {/* シフト種別名 */}
                <div className="col-span-5">
                  {isBuiltin ? (
                    <div className="flex items-center gap-2">
                      <TextInput value={s.label} onChange={v => updateLabel(s.shift_type, v)} />
                      <span className="text-xs shrink-0" style={{ color: '#d1d5db' }}>固定</span>
                    </div>
                  ) : (
                    <TextInput value={s.label} onChange={v => updateLabel(s.shift_type, v)} />
                  )}
                </div>
                {/* 夜間手当単価 */}
                <div className="col-span-4">
                  <NumInput value={s.night_allowance ?? 0} onChange={v => updateNight(s.shift_type, v)} />
                </div>
                {/* 夜間バッジ */}
                <div className="col-span-2 text-center">
                  {(s.night_allowance ?? 0) > 0 ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background: '#F5F3FF', color: '#6D28D9' }}>夜間</span>
                  ) : (
                    <span className="text-xs" style={{ color: '#d1d5db' }}>—</span>
                  )}
                </div>
                {/* 削除ボタン */}
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

        {/* 追加フォーム */}
        {showAdd && (
          <div className="border-t px-6 py-4" style={{ background: '#FAFFF4', borderColor: '#d1fae5' }}>
            <div className="text-sm font-bold mb-3" style={{ color: NAVY }}>新しいシフト種別を追加</div>
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <input
                  type="text"
                  value={newShift.label}
                  onChange={e => setNewShift(p => ({ ...p, label: e.target.value }))}
                  placeholder="シフト名（例: 早番）"
                  autoFocus
                  className="w-full px-3 py-2 border rounded text-sm focus:outline-none"
                  style={{ borderColor: GOLD }}
                />
              </div>
              <div className="col-span-4">
                <NumInput value={newShift.night_allowance} onChange={v => setNewShift(p => ({ ...p, night_allowance: v }))} />
              </div>
              <div className="col-span-2" />
              <div className="col-span-1 text-center">
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

        <div className="px-6 py-4 border-t flex items-center justify-between"
          style={{ borderColor: '#e5e7eb', background: '#FAFAFA' }}>
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
        固定シフトは削除不可。夜間手当単価 &gt; 0 のシフトが給与計算の夜間手当に加算されます
      </p>
    </div>
  );
}
