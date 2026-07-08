import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ShiftSetting } from '@/lib/types';

export async function GET() {
  const rows = await query<ShiftSetting>(
    `SELECT shift_type, label, clock_in, clock_out, rest_time, actual_time, night_allowance, is_builtin, sort_order
     FROM shift_settings ORDER BY sort_order ASC, shift_type`
  );
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const settings: ShiftSetting[] = await req.json();
  for (const s of settings) {
    await query(
      `UPDATE shift_settings SET label=$1, clock_in=$2, clock_out=$3, rest_time=$4, actual_time=$5, sort_order=$6, night_allowance=$7 WHERE shift_type=$8`,
      [s.label, s.clock_in, s.clock_out, s.rest_time, s.actual_time, s.sort_order ?? 99, s.night_allowance ?? 0, s.shift_type]
    );
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const { label, clock_in, clock_out, rest_time, actual_time } = await req.json();
  if (!label || !label.trim()) return NextResponse.json({ error: 'label required' }, { status: 400 });

  const maxRows = await query<{ max: number }>(`SELECT COALESCE(MAX(sort_order), 0) as max FROM shift_settings`);
  const nextOrder = (maxRows[0]?.max ?? 0) + 1;

  const shift_type = `custom_${Date.now()}`;
  await query(
    `INSERT INTO shift_settings (shift_type, label, clock_in, clock_out, rest_time, actual_time, is_builtin, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)`,
    [shift_type, label.trim(), clock_in ?? '', clock_out ?? '', rest_time ?? '', actual_time ?? '', nextOrder]
  );
  return NextResponse.json({ ok: true, shift_type });
}

export async function DELETE(req: NextRequest) {
  const { shift_type } = await req.json();
  const rows = await query<{ is_builtin: boolean }>(
    `SELECT is_builtin FROM shift_settings WHERE shift_type=$1`, [shift_type]
  );
  if (!rows[0] || rows[0].is_builtin) {
    return NextResponse.json({ error: '組み込みシフトは削除できません' }, { status: 400 });
  }
  await query(`DELETE FROM shift_settings WHERE shift_type=$1`, [shift_type]);
  return NextResponse.json({ ok: true });
}
