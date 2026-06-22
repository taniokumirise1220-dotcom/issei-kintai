import * as XLSX from 'xlsx';
import { ShiftSetting, ShiftType } from './types';

export async function exportAttendanceExcel(
  employeeName: string,
  year: number,
  month: number,
  attendance: Record<string, ShiftType>
) {
  // シフト設定をDBから取得
  const res = await fetch('/api/shift-settings');
  const settings: ShiftSetting[] = await res.json();
  const settingsMap: Record<string, ShiftSetting> = {};
  for (const s of settings) {
    settingsMap[s.shift_type] = s;
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const headerRow = ['日付', '出勤', '退社', '休憩時間', '実働時間'];
  const dataRows: string[][] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const shift = attendance[key];
    const dateLabel = `${year}/${month}/${d}`;

    if (!shift) {
      dataRows.push([dateLabel, '', '', '', '']);
      continue;
    }

    const setting = settingsMap[shift];
    dataRows.push([
      dateLabel,
      setting?.clock_in ?? '',
      setting?.clock_out ?? '',
      setting?.rest_time ?? '',
      setting?.actual_time ?? '',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${year}年${month}月`);
  XLSX.writeFile(wb, `出勤簿_${employeeName}_${year}年${month}月.xlsx`);
}
