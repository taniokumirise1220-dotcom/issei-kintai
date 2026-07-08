'use client';

import { useEffect, useState } from 'react';
import { Employee, ShiftSetting } from '@/lib/types';

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

export default function AllowanceSettings({ employees: _employees, onUpdated: _onUpdated }: Props) {
  const [settings, setSettings] = useState<ShiftSetting[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const load = () =>
    fetch('/api/shift-settings', { cache: 'no-store' })
      .then(r => r.json())
      .then(setSettings);

  useEffect(() => { load(); }, []);

  const update = (shift_type: string, value: number) => {
    setSettings(prev => prev.map(s => s.shift_type === shift_type ? { ...s, night_allowance: value } : s));
  };

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
            シフト種別ごとの夜間手当単価を設定します。給与計算・前借①の計算に反映されます。
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 px-6 py-3 text-xs font-bold tracking-wider" style={{ background: NAVY, color: GOLD }}>
          <div className="col-span-5">シフト種別</div>
          <div className="col-span-5 text-right">夜間手当単価 (円/回)</div>
          <div className="col-span-2" />
        </div>

        <div className="divide-y divide-gray-100">
          {settings.map((s, i) => (
            <div key={s.shift_type} className="grid grid-cols-12 items-center px-6 py-4 gap-3"
              style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
              <div className="col-span-5">
                <span className="font-medium text-sm" style={{ color: NAVY }}>{s.label || s.shift_type}</span>
                {s.is_builtin && (
                  <span className="ml-2 text-xs" style={{ color: '#d1d5db' }}>固定</span>
                )}
              </div>
              <div className="col-span-5">
                <NumInput value={s.night_allowance ?? 0} onChange={v => update(s.shift_type, v)} />
              </div>
              <div className="col-span-2 text-xs" style={{ color: '#9ca3af' }}>
                {(s.night_allowance ?? 0) > 0 ? (
                  <span className="px-2 py-0.5 rounded-full font-bold" style={{ background: '#F5F3FF', color: '#6D28D9' }}>夜間</span>
                ) : (
                  <span style={{ color: '#d1d5db' }}>—</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t flex justify-end" style={{ borderColor: '#e5e7eb', background: '#FAFAFA' }}>
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
        夜間手当単価が0以外のシフトが給与計算の「夜間手当」に加算されます
      </p>
    </div>
  );
}
