import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { useAuthStore } from './store';
import Swal from 'sweetalert2';
import { Moon, Sun } from 'lucide-react';
import Login from './components/Login';
import EmployeeDashboard from './components/EmployeeDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import AdminDashboard from './components/AdminDashboard';
import atombergLogo from './assets/atomberg-logo.png';

export const AtombergLogo = ({ className = "h-8 w-auto" }) => (
  <img src={atombergLogo} alt="Atomberg Logo" className={`${className} object-contain dark:bg-slate-100 dark:p-2 dark:rounded-xl`} />
);

function ProtectedRoute({ children, allowedRole }) {
  const { user, role } = useAuthStore();
  if (!user) return <Navigate to="/login" />;
  if (allowedRole && role !== allowedRole) return <Navigate to="/" />;
  return children;
}

function App() {
  const { user, role, logout, setAuth } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(true);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        let currentRole = 'employee';
        if (currentUser.email.includes('manager')) currentRole = 'manager';
        if (currentUser.email.includes('admin')) currentRole = 'admin';
        setAuth(currentUser, currentRole);
      } else {
        logout();
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [setAuth, logout]);

  const handleLogout = () => {
    Swal.fire({
      title: 'Logout',
      text: "Are you sure you want to log out of the AtomQuest portal?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Yes, log out!'
    }).then((result) => {
      if (result.isConfirmed) {
        signOut(auth).then(() => {
          logout();
          window.location.replace('/');
        });
      }
    });
  };

  const handleViewGuide = () => {
    Swal.fire({
      title: 'AtomQuest Architecture & Flow',
      html: `
        <div class="text-left space-y-4 text-sm mt-4 pb-4">
            <p><strong>1. Admin Layer:</strong> Log in as <code class="bg-slate-100 dark:bg-slate-800 px-1 rounded font-bold">admin@test.com</code>. Assign employees to managers and toggle the Active Quarter locks in real-time.</p>
            <p><strong>2. Manager Layer:</strong> Log in as <code class="bg-slate-100 dark:bg-slate-800 px-1 rounded font-bold">manager@test.com</code>. Accept rosters, approve goal sheets, and push shared KPIs directly to your team.</p>
            <p><strong>3. Employee Layer:</strong> Log in as <code class="bg-slate-100 dark:bg-slate-800 px-1 rounded font-bold">employee@test.com</code>. Use the AI Coach to write SMART goals and log actual progress when the Admin unlocks the Quarter.</p>
        </div>
      `,
      imageUrl: '/architecture.png',
      imageWidth: '100%',
      imageAlt: 'System Architecture Flow',
      width: '900px',
      confirmButtonColor: '#10b981',
      confirmButtonText: 'Enter Portal'
    }).then((res) => {
        if(res.isConfirmed) {
            window.location.href = '/login';
        }
    });
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><div className="text-slate-500 dark:text-slate-400 font-bold">Verifying Session...</div></div>;

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sticky top-0 z-10 shadow-sm">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <Link to="/" className="text-2xl font-black tracking-tight text-slate-800 dark:text-white flex items-center gap-3 hover:scale-105 transition-transform duration-300">
              <AtombergLogo className="h-10 w-auto" />
              <div className="flex items-center gap-3 border-l-2 border-slate-200 dark:border-slate-700 pl-3 ml-1">
                 <span className="text-slate-800 dark:text-white text-xl font-bold tracking-tight">Portal</span>
              </div>
            </Link>
            <nav className="space-x-6 text-sm font-semibold flex items-center">
              <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                {isDark ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-slate-500" />}
              </button>
              {user ? (
                <>
                  <span className="text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">Role: <span className="text-slate-800 dark:text-white uppercase">{role}</span></span>
                  {role === 'employee' && <Link to="/employee" className="text-slate-600 hover:text-yellow-600 dark:text-yellow-400 transition-colors">Goal Sheet</Link>}
                  {role === 'manager' && <Link to="/manager" className="text-slate-600 hover:text-yellow-600 dark:text-yellow-400 transition-colors">Manager Dashboard</Link>}
                  {role === 'admin' && <Link to="/admin" className="text-slate-600 hover:text-yellow-600 dark:text-yellow-400 transition-colors">Admin Panel</Link>}
                  <button onClick={handleLogout} className="text-slate-500 dark:text-slate-400 hover:text-red-600 ml-2 font-bold transition-colors">Logout</button>
                </>
              ) : (
                <Link to="/login" className="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 transition-colors shadow-sm">Sign In</Link>
              )}
            </nav>
          </div>
        </header>
        
        <main className="flex-1 max-w-6xl mx-auto w-full p-8">
          <Routes>
            <Route path="/" element={
              user ? <Navigate to={`/${role}`} /> : (
              <div className="text-center py-32 animate-fade-in-up">
                <div className="flex justify-center mb-8 hover:scale-110 transition-transform duration-500 cursor-default">
                    <AtombergLogo className="h-28 w-auto" />
                </div>
                <h2 className="text-5xl font-black mb-6 text-slate-800 dark:text-white tracking-tight leading-tight animate-fade-in-up delay-100">Enterprise Goal Tracking.<br/><span className="text-yellow-600 dark:text-yellow-400">Simplified.</span></h2>
                <p className="text-slate-500 dark:text-slate-400 mb-10 max-w-xl mx-auto text-lg leading-relaxed animate-fade-in-up delay-200">A minimalist, AI-powered HR goal tracking platform built for the Atomberg Hackathon. Log in to manage your quarterly objectives.</p>
                <div className="flex gap-4 justify-center animate-fade-in-up delay-200">
                    <button onClick={handleViewGuide} className="inline-block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 px-8 py-4 rounded-full font-bold shadow-sm hover:shadow-md transition-all">
                      📖 View System Guide
                    </button>
                    <Link to="/login" className="inline-block bg-primary text-slate-900 px-10 py-4 rounded-full font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
                      Access Your Portal
                    </Link>
                </div>
              </div>
              )
            } />
            <Route path="/login" element={user ? <Navigate to={`/${role}`} /> : <Login />} />
            <Route path="/employee" element={<ProtectedRoute allowedRole="employee"><EmployeeDashboard /></ProtectedRoute>} />
            <Route path="/manager" element={<ProtectedRoute allowedRole="manager"><ManagerDashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
