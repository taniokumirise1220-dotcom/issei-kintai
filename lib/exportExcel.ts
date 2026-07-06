import * as XLSX from 'xlsx';
import { ShiftSetting, ShiftType } from './types';

const DOW_JA = ['日', '月', '火', '水', '木', '金', '土'];

function parseMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const normalized = timeStr.replace('：', ':');
  const m = normalized.match(/^(\d+):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

function parseTimeToExcelValue(timeStr: string): number | null {
  const min = parseMinutes(timeStr);
  return min !== null ? min / 1440 : null;
}

// 22:00〜翌5:00に重複する時間をExcel時刻値で返す
function calcNightOvertimeExcelValue(clockIn: string, clockOut: string): number | null {
  const inMin  = parseMinutes(clockIn);
  const outMin = parseMinutes(clockOut);
  if (inMin === null || outMin === null) return null;

  // 退勤が出勤以下なら日をまたいでいる
  const adjustedOut = outMin <= inMin ? outMin + 1440 : outMin;

  // 深夜帯: 22:00(1320分) 〜 翌5:00(1740分)
  const nightStart = 22 * 60; // 1320
  const nightEnd   = 29 * 60; // 1740 (翌5:00)

  const overlapStart = Math.max(inMin, nightStart);
  const overlapEnd   = Math.min(adjustedOut, nightEnd);

  if (overlapEnd <= overlapStart) return null;

  return (overlapEnd - overlapStart) / 1440;
}

export async function exportAttendanceExcel(
  employeeName: string,
  year: number,
  month: number,
  attendance: Record<string, ShiftType>
) {
  const res = await fetch('/api/shift-settings');
  const settings: ShiftSetting[] = await res.json();
  const settingsMap: Record<string, ShiftSetting> = {};
  for (const s of settings) settingsMap[s.shift_type] = s;

  const daysInMonth = new Date(year, month, 0).getDate();

  // 実働時間・深夜残業時間を事前計算
  const actualTimeValues: Record<number, number | null> = {};
  const nightOvertimeValues: Record<number, number | null> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const shift = attendance[key];
    const setting = shift ? settingsMap[shift] : null;
    actualTimeValues[d]    = setting ? parseTimeToExcelValue(setting.actual_time) : null;
    nightOvertimeValues[d] = setting ? calcNightOvertimeExcelValue(setting.clock_in, setting.clock_out) : null;
  }

  const headerRow = ['日付', '曜日', '出勤', '退社', '休憩時間', '実働時間', '週計', '深夜残業'];
  const aoa: (string | number | null)[][] = [headerRow];

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const shift = attendance[key];
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    const setting = shift ? settingsMap[shift] : null;

    aoa.push([
      `${year}/${month}/${d}`,
      DOW_JA[dow],
      setting?.clock_in  ?? '',
      setting?.clock_out ?? '',
      setting?.rest_time ?? '',
      actualTimeValues[d],    // F列
      null,                   // G列: 後で設定
      nightOvertimeValues[d], // H列
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    const rowIdx = d + 1;

    // F列: h:mm 書式
    const fAddr = XLSX.utils.encode_cell({ r: d, c: 5 });
    if (ws[fAddr] && ws[fAddr].v != null) {
      ws[fAddr].z = 'h:mm';
      ws[fAddr].t = 'n';
    }

    // H列: h:mm 書式
    const hAddr = XLSX.utils.encode_cell({ r: d, c: 7 });
    if (ws[hAddr] && ws[hAddr].v != null) {
      ws[hAddr].z = 'h:mm';
      ws[hAddr].t = 'n';
    }

    // 週計(G列): 月曜起算
    const daysSinceMonday = (dow + 6) % 7;
    const mondayD = Math.max(1, d - daysSinceMonday);
    const mondayRow = mondayD + 1;

    let weeklySum = 0;
    for (let wd = mondayD; wd <= d; wd++) {
      const v = actualTimeValues[wd];
      if (v != null) weeklySum += v;
    }

    const gAddr = XLSX.utils.encode_cell({ r: d, c: 6 });
    ws[gAddr] = {
      t: 'n',
      v: weeklySum,
      f: `SUM(F${mondayRow}:F${rowIdx})`,
      z: '[h]:mm',
    };
  }

  // !ref をH列まで拡張
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  range.e.c = Math.max(range.e.c, 7);
  ws['!ref'] = XLSX.utils.encode_range(range);

  ws['!cols'] = [
    { wch: 12 }, // A: 日付
    { wch: 6  }, // B: 曜日
    { wch: 10 }, // C: 出勤
    { wch: 10 }, // D: 退社
    { wch: 10 }, // E: 休憩時間
    { wch: 10 }, // F: 実働時間
    { wch: 10 }, // G: 週計
    { wch: 12 }, // H: 深夜残業
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${year}年${month}月`);
  XLSX.writeFile(wb, `出勤簿_${employeeName}_${year}年${month}月.xlsx`);
}
