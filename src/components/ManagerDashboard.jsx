import Swal from 'sweetalert2';
import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../store';
import { CheckCircle2, XCircle, Send } from 'lucide-react';

export default function ManagerDashboard() {
  const { user } = useAuthStore();
  const [goals, setGoals] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Shared Goal Form
  const [sgTitle, setSgTitle] = useState('');
  const [sgArea, setSgArea] = useState('Operations');
  const [sgUom, setSgUom] = useState('min');
  const [sgTarget, setSgTarget] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Roster Requests for this manager
      const qReq = query(collection(db, 'allocations'), where('managerEmail', '==', user.email));
      const reqSnap = await getDocs(qReq);
      const allReqs = reqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRequests(allReqs);

      // 2. Determine accepted employees
      const acceptedEmails = allReqs.filter(r => r.status === 'accepted').map(r => r.employeeEmail);

      // 3. Fetch goals
      if (acceptedEmails.length > 0) {
          const qGoals = query(collection(db, 'goals'), where('status', 'in', ['pending', 'approved']));
          const goalsSnap = await getDocs(qGoals);
          // Filter in memory for demo speed
          const teamGoals = goalsSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(g => acceptedEmails.includes(g.employeeEmail));
          setGoals(teamGoals);
      } else {
          setGoals([]);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleRequest = async (reqId, status) => {
    try {
        await updateDoc(doc(db, 'allocations', reqId), { status });
        fetchDashboardData();
    } catch (err) {
        Swal.fire('Notification', "Error updating request.", 'info');
    }
  };

  const handleApproveAll = async (employeeEmail) => {
    const pendingToApprove = goals.filter(g => g.employeeEmail === employeeEmail && g.status === 'pending');
    if (!pendingToApprove.length) return;

    try {
      const batch = writeBatch(db);
      pendingToApprove.forEach(g => {
        const goalRef = doc(db, 'goals', g.id);
        batch.update(goalRef, {
          status: 'approved',
          isLocked: true,
          lockedAt: serverTimestamp()
        });
      });
      await batch.commit();
      Swal.fire('Notification', "Goals approved and locked!", 'info');
      fetchDashboardData();
    } catch (err) {
      Swal.fire('Notification', "Error approving: " + err.message, 'info');
    }
  };

  const handlePushSharedGoal = async (e) => {
    e.preventDefault();
    const acceptedEmails = requests.filter(r => r.status === 'accepted').map(r => r.employeeEmail);
    if(acceptedEmails.length === 0) return Swal.fire('Notification', "You have no accepted employees to push goals to.", 'info');

    try {
        const batch = writeBatch(db);
        acceptedEmails.forEach(empEmail => {
            const goalRef = doc(collection(db, 'goals'));
            batch.set(goalRef, {
                employeeEmail: empEmail,
                employeeId: 'shared_push',
                thrustArea: sgArea,
                title: sgTitle,
                description: 'Departmental KPI mandated by Manager.',
                uomType: sgUom,
                target: sgTarget,
                weightage: 0, // Employee must set weight
                status: 'pending', // Requires employee to incorporate it
                isShared: true,
                createdAt: serverTimestamp()
            });
        });
        await batch.commit();
        setSgTitle(''); setSgTarget('');
        Swal.fire('Notification', `Successfully pushed shared goal to ${acceptedEmails.length} team members!`, 'info');
        fetchDashboardData();
    } catch(err) {
        Swal.fire('Notification', "Error pushing goal: " + err.message, 'info');
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const groupedGoals = goals.reduce((acc, goal) => {
    if (!acc[goal.employeeEmail]) acc[goal.employeeEmail] = [];
    acc[goal.employeeEmail].push(goal);
    return acc;
  }, {});

  const computeScore = (actual, target, uom) => {
      if (actual === undefined || actual === null) return null;
      const act = Number(actual);
      const tgt = Number(target);
      if (tgt === 0) return 0;
      let score = 0;
      if (uom === 'min') {
          score = (act / tgt) * 100;
      } else {
          if (act === 0) return 100;
          score = (tgt / act) * 100;
      }
      return Math.max(0, Math.round(score));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Manager Dashboard</h2>
        <p className="text-slate-500 mt-1">Manage team roster, approve objectives, and monitor progress.</p>
      </div>

      {/* Roster Requests Section */}
      {pendingRequests.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-primary/20 overflow-hidden">
            <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex items-center justify-between">
                <h3 className="font-bold text-lg text-emerald-800">Action Required: New Roster Allocations</h3>
                <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded-full">{pendingRequests.length} Pending</span>
            </div>
            <div className="p-4 space-y-3 bg-white">
                {pendingRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50">
                        <div>
                            <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Admin Assigned Employee</p>
                            <p className="font-black text-slate-800 text-lg">{req.employeeEmail}</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={()=>handleRequest(req.id, 'conflict')} className="flex items-center gap-1 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 font-bold rounded-lg transition-colors">
                                <XCircle size={18}/> Reject (Conflict)
                            </button>
                            <button onClick={()=>handleRequest(req.id, 'accepted')} className="flex items-center gap-1 px-4 py-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 font-bold rounded-lg transition-colors">
                                <CheckCircle2 size={18}/> Accept to Team
                            </button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
      )}

      <div className="grid grid-cols-3 gap-8">
        {/* Shared Goal Pusher */}
        <div className="col-span-1 bg-slate-900 rounded-2xl shadow-lg p-6 text-white h-max sticky top-6">
            <h3 className="font-black text-xl mb-2 flex items-center gap-2"><Send size={20} className="text-primary"/> Push Shared Goal</h3>
            <p className="text-slate-400 text-sm mb-6">Force a departmental KPI onto all your accepted team members' sheets.</p>
            
            <form onSubmit={handlePushSharedGoal} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Thrust Area</label>
                    <select value={sgArea} onChange={e=>setSgArea(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-primary">
                        <option value="Operations">Operations</option>
                        <option value="Sales">Sales</option>
                        <option value="Finance">Finance</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Goal Title</label>
                    <input type="text" value={sgTitle} onChange={e=>setSgTitle(e.target.value)} required placeholder="e.g. Q3 Cost Reduction" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-primary placeholder-slate-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">UoM</label>
                        <select value={sgUom} onChange={e=>setSgUom(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-primary">
                            <option value="min">Min</option>
                            <option value="max">Max</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Target</label>
                        <input type="number" value={sgTarget} onChange={e=>setSgTarget(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-primary" />
                    </div>
                </div>
                <button type="submit" className="w-full bg-primary text-slate-900 font-black py-3 rounded-lg hover:bg-emerald-400 transition-colors mt-2">
                    Push to Entire Team
                </button>
            </form>
        </div>

        {/* Goal Approvals & Progress */}
        <div className="col-span-2 space-y-6">
            {loading ? (
                <div className="text-center py-20 text-slate-500">Syncing team data...</div>
            ) : Object.keys(groupedGoals).length === 0 ? (
                <div className="bg-white p-16 text-center rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">No Active Goals</h3>
                    <p className="text-slate-500">Your team members have not submitted any goal sheets yet.</p>
                </div>
            ) : (
                Object.entries(groupedGoals).map(([empEmail, employeeGoals]) => {
                    const hasPending = employeeGoals.some(g => g.status === 'pending');
                    return (
                        <div key={empEmail} className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                                <div>
                                    <h3 className="font-black text-lg text-slate-800">{empEmail}</h3>
                                    <p className="text-sm text-slate-500">{employeeGoals.length} total goals</p>
                                </div>
                                {hasPending ? (
                                    <button onClick={() => handleApproveAll(empEmail)} className="bg-primary text-white font-bold py-2 px-5 rounded-lg hover:bg-emerald-600 transition-colors shadow-sm text-sm">
                                        Approve Pending Updates
                                    </button>
                                ) : (
                                    <span className="text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full text-sm">All Approved</span>
                                )}
                            </div>
                            <div className="p-0">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-white text-slate-500 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold w-1/2">Goal Title</th>
                                        <th className="px-6 py-3 font-semibold text-right">Target</th>
                                        <th className="px-6 py-3 font-semibold text-right">Actual</th>
                                        <th className="px-6 py-3 font-semibold">State</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                    {employeeGoals.map((g) => {
                                        const score = computeScore(g.actualAchievement, g.target, g.uomType);
                                        return (
                                        <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            {g.isShared && <span className="bg-slate-800 text-white text-[10px] uppercase font-black px-1.5 py-0.5 rounded mr-2">Shared</span>}
                                            <span className="text-slate-700 font-medium">{g.title}</span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-800 font-bold text-right">{g.target} {g.uomType}</td>
                                        <td className="px-6 py-4 text-primary font-black text-right flex justify-end items-center gap-2">
                                            {g.actualAchievement || '-'}
                                            {score !== null && (
                                                <span className={`text-xs px-2 py-0.5 rounded font-black text-white ${score >= 100 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}>
                                                    {score}%
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {g.status === 'pending' ? (
                                                <span className="text-amber-600 text-xs font-bold uppercase">Pending</span>
                                            ) : g.progressStatus ? (
                                                <span className="text-blue-600 text-xs font-bold uppercase">{g.progressStatus}</span>
                                            ) : (
                                                <span className="text-slate-400 text-xs font-bold uppercase">Locked</span>
                                            )}
                                        </td>
                                        </tr>
                                    )})}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                })
            )}
        </div>
      </div>
    </div>
  );
}
