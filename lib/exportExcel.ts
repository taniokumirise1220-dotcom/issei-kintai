import ExcelJS from 'exceljs';
import { Employee, ShiftSetting, ShiftType } from './types';

const DOW_JA  = ['日', '月', '火', '水', '木', '金', '土'];
const NAVY    = 'FF1B2B5E';
const GOLD    = 'FFC9A84C';
const SUN_BG  = 'FFFFE8E8';
const TOT_BG  = 'FFFBF7EE';

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
  const adjustedOut  = outMin <= inMin ? outMin + 1440 : outMin;
  const overlapStart = Math.max(inMin, 22 * 60);
  const overlapEnd   = Math.min(adjustedOut, 29 * 60);
  if (overlapEnd <= overlapStart) return null;
  return overlapEnd - overlapStart;
}

async function fetchPrevActualMin(
  employeeId: number,
  year: number,
  month: number,
  settingsMap: Record<string, ShiftSetting>
): Promise<Record<string, number>> {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysSinceMondayForFirst = (firstDow + 6) % 7;
  if (daysSinceMondayForFirst === 0) return {};

  const prevYear  = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevRes = await fetch(`/api/attendance?employee_id=${employeeId}&year=${prevYear}&month=${prevMonth}`);
  const prevAtt: { date: string; shift_type: ShiftType }[] = await prevRes.json();

  const result: Record<string, number> = {};
  for (const a of prevAtt) {
    const s   = settingsMap[a.shift_type];
    const min = s ? parseMinutes(s.actual_time) : null;
    if (min !== null) result[a.date.substring(0, 10)] = min;
  }
  return result;
}

function addAttendanceSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  year: number,
  month: number,
  attendance: Record<string, ShiftType>,
  settingsMap: Record<string, ShiftSetting>,
  prevActualMin: Record<string, number>
) {
  const daysInMonth    = new Date(year, month, 0).getDate();
  const prevDaysInMonth = new Date(
    month === 1 ? year - 1 : year,
    month === 1 ? 12 : month - 1,
    0
  ).getDate();

  const actualMin: Record<number, number | null> = {};
  const nightMin:  Record<number, number | null> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const key     = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const setting = attendance[key] ? settingsMap[attendance[key]] : null;
    actualMin[d]  = setting ? parseMinutes(setting.actual_time) : null;
    nightMin[d]   = setting ? calcNightOvertimeMinutes(setting.clock_in, setting.clock_out) : null;
  }

  const ws = wb.addWorksheet(sheetName);
  ws.columns = [
    { width: 12 }, { width: 6  }, { width: 10 }, { width: 10 },
    { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 },
  ];

  const hRow = ws.addRow(['日付','曜日','出勤','退社','休憩時間','実働時間','週計','深夜残業']);
  hRow.eachCell({ includeEmpty: true }, cell => {
    cell.font      = { bold: true, color: { argb: GOLD } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  let totalActual    = 0;
  let totalNight     = 0;
  let paidDays       = 0;
  let dayCount       = 0;
  let nightFullCount = 0;
  let nightOnlyCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const date    = new Date(year, month - 1, d);
    const dow     = date.getDay();
    const key     = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const setting = attendance[key] ? settingsMap[attendance[key]] : null;

    // 週計（月またぎ対応）
    const daysSinceMonday = (dow + 6) % 7;
    const mondayD = d - daysSinceMonday;
    let weeklySum = 0;
    for (let wd = mondayD; wd <= d; wd++) {
      if (wd <= 0) {
        const prevD     = prevDaysInMonth + wd;
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
    const shift = attendance[key];
    if (shift === 'day')        dayCount++;
    if (shift === 'night_full') nightFullCount++;
    if (shift === 'night_only') nightOnlyCount++;
    if (shift === 'paid_leave') paidDays++;

    const row = ws.addRow([
      `${year}/${month}/${d}`,
      DOW_JA[dow],
      setting?.clock_in  ?? '',
      setting?.clock_out ?? '',
      setting?.rest_time ?? '',
      aMin !== null ? toExcelTime(aMin) : '',
      weeklySum > 0 ? toExcelTime(weeklySum) : '',
      nMin !== null ? toExcelTime(nMin) : '',
    ]);

    if (aMin !== null) { row.getCell(6).numFmt = 'h:mm'; }
    if (weeklySum > 0) { row.getCell(7).numFmt = '[h]:mm'; }
    if (nMin !== null) { row.getCell(8).numFmt = 'h:mm'; }

    if (dow === 0) {
      row.eachCell({ includeEmpty: true }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUN_BG } };
      });
    }
    row.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // 合計行
  const totalRow = ws.addRow([
    '合計',
    `出勤${dayCount + nightFullCount + nightOnlyCount}日　有給${paidDays}日`,
    `日勤:${dayCount}回`,
    `夜勤(日+夜):${nightFullCount}回`,
    `夜勤(夜のみ):${nightOnlyCount}回`,
    totalActual > 0 ? toExcelTime(totalActual) : '',
    '',
    totalNight  > 0 ? toExcelTime(totalNight)  : '',
  ]);
  if (totalActual > 0) { totalRow.getCell(6).numFmt = '[h]:mm'; }
  if (totalNight  > 0) { totalRow.getCell(8).numFmt = '[h]:mm'; }
  totalRow.eachCell({ includeEmpty: true }, cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOT_BG } };
    cell.font      = { bold: true, color: { argb: NAVY } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
}

async function saveWorkbook(wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── 1人分エクスポート ──
export async function exportAttendanceExcel(
  employeeId: number,
  employeeName: string,
  year: number,
  month: number,
  attendance: Record<string, ShiftType>
) {
  const res = await fetch('/api/shift-settings');
  const settings: ShiftSetting[] = await res.json();
  const settingsMap: Record<string, ShiftSetting> = {};
  for (const s of settings) settingsMap[s.shift_type] = s;

  const prevActualMin = await fetchPrevActualMin(employeeId, year, month, settingsMap);

  const wb = new ExcelJS.Workbook();
  addAttendanceSheet(wb, `${year}年${month}月`, year, month, attendance, settingsMap, prevActualMin);

  await saveWorkbook(wb, `出勤簿_${employeeName}_${year}年${month}月.xlsx`);
}

// ── 全員分エクスポート（1ファイル・シート別） ──
export async function exportAllAttendanceExcel(
  employees: Employee[],
  year: number,
  month: number
) {
  const res = await fetch('/api/shift-settings');
  const settings: ShiftSetting[] = await res.json();
  const settingsMap: Record<string, ShiftSetting> = {};
  for (const s of settings) settingsMap[s.shift_type] = s;

  const wb = new ExcelJS.Workbook();

  for (const emp of employees) {
    const attRes = await fetch(`/api/attendance?employee_id=${emp.id}&year=${year}&month=${month}`);
    const attArr: { date: string; shift_type: ShiftType }[] = await attRes.json();
    const attendance: Record<string, ShiftType> = {};
    for (const a of attArr) attendance[a.date.substring(0, 10)] = a.shift_type;

    const prevActualMin = await fetchPrevActualMin(emp.id, year, month, settingsMap);

    // シート名は氏名（31文字制限）
    addAttendanceSheet(wb, emp.name.slice(0, 31), year, month, attendance, settingsMap, prevActualMin);
  }

  await saveWorkbook(wb, `出勤簿_全員_${year}年${month}月.xlsx`);
}
