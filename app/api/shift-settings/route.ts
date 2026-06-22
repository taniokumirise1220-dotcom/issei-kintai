import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ShiftSetting } from '@/lib/types';

export async function GET() {
  const rows = await query<ShiftSetting>(`SELECT * FROM shift_settings ORDER BY shift_type`);
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const settings: ShiftSetting[] = await req.json();
  for (const s of settings) {
    await query(
      `UPDATE shift_settings SET clock_in=$1, clock_out=$2, rest_time=$3, actual_time=$4 WHERE shift_type=$5`,
      [s.clock_in, s.clock_out, s.rest_time, s.actual_time, s.shift_type]
    );
  }
  return NextResponse.json({ ok: true });
}
