import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ShiftSetting } from '@/lib/types';

export async function GET() {
  const rows = await query<ShiftSetting>(
    `SELECT shift_type, label, clock_in, clock_out, rest_time, actual_time, is_builtin
     FROM shift_settings ORDER BY is_builtin DESC, shift_type`
  );
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const settings: ShiftSetting[] = await req.json();
  for (const s of settings) {
    await query(
      `UPDATE shift_settings SET label=$1, clock_in=$2, clock_out=$3, rest_time=$4, actual_time=$5 WHERE shift_type=$6`,
      [s.label, s.clock_in, s.clock_out, s.rest_time, s.actual_time, s.shift_type]
    );
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const { label, clock_in, clock_out, rest_time, actual_time } = await req.json();
  if (!label || !label.trim()) return NextResponse.json({ error: 'label required' }, { status: 400 });

  const shift_type = `custom_${Date.now()}`;
  await query(
    `INSERT INTO shift_settings (shift_type, label, clock_in, clock_out, rest_time, actual_time, is_builtin)
     VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
    [shift_type, label.trim(), clock_in ?? '', clock_out ?? '', rest_time ?? '', actual_time ?? '']
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
