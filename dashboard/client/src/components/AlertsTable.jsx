import React from 'react';
import { ExternalLink, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';

const AlertsTable = ({ events }) => {
  return (
    <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl border border-slate-700/50 overflow-hidden animate-fade-in shadow-xl">
      <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock size={18} className="text-primary" />
            Recent Security Alerts
        </h3>
        <button className="text-xs font-bold text-primary hover:text-accent transition-colors flex items-center gap-1 group">
            Export Logs <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-700/20 text-[10px] uppercase tracking-widest font-black text-slate-500 border-b border-slate-700/50">
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Threat Details with each detail</th>
              <th className="px-6 py-4">Platform</th>
              <th className="px-6 py-4">Risk Score</th>
              <th className="px-6 py-4 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {events.length === 0 ? (
               <tr>
                 <td colSpan="5" className="px-6 py-12 text-center text-slate-500 italic">
                    No active threats detected. System is secure.
                 </td>
               </tr>
            ) : (
                events.map((event, idx) => (
                    <tr key={idx} className="group hover:bg-slate-700/30 transition-all cursor-default">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                           {event.action === 'REDACTED' ? (
                             <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase">
                                <ShieldCheck size={12} /> Blocked
                             </div>
                           ) : (
                             <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase">
                                <ShieldAlert size={12} /> Logged
                             </div>
                           )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div>
                          <p className="text-sm font-bold text-slate-100 group-hover:text-primary transition-colors">{event.type}</p>
                          <p className="text-xs text-slate-500 mt-1">{event.details}</p>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-300">{event.platform}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                           <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                             <div 
                               className={`h-full transition-all duration-1000 ${
                                 event.risk_score > 70 ? 'bg-rose-500' : 
                                 event.risk_score > 40 ? 'bg-amber-500' : 'bg-primary'
                               }`}
                               style={{ width: `${event.risk_score}%` }}
                             />
                           </div>
                           <span className={`text-xs font-black ${
                             event.risk_score > 70 ? 'text-rose-500' : 
                             event.risk_score > 40 ? 'text-amber-500' : 'text-slate-400'
                           }`}>{event.risk_score}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="text-xs font-medium text-slate-500">{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                    </tr>
                  ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AlertsTable;
