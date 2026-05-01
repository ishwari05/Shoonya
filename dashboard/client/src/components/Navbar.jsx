import React from 'react';
import { FileText } from 'lucide-react';

const Navbar = ({ title, onGenerateReport }) => {
  return (
    <nav className="h-20 flex items-center justify-between px-8 mb-8 bg-slate-900/50 backdrop-blur-md border-b border-slate-800/50 sticky top-0 z-50">
      <div className="flex flex-col">
        <h2 className="text-2xl font-bold text-white tracking-tight leading-tight">{title}</h2>
        <p className="text-[10px] text-primary font-bold uppercase tracking-[0.2em]">Zero-Trust Protection Active</p>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={onGenerateReport}
          className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20 flex items-center gap-2 group hover:scale-[1.02] active:scale-[0.98]"
        >
          <FileText size={18} className="group-hover:rotate-6 transition-transform" />
          Generate Security Audit
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
