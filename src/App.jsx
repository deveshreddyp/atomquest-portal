import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { useAuthStore } from './store';
import Login from './components/Login';
import EmployeeDashboard from './components/EmployeeDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import AdminDashboard from './components/AdminDashboard';

function ProtectedRoute({ children, allowedRole }) {
  const { user, role } = useAuthStore();
  if (!user) return <Navigate to="/login" />;
  if (allowedRole && role !== allowedRole) return <Navigate to="/" />;
  return children;
}

function App() {
  const { user, role, logout } = useAuthStore();

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out of the AtomQuest portal?")) {
      signOut(auth).then(() => {
        logout();
        // Replace current URL in history stack so 'back' button doesn't trap them
        window.location.replace('/login');
      });
    }
  };

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-slate-50">
        <header className="border-b border-slate-200 bg-white p-4 sticky top-0 z-10 shadow-sm">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <Link to="/" className="text-2xl font-black tracking-tight text-slate-800">
              AtomQuest <span className="text-primary">Portal</span>
            </Link>
            <nav className="space-x-6 text-sm font-semibold flex items-center">
              {user ? (
                <>
                  <span className="text-slate-400 bg-slate-100 px-3 py-1 rounded-full">Role: <span className="text-slate-800 uppercase">{role}</span></span>
                  {role === 'employee' && <Link to="/employee" className="text-slate-600 hover:text-primary transition-colors">Goal Sheet</Link>}
                  {role === 'manager' && <Link to="/manager" className="text-slate-600 hover:text-primary transition-colors">Manager Dashboard</Link>}
                  {role === 'admin' && <Link to="/admin" className="text-slate-600 hover:text-primary transition-colors">Admin Panel</Link>}
                  <button onClick={handleLogout} className="text-slate-500 hover:text-red-600 ml-2 font-bold transition-colors">Logout</button>
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
              <div className="text-center py-32">
                <h2 className="text-5xl font-black mb-6 text-slate-800 tracking-tight leading-tight">Enterprise Goal Tracking.<br/><span className="text-primary">Simplified.</span></h2>
                <p className="text-slate-500 mb-10 max-w-xl mx-auto text-lg leading-relaxed">A minimalist, AI-powered HR goal tracking platform built for the AtomQuest Hackathon 1.0. Log in to manage your quarterly objectives.</p>
                <Link to="/login" className="inline-block bg-primary text-white px-10 py-4 rounded-full font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
                  Access Your Portal
                </Link>
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
