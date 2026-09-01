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

  const valRows = await query<{ item_id: number; amount: number }>(
    `SELECT item_id, amount FROM monthly_allowance_values
     WHERE employee_id = $1 AND year = $2 AND month = $3`,
    [employeeId, year, month]
  );

  const metaRows = await query<{ persistent: boolean }>(
    `SELECT persistent FROM monthly_allowances WHERE employee_id = $1 AND year = $2 AND month = $3`,
    [employeeId, year, month]
  );

  // 一度も保存していない月は null を返す（呼び出し側で既定値を入れる）
  if (valRows.length === 0 && metaRows.length === 0) {
    return NextResponse.json(null);
  }

  const values: Record<number, number> = {};
  for (const r of valRows) values[r.item_id] = r.amount;

  return NextResponse.json({ persistent: metaRows[0]?.persistent ?? false, values });
}

export async function POST(req: NextRequest) {
  const { employee_id, year, month, values, persistent } = await req.json();

  await query(
    `INSERT INTO monthly_allowances (employee_id, year, month, persistent)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (employee_id, year, month)
     DO UPDATE SET persistent = EXCLUDED.persistent`,
    [employee_id, year, month, persistent || false]
  );

  const entries: [string, number][] = Object.entries(values ?? {}) as [string, number][];
  for (const [itemId, amount] of entries) {
    await query(
      `INSERT INTO monthly_allowance_values (employee_id, year, month, item_id, amount)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (employee_id, year, month, item_id)
       DO UPDATE SET amount = EXCLUDED.amount`,
      [employee_id, year, month, parseInt(itemId), amount || 0]
    );
  }

  return NextResponse.json({ ok: true });
}
