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
    `SELECT * FROM monthly_allowances WHERE employee_id = $1 AND year = $2 AND month = $3`,
    [employeeId, year, month]
  );
  return NextResponse.json(rows[0] || null);
}

export async function POST(req: NextRequest) {
  const {
    employee_id, year, month,
    family_allowance, skill_allowance, business_trip_allowance,
    rent_deduction, utilities_deduction, persistent
  } = await req.json();

  const rows = await query(
    `INSERT INTO monthly_allowances
       (employee_id, year, month, family_allowance, skill_allowance, business_trip_allowance,
        rent_deduction, utilities_deduction, persistent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (employee_id, year, month)
     DO UPDATE SET
       family_allowance = EXCLUDED.family_allowance,
       skill_allowance = EXCLUDED.skill_allowance,
       business_trip_allowance = EXCLUDED.business_trip_allowance,
       rent_deduction = EXCLUDED.rent_deduction,
       utilities_deduction = EXCLUDED.utilities_deduction,
       persistent = EXCLUDED.persistent
     RETURNING *`,
    [employee_id, year, month, family_allowance || 0, skill_allowance || 0,
     business_trip_allowance || 0, rent_deduction || 0, utilities_deduction || 0, persistent || false]
  );
  return NextResponse.json(rows[0]);
}
