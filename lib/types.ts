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

export interface MonthlyAllowance {
  id: number;
  employee_id: number;
  year: number;
  month: number;
  family_allowance: number;
  skill_allowance: number;
  business_trip_allowance: number;
  rent_deduction: number;
  utilities_deduction: number;
  persistent: boolean;
}

export interface ShiftSetting {
  shift_type: ShiftType;
  label: string;
  clock_in: string;
  clock_out: string;
  rest_time: string;
  actual_time: string;
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
