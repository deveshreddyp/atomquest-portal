import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuthStore } from '../store';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const setAuth = useAuthStore(state => state.setAuth);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      // Hackathon shortcut: determine role from email string to avoid complex custom claims setup overhead
      let role = 'employee';
      if (email.includes('manager')) role = 'manager';
      if (email.includes('admin')) role = 'admin';
      
      // Save/Update user profile in firestore
      await setDoc(doc(db, 'users', userCred.user.uid), {
        email,
        role,
        uid: userCred.user.uid
      }, { merge: true });

      setAuth(userCred.user, role);
      navigate(`/${role}`);
    } catch (error) {
      alert("Login Failed: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <div className="bg-white p-10 rounded-2xl shadow-xl border border-border w-full max-w-md">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-slate-800">Welcome Back</h2>
            <p className="text-slate-500 mt-2">Sign in to your AtomQuest account</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-slate-700">Email Address</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="employee@test.com" className="w-full border border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none rounded-lg p-3 transition-all" required />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-slate-700">Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" className="w-full border border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none rounded-lg p-3 transition-all" required />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-70 mt-4">
            {loading ? "Authenticating..." : "Access Portal"}
          </button>
        </form>
      </div>

      <div className="mt-8 text-center text-xs font-medium text-slate-500 space-y-1">
        <p>AtomQuest Hackathon © 2026</p>
        <div className="flex gap-4 justify-center">
            <a href="#" onClick={(e) => { e.preventDefault(); alert("Privacy Policy: All data is securely stored in Firebase and used strictly for Hackathon evaluation purposes."); }} className="hover:text-primary transition-colors">Privacy Policy</a>
            <span>|</span>
            <a href="#" onClick={(e) => { e.preventDefault(); alert("Terms of Service: Authorized personnel only."); }} className="hover:text-primary transition-colors">Terms of Service</a>
        </div>
      </div>
    </div>
  );
}
