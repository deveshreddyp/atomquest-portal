import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Users, FileDown, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function AdminDashboard() {
  const [goals, setGoals] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Roster Form State
  const [empEmail, setEmpEmail] = useState('');
  const [mgrEmail, setMgrEmail] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const qGoals = query(collection(db, 'goals'), orderBy('createdAt', 'desc'));
      const snapGoals = await getDocs(qGoals);
      setGoals(snapGoals.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const qAlloc = query(collection(db, 'allocations'), orderBy('createdAt', 'desc'));
      const snapAlloc = await getDocs(qAlloc);
      setAllocations(snapAlloc.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleAllocate = async (e) => {
    e.preventDefault();
    if(!empEmail || !mgrEmail) return;
    try {
        await addDoc(collection(db, 'allocations'), {
            employeeEmail: empEmail.toLowerCase().trim(),
            managerEmail: mgrEmail.toLowerCase().trim(),
            status: 'pending',
            createdAt: serverTimestamp()
        });
        setEmpEmail('');
        setMgrEmail('');
        alert("Allocation Request sent to Manager!");
        fetchData();
    } catch (err) {
        alert("Error allocating: " + err.message);
    }
  };

  const exportToExcel = () => {
    const formattedData = goals.map(g => ({
      'Employee Email': g.employeeEmail || g.employeeId,
      'Status': g.status.toUpperCase(),
      'Thrust Area': g.thrustArea,
      'Title': g.title,
      'Description': g.description,
      'UoM': g.uomType,
      'Target': g.target,
      'Weightage (%)': g.weightage,
      'Actual Progress': g.actualAchievement || 'Not updated'
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Goals Report");
    XLSX.writeFile(workbook, "AtomQuest_Report.xlsx");
  };

  const thrustAreaCounts = goals.reduce((acc, goal) => {
    acc[goal.thrustArea] = (acc[goal.thrustArea] || 0) + 1;
    return acc;
  }, {});
  
  const pieData = Object.keys(thrustAreaCounts).map(key => ({ name: key, value: thrustAreaCounts[key] }));
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
  const statusData = [
    { name: 'Pending Review', value: goals.filter(g => g.status === 'pending').length, fill: '#f59e0b' },
    { name: 'Approved & Locked', value: goals.filter(g => g.status === 'approved').length, fill: '#10b981' }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Admin Control Center</h2>
          <p className="text-slate-500 mt-1">Manage global analytics, audits, and roster allocations.</p>
        </div>
        <button onClick={exportToExcel} className="bg-slate-900 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-2">
          <FileDown className="w-5 h-5" /> Export Data
        </button>
      </div>

      {/* Roster Allocation Module */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="font-black text-xl text-slate-800 flex items-center gap-2 mb-6">
            <Users className="text-primary" /> Roster Management & Allocations
        </h3>
        
        <div className="grid grid-cols-3 gap-8">
            <div className="col-span-1 bg-slate-50 p-6 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-800 mb-4">Create New Allocation</h4>
                <form onSubmit={handleAllocate} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Employee Email</label>
                        <input type="email" value={empEmail} onChange={e=>setEmpEmail(e.target.value)} required className="w-full border border-slate-300 rounded-lg p-2.5 bg-white outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="employee@test.com" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Manager Email</label>
                        <input type="email" value={mgrEmail} onChange={e=>setMgrEmail(e.target.value)} required className="w-full border border-slate-300 rounded-lg p-2.5 bg-white outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="manager@test.com" />
                    </div>
                    <button type="submit" className="w-full bg-primary text-white font-bold py-2.5 rounded-lg hover:bg-emerald-600 transition-colors">
                        Send Allocation Request
                    </button>
                </form>
            </div>

            <div className="col-span-2">
                <h4 className="font-bold text-slate-800 mb-4">Allocation Status Logs</h4>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden h-64 overflow-y-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                        <tr>
                            <th className="px-6 py-3 font-semibold">Status</th>
                            <th className="px-6 py-3 font-semibold">Employee</th>
                            <th className="px-6 py-3 font-semibold">Assigned Manager</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {allocations.map(a => (
                                <tr key={a.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-3">
                                        {a.status === 'pending' && <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-md text-xs font-bold w-max"><Clock size={14}/> Pending</span>}
                                        {a.status === 'accepted' && <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-xs font-bold w-max"><CheckCircle size={14}/> Accepted</span>}
                                        {a.status === 'conflict' && <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-md text-xs font-bold w-max"><AlertCircle size={14}/> Conflict (Rejected)</span>}
                                    </td>
                                    <td className="px-6 py-3 font-medium text-slate-800">{a.employeeEmail}</td>
                                    <td className="px-6 py-3 text-slate-600">{a.managerEmail}</td>
                                </tr>
                            ))}
                            {allocations.length === 0 && (
                                <tr><td colSpan="3" className="px-6 py-8 text-center text-slate-500">No roster allocations created yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>

      {/* Analytics Module */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-lg text-slate-800 mb-4">Goal Distribution by Thrust Area</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-lg text-slate-800 mb-4">Approval Completion Rate</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
