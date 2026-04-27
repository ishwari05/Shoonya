import React from 'react';
import { 
  Shield, 
  LayoutDashboard, 
  Scan, 
  Globe, 
  BarChart3, 
  Settings,
  ShieldAlert
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = ({ activeTab, onTabChange, role }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} />, path: '/' },
    { id: 'scans', label: 'Real-time Scans', icon: <Scan size={20} />, path: '/' },
    { id: 'platforms', label: 'Platforms', icon: <Globe size={20} />, path: '/' },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={20} />, path: '/' },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} />, path: '/' },
  ];

  if (role === 'admin') {
    menuItems.push({ id: 'admin', label: 'Admin Panel', icon: <ShieldAlert size={20} />, path: '/admin' });
  }

  return (
    <aside className="w-64 bg-slate-800/50 backdrop-blur-xl border-r border-slate-700 h-screen fixed left-0 top-0 z-50 flex flex-col p-6">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
          <Shield className="text-white" size={24} />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">Shoonya</h1>
      </div>

      <nav className="flex-1 flex flex-col gap-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path && (item.path !== '/' || activeTab === item.id);
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.path === '/') {
                  onTabChange(item.id);
                  navigate('/');
                } else {
                  navigate(item.path);
                }
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 font-semibold' 
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
              }`}
            >
              <span className={`${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>
                {item.icon}
              </span>
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto p-4 bg-slate-700/30 rounded-2xl border border-slate-700/50">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Security Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-200">System Protected</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
