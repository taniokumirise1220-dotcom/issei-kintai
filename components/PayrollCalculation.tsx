'use client';

import { useCallback, useEffect, useState } from 'react';
import { Attendance, Employee, ShiftType } from '@/lib/types';

interface Props {
  employee: Employee;
  year: number;
  month: number;
}

const NAVY = '#1B2B5E';
const GOLD = '#C9A84C';

function calcPayroll(employee: Employee, attendance: Attendance[]) {
  // 給与計算ページの基本給・夜間手当
  const basicPay      = employee.monthly_salary ?? 0;
  let payrollNight    = 0;   // 給与計算の夜間手当（5000/3000 固定）

  // 給与明細ベースの計算（日当ベース）
  let stubBasicPay    = 0;
  let stubNightAllow  = 0;

  for (const a of attendance) {
    const shift = a.shift_type as ShiftType;
    if (shift === 'night_full') {
      stubBasicPay   += employee.daily_rate;
      stubNightAllow += employee.daily_rate + 5000;
      payrollNight   += 5000;
    } else if (shift === 'night_only') {
      stubNightAllow += employee.daily_rate + 3000;
      payrollNight   += 3000;
    } else {
      // day / paid_leave
      stubBasicPay   += employee.daily_rate;
    }
  }

  // 前借① = (給与明細基本給 - 月給) + (給与明細夜間手当 - 給与計算夜間手当) + 家族手当
  const advance1 = (stubBasicPay - basicPay)
                 + (stubNightAllow - payrollNight)
                 + (employee.family_allowance ?? 0);

  return { basicPay, nightAllowance: payrollNight, advance1 };
}

export default function PayrollCalculation({ employee, year, month }: Props) {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [advance2, setAdvance2]     = useState(0);
  const [inputVal, setInputVal]     = useState('0');
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const load = useCallback(async () => {
    const [attRes, payRes] = await Promise.all([
      fetch(`/api/attendance?employee_id=${employee.id}&year=${year}&month=${month}`),
      fetch(`/api/payroll?employee_id=${employee.id}&year=${year}&month=${month}`),
    ]);
    const att: Attendance[] = await attRes.json();
    const pay = await payRes.json();
    setAttendance(att);
    setAdvance2(pay.advance2 ?? 0);
    setInputVal(String(pay.advance2 ?? 0));
  }, [employee.id, year, month]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    await fetch('/api/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: employee.id, year, month, advance2: parseInt(inputVal) || 0 }),
    });
    setAdvance2(parseInt(inputVal) || 0);
    setSaving(false);
    showToast('保存しました');
  };

  const { basicPay, nightAllowance, advance1 } = calcPayroll(employee, attendance);
  const total = basicPay + nightAllowance + advance1 + advance2;

  const nightCount = attendance.filter(a =>
    a.shift_type === 'night_full' || a.shift_type === 'night_only'
  ).length;

  const rows = [
    { label: '基本給',   value: basicPay,      color: NAVY,      note: '月給' },
    { label: '夜間手当', value: nightAllowance, color: '#6D28D9', note: `夜勤${nightCount}回分` },
  ];

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
          <div className="section-label mb-1">PAYROLL CALCULATION</div>
          <h2 className="text-2xl font-bold text-white">給与計算</h2>
          <div className="mt-2" style={{ width: 40, height: 2, background: GOLD }} />
          <p className="mt-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {employee.name}　{year}年{month}月
          </p>
        </div>
      </div>

      {/* Payroll card */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
        {/* 支給項目 */}
        <div className="px-6 py-3 border-b text-xs font-bold tracking-wider"
          style={{ background: NAVY, color: GOLD }}>
          支給項目
        </div>

        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div>
              <div className="text-sm font-semibold" style={{ color: NAVY }}>{row.label}</div>
              <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{row.note}</div>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold" style={{ color: row.color }}>
                {row.value.toLocaleString()}
              </span>
              <span className="text-sm ml-1" style={{ color: '#6b7280' }}>円</span>
            </div>
          </div>
        ))}

        {/* 前借① — 支給項目 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <div className="text-sm font-semibold" style={{ color: NAVY }}>前借①</div>
            <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
              (給与明細基本給−月給) ＋ (給与明細夜間手当−夜間手当) ＋ 家族手当
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl font-bold" style={{ color: '#16A34A' }}>
              {advance1.toLocaleString()}
            </span>
            <span className="text-sm ml-1" style={{ color: '#6b7280' }}>円</span>
          </div>
        </div>

        {/* 前借② — 支給項目 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <div className="text-sm font-semibold" style={{ color: NAVY }}>前借②</div>
            <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>手入力で保存されます</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center border rounded overflow-hidden" style={{ borderColor: GOLD }}>
              <input
                type="number"
                min={0}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                className="px-3 py-2 text-sm text-right focus:outline-none w-32"
              />
              <span className="px-2 text-xs" style={{ background: '#f9fafb', borderLeft: '1px solid #e5e7eb', color: '#6b7280' }}>円</span>
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded text-sm font-bold transition-opacity hover:opacity-85"
              style={{ background: NAVY, color: GOLD, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? '保存中' : '保存'}
            </button>
          </div>
        </div>

        {/* 合計 */}
        <div className="flex items-center justify-between px-6 py-6"
          style={{ background: '#FBF7EE' }}>
          <div className="text-base font-bold" style={{ color: NAVY }}>差引支給額</div>
          <div>
            <span className="text-2xl font-bold" style={{ color: total >= 0 ? NAVY : '#ef4444' }}>
              {total.toLocaleString()}
            </span>
            <span className="text-sm ml-1" style={{ color: '#6b7280' }}>円</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-center" style={{ color: '#9ca3af' }}>
        すべての項目は出勤簿・従業員管理のデータから自動計算されます
      </p>
    </div>
  );
}
