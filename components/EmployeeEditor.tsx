'use client';

import { useState } from 'react';
import { Employee } from '@/lib/types';

interface Props {
  employees: Employee[];
  onUpdated: () => Promise<void>;
}

const NAVY = '#1B2B5E';
const GOLD = '#C9A84C';

type EditForm = { name: string; daily_rate: number; monthly_salary: number; family_allowance: number; rent_deduction: number };
type NewForm  = { name: string; daily_rate: string; monthly_salary: string; family_allowance: string; rent_deduction: string };

function AmountInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center border rounded overflow-hidden" style={{ borderColor: GOLD }}>
      <input
        type="number"
        min={0}
        value={value}
        onChange={e => onChange(parseInt(e.target.value) || 0)}
        className="flex-1 px-2 py-2 text-sm text-right focus:outline-none w-20"
      />
      <span className="px-1.5 text-xs" style={{ background: '#f9fafb', borderLeft: '1px solid #e5e7eb', color: '#6b7280' }}>円</span>
    </div>
  );
}

function NewAmountInput({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (v: string) => void }) {
  const border = '#d1d5db';
  return (
    <div className="flex items-center border rounded overflow-hidden" style={{ borderColor: border }}>
      <input
        type="number"
        placeholder={placeholder}
        min={0}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 px-2 py-2.5 text-sm text-right focus:outline-none"
      />
      <span className="px-1.5 text-xs" style={{ color: '#6b7280', background: '#f9fafb', borderLeft: '1px solid #e5e7eb' }}>円</span>
    </div>
  );
}

export default function EmployeeEditor({ employees, onUpdated }: Props) {
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editForm,  setEditForm]    = useState<EditForm>({ name: '', daily_rate: 0, monthly_salary: 0, family_allowance: 0, rent_deduction: 0 });
  const [newForm,   setNewForm]     = useState<NewForm>({ name: '', daily_rate: '', monthly_salary: '', family_allowance: '', rent_deduction: '' });
  const [saving,    setSaving]      = useState(false);
  const [deleting,  setDeleting]    = useState<number | null>(null);
  const [addMode,   setAddMode]     = useState(false);
  const [toast,     setToast]       = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setEditForm({
      name:             emp.name,
      daily_rate:       emp.daily_rate,
      monthly_salary:   emp.monthly_salary   ?? 0,
      family_allowance: emp.family_allowance ?? 0,
      rent_deduction:   emp.rent_deduction   ?? 0,
    });
    setAddMode(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', daily_rate: 0, monthly_salary: 0, family_allowance: 0, rent_deduction: 0 });
  };

  const saveEdit = async () => {
    if (!editForm.name || !editForm.daily_rate) return;
    setSaving(true);
    await fetch(`/api/employees/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    await onUpdated();
    setEditingId(null);
    setSaving(false);
    showToast('更新しました');
  };

  const deleteEmployee = async (id: number, name: string) => {
    if (!window.confirm(`「${name}」を削除しますか？\n関連する出勤データもすべて削除されます。`)) return;
    setDeleting(id);
    await fetch(`/api/employees/${id}`, { method: 'DELETE' });
    await onUpdated();
    setDeleting(null);
    showToast('削除しました');
  };

  const addEmployee = async () => {
    if (!newForm.name || !newForm.daily_rate) return;
    setSaving(true);
    await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:             newForm.name,
        daily_rate:       parseInt(newForm.daily_rate)       || 0,
        monthly_salary:   parseInt(newForm.monthly_salary)   || 0,
        family_allowance: parseInt(newForm.family_allowance) || 0,
        rent_deduction:   parseInt(newForm.rent_deduction)   || 0,
      }),
    });
    await onUpdated();
    setNewForm({ name: '', daily_rate: '', monthly_salary: '', family_allowance: '', rent_deduction: '' });
    setAddMode(false);
    setSaving(false);
    showToast('追加しました');
  };

  const inputBase = 'w-full px-3 py-2.5 border rounded text-sm focus:outline-none';
  const inputBorder = '#d1d5db';

  return (
    <div className="max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3 rounded shadow-lg text-sm font-medium text-white"
          style={{ background: NAVY, borderLeft: `4px solid ${GOLD}` }}>
          {toast}
        </div>
      )}

      {/* Header card */}
      <div className="rounded-xl overflow-hidden shadow-sm mb-6" style={{ background: NAVY }}>
        <div className="px-8 py-6 flex items-end justify-between">
          <div>
            <div className="section-label mb-1">EMPLOYEE MANAGEMENT</div>
            <h2 className="text-2xl font-bold text-white">従業員管理</h2>
            <div className="mt-2" style={{ width: 40, height: 2, background: GOLD }} />
            <p className="mt-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              従業員情報（名前・日当・月給・家族手当・家賃控除）の確認・編集・追加・削除ができます
            </p>
          </div>
          <button
            onClick={() => { setAddMode(m => !m); setEditingId(null); }}
            className="px-5 py-2.5 rounded text-sm font-bold transition-all"
            style={addMode ? { background: 'rgba(255,255,255,0.15)', color: 'white' } : { background: GOLD, color: NAVY }}
          >
            {addMode ? 'キャンセル' : '＋ 従業員追加'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {addMode && (
        <div className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden" style={{ borderColor: GOLD }}>
          <div className="px-6 py-4 border-b" style={{ background: '#FBF7EE', borderColor: '#E8D9A0' }}>
            <div className="section-label">NEW EMPLOYEE</div>
            <div className="font-bold mt-0.5" style={{ color: NAVY }}>新規従業員追加</div>
          </div>
          <div className="p-6 grid grid-cols-14 gap-3 items-end" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
            <div className="col-span-3">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: NAVY }}>氏名</label>
              <input type="text" placeholder="例：山田　太郎" value={newForm.name}
                onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                className={inputBase} style={{ borderColor: inputBorder }}
                onFocus={e => e.target.style.borderColor = GOLD}
                onBlur={e => e.target.style.borderColor = inputBorder}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: NAVY }}>日当</label>
              <NewAmountInput value={newForm.daily_rate} placeholder="15000" onChange={v => setNewForm(f => ({ ...f, daily_rate: v }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: NAVY }}>月給</label>
              <NewAmountInput value={newForm.monthly_salary} placeholder="0" onChange={v => setNewForm(f => ({ ...f, monthly_salary: v }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: NAVY }}>家族手当</label>
              <NewAmountInput value={newForm.family_allowance} placeholder="0" onChange={v => setNewForm(f => ({ ...f, family_allowance: v }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: NAVY }}>家賃控除</label>
              <NewAmountInput value={newForm.rent_deduction} placeholder="0" onChange={v => setNewForm(f => ({ ...f, rent_deduction: v }))} />
            </div>
            <div className="col-span-3">
              <button onClick={addEmployee} disabled={saving || !newForm.name || !newForm.daily_rate}
                className="w-full px-4 py-2.5 rounded text-sm font-bold"
                style={{ background: NAVY, color: GOLD, opacity: saving ? 0.6 : 1 }}>
                {saving ? '追加中...' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Table header — 14 cols */}
        <div className="px-6 py-3 text-xs font-bold tracking-wider flex" style={{ background: NAVY, color: GOLD }}>
          <div className="w-8 text-center shrink-0">No.</div>
          <div className="flex-1 min-w-0">氏名</div>
          <div className="w-28 text-right shrink-0">日当</div>
          <div className="w-28 text-right shrink-0">月給</div>
          <div className="w-28 text-right shrink-0">家族手当</div>
          <div className="w-28 text-right shrink-0">家賃控除</div>
          <div className="w-24 text-center shrink-0">操作</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-100">
          {employees.map((emp, idx) => (
            <div key={emp.id}>
              {editingId === emp.id ? (
                <div className="px-6 py-4 flex items-center gap-2" style={{ background: '#FBF7EE' }}>
                  <div className="w-8 text-center text-sm font-bold shrink-0" style={{ color: GOLD }}>{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <input type="text" value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border rounded text-sm focus:outline-none"
                      style={{ borderColor: GOLD }} />
                  </div>
                  <div className="w-28 shrink-0">
                    <AmountInput value={editForm.daily_rate} onChange={v => setEditForm(f => ({ ...f, daily_rate: v }))} />
                  </div>
                  <div className="w-28 shrink-0">
                    <AmountInput value={editForm.monthly_salary} onChange={v => setEditForm(f => ({ ...f, monthly_salary: v }))} />
                  </div>
                  <div className="w-28 shrink-0">
                    <AmountInput value={editForm.family_allowance} onChange={v => setEditForm(f => ({ ...f, family_allowance: v }))} />
                  </div>
                  <div className="w-28 shrink-0">
                    <AmountInput value={editForm.rent_deduction} onChange={v => setEditForm(f => ({ ...f, rent_deduction: v }))} />
                  </div>
                  <div className="w-24 flex gap-2 justify-center shrink-0">
                    <button onClick={saveEdit} disabled={saving}
                      className="px-3 py-1.5 rounded text-xs font-bold"
                      style={{ background: NAVY, color: GOLD }}>
                      {saving ? '保存中' : '保存'}
                    </button>
                    <button onClick={cancelEdit}
                      className="px-3 py-1.5 rounded text-xs font-medium border"
                      style={{ borderColor: '#d1d5db', color: '#6b7280' }}>
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-6 py-4 flex items-center transition-colors"
                  style={{ background: idx % 2 === 0 ? 'white' : '#FAFAFA' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8F5EE')}
                  onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#FAFAFA')}
                >
                  <div className="w-8 text-center text-sm font-medium shrink-0" style={{ color: '#9ca3af' }}>{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold" style={{ color: NAVY }}>{emp.name}</span>
                  </div>
                  <div className="w-28 text-right shrink-0">
                    <span className="text-sm font-bold" style={{ color: NAVY }}>{emp.daily_rate.toLocaleString()}</span>
                    <span className="text-xs ml-1" style={{ color: '#6b7280' }}>円</span>
                  </div>
                  <div className="w-28 text-right shrink-0">
                    <span className="text-sm font-bold" style={{ color: (emp.monthly_salary ?? 0) > 0 ? NAVY : '#9ca3af' }}>
                      {(emp.monthly_salary ?? 0).toLocaleString()}
                    </span>
                    <span className="text-xs ml-1" style={{ color: '#6b7280' }}>円</span>
                  </div>
                  <div className="w-28 text-right shrink-0">
                    <span className="text-sm font-bold" style={{ color: (emp.family_allowance ?? 0) > 0 ? NAVY : '#9ca3af' }}>
                      {(emp.family_allowance ?? 0).toLocaleString()}
                    </span>
                    <span className="text-xs ml-1" style={{ color: '#6b7280' }}>円</span>
                  </div>
                  <div className="w-28 text-right shrink-0">
                    <span className="text-sm font-bold" style={{ color: (emp.rent_deduction ?? 0) > 0 ? '#ef4444' : '#9ca3af' }}>
                      {(emp.rent_deduction ?? 0).toLocaleString()}
                    </span>
                    <span className="text-xs ml-1" style={{ color: '#6b7280' }}>円</span>
                  </div>
                  <div className="w-24 flex gap-2 justify-center shrink-0">
                    <button onClick={() => startEdit(emp)}
                      className="px-3 py-1.5 rounded text-xs font-bold"
                      style={{ background: NAVY, color: GOLD }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                      編集
                    </button>
                    <button onClick={() => deleteEmployee(emp.id, emp.name)}
                      disabled={deleting === emp.id}
                      className="px-3 py-1.5 rounded text-xs font-bold border"
                      style={{ borderColor: '#fca5a5', color: '#ef4444', background: 'white' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                      {deleting === emp.id ? '削除中' : '削除'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t flex items-center justify-between"
          style={{ borderColor: '#e5e7eb', background: '#FAFAFA' }}>
          <span className="text-xs" style={{ color: '#9ca3af' }}>全 {employees.length} 名</span>
          <span className="text-xs" style={{ color: '#9ca3af' }}>
            平均日当: {employees.length > 0
              ? Math.round(employees.reduce((s, e) => s + e.daily_rate, 0) / employees.length).toLocaleString()
              : 0}円
          </span>
        </div>
      </div>
    </div>
  );
}
