'use client';

import { useCallback, useEffect, useState } from 'react';
import { Attendance, Employee, ShiftSetting, ShiftType } from '@/lib/types';

interface Props {
  employees: Employee[];
}

const NAVY = '#1B2B5E';
const GOLD = '#C9A84C';

function getQuarterMonths(year: number, quarter: number): { year: number; month: number }[] {
  const startMonth = (quarter - 1) * 3 + 1;
  return [0, 1, 2].map(i => {
    const m = startMonth + i;
    return m > 12
      ? { year: year + 1, month: m - 12 }
      : { year, month: m };
  });
}

function calcAdvance1(employee: Employee, attendance: Attendance[], shiftMap: Record<string, ShiftSetting>): number {
  const basicPay = employee.monthly_salary ?? 0;
  let payrollNight = 0;
  let stubBasicPay = 0;
  let stubNightAllow = 0;

  for (const a of attendance) {
    const shift = a.shift_type as ShiftType;
    const s = shiftMap[shift];
    const nightAmt = s?.night_allowance ?? 0;
    const behavior = s?.shift_behavior ?? 'day';
    if (behavior === 'night_full') {
      stubBasicPay   += employee.daily_rate;
      stubNightAllow += employee.daily_rate + nightAmt;
      payrollNight   += nightAmt;
    } else if (behavior === 'night_only') {
      stubNightAllow += employee.daily_rate + nightAmt;
      payrollNight   += nightAmt;
    } else {
      stubBasicPay += employee.daily_rate;
    }
  }

  return (stubBasicPay - basicPay)
       + (stubNightAllow - payrollNight)
       + (employee.family_allowance ?? 0);
}

interface CellData {
  value: number;
  confirmed: boolean;
}

export default function QuarterlyReport({ employees }: Props) {
  const now = new Date();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

  const [year, setYear]       = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(currentQuarter);
  const [data, setData]       = useState<Record<string, Record<string, CellData>>>({});
  const [loading, setLoading] = useState(false);
  const [shiftMap, setShiftMap] = useState<Record<string, ShiftSetting>>({});

  const months = getQuarterMonths(year, quarter);

  useEffect(() => {
    fetch('/api/shift-settings', { cache: 'no-store' })
      .then(r => r.json())
      .then((data: ShiftSetting[]) => {
        const map: Record<string, ShiftSetting> = {};
        for (const s of data) map[s.shift_type] = s;
        setShiftMap(map);
      });
  }, []);

  const load = useCallback(async () => {
    if (employees.length === 0 || Object.keys(shiftMap).length === 0) return;
    setLoading(true);

    const result: Record<string, Record<string, CellData>> = {};

    await Promise.all(employees.map(async emp => {
      result[emp.id] = {};

      await Promise.all(months.map(async ({ year: y, month: m }) => {
        const key = `${y}-${m}`;
        const [attRes, payRes] = await Promise.all([
          fetch(`/api/attendance?employee_id=${emp.id}&year=${y}&month=${m}`),
          fetch(`/api/payroll?employee_id=${emp.id}&year=${y}&month=${m}`),
        ]);
        const att: Attendance[] = await attRes.json();
        const pay = await payRes.json();

        let value: number;
        if (pay.confirmed && pay.snap_advance1 !== null && pay.snap_advance1 !== undefined) {
          value = pay.snap_advance1;
        } else {
          value = calcAdvance1(emp, att, shiftMap);
        }
        result[emp.id][key] = { value, confirmed: pay.confirmed ?? false };
      }));
    }));

    setData(result);
    setLoading(false);
  }, [employees, year, quarter, shiftMap]);

  useEffect(() => { load(); }, [load]);

  const prevQuarter = () => {
    if (quarter === 1) { setYear(y => y - 1); setQuarter(4); }
    else setQuarter(q => q - 1);
  };
  const nextQuarter = () => {
    if (quarter === 4) { setYear(y => y + 1); setQuarter(1); }
    else setQuarter(q => q + 1);
  };

  const quarterTotal = (empId: number) =>
    months.reduce((sum, { year: y, month: m }) => {
      const v = data[empId]?.[`${y}-${m}`]?.value ?? 0;
      return sum + v;
    }, 0);

  return (
    <div>
      {/* Header */}
      <div className="rounded-xl overflow-hidden shadow-sm mb-6" style={{ background: NAVY }}>
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <div className="section-label mb-1">QUARTERLY REPORT</div>
            <h2 className="text-2xl font-bold text-white">四半期報酬</h2>
            <div className="mt-2" style={{ width: 40, height: 2, background: GOLD }} />
          </div>
          <div className="flex items-center gap-4">
            <button onClick={prevQuarter}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              style={{ color: GOLD }}>◀</button>
            <div className="text-center">
              <div className="text-xs tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>PERIOD</div>
              <span className="text-xl font-bold text-white">{year}年 Q{quarter}</span>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {months.map(({ month: m }) => `${m}月`).join('・')}
              </div>
            </div>
            <button onClick={nextQuarter}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              style={{ color: GOLD }}>▶</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-sm" style={{ color: '#9ca3af' }}>読み込み中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: NAVY }}>
                  <th className="text-left px-6 py-3 font-bold" style={{ color: GOLD }}>氏名</th>
                  {months.map(({ year: y, month: m }) => (
                    <th key={`${y}-${m}`} className="text-right px-6 py-3 font-bold" style={{ color: GOLD }}>
                      {m}月
                    </th>
                  ))}
                  <th className="text-right px-6 py-3 font-bold" style={{ color: GOLD }}>合計</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => (
                  <tr key={emp.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td className="px-6 py-4 font-medium" style={{ color: NAVY }}>{emp.name}</td>
                    {months.map(({ year: y, month: m }) => {
                      const cell = data[emp.id]?.[`${y}-${m}`];
                      return (
                        <td key={`${y}-${m}`} className="px-6 py-4 text-right">
                          {cell !== undefined ? (
                            <span>
                              <span className="font-semibold" style={{ color: NAVY }}>
                                {cell.value.toLocaleString()}
                              </span>
                              <span className="text-xs ml-1" style={{ color: '#9ca3af' }}>円</span>
                              {cell.confirmed && (
                                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full font-bold"
                                  style={{ background: '#FBF7EE', color: GOLD }}>確定</span>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: '#d1d5db' }}>—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-base" style={{ color: NAVY }}>
                        {quarterTotal(emp.id).toLocaleString()}
                      </span>
                      <span className="text-xs ml-1" style={{ color: '#9ca3af' }}>円</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#FBF7EE' }}>
                  <td className="px-6 py-4 font-bold" style={{ color: NAVY }}>合計</td>
                  {months.map(({ year: y, month: m }) => {
                    const monthTotal = employees.reduce((sum, emp) => {
                      return sum + (data[emp.id]?.[`${y}-${m}`]?.value ?? 0);
                    }, 0);
                    return (
                      <td key={`${y}-${m}`} className="px-6 py-4 text-right">
                        <span className="font-bold" style={{ color: NAVY }}>{monthTotal.toLocaleString()}</span>
                        <span className="text-xs ml-1" style={{ color: '#9ca3af' }}>円</span>
                      </td>
                    );
                  })}
                  <td className="px-6 py-4 text-right">
                    <span className="font-bold text-base" style={{ color: NAVY }}>
                      {employees.reduce((s, emp) => s + quarterTotal(emp.id), 0).toLocaleString()}
                    </span>
                    <span className="text-xs ml-1" style={{ color: '#9ca3af' }}>円</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-center mt-4" style={{ color: '#9ca3af' }}>
        確定済みの月はスナップショット値、未確定の月はリアルタイム計算値を表示しています
      </p>
    </div>
  );
}
