const fs = require('fs');
const files = [
  'src/App.jsx',
  'src/components/Login.jsx',
  'src/components/AdminDashboard.jsx',
  'src/components/EmployeeDashboard.jsx',
  'src/components/ManagerDashboard.jsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  
  content = content.replace(/\bbg-white\b(?! dark:bg-slate-900)/g, "bg-white dark:bg-slate-900");
  content = content.replace(/\btext-slate-800\b(?! dark:text-white)/g, "text-slate-800 dark:text-white");
  content = content.replace(/\btext-slate-700\b(?! dark:text-slate-200)/g, "text-slate-700 dark:text-slate-200");
  content = content.replace(/\btext-slate-500\b(?! dark:text-slate-400)/g, "text-slate-500 dark:text-slate-400");
  content = content.replace(/\bbg-slate-50\b(?! dark:bg-slate-950)/g, "bg-slate-50 dark:bg-slate-950");
  content = content.replace(/\bborder-slate-200\b(?! dark:border-slate-800)/g, "border-slate-200 dark:border-slate-800");
  content = content.replace(/\bborder-slate-300\b(?! dark:border-slate-700)/g, "border-slate-300 dark:border-slate-700");
  content = content.replace(/\bbg-slate-100\b(?! dark:bg-slate-800)/g, "bg-slate-100 dark:bg-slate-800");
  
  fs.writeFileSync(f, content);
});
