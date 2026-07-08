'use client';

import { useEffect, useState } from 'react';
import { Employee } from '@/lib/types';

interface Props {
  employees: Employee[];
  onUpdated: () => void;
}

const NAVY = '#1B2B5E';
const GOLD = '#C9A84C';

interface Row {
  id: number;
  name: string;
  family_allowance: number;
  rent_deduction: number;
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full px-3 py-2 border rounded text-sm text-right focus:outline-none"
      style={{ borderColor: '#d1d5db' }}
      onFocus={e => (e.target.style.borderColor = GOLD)}
      onBlur={e => (e.target.style.borderColor = '#d1d5db')}
    />
  );
}

export default function AllowanceSettings({ employees, onUpdated }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setRows(employees.map(e => ({
      id: e.id,
      name: e.name,
      family_allowance: e.family_allowance ?? 0,
      rent_deduction: e.rent_deduction ?? 0,
    })));
  }, [employees]);

  const update = (id: number, field: 'family_allowance' | 'rent_deduction', value: number) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const save = async () => {
    setSaving(true);
    const emp = employees;
    await Promise.all(rows.map(row => {
      const orig = emp.find(e => e.id === row.id)!;
      return fetch(`/api/employees/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orig.name,
          daily_rate: orig.daily_rate,
          monthly_salary: orig.monthly_salary ?? 0,
          family_allowance: row.family_allowance,
          rent_deduction: row.rent_deduction,
        }),
      });
    }));
    setSaving(false);
    onUpdated();
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

      {/* Header */}
      <div className="rounded-xl overflow-hidden shadow-sm mb-6" style={{ background: NAVY }}>
        <div className="px-8 py-6">
          <div className="section-label mb-1">ALLOWANCE SETTINGS</div>
          <h2 className="text-2xl font-bold text-white">手当設定</h2>
          <div className="mt-2" style={{ width: 40, height: 2, background: GOLD }} />
          <p className="mt-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
            従業員ごとのデフォルト手当・控除額を設定します。給与明細の月次設定で個別に上書きすることもできます。
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 px-6 py-3 text-xs font-bold tracking-wider" style={{ background: NAVY, color: GOLD }}>
          <div className="col-span-4">氏名</div>
          <div className="col-span-3 text-right">家族手当 (円)</div>
          <div className="col-span-1 text-center text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>支給</div>
          <div className="col-span-3 text-right">家賃控除 (円)</div>
          <div className="col-span-1 text-center text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>控除</div>
        </div>

        <div className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <div key={row.id} className="grid grid-cols-12 items-center px-6 py-3 gap-2"
              style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
              <div className="col-span-4 font-medium text-sm" style={{ color: NAVY }}>{row.name}</div>
              <div className="col-span-3">
                <NumInput value={row.family_allowance} onChange={v => update(row.id, 'family_allowance', v)} />
              </div>
              <div className="col-span-1 text-center">
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>支給</span>
              </div>
              <div className="col-span-3">
                <NumInput value={row.rent_deduction} onChange={v => update(row.id, 'rent_deduction', v)} />
              </div>
              <div className="col-span-1 text-center">
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#FFF1F2', color: '#BE123C' }}>控除</span>
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
        ここで設定した値が給与明細の初期値として使われます
      </p>
    </div>
  );
}
