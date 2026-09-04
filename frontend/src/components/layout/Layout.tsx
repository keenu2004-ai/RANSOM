import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#020817] text-[#F8FAFC]">
      <Sidebar 
        mobileOpen={mobileOpen} 
        setMobileOpen={setMobileOpen}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:p-8 overflow-y-auto max-w-[1600px] w-full mx-auto space-y-4 sm:space-y-6 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};
