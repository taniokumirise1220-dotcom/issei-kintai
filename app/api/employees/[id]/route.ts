import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, daily_rate, family_allowance, rent_deduction } = await req.json();

  if (!name || !daily_rate) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const rows = await query(
    `UPDATE employees SET name = $1, daily_rate = $2, family_allowance = $3, rent_deduction = $4 WHERE id = $5 RETURNING *`,
    [name, daily_rate, family_allowance ?? 0, rent_deduction ?? 0, id]
  );
  return NextResponse.json(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await query(`DELETE FROM employees WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
