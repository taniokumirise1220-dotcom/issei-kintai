'use client';

import { useCallback, useEffect, useState } from 'react';
import { AllowanceItem, Attendance, defaultAllowanceValue, Employee, MonthlyAllowance, SHIFT_LABELS, ShiftSetting, ShiftType } from '@/lib/types';

interface Props {
  employee: Employee;
  year: number;
  month: number;
}

const NAVY = '#1B2B5E';
const GOLD = '#C9A84C';

export default function PayStub({ employee, year, month }: Props) {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [shiftMap, setShiftMap] = useState<Record<string, ShiftSetting>>({});
  const [items, setItems] = useState<AllowanceItem[]>([]);
  const [values, setValues] = useState<Record<number, number>>({});
  const [persistent, setPersistent] = useState(false);
  const [saved, setSaved] = useState(false);

  // 項目編集モード
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<AllowanceItem[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newKind, setNewKind] = useState<'allowance' | 'deduction'>('allowance');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/shift-settings', { cache: 'no-store' })
      .then(r => r.json())
      .then((data: ShiftSetting[]) => {
        const map: Record<string, ShiftSetting> = {};
        for (const s of data) map[s.shift_type] = s;
        setShiftMap(map);
      });
  }, []);

  const [itemsLoaded, setItemsLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/allowance-items', { cache: 'no-store' })
      .then(r => r.json())
      .then((data: AllowanceItem[]) => { setItems(data); setItemsLoaded(true); });
  }, []);

  const load = useCallback(async () => {
    if (!itemsLoaded) return;
    const itemList = items;

    const [attRes, allowRes] = await Promise.all([
      fetch(`/api/attendance?employee_id=${employee.id}&year=${year}&month=${month}`),
      fetch(`/api/allowances?employee_id=${employee.id}&year=${year}&month=${month}`, { cache: 'no-store' }),
    ]);
    const attRows: Attendance[] = await attRes.json();
    const allowRow: MonthlyAllowance | null = await allowRes.json();

    setAttendance(attRows);

    const next: Record<number, number> = {};
    for (const it of itemList) {
      // 未保存の月は従業員マスタの家族手当を初期値にする
      next[it.id] = allowRow ? (allowRow.values[it.id] ?? 0) : defaultAllowanceValue(it, employee);
    }
    setValues(next);
    setPersistent(allowRow?.persistent ?? false);
    setSaved(false);
  }, [employee, year, month, items, itemsLoaded]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    await fetch('/api/allowances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: employee.id, year, month, values, persistent }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // ── 項目編集 ──
  const startEdit = () => { setDraft(items.map(i => ({ ...i }))); setEditMode(true); };
  const cancelEdit = () => { setEditMode(false); setNewLabel(''); };

  const patchDraft = (id: number, patch: Partial<AllowanceItem>) =>
    setDraft(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));

  const moveDraft = (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    if (to < 0 || to >= draft.length) return;
    const next = [...draft];
    [next[idx], next[to]] = [next[to], next[idx]];
    setDraft(next);
  };

  const addItem = async () => {
    if (!newLabel.trim()) return;
    setBusy(true);
    const res = await fetch('/api/allowance-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel, kind: newKind }),
    });
    const created: AllowanceItem = await res.json();
    setDraft(prev => [...prev, created]);
    setNewLabel('');
    setBusy(false);
  };

  const deleteItem = async (id: number) => {
    if (!confirm('この項目を削除しますか？過去月の入力値も削除されます。')) return;
    setBusy(true);
    await fetch('/api/allowance-items', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setDraft(prev => prev.filter(i => i.id !== id));
    setBusy(false);
  };

  const saveItems = async () => {
    setBusy(true);
    const ordered = draft.map((i, idx) => ({ ...i, sort_order: idx + 1 }));
    await fetch('/api/allowance-items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ordered),
    });
    setItems(ordered);
    setBusy(false);
    setEditMode(false);
    setNewLabel('');
  };

  // ── 集計 ──
  const shiftCounts: Record<string, number> = {};
  let basicPay = 0;
  let basicPayDays = 0;
  let nightAllowance = 0;

  for (const row of attendance) {
    const shift = row.shift_type as ShiftType;
    const s = shiftMap[shift];
    const label = s?.label || SHIFT_LABELS[shift] || shift;
    shiftCounts[label] = (shiftCounts[label] || 0) + 1;

    const nightAmt = s?.night_allowance ?? 0;
    const behavior = s?.shift_behavior ?? 'day';
    if (behavior === 'night_full') {
      basicPay += employee.daily_rate;
      basicPayDays += 1;
      nightAllowance += employee.daily_rate + nightAmt;
    } else if (behavior === 'night_only') {
      nightAllowance += employee.daily_rate + nightAmt;
    } else {
      basicPay += employee.daily_rate;
      basicPayDays += 1;
    }
  }

  const allowanceItems = items.filter(i => i.kind === 'allowance');
  const deductionItems = items.filter(i => i.kind === 'deduction');

  const totalAllowances = allowanceItems.reduce((s, i) => s + (values[i.id] ?? 0), 0);
  const totalDeductions  = deductionItems.reduce((s, i) => s + (values[i.id] ?? 0), 0);
  const grossPay = basicPay + nightAllowance + totalAllowances;
  const netPay   = grossPay - totalDeductions;

  const numField = (item: AllowanceItem) => (
    <div key={item.id} className="flex items-center gap-2">
      <label className="w-36 text-sm text-gray-600 shrink-0">{item.label}</label>
      <div className="flex items-center border border-gray-300 rounded overflow-hidden">
        <input
          type="number"
          min={0}
          value={values[item.id] ?? 0}
          onChange={e => setValues(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
          className="w-28 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <span className="px-2 text-sm text-gray-400 bg-gray-50 border-l border-gray-300">円</span>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Attendance summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="font-bold text-gray-800 mb-3">勤怠サマリー</h3>
        {attendance.length === 0 ? (
          <p className="text-gray-400 text-sm">この月の出勤データがありません</p>
        ) : (
          <div className="flex gap-4 flex-wrap">
            {Object.entries(shiftCounts).map(([label, cnt]) => (
              <div key={label} className="text-sm text-gray-700">
                <span className="font-medium">{label}</span>: {cnt}日
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Allowance / Deduction form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">手当・控除入力</h3>
          <div className="flex items-center gap-4">
            {!editMode && (
              <button
                onClick={startEdit}
                className="text-sm px-3 py-1 rounded border transition-colors hover:bg-gray-50"
                style={{ borderColor: GOLD, color: NAVY }}
              >
                項目を編集
              </button>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={persistent}
                onChange={e => setPersistent(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              継続表示モード
            </label>
          </div>
        </div>

        {editMode ? (
          <div>
            <div className="grid grid-cols-12 px-3 py-2 text-xs font-bold tracking-wider rounded-t"
              style={{ background: NAVY, color: GOLD }}>
              <div className="col-span-2 text-center">並び</div>
              <div className="col-span-6">項目名</div>
              <div className="col-span-3 text-center">区分</div>
              <div className="col-span-1" />
            </div>
            <div className="divide-y divide-gray-100 border border-t-0 border-gray-200 rounded-b">
              {draft.map((it, idx) => (
                <div key={it.id} className="grid grid-cols-12 items-center px-3 py-2 gap-2"
                  style={{ background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <div className="col-span-2 flex justify-center gap-1">
                    <button onClick={() => moveDraft(idx, -1)} disabled={idx === 0}
                      className="px-1.5 py-0.5 text-xs rounded hover:bg-gray-200 disabled:opacity-25">▲</button>
                    <button onClick={() => moveDraft(idx, 1)} disabled={idx === draft.length - 1}
                      className="px-1.5 py-0.5 text-xs rounded hover:bg-gray-200 disabled:opacity-25">▼</button>
                  </div>
                  <div className="col-span-6">
                    <input
                      type="text"
                      value={it.label}
                      onChange={e => patchDraft(it.id, { label: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div className="col-span-3">
                    <select
                      value={it.kind}
                      onChange={e => patchDraft(it.id, { kind: e.target.value as AllowanceItem['kind'] })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none"
                      style={{ color: NAVY }}
                    >
                      <option value="allowance">支給</option>
                      <option value="deduction">控除</option>
                    </select>
                  </div>
                  <div className="col-span-1 text-center">
                    <button onClick={() => deleteItem(it.id)} disabled={busy}
                      className="text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      style={{ color: '#ef4444' }} title="削除">✕</button>
                  </div>
                </div>
              ))}
            </div>

            {/* 追加フォーム */}
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="項目名（例: 資格手当）"
                className="flex-1 px-3 py-2 border rounded text-sm focus:outline-none"
                style={{ borderColor: GOLD }}
              />
              <select
                value={newKind}
                onChange={e => setNewKind(e.target.value as 'allowance' | 'deduction')}
                className="px-2 py-2 border border-gray-300 rounded text-xs focus:outline-none"
                style={{ color: NAVY }}
              >
                <option value="allowance">支給</option>
                <option value="deduction">控除</option>
              </select>
              <button onClick={addItem} disabled={busy || !newLabel.trim()}
                className="px-4 py-2 rounded text-sm font-bold transition-opacity hover:opacity-85"
                style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #bbf7d0',
                  opacity: (busy || !newLabel.trim()) ? 0.5 : 1 }}>
                ＋ 追加
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button onClick={saveItems} disabled={busy}
                className="px-5 py-2 rounded text-sm font-bold transition-opacity hover:opacity-85"
                style={{ background: NAVY, color: GOLD, opacity: busy ? 0.6 : 1 }}>
                {busy ? '保存中...' : '項目を保存'}
              </button>
              <button onClick={cancelEdit} className="text-sm" style={{ color: '#9ca3af' }}>キャンセル</button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">支給項目</p>
                <div className="space-y-2">
                  {allowanceItems.length === 0
                    ? <p className="text-xs text-gray-400">項目がありません</p>
                    : allowanceItems.map(numField)}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">控除項目</p>
                <div className="space-y-2">
                  {deductionItems.length === 0
                    ? <p className="text-xs text-gray-400">項目がありません</p>
                    : deductionItems.map(numField)}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleSave}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                保存
              </button>
              {saved && <span className="text-green-600 text-sm font-medium">保存しました ✓</span>}
            </div>
          </>
        )}
      </div>

      {/* Pay stub */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="font-bold text-gray-800 mb-4">
          給与明細 — {employee.name}（{year}年{month}月）
        </h3>

        <div className="space-y-2">
          <Section title="支給">
            <Row label={`基本給（日当 ${employee.daily_rate.toLocaleString()}円 × ${basicPayDays}日）`} amount={basicPay} />
            {nightAllowance > 0 && <Row label="夜勤手当" amount={nightAllowance} />}
            {allowanceItems.filter(i => (values[i.id] ?? 0) > 0).map(i => (
              <Row key={i.id} label={i.label} amount={values[i.id]} />
            ))}
            <TotalRow label="支給合計" amount={grossPay} />
          </Section>

          <Section title="控除">
            {deductionItems.filter(i => (values[i.id] ?? 0) > 0).map(i => (
              <Row key={i.id} label={i.label} amount={values[i.id]} isDeduction />
            ))}
            <TotalRow label="控除合計" amount={totalDeductions} isDeduction />
          </Section>

          <div className="pt-4 border-t-2 border-gray-800">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-gray-800">差引支給額（手取り）</span>
              <span className="text-2xl font-bold text-blue-700">{netPay.toLocaleString()}円</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
      <div className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-600 border-b border-gray-200">
        {title}
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

function Row({ label, amount, isDeduction = false }: { label: string; amount: number; isDeduction?: boolean }) {
  return (
    <div className="flex justify-between items-center px-4 py-2 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={isDeduction ? 'text-red-600' : 'text-gray-800'}>
        {isDeduction ? '−' : ''}{amount.toLocaleString()}円
      </span>
    </div>
  );
}

function TotalRow({ label, amount, isDeduction = false }: { label: string; amount: number; isDeduction?: boolean }) {
  return (
    <div className="flex justify-between items-center px-4 py-2 font-semibold text-sm bg-gray-50">
      <span className="text-gray-700">{label}</span>
      <span className={isDeduction ? 'text-red-700' : 'text-gray-900'}>
        {isDeduction ? '−' : ''}{amount.toLocaleString()}円
      </span>
    </div>
  );
}
