import ExcelJS from 'exceljs';
import { ShiftSetting, ShiftType } from './types';

const DOW_JA = ['日', '月', '火', '水', '木', '金', '土'];

const NAVY  = 'FF1B2B5E';
const GOLD  = 'FFC9A84C';
const SUN_BG = 'FFFFE8E8'; // 日曜背景（薄赤）
const TOT_BG = 'FFFBF7EE'; // 合計行背景

function parseMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const normalized = timeStr.replace('：', ':');
  const m = normalized.match(/^(\d+):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

const toExcelTime = (min: number) => min / 1440;

function calcNightOvertimeMinutes(clockIn: string, clockOut: string): number | null {
  const inMin  = parseMinutes(clockIn);
  const outMin = parseMinutes(clockOut);
  if (inMin === null || outMin === null) return null;
  const adjustedOut = outMin <= inMin ? outMin + 1440 : outMin;
  const overlapStart = Math.max(inMin,  22 * 60);
  const overlapEnd   = Math.min(adjustedOut, 29 * 60); // 翌5時
  if (overlapEnd <= overlapStart) return null;
  return overlapEnd - overlapStart;
}

export async function exportAttendanceExcel(
  employeeId: number,
  employeeName: string,
  year: number,
  month: number,
  attendance: Record<string, ShiftType>
) {
  // シフト設定取得
  const res = await fetch('/api/shift-settings');
  const settings: ShiftSetting[] = await res.json();
  const settingsMap: Record<string, ShiftSetting> = {};
  for (const s of settings) settingsMap[s.shift_type] = s;

  const daysInMonth = new Date(year, month, 0).getDate();

  // 前月データ取得（月またぎ週計のため）
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysSinceMondayForFirst = (firstDow + 6) % 7; // Mon=0…Sun=6

  const prevActualMin: Record<string, number> = {}; // "YYYY-MM-DD" -> 分
  if (daysSinceMondayForFirst > 0) {
    const prevYear  = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevRes = await fetch(`/api/attendance?employee_id=${employeeId}&year=${prevYear}&month=${prevMonth}`);
    const prevAtt: { date: string; shift_type: ShiftType }[] = await prevRes.json();
    for (const a of prevAtt) {
      const s = settingsMap[a.shift_type];
      const min = s ? parseMinutes(s.actual_time) : null;
      if (min !== null) prevActualMin[a.date] = min;
    }
  }

  // 当月の各日の実働・深夜残業（分）
  const actualMin:  Record<number, number | null> = {};
  const nightMin:   Record<number, number | null> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const shift   = attendance[key];
    const setting = shift ? settingsMap[shift] : null;
    actualMin[d] = setting ? parseMinutes(setting.actual_time) : null;
    nightMin[d]  = setting ? calcNightOvertimeMinutes(setting.clock_in, setting.clock_out) : null;
  }

  // ──── ExcelJS ────
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${year}年${month}月`);

  ws.columns = [
    { width: 12 }, { width: 6  }, { width: 10 }, { width: 10 },
    { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 },
  ];

  // ヘッダー行
  const hRow = ws.addRow(['日付','曜日','出勤','退社','休憩時間','実働時間','週計','深夜残業']);
  hRow.eachCell({ includeEmpty: true }, cell => {
    cell.font      = { bold: true, color: { argb: GOLD } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  let totalActual = 0;
  let totalNight  = 0;

  const prevDaysInMonth = new Date(
    month === 1 ? year - 1 : year,
    month === 1 ? 12 : month - 1,
    0
  ).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow  = date.getDay();
    const key  = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const shift   = attendance[key];
    const setting = shift ? settingsMap[shift] : null;

    // 週計（月またぎ対応）
    const daysSinceMonday = (dow + 6) % 7;
    const mondayD = d - daysSinceMonday; // 0以下なら前月

    let weeklySum = 0;
    for (let wd = mondayD; wd <= d; wd++) {
      if (wd <= 0) {
        const prevD   = prevDaysInMonth + wd;
        const prevYear  = month === 1 ? year - 1 : year;
        const prevMonth = month === 1 ? 12 : month - 1;
        const pKey = `${prevYear}-${String(prevMonth).padStart(2,'0')}-${String(prevD).padStart(2,'0')}`;
        weeklySum += prevActualMin[pKey] ?? 0;
      } else {
        weeklySum += actualMin[wd] ?? 0;
      }
    }

    const aMin = actualMin[d];
    const nMin = nightMin[d];
    if (aMin !== null) totalActual += aMin;
    if (nMin !== null) totalNight  += nMin;

    const row = ws.addRow([
      `${year}/${month}/${d}`,
      DOW_JA[dow],
      setting?.clock_in  ?? '',
      setting?.clock_out ?? '',
      setting?.rest_time ?? '',
      aMin !== null ? toExcelTime(aMin) : '',
      weeklySum > 0  ? toExcelTime(weeklySum) : '',
      nMin !== null  ? toExcelTime(nMin) : '',
    ]);

    // 時刻フォーマット
    if (aMin !== null) { const c = row.getCell(6); c.numFmt = 'h:mm'; }
    if (weeklySum > 0) { const c = row.getCell(7); c.numFmt = '[h]:mm'; }
    if (nMin !== null) { const c = row.getCell(8); c.numFmt = 'h:mm'; }

    // 日曜背景
    if (dow === 0) {
      row.eachCell({ includeEmpty: true }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUN_BG } };
      });
    }

    row.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // ──── 合計行 ────
  const totalRow = ws.addRow([
    '合計', '', '', '', '',
    totalActual > 0 ? toExcelTime(totalActual) : '',
    '',
    totalNight  > 0 ? toExcelTime(totalNight)  : '',
  ]);

  if (totalActual > 0) { const c = totalRow.getCell(6); c.numFmt = '[h]:mm'; }
  if (totalNight  > 0) { const c = totalRow.getCell(8); c.numFmt = '[h]:mm'; }

  totalRow.eachCell({ includeEmpty: true }, cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOT_BG } };
    cell.font      = { bold: true, color: { argb: NAVY } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // ──── 保存 ────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `出勤簿_${employeeName}_${year}年${month}月.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
