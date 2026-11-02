export type ShiftType = string;

export const BUILTIN_SHIFTS = ['day', 'night_full', 'night_only', 'paid_leave'] as const;

export interface Employee {
  id: number;
  name: string;
  daily_rate: number;
  monthly_salary: number;
  family_allowance: number;
  rent_deduction: number;
}

export interface Attendance {
  id: number;
  employee_id: number;
  date: string;
  shift_type: ShiftType;
}

export interface AllowanceItem {
  id: number;
  label: string;
  kind: 'allowance' | 'deduction';
  sort_order: number;
  code: string | null;
  /** 歩合給①に反映するか。控除の場合は減算される */
  affects_advance: boolean;
}

export interface MonthlyAllowance {
  persistent: boolean;
  /** item_id → 金額 */
  values: Record<number, number>;
}

/** 未保存月の初期値。家族手当だけ従業員マスタの値を引き継ぐ */
export function defaultAllowanceValue(item: AllowanceItem, employee: Employee): number {
  return item.code === 'family_allowance' ? (employee.family_allowance ?? 0) : 0;
}

/** 2026年10月分より「前借」から「歩合給」に名称変更。過去月は旧名称のまま表示する */
const COMMISSION_RENAME_START = { year: 2026, month: 10 };

export function advanceLabel(year: number, month: number, index: 1 | 2): string {
  const renamed =
    year > COMMISSION_RENAME_START.year ||
    (year === COMMISSION_RENAME_START.year && month >= COMMISSION_RENAME_START.month);
  return `${renamed ? '歩合給' : '前借'}${index === 1 ? '①' : '②'}`;
}

/**
 * 歩合給①（旧・前借①）に加算する諸手当の合計。
 * 「歩合給①に反映」が有効な項目のみを対象とし、控除は減算する。
 */
export function calcAllowanceTotal(
  items: AllowanceItem[],
  row: MonthlyAllowance | null,
  employee: Employee
): number {
  return items.reduce((sum, i) => {
    if (!i.affects_advance) return sum;
    const amount = row ? (row.values[i.id] ?? 0) : defaultAllowanceValue(i, employee);
    return sum + (i.kind === 'deduction' ? -amount : amount);
  }, 0);
}

export interface ShiftSetting {
  shift_type: ShiftType;
  label: string;
  clock_in: string;
  clock_out: string;
  rest_time: string;
  actual_time: string;
  night_allowance: number;
  show_in_allowance: boolean;
  shift_behavior: 'day' | 'night_full' | 'night_only' | 'paid_leave';
  sort_order?: number;
  is_builtin?: boolean;
}

export const SHIFT_LABELS: Record<string, string> = {
  day: '日勤',
  night_full: '夜勤(日+夜)',
  night_only: '夜勤(夜のみ)',
  paid_leave: '有給',
};

export const SHIFT_COLORS: Record<string, string> = {
  day: 'bg-blue-100 text-blue-800',
  night_full: 'bg-purple-100 text-purple-800',
  night_only: 'bg-indigo-100 text-indigo-800',
  paid_leave: 'bg-green-100 text-green-800',
};

export const CUSTOM_SHIFT_COLORS = [
  'bg-orange-100 text-orange-800',
  'bg-rose-100 text-rose-800',
  'bg-teal-100 text-teal-800',
  'bg-amber-100 text-amber-800',
  'bg-cyan-100 text-cyan-800',
  'bg-lime-100 text-lime-800',
];

export function calcShiftPay(dailyRate: number, shiftType: ShiftType): number {
  switch (shiftType) {
    case 'day': return dailyRate;
    case 'night_full': return dailyRate + 5000;
    case 'night_only': return dailyRate + 3000;
    case 'paid_leave': return dailyRate;
    default: return dailyRate;
  }
}
