import * as XLSX from 'xlsx';
import { ShiftSetting, ShiftType } from './types';

const DOW_JA = ['日', '月', '火', '水', '木', '金', '土'];

function parseTimeToExcelValue(timeStr: string): number | null {
  if (!timeStr) return null;
  // 全角コロンも許容
  const normalized = timeStr.replace('：', ':');
  const m = normalized.match(/^(\d+):(\d{2})$/);
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

  // 実働時間(Excel時刻値)を日付キーで事前計算
  const actualTimeValues: Record<number, number | null> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const shift = attendance[key];
    const setting = shift ? settingsMap[shift] : null;
    actualTimeValues[d] = setting ? parseTimeToExcelValue(setting.actual_time) : null;
  }

  const headerRow = ['日付', '曜日', '出勤', '退社', '休憩時間', '実働時間', '週計'];
  const aoa: (string | number | null)[][] = [headerRow];

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const shift = attendance[key];
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    const dateLabel = `${year}/${month}/${d}`;
    const dowLabel = DOW_JA[dow];
    const setting = shift ? settingsMap[shift] : null;

    aoa.push([
      dateLabel,
      dowLabel,
      setting?.clock_in ?? '',
      setting?.clock_out ?? '',
      setting?.rest_time ?? '',
      actualTimeValues[d],  // F列: 数値型時刻値
      null,                 // G列: 後で設定
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    const rowIdx = d + 1; // Excelの行番号(1始まり)

    // F列: h:mm 書式
    const fAddr = XLSX.utils.encode_cell({ r: d, c: 5 });
    if (ws[fAddr] && ws[fAddr].v != null) {
      ws[fAddr].z = 'h:mm';
      ws[fAddr].t = 'n';
    }

    // 週計: 月曜起算の週頭を求める
    const daysSinceMonday = (dow + 6) % 7; // Mon=0 … Sun=6
    const mondayD = Math.max(1, d - daysSinceMonday);
    const mondayRow = mondayD + 1;

    // 週計のキャッシュ値を JS で計算
    let weeklySum = 0;
    for (let wd = mondayD; wd <= d; wd++) {
      const v = actualTimeValues[wd];
      if (v != null) weeklySum += v;
    }

    // G列: 数式 + キャッシュ値 + [h]:mm 書式
    const gAddr = XLSX.utils.encode_cell({ r: d, c: 6 });
    ws[gAddr] = {
      t: 'n',
      v: weeklySum,                            // キャッシュ値（書式適用に必須）
      f: `SUM(F${mondayRow}:F${rowIdx})`,      // Excelで再計算可能な数式
      z: '[h]:mm',                             // 24時間超対応フォーマット
    };
  }

  // !ref をG列まで拡張
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  range.e.c = Math.max(range.e.c, 6);
  ws['!ref'] = XLSX.utils.encode_range(range);

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
