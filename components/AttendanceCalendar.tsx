'use client';

import { useCallback, useEffect, useState } from 'react';
import { Attendance, Employee, SHIFT_COLORS, SHIFT_LABELS, ShiftType } from '@/lib/types';

interface Props {
  employee: Employee;
  year: number;
  month: number;
}

const DAYS_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const SHIFT_OPTIONS: ShiftType[] = ['day', 'night_full', 'night_only', 'paid_leave'];

export default function AttendanceCalendar({ employee, year, month }: Props) {
  const [attendance, setAttendance] = useState<Record<string, ShiftType>>({});
  const [loading, setLoading] = useState(true);
  const [activeCell, setActiveCell] = useState<string | null>(null);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/attendance?employee_id=${employee.id}&year=${year}&month=${month}`);
    const rows: Attendance[] = await res.json();
    const map: Record<string, ShiftType> = {};
    for (const row of rows) {
      const d = new Date(row.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      map[key] = row.shift_type;
    }
    setAttendance(map);
    setLoading(false);
  }, [employee.id, year, month]);

  useEffect(() => {
    fetchAttendance();
    setActiveCell(null);
  }, [fetchAttendance]);

  const setShift = async (dateStr: string, shiftType: ShiftType | null) => {
    if (shiftType === null) {
      await fetch('/api/attendance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employee.id, date: dateStr }),
      });
      setAttendance(prev => {
        const next = { ...prev };
        delete next[dateStr];
        return next;
      });
    } else {
      await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employee.id, date: dateStr, shift_type: shiftType }),
      });
      setAttendance(prev => ({ ...prev, [dateStr]: shiftType }));
    }
    setActiveCell(null);
  };

  const getDaysInMonth = () => {
    const days: { date: Date; key: string }[] = [];
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ date: new Date(d), key });
    }
    return days;
  };

  const days = getDaysInMonth();
  const startDow = new Date(year, month - 1, 1).getDay();
  const totalRows = Math.ceil((startDow + days.length) / 7);

  // Summary counts
  const counts = { day: 0, night_full: 0, night_only: 0, paid_leave: 0 };
  for (const s of Object.values(attendance)) {
    counts[s]++;
  }

  if (loading) return <div className="text-center text-gray-400 py-20">読み込み中...</div>;

  return (
    <div>
      {/* Summary bar */}
      <div className="flex gap-4 mb-4 flex-wrap">
        {SHIFT_OPTIONS.map(s => (
          <div key={s} className={`px-3 py-1.5 rounded-full text-sm font-medium ${SHIFT_COLORS[s]}`}>
            {SHIFT_LABELS[s]}: {counts[s]}日
          </div>
        ))}
        <div className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
          合計: {Object.keys(attendance).length}日
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 rounded-t-xl overflow-hidden">
          {DAYS_OF_WEEK.map((d, i) => (
            <div
              key={d}
              className={`py-2 text-center text-sm font-semibold ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {Array.from({ length: startDow }).map((_, i) => (
            <div key={`empty-${i}`} className="h-24 border-b border-r border-gray-100 bg-gray-50" />
          ))}

          {days.map(({ date, key }) => {
            const dow = date.getDay();
            const shift = attendance[key];
            const isToday = key === new Date().toISOString().split('T')[0];
            const isActive = activeCell === key;
            const rowIndex = Math.floor((startDow + date.getDate() - 1) / 7);
            const isLastRows = rowIndex >= totalRows - 2;

            return (
              <div
                key={key}
                className={`h-24 border-b border-r border-gray-100 p-1 relative cursor-pointer hover:bg-gray-50 transition-colors ${
                  isToday ? 'bg-blue-50' : ''
                }`}
                onClick={() => setActiveCell(isActive ? null : key)}
              >
                <span className={`text-sm font-medium ${
                  dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-700'
                } ${isToday ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full text-xs' : ''}`}>
                  {date.getDate()}
                </span>

                {shift && (
                  <div className={`mt-1 text-xs px-1.5 py-0.5 rounded font-medium ${SHIFT_COLORS[shift]} truncate`}>
                    {SHIFT_LABELS[shift]}
                  </div>
                )}

                {/* Dropdown */}
                {isActive && (
                  <div className={`absolute z-20 left-0 bg-white border border-gray-200 rounded-lg shadow-lg w-40 py-1 ${isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'}`}
                    onClick={e => e.stopPropagation()}>
                    {SHIFT_OPTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => setShift(key, s)}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${
                          shift === s ? 'font-bold text-blue-600' : 'text-gray-700'
                        }`}
                      >
                        {SHIFT_LABELS[s]}
                      </button>
                    ))}
                    {shift && (
                      <button
                        onClick={() => setShift(key, null)}
                        className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 border-t border-gray-100"
                      >
                        クリア
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-2 text-center">日付をクリックしてシフトを入力してください</p>
    </div>
  );
}
