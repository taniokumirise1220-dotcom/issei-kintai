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
  return NextResponse.json(rows[0] ?? { advance1: 0 });
}

export async function POST(req: NextRequest) {
  const { employee_id, year, month, advance1 } = await req.json();
  const rows = await query(
    `INSERT INTO payroll_entries (employee_id, year, month, advance1)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (employee_id, year, month)
     DO UPDATE SET advance1 = EXCLUDED.advance1
     RETURNING *`,
    [employee_id, year, month, advance1 ?? 0]
  );
  return NextResponse.json(rows[0]);
}
