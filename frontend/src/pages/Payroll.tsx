import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api-client';
import { useAuth } from '../context/AuthContext';
import { Banknote, ShieldAlert } from 'lucide-react';

export const Payroll: React.FC = () => {
  const { user } = useAuth();
  const [structures, setStructures] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [myPayslips, setMyPayslips] = useState<any[]>([]);

  useEffect(() => {
    const fetchPayroll = async () => {
      try {
        if (user?.employeeId) {
          const myRes = await apiFetch('/payroll/my-payslips').catch(() => null);
          setMyPayslips(myRes?.payslips || []);
        }

        if (['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(user?.role || '')) {
          const structRes = await apiFetch('/payroll/structures');
          setStructures(structRes.salaryStructures || []);

          const recRes = await apiFetch('/payroll/records');
          setRecords(recRes.payrollRecords || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchPayroll();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
          <Banknote className="w-6 h-6 text-emerald-400" />
          <span>Payroll & Salary Administration</span>
        </h1>
        <p className="text-xs text-slate-400">Strictly RBAC-protected salary structures, gross calculations, and monthly payslips in INR (₹)</p>
      </div>

      {user?.employeeId && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 font-semibold text-xs text-slate-300">
            My Personal Monthly Payslips
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Pay Period</th>
                  <th className="px-6 py-3">Basic Pay</th>
                  <th className="px-6 py-3">Allowances</th>
                  <th className="px-6 py-3">Deductions</th>
                  <th className="px-6 py-3">Net Salary (₹)</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {Array.isArray(myPayslips) && myPayslips.length > 0 ? (
                  myPayslips.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="px-6 py-3.5 font-bold text-slate-200">{p.pay_period_month}/{p.pay_period_year}</td>
                      <td className="px-6 py-3.5 font-mono">₹ {parseFloat(p.basic_pay).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 font-mono">₹ {parseFloat(p.allowances).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 font-mono text-rose-400">₹ {parseFloat(p.deductions).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 font-mono font-extrabold text-emerald-400">₹ {parseFloat(p.net_salary).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 font-bold text-cyan-400">{p.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No generated payslips available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'].includes(user?.role || '') && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 font-semibold text-xs text-slate-300">
            Organization Salary Structures Overview (RBAC Protected)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Basic Pay</th>
                  <th className="px-6 py-3">HRA</th>
                  <th className="px-6 py-3">Gross Salary</th>
                  <th className="px-6 py-3">PF / ESI / Taxes</th>
                  <th className="px-6 py-3">Net Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {Array.isArray(structures) && structures.length > 0 ? (
                  structures.map(s => (
                    <tr key={s.id} className="hover:bg-slate-800/40">
                      <td className="px-6 py-3.5 font-semibold text-slate-200">{s.employee_name} ({s.employee_code})</td>
                      <td className="px-6 py-3.5 font-mono">₹ {parseFloat(s.basic_pay).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 font-mono">₹ {parseFloat(s.hra).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 font-mono font-bold text-cyan-400">₹ {parseFloat(s.gross_salary).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 font-mono text-rose-400">₹ {(parseFloat(s.pf_deduction) + parseFloat(s.esi_deduction) + parseFloat(s.tds)).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 font-mono font-extrabold text-emerald-400">₹ {parseFloat(s.net_salary).toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No baseline salary structures configured.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
