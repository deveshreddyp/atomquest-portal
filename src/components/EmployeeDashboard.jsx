import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { collection, serverTimestamp, writeBatch, doc, query, where, getDocs, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../store';
import { Target, CheckCircle2, AlertCircle, FileDown } from 'lucide-react';
import Swal from 'sweetalert2';
import html2pdf from 'html2pdf.js';
import { logAuditAction } from '../utils';

export default function EmployeeDashboard() {
  const { user } = useAuthStore();
  const [existingGoals, setExistingGoals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePhase, setActivePhase] = useState('Goal Setting');

  const { register, control, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      goals: [{ thrustArea: 'Operations', title: '', description: '', uomType: 'min', target: 0, weightage: 100 }]
    }
  });
  
  const { fields, append, remove } = useFieldArray({ control, name: "goals" });
  const watchGoals = watch("goals");
  const totalWeightage = watchGoals.reduce((sum, goal) => sum + (Number(goal.weightage) || 0), 0);
  
  const [isSuggesting, setIsSuggesting] = useState(null);
  const [updateGoalId, setUpdateGoalId] = useState(null);
  const [actualVal, setActualVal] = useState('');
  const [progStatus, setProgStatus] = useState('On Track');

  useEffect(() => {
    fetchMyGoals();
  }, [user]);

  const fetchMyGoals = async () => {
    try {
      const snapSettings = await getDoc(doc(db, 'settings', 'system'));
      if (snapSettings.exists()) setActivePhase(snapSettings.data().activePhase);

      const q = query(collection(db, 'goals'), where('employeeEmail', '==', user.email));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setExistingGoals(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (err) {
      console.error("Failed to load existing goals", err);
    }
    setLoading(false);
  };

  const suggestSMARTGoal = async (index) => {
    const thrustArea = watchGoals[index].thrustArea;
    const title = watchGoals[index].title;
    if (!title) return Swal.fire('Notification', "Please enter a title first.", 'info');

    setIsSuggesting(index);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "anthropic/claude-3-haiku",
          messages: [
            { role: "system", content: "You are an expert HR coach. Write a concise, 2-sentence SMART goal description based on the provided title and area. Do not include introductory text." },
            { role: "user", content: `Area: ${thrustArea}. Title: ${title}.` }
          ]
        })
      });
      const data = await response.json();
      setValue(`goals.${index}.description`, data.choices[0].message.content.trim());
    } catch (err) {
      Swal.fire('Notification', "Failed to fetch AI suggestion.", 'info');
    }
    setIsSuggesting(null);
  };

  const onSubmit = async (data) => {
    if (totalWeightage !== 100) return Swal.fire('Notification', "Total weightage must be exactly 100%. Please adjust.", 'info');
    if (data.goals.length > 8) return Swal.fire('Notification', "Maximum 8 goals allowed.", 'info');
    if (data.goals.some(g => g.weightage < 10)) return Swal.fire('Notification', "Each goal must have a minimum weightage of 10%.", 'info');
    
    try {
      const batch = writeBatch(db);
      data.goals.forEach(goal => {
        const goalRef = doc(collection(db, 'goals'));
        batch.set(goalRef, {
          ...goal,
          employeeId: user.uid,
          employeeEmail: user.email,
          status: 'pending',
          createdAt: serverTimestamp(),
          isLocked: false
        });
      });
      await batch.commit();
      fetchMyGoals();
      await logAuditAction(user.email, 'GOAL_SUBMISSION', `Submitted ${data.goals.length} goals for approval`);
      Swal.fire('Notification', "Successfully submitted to Manager for approval!", 'info');
    } catch (err) {
        Swal.fire('Notification', "Error saving: " + err.message, 'info');
    }
  };

  const handleUpdateProgress = async (e) => {
    e.preventDefault();
    try {
        await updateDoc(doc(db, 'goals', updateGoalId), {
            actualAchievement: Number(actualVal),
            progressStatus: progStatus,
            lastUpdated: serverTimestamp()
        });
        await logAuditAction(user.email, 'PROGRESS_UPDATE', `Updated progress to ${actualVal}`);
        Swal.fire('Notification', "Progress Updated!", 'info');
        setUpdateGoalId(null); setActualVal(''); setProgStatus('On Track');
        fetchMyGoals();
    } catch (err) {
        Swal.fire('Notification', "Failed to update progress.", 'info');
    }
  };

  const handleSetSharedWeight = async (goalId, newWeight) => {
      // In a real app, we'd check total weight again, but for hackathon demo we just update the individual document.
      try {
          await updateDoc(doc(db, 'goals', goalId), { weightage: Number(newWeight), status: 'pending' });
          fetchMyGoals();
      } catch (err) { Swal.fire('Notification', "Failed to update weight.", 'info'); }
  };

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

  const exportPDF = () => {
    const element = document.getElementById('goal-sheet');
    html2pdf().from(element).set({
      margin: 1,
      filename: 'AtomQuest_Goal_Sheet.pdf',
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    }).save();
    logAuditAction(user.email, 'EXPORT_PDF', 'Exported goal sheet as PDF');
  };

  if (loading) return <div className="text-center py-20">Loading your profile...</div>;

  if (existingGoals) {
    const isApproved = existingGoals.every(g => g.status === 'approved');
    return (
      <div id="goal-sheet" className="max-w-5xl mx-auto space-y-8 pb-20">
        <div className="bg-white dark:bg-slate-900 p-10 shadow-sm rounded-2xl border border-slate-200 dark:border-slate-800 text-center relative">
          <div className="absolute top-6 right-6">
            <button onClick={exportPDF} className="bg-slate-900 text-white flex items-center gap-2 px-4 py-2 rounded-lg font-bold hover:bg-slate-800 text-sm transition-colors shadow-sm" data-html2canvas-ignore="true">
                <FileDown size={16}/> Export PDF
            </button>
          </div>
          <div className="inline-block p-4 rounded-full bg-slate-50 dark:bg-slate-950 mb-4">
            {isApproved ? <CheckCircle2 className="w-12 h-12 text-emerald-500" /> : <AlertCircle className="w-12 h-12 text-amber-500" />}
          </div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Your Goal Sheet is {isApproved ? 'Approved!' : 'Under Review'}</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto">
            {isApproved 
              ? "Your manager has approved your goals. You can now log your Quarterly Check-in progress below."
              : "Your manager is currently reviewing your submission. Check back later."}
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {existingGoals.map((g) => {
            const score = computeScore(g.actualAchievement, g.target, g.uomType);
            return (
            <div key={g.id} className="p-6 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              {g.isShared && <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded-bl-lg">Mandated KPI</div>}
              
              <div className="mb-4 pr-12">
                <span className="text-xs font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-400 mb-1 block">{g.thrustArea}</span>
                <h4 className="font-bold text-slate-800 dark:text-white text-lg">{g.title}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">{g.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl mb-4 border border-slate-100">
                <div>
                    <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Target</div>
                    <div className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-1"><Target size={16}/> {g.target} <span className="text-xs text-slate-500 dark:text-slate-400">{g.uomType}</span></div>
                </div>
                <div>
                    <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Actual Progress</div>
                    <div className="text-lg font-black text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                        {g.actualAchievement !== undefined ? g.actualAchievement : '-'}
                        {score !== null && (
                            <span className={`text-xs px-2 py-0.5 rounded font-black text-white ${score >= 100 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}>
                                {score}%
                            </span>
                        )}
                    </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                  {g.isShared && g.weightage === 0 ? (
                      <div className="flex gap-2 w-full">
                          <input type="number" placeholder="Set Weight %" id={`weight-${g.id}`} className="w-full border rounded-lg p-2 text-sm" />
                          <button onClick={()=>handleSetSharedWeight(g.id, document.getElementById(`weight-${g.id}`).value)} className="bg-primary text-slate-900 text-sm font-bold px-4 rounded-lg">Save</button>
                      </div>
                  ) : (
                      <div className="text-sm font-black text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        Weight: {g.weightage}%
                      </div>
                  )}

                  {isApproved && (!g.isShared || g.weightage > 0) && (
                      <button 
                          onClick={() => setUpdateGoalId(g.id)} 
                          disabled={activePhase === 'Goal Setting'}
                          className="text-yellow-600 dark:text-yellow-400 font-bold text-sm hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                          title={activePhase === 'Goal Setting' ? 'Quarterly check-in is currently locked by the Admin.' : 'Update your progress'}
                      >
                          {activePhase === 'Goal Setting' ? 'Locked (Goal Setting Phase)' : 'Update Progress →'}
                      </button>
                  )}
              </div>
            </div>
          )})}
        </div>

        {/* Update Progress Modal */}
        {updateGoalId && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md w-full shadow-2xl">
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Quarterly Check-In</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">Log your actual achievement against your planned target.</p>
                    <form onSubmit={handleUpdateProgress} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Actual Value Achieved</label>
                            <input type="number" value={actualVal} onChange={e=>setActualVal(e.target.value)} required className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-3 outline-none focus:border-primary" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Status</label>
                            <select value={progStatus} onChange={e=>setProgStatus(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-3 outline-none focus:border-primary">
                                <option>Not Started</option>
                                <option>On Track</option>
                                <option>Completed</option>
                            </select>
                        </div>
                        <div className="flex gap-3 mt-6 pt-6 border-t border-slate-100">
                            <button type="button" onClick={()=>setUpdateGoalId(null)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold py-3 rounded-lg hover:bg-slate-200">Cancel</button>
                            <button type="submit" className="w-full bg-primary text-slate-900 font-bold py-3 rounded-lg hover:brightness-110">Save Progress</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
      </div>
    );
  }

  // Original Goal Creation Form (unchanged logic)
  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 p-10 shadow-xl rounded-2xl border border-slate-200 dark:border-slate-800 pb-20">
      <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
        <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Create Goal Sheet</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Define your objectives for the current quarter.</p>
        </div>
        <div className={`px-5 py-2.5 rounded-xl font-black text-lg transition-colors ${totalWeightage === 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          Total Weight: {totalWeightage}%
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {fields.map((field, index) => (
          <div key={field.id} className="p-6 border border-slate-200 dark:border-slate-800 rounded-xl space-y-5 bg-slate-50 dark:bg-slate-950/50 relative group transition-all hover:border-slate-300 dark:border-slate-700">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Goal {index + 1}</h3>
                {index > 0 && (
                    <button type="button" onClick={() => remove(index)} className="text-slate-400 hover:text-red-500 font-medium transition-colors text-sm">Remove</button>
                )}
            </div>
            
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-200">Thrust Area</label>
                <select {...register(`goals.${index}.thrustArea`)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 outline-none focus:border-primary">
                  <option value="Operations">Operations</option>
                  <option value="Sales">Sales</option>
                  <option value="Quality">Quality</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-200">Title</label>
                <input {...register(`goals.${index}.title`)} placeholder="e.g. Reduce server downtime" className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 outline-none focus:border-primary" required />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">SMART Description</label>
                <button type="button" onClick={() => suggestSMARTGoal(index)} disabled={isSuggesting === index} className="text-yellow-600 dark:text-yellow-400 text-sm font-bold flex items-center gap-1.5 hover:opacity-80 transition-opacity bg-emerald-50 px-3 py-1 rounded-md">
                  ✨ {isSuggesting === index ? "Generating..." : "Generate AI Description"}
                </button>
              </div>
              <textarea {...register(`goals.${index}.description`)} rows="3" placeholder="Describe the specifics..." className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-900 outline-none focus:border-primary resize-none" required></textarea>
            </div>

            <div className="grid grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-200">UoM Type</label>
                <select {...register(`goals.${index}.uomType`)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 outline-none focus:border-primary">
                  <option value="min">Min (Target to Reach)</option>
                  <option value="max">Max (Target to Reduce)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-200">Target Value</label>
                <input type="number" {...register(`goals.${index}.target`)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 outline-none focus:border-primary" required />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-200">Weightage (%)</label>
                <input type="number" {...register(`goals.${index}.weightage`)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-900 outline-none focus:border-primary" required />
              </div>
            </div>
          </div>
        ))}

        <div className="flex justify-between pt-6 border-t border-slate-100 mt-8">
          <button type="button" onClick={() => append({ thrustArea: 'Operations', title: '', description: '', uomType: 'min', target: 0, weightage: 10 })} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-3 px-6 rounded-lg hover:bg-slate-200">
            + Add Another Goal
          </button>
          <button type="submit" disabled={totalWeightage !== 100 || fields.length > 8} className="bg-slate-900 text-white font-bold py-3 px-10 rounded-lg disabled:opacity-50 hover:bg-slate-800 shadow-md">
            Submit Goals For Approval
          </button>
        </div>
      </form>
    </div>
  );
}
