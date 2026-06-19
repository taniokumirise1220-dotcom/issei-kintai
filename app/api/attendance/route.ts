import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employee_id');
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  if (!employeeId || !year || !month) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const rows = await query(
    `SELECT * FROM attendance
     WHERE employee_id = $1
       AND EXTRACT(YEAR FROM date) = $2
       AND EXTRACT(MONTH FROM date) = $3
     ORDER BY date`,
    [employeeId, year, month]
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { employee_id, date, shift_type } = await req.json();

  if (!employee_id || !date || !shift_type) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const rows = await query(
    `INSERT INTO attendance (employee_id, date, shift_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (employee_id, date)
     DO UPDATE SET shift_type = EXCLUDED.shift_type
     RETURNING *`,
    [employee_id, date, shift_type]
  );
  return NextResponse.json(rows[0]);
}

export async function DELETE(req: NextRequest) {
  const { employee_id, date } = await req.json();

  await query(
    `DELETE FROM attendance WHERE employee_id = $1 AND date = $2`,
    [employee_id, date]
  );
  return NextResponse.json({ ok: true });
}
