import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryApp } from '../firebase';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Users, FileDown, AlertCircle, CheckCircle, Clock, ShieldCheck, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuthStore } from '../store';
import { logAuditAction } from '../utils';

export default function AdminDashboard() {
  const [goals, setGoals] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  // Roster Form State
  const [empEmail, setEmpEmail] = useState('');
  const [mgrEmail, setMgrEmail] = useState('');
  
  // User Creation State
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('Employee');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  
  // System Phase
  const [activePhase, setActivePhase] = useState('Goal Setting');

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
      
      const qUsers = query(collection(db, 'system_users'), orderBy('createdAt', 'desc'));
      const snapUsers = await getDocs(qUsers);
      let loadedUsers = snapUsers.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Auto-seed default test users if they don't exist in the directory
      const defaultUsers = ['admin@test.com', 'manager@test.com', 'employee@test.com'];
      const existingEmails = loadedUsers.map(u => u.email);
      let needsRefetch = false;

      for (const email of defaultUsers) {
          if (!existingEmails.includes(email)) {
              await addDoc(collection(db, 'system_users'), {
                  email: email,
                  role: email.split('@')[0],
                  createdAt: serverTimestamp()
              });
              needsRefetch = true;
          }
      }

      if (needsRefetch) {
          const newSnap = await getDocs(qUsers);
          loadedUsers = newSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      setSystemUsers(loadedUsers);

      const snapSettings = await getDoc(doc(db, 'settings', 'system'));
      if (snapSettings.exists()) {
        setActivePhase(snapSettings.data().activePhase);
      } else {
        await setDoc(doc(db, 'settings', 'system'), { activePhase: 'Goal Setting' });
      }

      const qAudit = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'));
      const snapAudit = await getDocs(qAudit);
      setAuditLogs(snapAudit.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if(!newEmail || !newPassword) return;
    setIsCreatingUser(true);
    try {
        const secondaryAuth = getAuth(secondaryApp);
        await createUserWithEmailAndPassword(secondaryAuth, newEmail.toLowerCase().trim(), newPassword);
        
        await addDoc(collection(db, 'system_users'), {
            email: newEmail.toLowerCase().trim(),
            role: newRole,
            createdAt: serverTimestamp()
        });

        await logAuditAction(user.email, 'CREATE_USER', `Created new system user: ${newEmail}`);
        Swal.fire('Success', `User ${newEmail} created successfully!`, 'success');
        setNewEmail('');
        setNewPassword('');
        fetchData();
    } catch (err) {
        Swal.fire('Error', "Failed to create user: " + err.message, 'error');
    }
    setIsCreatingUser(false);
  };

  const handleAllocate = async (e) => {
    e.preventDefault();
    const emp = empEmail.toLowerCase().trim();
    const mgr = mgrEmail.toLowerCase().trim();
    
    if(!emp || !mgr) return;
    if(emp === mgr) {
        return Swal.fire('Error', 'Employee and Manager cannot be the same person.', 'error');
    }
    
    // Check if both users exist in our system_users collection
    const userEmails = systemUsers.map(u => u.email);
    if (!userEmails.includes(emp) || !userEmails.includes(mgr)) {
        return Swal.fire('Error', 'One or both users do not exist in the System Directory. Please register them first.', 'error');
    }

    try {
        await addDoc(collection(db, 'allocations'), {
            employeeEmail: emp,
            managerEmail: mgr,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        setEmpEmail('');
        setMgrEmail('');
        await logAuditAction(user.email, 'ROSTER_ALLOCATION', `Requested assignment: ${empEmail} -> ${mgrEmail}`);
        Swal.fire('Success', 'Allocation Request sent to Manager!', 'success');
        fetchData();
    } catch (err) {
        Swal.fire('Error', "Error allocating: " + err.message, 'error');
    }
  };

  const handleDeleteAllocation = async (allocationId, employee, manager) => {
    const result = await Swal.fire({
      title: 'Delete Allocation?',
      text: `Are you sure you want to remove the allocation for ${employee}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'allocations', allocationId));
        await logAuditAction(user.email, 'DELETE_ALLOCATION', `Deleted allocation: ${employee} -> ${manager}`);
        Swal.fire('Deleted!', 'The allocation has been removed.', 'success');
        fetchData();
      } catch (err) {
        Swal.fire('Error', "Failed to delete allocation: " + err.message, 'error');
      }
    }
  };

  const handleUpdatePhase = async (newPhase) => {
    setActivePhase(newPhase);
    try {
        await setDoc(doc(db, 'settings', 'system'), { activePhase: newPhase }, { merge: true });
        await logAuditAction(user.email, 'PHASE_UPDATE', `Changed system phase to ${newPhase}`);
        Swal.fire('Success', `System Phase successfully updated to: ${newPhase}`, 'success');
    } catch (err) {
        Swal.fire('Error', "Error updating phase: " + err.message, 'error');
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
          <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Admin Control Center</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage global analytics, audits, and roster allocations.</p>
        </div>
        <div className="flex gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 flex items-center shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-3">System Phase:</span>
                <select value={activePhase} onChange={e=>handleUpdatePhase(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-sm font-bold p-1.5 outline-none text-slate-800 dark:text-white focus:border-primary">
                    <option value="Goal Setting">Goal Setting</option>
                    <option value="Q1 Check-in">Q1 Check-in</option>
                    <option value="Q2 Check-in">Q2 Check-in</option>
                    <option value="Q3 Check-in">Q3 Check-in</option>
                    <option value="Q4 Check-in">Q4 Check-in</option>
                </select>
            </div>
            <button onClick={exportToExcel} className="bg-slate-900 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-2">
            <FileDown className="w-5 h-5" /> Export Data
            </button>
        </div>
      </div>

      {/* Identity & Roster Allocation Module */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="font-black text-xl text-slate-800 dark:text-white flex items-center gap-2 mb-6">
            <Users className="text-yellow-600 dark:text-yellow-400" /> Identity & Roster Management
        </h3>
        
        <div className="grid grid-cols-4 gap-6">
            {/* Create System User */}
            <div className="col-span-1 bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-slate-800 dark:text-white mb-4">Create System User</h4>
                <form onSubmit={handleCreateUser} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">New User Email</label>
                        <input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} required className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="new@test.com" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Secure Password</label>
                        <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="••••••••" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Assign Role</label>
                        <select value={newRole} onChange={e=>setNewRole(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                            <option value="Employee">Employee</option>
                            <option value="Manager">Manager</option>
                            <option value="Admin">Admin</option>
                        </select>
                    </div>
                    <button type="submit" disabled={isCreatingUser} className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50">
                        {isCreatingUser ? 'Creating...' : 'Register User'}
                    </button>
                </form>
            </div>

            {/* Create Allocation */}
            <div className="col-span-1 bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-slate-800 dark:text-white mb-4">Create Allocation</h4>
                <form onSubmit={handleAllocate} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Employee Email</label>
                        <input type="email" value={empEmail} onChange={e=>setEmpEmail(e.target.value)} required className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="employee@test.com" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Manager Email</label>
                        <input type="email" value={mgrEmail} onChange={e=>setMgrEmail(e.target.value)} required className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="manager@test.com" />
                    </div>
                    <button type="submit" className="w-full bg-primary text-slate-900 font-bold py-2.5 rounded-lg hover:brightness-110 transition-colors">
                        Send Allocation Request
                    </button>
                </form>
            </div>

            <div className="col-span-2">
                <h4 className="font-bold text-slate-800 dark:text-white mb-4">Allocation Status Logs</h4>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden h-64 overflow-y-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                        <tr>
                            <th className="px-6 py-3 font-semibold">Status</th>
                            <th className="px-6 py-3 font-semibold">Employee</th>
                            <th className="px-6 py-3 font-semibold">Assigned Manager</th>
                            <th className="px-6 py-3 font-semibold text-right">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {allocations.map(a => (
                                <tr key={a.id} className="hover:bg-slate-50 dark:bg-slate-950">
                                    <td className="px-6 py-3">
                                        {a.status === 'pending' && <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-md text-xs font-bold w-max"><Clock size={14}/> Pending</span>}
                                        {a.status === 'accepted' && <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-xs font-bold w-max"><CheckCircle size={14}/> Accepted</span>}
                                        {a.status === 'conflict' && <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-md text-xs font-bold w-max"><AlertCircle size={14}/> Conflict (Rejected)</span>}
                                    </td>
                                    <td className="px-6 py-3 font-medium text-slate-800 dark:text-white">{a.employeeEmail}</td>
                                    <td className="px-6 py-3 text-slate-600">{a.managerEmail}</td>
                                    <td className="px-6 py-3 text-right">
                                        <button onClick={() => handleDeleteAllocation(a.id, a.employeeEmail, a.managerEmail)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-md transition-colors" title="Delete Allocation">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {allocations.length === 0 && (
                                <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">No roster allocations created yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        {/* System User Directory */}
        <div className="mt-8">
            <h4 className="font-bold text-slate-800 dark:text-white mb-4">System User Directory</h4>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                    <tr>
                        <th className="px-6 py-3 font-semibold">User Email</th>
                        <th className="px-6 py-3 font-semibold">Role</th>
                        <th className="px-6 py-3 font-semibold">Registered At</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {systemUsers.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50 dark:bg-slate-950">
                                <td className="px-6 py-3 font-medium text-slate-800 dark:text-white">{u.email}</td>
                                <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{u.role || 'Employee'}</td>
                                <td className="px-6 py-3 text-slate-500 text-xs">{u.createdAt?.toDate().toLocaleDateString() || 'Recently'}</td>
                            </tr>
                        ))}
                        {systemUsers.length === 0 && (
                            <tr><td colSpan="3" className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">No registered users in directory.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      {/* Audit Log Module */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="font-black text-xl text-slate-800 dark:text-white flex items-center gap-2 mb-6">
            <ShieldCheck className="text-yellow-600 dark:text-yellow-400" /> System Audit Logs
        </h3>
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden h-48 overflow-y-auto p-4">
            {auditLogs.length === 0 ? <p className="text-slate-500 dark:text-slate-400 text-center mt-10">No audit logs available.</p> : (
                <ul className="space-y-3">
                    {auditLogs.map(log => (
                        <li key={log.id} className="text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 p-3 rounded shadow-sm border border-slate-100 flex justify-between items-center">
                            <div>
                                <span className="font-bold text-slate-900 mr-2">{log.actorEmail}</span>
                                <span className="text-xs bg-slate-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-slate-600 mr-2">{log.action}</span>
                                <span>{log.details}</span>
                            </div>
                            <span className="text-xs text-slate-400 font-medium">
                                {log.timestamp?.toDate().toLocaleString() || 'Just now'}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
      </div>

      {/* Analytics Module */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4">Goal Distribution by Thrust Area</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4">Approval Completion Rate</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
