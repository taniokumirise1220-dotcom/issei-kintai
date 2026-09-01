import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { AllowanceItem } from '@/lib/types';

export async function GET() {
  const rows = await query<AllowanceItem>(
    `SELECT id, label, kind, sort_order, code FROM allowance_items ORDER BY sort_order ASC, id ASC`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { label, kind } = await req.json();
  if (!label || !label.trim()) {
    return NextResponse.json({ error: 'label required' }, { status: 400 });
  }

  const maxRows = await query<{ max: number }>(`SELECT COALESCE(MAX(sort_order), 0) as max FROM allowance_items`);
  const nextOrder = (maxRows[0]?.max ?? 0) + 1;

  const rows = await query<AllowanceItem>(
    `INSERT INTO allowance_items (label, kind, sort_order) VALUES ($1, $2, $3)
     RETURNING id, label, kind, sort_order, code`,
    [label.trim(), kind === 'deduction' ? 'deduction' : 'allowance', nextOrder]
  );
  return NextResponse.json(rows[0]);
}

export async function PUT(req: NextRequest) {
  const items: AllowanceItem[] = await req.json();
  for (const it of items) {
    await query(
      `UPDATE allowance_items SET label=$1, kind=$2, sort_order=$3 WHERE id=$4`,
      [it.label, it.kind === 'deduction' ? 'deduction' : 'allowance', it.sort_order, it.id]
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await query(`DELETE FROM allowance_items WHERE id=$1`, [id]);
  return NextResponse.json({ ok: true });
}
