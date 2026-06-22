import * as XLSX from 'xlsx';
import { ShiftType } from './types';

export function exportAttendanceExcel(
  employeeName: string,
  year: number,
  month: number,
  attendance: Record<string, ShiftType>
) {
  const daysInMonth = new Date(year, month, 0).getDate();

  const headerRow = ['日付', '出勤', '退社', '休憩時間', '実働時間'];
  const dataRows: (string | number)[][] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const shift = attendance[key];
    const dateLabel = `${year}/${month}/${d}`;

    let clockIn = '', clockOut = '', rest = '', actual = '';

    if (shift === 'day') {
      clockIn = '8:30';
      clockOut = '17:00';
      rest = '2:00';
      actual = '6:30';
    } else if (shift === 'night_full') {
      // 夜勤(日+夜) — 時間は後日設定
      clockIn = '夜勤(日+夜)';
    } else if (shift === 'night_only') {
      // 夜勤(夜のみ) — 時間は後日設定
      clockIn = '夜勤(夜のみ)';
    } else if (shift === 'paid_leave') {
      clockIn = '有給';
    }

    dataRows.push([dateLabel, clockIn, clockOut, rest, actual]);
  }

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, // 日付
    { wch: 10 }, // 出勤
    { wch: 10 }, // 退社
    { wch: 12 }, // 休憩時間
    { wch: 12 }, // 実働時間
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${year}年${month}月`);
  XLSX.writeFile(wb, `出勤簿_${employeeName}_${year}年${month}月.xlsx`);
}
