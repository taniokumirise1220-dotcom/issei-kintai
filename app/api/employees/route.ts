import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { Employee } from '@/lib/types';

export async function GET() {
  const employees = await query<Employee>(`SELECT * FROM employees ORDER BY id`);
  return NextResponse.json(employees);
}

export async function POST(req: NextRequest) {
  const { name, daily_rate, monthly_salary, family_allowance, rent_deduction } = await req.json();
  if (!name || !daily_rate) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  const rows = await query<Employee>(
    `INSERT INTO employees (name, daily_rate, monthly_salary, family_allowance, rent_deduction) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, daily_rate, monthly_salary ?? 0, family_allowance ?? 0, rent_deduction ?? 0]
  );
  return NextResponse.json(rows[0]);
}
