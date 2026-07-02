import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST() {
  await query(`
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      daily_rate INTEGER NOT NULL,
      family_allowance INTEGER DEFAULT 0,
      rent_deduction INTEGER DEFAULT 0
    )
  `);

  // 既存テーブルへのカラム追加（マイグレーション）
  await query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS family_allowance INTEGER DEFAULT 0`);
  await query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS rent_deduction INTEGER DEFAULT 0`);
  await query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS monthly_salary INTEGER DEFAULT 0`);

  await query(`
    CREATE TABLE IF NOT EXISTS payroll_entries (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      advance1 INTEGER DEFAULT 0,
      UNIQUE(employee_id, year, month)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      shift_type VARCHAR(20) NOT NULL,
      UNIQUE(employee_id, date)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS monthly_allowances (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      family_allowance INTEGER DEFAULT 0,
      skill_allowance INTEGER DEFAULT 0,
      business_trip_allowance INTEGER DEFAULT 0,
      rent_deduction INTEGER DEFAULT 0,
      utilities_deduction INTEGER DEFAULT 0,
      persistent BOOLEAN DEFAULT FALSE,
      UNIQUE(employee_id, year, month)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS shift_settings (
      shift_type VARCHAR(20) PRIMARY KEY,
      clock_in VARCHAR(10) NOT NULL DEFAULT '',
      clock_out VARCHAR(10) NOT NULL DEFAULT '',
      rest_time VARCHAR(10) NOT NULL DEFAULT '',
      actual_time VARCHAR(10) NOT NULL DEFAULT ''
    )
  `);

  // シフト設定の初期データ
  const defaultSettings = [
    { shift_type: 'day',        clock_in: '8:30',  clock_out: '17:00', rest_time: '2:00', actual_time: '6:30' },
    { shift_type: 'night_full', clock_in: '',       clock_out: '',      rest_time: '',     actual_time: '' },
    { shift_type: 'night_only', clock_in: '',       clock_out: '',      rest_time: '',     actual_time: '' },
    { shift_type: 'paid_leave', clock_in: '有給',   clock_out: '',      rest_time: '',     actual_time: '' },
  ];
  for (const s of defaultSettings) {
    await query(
      `INSERT INTO shift_settings (shift_type, clock_in, clock_out, rest_time, actual_time)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (shift_type) DO NOTHING`,
      [s.shift_type, s.clock_in, s.clock_out, s.rest_time, s.actual_time]
    );
  }

  const existing = await query(`SELECT COUNT(*) as cnt FROM employees`);
  const count = (existing[0] as { cnt: string }).cnt;

  if (parseInt(count) === 0) {
    const employees = [
      { name: '熊谷　将', daily_rate: 18000 },
      { name: '磯村　健吾', daily_rate: 16500 },
      { name: '島田　亮', daily_rate: 20000 },
      { name: '石丸　飛生', daily_rate: 17500 },
      { name: '水谷　公彦', daily_rate: 19500 },
      { name: '木幡　竜二', daily_rate: 17000 },
      { name: '山田　見', daily_rate: 15500 },
      { name: '岩井　裕仁', daily_rate: 15500 },
      { name: '小林　翔太', daily_rate: 15000 },
      { name: '本間　裕太', daily_rate: 12500 },
      { name: '笠川　朗', daily_rate: 16000 },
      { name: '中村　直貴', daily_rate: 13500 },
    ];
    for (const emp of employees) {
      await query(`INSERT INTO employees (name, daily_rate) VALUES ($1, $2)`, [emp.name, emp.daily_rate]);
    }
  }

  return NextResponse.json({ ok: true });
}
