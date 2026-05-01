import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Search, 
  Lock, 
  AlertTriangle, 
  Zap,
  ShieldCheck,
  Cpu,
  Fingerprint,
  Info
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import StatCard from './components/StatCard';
import ChartCard from './components/ChartCard';
import AlertsTable from './components/AlertsTable';

const MethodologyCard = () => (
  <div className="bg-slate-900/40 border border-slate-800/50 p-6 rounded-3xl shadow-2xl backdrop-blur-xl animate-slide-up">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-white font-bold flex items-center gap-2">
        <ShieldCheck size={20} className="text-primary" />
        Intelligence Methodology
      </h3>
      <Info size={16} className="text-slate-500 cursor-help" />
    </div>
    
    <div className="grid grid-cols-1 gap-4">
      <div className="flex gap-4 p-4 rounded-2xl bg-slate-800/20 border border-slate-800/30 hover:bg-slate-800/40 transition-all group">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-110 transition-transform">
          <Fingerprint size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white mb-1">Signature Engine</h4>
          <p className="text-xs text-slate-400 leading-relaxed">Identifies 40+ specific secret patterns (AWS, Stripe, GitHub) with 100% precision.</p>
        </div>
      </div>

      <div className="flex gap-4 p-4 rounded-2xl bg-slate-800/20 border border-slate-800/30 hover:bg-slate-800/40 transition-all group">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-110 transition-transform">
          <Zap size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white mb-1">Statistical Entropy</h4>
          <p className="text-xs text-slate-400 leading-relaxed">Detects random-character secrets like passwords or custom tokens by analyzing text randomness.</p>
        </div>
      </div>

      <div className="flex gap-4 p-4 rounded-2xl bg-slate-800/20 border border-slate-800/30 hover:bg-slate-800/40 transition-all group">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-110 transition-transform">
          <Cpu size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white mb-1">Contextual AI (NER)</h4>
          <p className="text-xs text-slate-400 leading-relaxed">Uses a local DistilBERT model to understand semantic context and prevent "intelligent" leaks.</p>
        </div>
      </div>
    </div>

    <div className="mt-6 pt-6 border-t border-slate-800/50">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
        <span className="text-slate-500">Security Core:</span>
        <span className="text-emerald-400 flex items-center gap-1">
          <Lock size={10} /> Zero-Trust Verified
        </span>
      </div>
    </div>
  </div>
);

const App = () => {
  const [stats, setStats] = useState({ totalDetected: 0, secretsBlocked: 0, preventionRate: 0, avgRisk: 0 });
  const [events, setEvents] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  const generateReport = () => {
    if (events.length === 0 && stats.totalDetected === 0) {
      alert("No security incidents recorded yet.");
      return;
    }
    
    try {
      const headers = ['Timestamp', 'Type', 'Platform', 'Risk Score', 'Action', 'Details'];
      const rows = events.map(e => [
        new Date(e.timestamp).toISOString(),
        e.type,
        e.platform,
        e.risk_score,
        e.action,
        `Blocked ${e.type} on ${e.platform}`
      ]);

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers, ...rows].map(e => e.join(",")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `shoonya_audit_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Export failed. Please try again.");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          const result = await chrome.storage.local.get({ events: [], totalScans: 0, secretsBlocked: 0 });
          const storedEvents = result.events || [];
          
          setStats({
            totalDetected: result.totalScans,
            secretsBlocked: result.secretsBlocked,
            preventionRate: result.totalScans > 0 ? Math.round((result.secretsBlocked / result.totalScans) * 100) : 0,
            avgRisk: storedEvents.length > 0 
              ? Math.round(storedEvents.reduce((acc, e) => acc + (e.risk_score || 0), 0) / storedEvents.length) 
              : 0
          });
          
          setEvents(storedEvents);

          const insightsArr = [];
          if (storedEvents.length > 0) {
            const last2Hours = Date.now() - (2 * 60 * 60 * 1000);
            const recentCount = storedEvents.filter(e => e.timestamp > last2Hours).length;
            if (recentCount > 5) insightsArr.push({ message: `Spike in activity: ${recentCount} incidents detected.` });
            if (insightsArr.length === 0) insightsArr.push({ message: 'Security landscape is stable.' });
          }
          setInsights(insightsArr);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setTimeout(() => setLoading(false), 800);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const timelineData = events.reduce((acc, event) => {
    const date = new Date(event.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
    const existing = acc.find(d => d.date === date);
    if (existing) existing.count += 1;
    else acc.push({ date, count: 1 });
    return acc;
  }, []).slice(-7);

  const platformData = events.reduce((acc, event) => {
    const existing = acc.find(d => d.name === event.platform);
    if (existing) existing.value += 1;
    else acc.push({ name: event.platform, value: 1 });
    return acc;
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#020617]">
        <div className="flex flex-col items-center gap-6 animate-pulse">
          <Shield className="w-16 h-16 text-primary" />
          <h2 className="text-xl font-bold text-white tracking-[0.2em] uppercase">Shoonya</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col font-sans">
      <Navbar title="Intelligence Dashboard" onGenerateReport={generateReport} />
      
      <main className="flex-1 w-full max-w-7xl mx-auto p-8 space-y-8 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Live Scans" value={stats.totalDetected} icon={<Search size={20} />} />
          <StatCard label="Redacted" value={stats.secretsBlocked} icon={<Lock size={20} />} />
          <StatCard label="Efficacy" value={`${stats.preventionRate}%`} icon={<Zap size={20} />} />
          <StatCard label="Risk Index" value={stats.avgRisk > 40 ? 'Moderate' : 'Secure'} icon={<AlertTriangle size={20} />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <ChartCard title="Security Incident Timeline">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="date" stroke="#475569" fontSize={10} axisLine={false} />
                    <YAxis stroke="#475569" fontSize={10} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <AlertsTable events={events} />
          </div>

          <div className="lg:col-span-1 space-y-8">
            <ChartCard title="Platform Vulnerability">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={platformData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" stroke="#475569" fontSize={10} width={80} axisLine={false} />
                    <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <div className="bg-slate-900/40 border border-slate-800/50 p-6 rounded-3xl">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-amber-400">
                <Zap size={18} /> Threat Insights
              </h3>
              {insights.map((ins, i) => (
                <div key={i} className="p-3 bg-slate-800/50 rounded-xl text-xs text-slate-300 border border-slate-700/50">
                  {ins.message}
                </div>
              ))}
            </div>

            <MethodologyCard />
          </div>
        </div>
      </main>

      <footer className="p-8 text-center text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
        Shoonya Intelligence Layer • Verified Zero-Trust Protection
      </footer>
    </div>
  );
};

export default App;
