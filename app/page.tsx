'use client';

import { useEffect, useState } from 'react';
import { Employee } from '@/lib/types';
import AttendanceCalendar from '@/components/AttendanceCalendar';
import PayStub from '@/components/PayStub';
import EmployeeEditor from '@/components/EmployeeEditor';
import ShiftSettingsEditor from '@/components/ShiftSettingsEditor';
import PayrollCalculation from '@/components/PayrollCalculation';
import QuarterlyReport from '@/components/QuarterlyReport';
import AllowanceSettings from '@/components/AllowanceSettings';
import { exportAllAttendanceExcel } from '@/lib/exportExcel';

type View = 'calendar' | 'paystub' | 'employees' | 'workhours' | 'payroll' | 'quarterly' | 'allowance';

export default function Home() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [view, setView] = useState<View>('calendar');
  const [initialized, setInitialized] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  const handleExportAll = async () => {
    setExportingAll(true);
    await exportAllAttendanceExcel(employees, year, month);
    setExportingAll(false);
  };

  const loadEmployees = () =>
    fetch('/api/employees').then(r => r.json()).then((data: Employee[]) => {
      setEmployees(data);
      setSelectedEmployee(prev => data.find(e => e.id === prev?.id) ?? (data[0] || null));
    });

  useEffect(() => {
    fetch('/api/init', { method: 'POST' })
      .then(loadEmployees)
      .then(() => setInitialized(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#F4F5F8' }}>
        <div className="text-center">
          <div className="text-2xl font-bold mb-2" style={{ color: '#1B2B5E' }}>読み込み中...</div>
          <div style={{ color: '#C9A84C' }}>データベースを初期化しています</div>
        </div>
      </div>
    );
  }

  const navItems: { key: View; label: string; icon: string }[] = [
    { key: 'calendar', label: '出勤簿', icon: '📅' },
    { key: 'paystub', label: '給与明細', icon: '📄' },
    { key: 'employees', label: '従業員管理', icon: '👤' },
    { key: 'payroll',    label: '給与計算',    icon: '💴' },
    { key: 'quarterly',  label: '四半期報酬',  icon: '📊' },
    { key: 'allowance',  label: '手当設定',    icon: '💰' },
    { key: 'workhours',  label: '労働時間設定', icon: '⏰' },
  ];

  return (
    <div className="flex h-screen" style={{ background: '#F4F5F8' }}>
      {/* Sidebar */}
      <aside className="w-60 flex flex-col shrink-0" style={{ background: '#1B2B5E' }}>
        {/* Logo */}
        <div className="px-6 py-5 border-b" style={{ borderColor: '#2A3F7A' }}>
          <div className="text-xs tracking-widest mb-1" style={{ color: '#C9A84C' }}>ISSEI</div>
          <div className="text-white font-bold text-lg leading-tight">出勤簿アプリ</div>
          <div className="mt-2" style={{ width: 32, height: 2, background: '#C9A84C' }} />
        </div>

        {/* Nav */}
        <div className="px-4 pt-4 pb-2">
          <div className="text-xs tracking-widest mb-3" style={{ color: '#C9A84C', opacity: 0.8 }}>MENU</div>
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className="w-full text-left px-4 py-2.5 rounded mb-1 text-sm font-medium transition-all flex items-center gap-3"
              style={view === item.key
                ? { background: '#C9A84C', color: '#1B2B5E' }
                : { color: 'rgba(255,255,255,0.75)' }
              }
              onMouseEnter={e => { if (view !== item.key) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,168,76,0.15)'; }}
              onMouseLeave={e => { if (view !== item.key) (e.currentTarget as HTMLButtonElement).style.background = ''; }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* Employee list */}
        {view !== 'employees' && view !== 'workhours' && (
          <div className="flex-1 overflow-y-auto px-4 pt-2">
            <div className="text-xs tracking-widest mb-3" style={{ color: '#C9A84C', opacity: 0.8 }}>EMPLOYEE</div>
            <ul className="space-y-0.5">
              {employees.map(emp => (
                <li key={emp.id}>
                  <button
                    onClick={() => setSelectedEmployee(emp)}
                    className="w-full text-left px-3 py-2 rounded text-sm transition-all"
                    style={selectedEmployee?.id === emp.id
                      ? { background: 'rgba(201,168,76,0.2)', color: '#C9A84C', fontWeight: 600, borderLeft: '3px solid #C9A84C', paddingLeft: 9 }
                      : { color: 'rgba(255,255,255,0.65)' }
                    }
                    onMouseEnter={e => { if (selectedEmployee?.id !== emp.id) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)'; }}
                    onMouseLeave={e => { if (selectedEmployee?.id !== emp.id) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.65)'; }}
                  >
                    {emp.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 mt-auto border-t text-xs" style={{ borderColor: '#2A3F7A', color: 'rgba(255,255,255,0.3)' }}>
          © 2026 ISSEI
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white px-8 py-4 flex items-center justify-between shrink-0 shadow-sm">
          {view === 'employees' ? (
            <div>
              <div className="section-label">EMPLOYEE</div>
              <h2 className="text-xl font-bold" style={{ color: '#1B2B5E' }}>従業員管理</h2>
            </div>
          ) : view === 'workhours' ? (
            <div>
              <div className="section-label">SETTINGS</div>
              <h2 className="text-xl font-bold" style={{ color: '#1B2B5E' }}>労働時間設定</h2>
            </div>
          ) : view === 'payroll' ? (
            <>
              <div className="flex items-center gap-4">
                <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-gray-100" style={{ color: '#1B2B5E' }}>◀</button>
                <div className="text-center">
                  <div className="section-label">PAYROLL</div>
                  <span className="text-xl font-bold" style={{ color: '#1B2B5E' }}>{year}年{month}月</span>
                </div>
                <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-gray-100" style={{ color: '#1B2B5E' }}>▶</button>
              </div>
              {selectedEmployee && (
                <div className="text-right">
                  <div className="section-label text-right">SELECTED</div>
                  <span className="text-sm font-semibold" style={{ color: '#1B2B5E' }}>{selectedEmployee.name}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <button
                  onClick={prevMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-gray-100"
                  style={{ color: '#1B2B5E' }}
                >◀</button>
                <div className="text-center">
                  <div className="section-label">ATTENDANCE</div>
                  <span className="text-xl font-bold" style={{ color: '#1B2B5E' }}>
                    {year}年{month}月
                  </span>
                </div>
                <button
                  onClick={nextMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-gray-100"
                  style={{ color: '#1B2B5E' }}
                >▶</button>
              </div>

              <div className="flex items-center gap-4">
                {selectedEmployee && (
                  <div className="text-right">
                    <div className="section-label text-right">SELECTED</div>
                    <span className="text-sm font-semibold" style={{ color: '#1B2B5E' }}>
                      {selectedEmployee.name}
                      <span className="ml-2 font-normal text-xs" style={{ color: '#C9A84C' }}>
                        日当 {selectedEmployee.daily_rate.toLocaleString()}円
                      </span>
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExportAll}
                    disabled={exportingAll}
                    className="px-4 py-2 rounded text-sm font-bold transition-opacity hover:opacity-85"
                    style={{ background: '#C9A84C', color: '#1B2B5E', opacity: exportingAll ? 0.6 : 1 }}
                  >
                    {exportingAll ? '出力中...' : '⬇ 全員分Excel出力'}
                  </button>
                  <div className="flex rounded overflow-hidden border" style={{ borderColor: '#1B2B5E' }}>
                    {navItems.slice(0, 2).map(item => (
                      <button
                        key={item.key}
                        onClick={() => setView(item.key as View)}
                        className="px-5 py-2 text-sm font-medium transition-colors"
                        style={view === item.key
                          ? { background: '#1B2B5E', color: '#C9A84C' }
                          : { background: 'white', color: '#1B2B5E' }
                        }
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-8">
          {view === 'employees' ? (
            <EmployeeEditor employees={employees} onUpdated={loadEmployees} />
          ) : view === 'workhours' ? (
            <ShiftSettingsEditor />
          ) : view === 'allowance' ? (
            <AllowanceSettings employees={employees} onUpdated={loadEmployees} />
          ) : view === 'quarterly' ? (
            <QuarterlyReport employees={employees} />
          ) : view === 'payroll' ? (
            selectedEmployee
              ? <PayrollCalculation employee={selectedEmployee} year={year} month={month} />
              : <div className="text-center mt-20" style={{ color: '#1B2B5E', opacity: 0.4 }}>左から従業員を選択してください</div>
          ) : selectedEmployee ? (
            view === 'calendar' ? (
              <AttendanceCalendar employee={selectedEmployee} year={year} month={month} />
            ) : (
              <PayStub employee={selectedEmployee} year={year} month={month} />
            )
          ) : (
            <div className="text-center mt-20" style={{ color: '#1B2B5E', opacity: 0.4 }}>
              左から従業員を選択してください
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
