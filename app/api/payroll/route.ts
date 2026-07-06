import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const employee_id = searchParams.get('employee_id');
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  const rows = await query(
    `SELECT * FROM payroll_entries WHERE employee_id=$1 AND year=$2 AND month=$3`,
    [employee_id, year, month]
  );
  return NextResponse.json(rows[0] ?? { advance1: 0, advance2: 0 });
}

export async function POST(req: NextRequest) {
  const { employee_id, year, month, advance1, advance2, confirm, snap_basic_pay, snap_night_allowance, snap_advance1, snap_total, unconfirm } = await req.json();

  if (unconfirm) {
    const rows = await query(
      `UPDATE payroll_entries SET confirmed=FALSE WHERE employee_id=$1 AND year=$2 AND month=$3 RETURNING *`,
      [employee_id, year, month]
    );
    return NextResponse.json(rows[0] ?? {});
  }

  if (confirm) {
    const rows = await query(
      `INSERT INTO payroll_entries (employee_id, year, month, advance2, confirmed, snap_basic_pay, snap_night_allowance, snap_advance1, snap_total)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7, $8)
       ON CONFLICT (employee_id, year, month)
       DO UPDATE SET advance2=EXCLUDED.advance2, confirmed=TRUE,
         snap_basic_pay=EXCLUDED.snap_basic_pay, snap_night_allowance=EXCLUDED.snap_night_allowance,
         snap_advance1=EXCLUDED.snap_advance1, snap_total=EXCLUDED.snap_total
       RETURNING *`,
      [employee_id, year, month, advance2 ?? 0, snap_basic_pay, snap_night_allowance, snap_advance1, snap_total]
    );
    return NextResponse.json(rows[0]);
  }

  const rows = await query(
    `INSERT INTO payroll_entries (employee_id, year, month, advance2)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (employee_id, year, month)
     DO UPDATE SET advance2 = EXCLUDED.advance2
     RETURNING *`,
    [employee_id, year, month, advance2 ?? 0]
  );
  return NextResponse.json(rows[0]);
}
