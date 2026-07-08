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
      advance2 INTEGER DEFAULT 0,
      UNIQUE(employee_id, year, month)
    )
  `);
  await query(`ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS advance2 INTEGER DEFAULT 0`);
  await query(`ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS confirmed BOOLEAN DEFAULT FALSE`);
  await query(`ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS snap_basic_pay INTEGER`);
  await query(`ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS snap_night_allowance INTEGER`);
  await query(`ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS snap_advance1 INTEGER`);
  await query(`ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS snap_total INTEGER`);

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
      shift_type VARCHAR(50) PRIMARY KEY,
      label VARCHAR(50) NOT NULL DEFAULT '',
      clock_in VARCHAR(10) NOT NULL DEFAULT '',
      clock_out VARCHAR(10) NOT NULL DEFAULT '',
      rest_time VARCHAR(10) NOT NULL DEFAULT '',
      actual_time VARCHAR(10) NOT NULL DEFAULT '',
      is_builtin BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
  await query(`ALTER TABLE shift_settings ADD COLUMN IF NOT EXISTS label VARCHAR(50) NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE shift_settings ADD COLUMN IF NOT EXISTS is_builtin BOOLEAN NOT NULL DEFAULT FALSE`);
  await query(`ALTER TABLE shift_settings ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 99`);
  await query(`ALTER TABLE shift_settings ADD COLUMN IF NOT EXISTS night_allowance INTEGER NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE shift_settings ADD COLUMN IF NOT EXISTS show_in_allowance BOOLEAN NOT NULL DEFAULT FALSE`);
  await query(`ALTER TABLE shift_settings ADD COLUMN IF NOT EXISTS shift_behavior VARCHAR(20) NOT NULL DEFAULT 'day'`);

  // シフト設定の初期データ
  const defaultSettings = [
    { shift_type: 'day',        label: '日勤',        clock_in: '8:30',  clock_out: '17:00', rest_time: '2:00', actual_time: '6:30', sort_order: 1, night_allowance: 0,    show_in_allowance: false, shift_behavior: 'day' },
    { shift_type: 'night_full', label: '夜勤(日+夜)', clock_in: '',       clock_out: '',      rest_time: '',     actual_time: '',     sort_order: 2, night_allowance: 5000, show_in_allowance: true,  shift_behavior: 'night_full' },
    { shift_type: 'night_only', label: '夜勤(夜のみ)', clock_in: '',      clock_out: '',      rest_time: '',     actual_time: '',     sort_order: 3, night_allowance: 3000, show_in_allowance: true,  shift_behavior: 'night_only' },
    { shift_type: 'paid_leave', label: '有給',         clock_in: '有給',  clock_out: '',      rest_time: '',     actual_time: '',     sort_order: 4, night_allowance: 0,    show_in_allowance: false, shift_behavior: 'paid_leave' },
  ];
  for (const s of defaultSettings) {
    await query(
      `INSERT INTO shift_settings (shift_type, label, clock_in, clock_out, rest_time, actual_time, is_builtin, sort_order, night_allowance, show_in_allowance, shift_behavior)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, $9, $10)
       ON CONFLICT (shift_type) DO UPDATE SET is_builtin = TRUE,
         label = CASE WHEN shift_settings.label = '' THEN $2 ELSE shift_settings.label END,
         sort_order = CASE WHEN shift_settings.sort_order = 99 THEN $7 ELSE shift_settings.sort_order END,
         shift_behavior = CASE WHEN shift_settings.shift_behavior = 'day' AND shift_settings.is_builtin THEN $10 ELSE shift_settings.shift_behavior END`,
      [s.shift_type, s.label, s.clock_in, s.clock_out, s.rest_time, s.actual_time, s.sort_order, s.night_allowance, s.show_in_allowance, s.shift_behavior]
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
