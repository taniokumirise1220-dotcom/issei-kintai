import * as XLSX from 'xlsx';
import { ShiftSetting, ShiftType } from './types';

const DOW_JA = ['日', '月', '火', '水', '木', '金', '土'];

function parseTimeToExcelValue(timeStr: string): number | null {
  if (!timeStr) return null;
  const m = timeStr.match(/^(\d+):(\d{2})$/);
  if (!m) return null;
  return (parseInt(m[1]) * 60 + parseInt(m[2])) / 1440;
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

  // ヘッダー行 (A-G)
  const headerRow = ['日付', '曜日', '出勤', '退社', '休憩時間', '実働時間', '週計'];

  // 日付・テキスト列だけ先に aoa で構築
  const aoa: (string | number | null)[][] = [headerRow];

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const shift = attendance[key];
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    const dateLabel = `${year}/${month}/${d}`;
    const dowLabel = DOW_JA[dow];

    const setting = shift ? settingsMap[shift] : null;
    const actualTime = setting ? parseTimeToExcelValue(setting.actual_time) : null;

    aoa.push([
      dateLabel,
      dowLabel,
      setting?.clock_in ?? '',
      setting?.clock_out ?? '',
      setting?.rest_time ?? '',
      actualTime,   // F列: 実働時間 (数値型、後でフォーマット指定)
      null,         // G列: 週計 (後で数式セット)
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // F列・G列のセルに書式と数式を設定
  for (let d = 1; d <= daysInMonth; d++) {
    const rowIdx = d + 1; // Excelの行番号 (1始まり、ヘッダーが1行目)
    const date = new Date(year, month - 1, d);
    const dow = date.getDay(); // 0=日, 1=月 ... 6=土

    // F列: 実働時間を h:mm 書式
    const fAddr = XLSX.utils.encode_cell({ r: d, c: 5 });
    if (ws[fAddr] && ws[fAddr].v !== null && ws[fAddr].v !== undefined) {
      ws[fAddr].z = 'h:mm';
      ws[fAddr].t = 'n';
    }

    // G列: 週計 = その週の月曜から当日までの実働時間の合計
    const daysSinceMonday = (dow + 6) % 7; // Mon=0, Tue=1 ... Sun=6
    const mondayD = Math.max(1, d - daysSinceMonday);
    const mondayRow = mondayD + 1;

    const gAddr = XLSX.utils.encode_cell({ r: d, c: 6 });
    ws[gAddr] = {
      t: 'n',
      f: `SUM(F${mondayRow}:F${rowIdx})`,
      z: 'h:mm',
    };
  }

  // !ref をG列まで拡張（aoa の null 列が範囲に含まれないため）
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  range.e.c = Math.max(range.e.c, 6);
  ws['!ref'] = XLSX.utils.encode_range(range);

  // 列幅
  ws['!cols'] = [
    { wch: 12 }, // A: 日付
    { wch: 6  }, // B: 曜日
    { wch: 10 }, // C: 出勤
    { wch: 10 }, // D: 退社
    { wch: 10 }, // E: 休憩時間
    { wch: 10 }, // F: 実働時間
    { wch: 10 }, // G: 週計
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${year}年${month}月`);
  XLSX.writeFile(wb, `出勤簿_${employeeName}_${year}年${month}月.xlsx`);
}
