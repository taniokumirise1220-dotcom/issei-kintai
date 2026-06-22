'use client';

import { useEffect, useState } from 'react';
import { ShiftSetting, ShiftType, SHIFT_LABELS } from '@/lib/types';

const NAVY = '#1B2B5E';
const GOLD = '#C9A84C';

const SHIFT_ORDER: ShiftType[] = ['day', 'night_full', 'night_only', 'paid_leave'];

const SHIFT_COLORS: Record<ShiftType, { bg: string; text: string }> = {
  day:        { bg: '#EFF6FF', text: '#1D4ED8' },
  night_full: { bg: '#F5F3FF', text: '#6D28D9' },
  night_only: { bg: '#EEF2FF', text: '#4338CA' },
  paid_leave: { bg: '#F0FDF4', text: '#166534' },
};

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

export default function ShiftSettingsEditor() {
  const [settings, setSettings] = useState<ShiftSetting[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    fetch('/api/shift-settings')
      .then(r => r.json())
      .then((data: ShiftSetting[]) => {
        // sort by defined order
        const sorted = SHIFT_ORDER.map(t => data.find(s => s.shift_type === t)).filter(Boolean) as ShiftSetting[];
        setSettings(sorted);
      });
  }, []);

  const update = (shift_type: ShiftType, field: keyof Omit<ShiftSetting, 'shift_type'>, value: string) => {
    setSettings(prev => prev.map(s => s.shift_type === shift_type ? { ...s, [field]: value } : s));
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
            シフト種別ごとの出勤・退社・休憩時間を設定します。Excel出勤簿に反映されます。
          </p>
        </div>
      </div>

      {/* Table header */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 px-6 py-3 text-xs font-bold tracking-wider" style={{ background: NAVY, color: GOLD }}>
          <div className="col-span-3">シフト種別</div>
          <div className="col-span-2 text-center">出勤時刻</div>
          <div className="col-span-2 text-center">退社時刻</div>
          <div className="col-span-2 text-center">休憩時間</div>
          <div className="col-span-2 text-center">実働時間</div>
          <div className="col-span-1 text-center">形式</div>
        </div>

        <div className="divide-y divide-gray-100">
          {settings.map(s => {
            const color = SHIFT_COLORS[s.shift_type];
            return (
              <div key={s.shift_type} className="grid grid-cols-12 items-center px-6 py-4 gap-2">
                <div className="col-span-3">
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: color.bg, color: color.text }}>
                    {SHIFT_LABELS[s.shift_type]}
                  </span>
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
                <div className="col-span-1 text-center text-xs" style={{ color: '#9ca3af' }}>
                  h:mm
                </div>
              </div>
            );
          })}
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
        時刻は「h:mm」形式で入力してください（例: 8:30 / 17:00 / 翌8:30）
      </p>
    </div>
  );
}
