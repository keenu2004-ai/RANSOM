import React from 'react';
import { Menu, LogOut, Bell, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-slate-900/90 backdrop-blur border-b border-slate-800">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Building2 className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-200">Theiakshi Enterprise</span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline font-mono text-cyan-400">₹ INR</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* User Identity Pills */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.email}</p>
            <p className="text-[10px] text-cyan-400 font-mono">{user?.role}</p>
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-400 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-800/50 rounded-lg transition-all"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
