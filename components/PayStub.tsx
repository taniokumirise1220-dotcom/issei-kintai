'use client';

import { useCallback, useEffect, useState } from 'react';
import { Attendance, calcShiftPay, Employee, MonthlyAllowance, SHIFT_LABELS, ShiftSetting, ShiftType } from '@/lib/types';

interface Props {
  employee: Employee;
  year: number;
  month: number;
}

export default function PayStub({ employee, year, month }: Props) {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [allowance, setAllowance] = useState<MonthlyAllowance | null>(null);
  const [shiftMap, setShiftMap] = useState<Record<string, ShiftSetting>>({});

  useEffect(() => {
    fetch('/api/shift-settings', { cache: 'no-store' })
      .then(r => r.json())
      .then((data: ShiftSetting[]) => {
        const map: Record<string, ShiftSetting> = {};
        for (const s of data) map[s.shift_type] = s;
        setShiftMap(map);
      });
  }, []);
  const [form, setForm] = useState({
    family_allowance: 0,
    skill_allowance: 0,
    business_trip_allowance: 0,
    rent_deduction: 0,
    utilities_deduction: 0,
    persistent: false,
  });
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const [attRes, allowRes] = await Promise.all([
      fetch(`/api/attendance?employee_id=${employee.id}&year=${year}&month=${month}`),
      fetch(`/api/allowances?employee_id=${employee.id}&year=${year}&month=${month}`),
    ]);
    const attRows: Attendance[] = await attRes.json();
    const allowRow: MonthlyAllowance | null = await allowRes.json();

    setAttendance(attRows);

    if (allowRow) {
      setAllowance(allowRow);
      setForm({
        family_allowance: allowRow.family_allowance,
        skill_allowance: allowRow.skill_allowance,
        business_trip_allowance: allowRow.business_trip_allowance,
        rent_deduction: allowRow.rent_deduction,
        utilities_deduction: allowRow.utilities_deduction,
        persistent: allowRow.persistent,
      });
    } else {
      setForm({
        family_allowance: 0,
        skill_allowance: 0,
        business_trip_allowance: 0,
        rent_deduction: 0,
        utilities_deduction: 0,
        persistent: false,
      });
    }
    setSaved(false);
  }, [employee.id, year, month]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    await fetch('/api/allowances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: employee.id, year, month, ...form }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Calculate pay
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
    } else if (behavior === 'paid_leave') {
      basicPay += employee.daily_rate;
      basicPayDays += 1;
    } else {
      basicPay += employee.daily_rate;
      basicPayDays += 1;
    }
  }

  const totalAllowances =
    form.family_allowance + form.skill_allowance + form.business_trip_allowance;
  const totalDeductions = form.rent_deduction + form.utilities_deduction;
  const grossPay = basicPay + nightAllowance + totalAllowances;
  const netPay = grossPay - totalDeductions;

  const numField = (label: string, key: keyof typeof form, isDeduction = false) => (
    <div className="flex items-center gap-2">
      <label className="w-36 text-sm text-gray-600 shrink-0">{label}</label>
      <div className="flex items-center border border-gray-300 rounded overflow-hidden">
        <input
          type="number"
          min={0}
          value={form[key] as number}
          onChange={e => setForm(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
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
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.persistent}
              onChange={e => setForm(prev => ({ ...prev, persistent: e.target.checked }))}
              className="w-4 h-4 accent-blue-600"
            />
            継続表示モード
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">支給項目</p>
            <div className="space-y-2">
              {numField('家族手当', 'family_allowance')}
              {numField('能力手当', 'skill_allowance')}
              {numField('出張手当', 'business_trip_allowance')}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">控除項目</p>
            <div className="space-y-2">
              {numField('家賃控除', 'rent_deduction', true)}
              {numField('水道光熱費', 'utilities_deduction', true)}
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
            {form.family_allowance > 0 && <Row label="家族手当" amount={form.family_allowance} />}
            {form.skill_allowance > 0 && <Row label="能力手当" amount={form.skill_allowance} />}
            {form.business_trip_allowance > 0 && <Row label="出張手当" amount={form.business_trip_allowance} />}
            <TotalRow label="支給合計" amount={grossPay} />
          </Section>

          <Section title="控除">
            {form.rent_deduction > 0 && <Row label="家賃控除" amount={form.rent_deduction} isDeduction />}
            {form.utilities_deduction > 0 && <Row label="水道光熱費" amount={form.utilities_deduction} isDeduction />}
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
