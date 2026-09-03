import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Login } from './pages/Login';
import { UnapprovedNotice } from './pages/UnapprovedNotice';
import { DisplayView } from './pages/display/DisplayView';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UsersManager } from './pages/admin/UsersManager';
import { StagesManager } from './pages/admin/StagesManager';
import { FamiliesManager } from './pages/admin/FamiliesManager';
import { ChildrenManager } from './pages/admin/ChildrenManager';
import { PointRulesManager } from './pages/admin/PointRulesManager';
import { AuditLogs } from './pages/admin/AuditLogs';

// Servant Pages
import { ServantHome } from './pages/servant/ServantHome';
import { ServantHistory } from './pages/servant/ServantHistory';

export const App: React.FC = () => {
  const { user, profile, role, isApproved, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [directDisplayMode, setDirectDisplayMode] = useState<boolean>(false);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf7ee] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 border-4 border-church-500/30 border-t-church-600 rounded-full animate-spin"></div>
        <div className="text-church-900 font-black text-lg">⛪ خدمة مدارس الأحد</div>
        <p className="text-xs text-slate-500 font-semibold">جاري تهيئة النظام والاتصال بالخادم...</p>
      </div>
    );
  }

  // Direct Display Mode (TV Screen / Projector)
  if (directDisplayMode || role === 'display' || currentTab === 'display') {
    return (
      <div>
        <DisplayView />
        {/* Floating Return button if opened from admin/servant view */}
        {role && role !== 'display' && (
          <button
            onClick={() => {
              setDirectDisplayMode(false);
              setCurrentTab(role === 'admin' ? 'dashboard' : 'service');
            }}
            className="fixed bottom-5 left-5 z-50 px-4 py-2 bg-church-900/90 hover:bg-church-800 text-church-200 border border-church-500/40 rounded-2xl text-xs font-bold shadow-2xl transition-all active:scale-95"
          >
            ← العودة للوحة التحكم
          </button>
        )}
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Login onOpenDisplayDirectly={() => setDirectDisplayMode(true)} />;
  }

  // Logged in but not approved yet
  if (!isApproved) {
    return <UnapprovedNotice />;
  }

  // -------------------------------------------------------------
  // ADMIN PANEL
  // -------------------------------------------------------------
  if (role === 'admin') {
    return (
      <div className="min-h-screen bg-[#fbf7ee] flex flex-col">
        <Navbar currentTab={currentTab} onTabChange={setCurrentTab} />
        <main className="flex-1">
          {currentTab === 'dashboard' && <AdminDashboard onNavigateTab={setCurrentTab} />}
          {currentTab === 'users' && <UsersManager />}
          {currentTab === 'stages' && <StagesManager />}
          {currentTab === 'families' && <FamiliesManager />}
          {currentTab === 'children' && <ChildrenManager />}
          {currentTab === 'rules' && <PointRulesManager />}
          {currentTab === 'audit' && <AuditLogs />}
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SERVANT PANEL
  // -------------------------------------------------------------
  if (role === 'servant') {
    return (
      <div className="min-h-screen bg-[#fbf7ee] flex flex-col">
        <Navbar currentTab={currentTab} onTabChange={setCurrentTab} />
        <main className="flex-1">
          {currentTab === 'history' ? <ServantHistory /> : <ServantHome />}
        </main>
      </div>
    );
  }

  // Default fallback
  return <DisplayView />;
};

export default App;
