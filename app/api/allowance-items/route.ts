import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { AllowanceItem } from '@/lib/types';

export async function GET() {
  const rows = await query<AllowanceItem>(
    `SELECT id, label, kind, sort_order, code, COALESCE(affects_advance, kind = 'allowance') AS affects_advance
     FROM allowance_items ORDER BY sort_order ASC, id ASC`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { label, kind, affects_advance } = await req.json();
  if (!label || !label.trim()) {
    return NextResponse.json({ error: 'label required' }, { status: 400 });
  }

  const maxRows = await query<{ max: number }>(`SELECT COALESCE(MAX(sort_order), 0) as max FROM allowance_items`);
  const nextOrder = (maxRows[0]?.max ?? 0) + 1;

  const normalizedKind = kind === 'deduction' ? 'deduction' : 'allowance';
  // 指定がなければ支給は反映あり、控除は反映なしを既定とする
  const affects = affects_advance ?? (normalizedKind === 'allowance');

  const rows = await query<AllowanceItem>(
    `INSERT INTO allowance_items (label, kind, sort_order, affects_advance) VALUES ($1, $2, $3, $4)
     RETURNING id, label, kind, sort_order, code, affects_advance`,
    [label.trim(), normalizedKind, nextOrder, affects]
  );
  return NextResponse.json(rows[0]);
}

export async function PUT(req: NextRequest) {
  const items: AllowanceItem[] = await req.json();
  for (const it of items) {
    await query(
      `UPDATE allowance_items SET label=$1, kind=$2, sort_order=$3, affects_advance=$4 WHERE id=$5`,
      [it.label, it.kind === 'deduction' ? 'deduction' : 'allowance', it.sort_order, it.affects_advance ?? false, it.id]
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await query(`DELETE FROM allowance_items WHERE id=$1`, [id]);
  return NextResponse.json({ ok: true });
}
