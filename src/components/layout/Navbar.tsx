import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Tv,
  Users,
  Award,
  Layers,
  Home,
  LogOut,
  UserCheck,
  ShieldCheck,
  History,
  Sparkles,
  Menu,
  X,
  Maximize,
  Minimize
} from 'lucide-react';

interface NavbarProps {
  currentTab?: string;
  onTabChange?: (tab: string) => void;
  isDisplayMode?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange, isDisplayMode = false }) => {
  const { user, profile, role, signOut } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setCurrentDate(
        now.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const getRoleBadge = () => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-sm">
            👑 أدمن (مدير الخدمة)
          </span>
        );
      case 'servant':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 shadow-sm">
            🙋 خادم
          </span>
        );
      case 'display':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-sm">
            🖥️ شاشة عرض
          </span>
        );
      default:
        return null;
    }
  };

  // If in pure display mode (TV screen), render an ultra-clean high-contrast header
  if (isDisplayMode) {
    return (
      <header className="w-full bg-gradient-to-r from-church-950 via-church-900 to-church-950 text-white px-6 py-4 border-b-2 border-church-500/50 shadow-2xl flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-church-500/20 border border-church-400/40 flex items-center justify-center shadow-inner">
            <span className="text-3xl">⛪</span>
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-wide text-church-200 drop-shadow-md">
              خدمة مدارس الأحد
            </h1>
            <p className="text-xs text-church-300/80 font-medium">منصة المتابعة والتتويج اللحظي</p>
          </div>
        </div>

        {/* Live Clock & Date */}
        <div className="hidden md:flex flex-col items-center justify-center bg-black/40 backdrop-blur-md px-6 py-2 rounded-2xl border border-church-500/30 shadow-lg">
          <div className="text-xl font-black text-amber-300 tracking-wider font-mono">
            {currentTime}
          </div>
          <div className="text-xs text-church-200/90 font-semibold">{currentDate}</div>
        </div>

        {/* Display actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 bg-church-800/80 hover:bg-church-700 text-church-100 border border-church-500/40 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-md active:scale-95"
            title="ملء الشاشة"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            <span className="hidden sm:inline">{isFullscreen ? 'تصغير' : 'ملء الشاشة'}</span>
          </button>

          {user && (
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-200 border border-red-800/50 px-3 py-2 rounded-xl text-sm transition-all"
              title="تسجيل الخروج"
            >
              <LogOut size={16} />
              <span className="hidden lg:inline text-xs">خروج</span>
            </button>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-church-200/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-church-100 border border-church-300 flex items-center justify-center shadow-sm">
              <span className="text-2xl">⛪</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-church-900">خدمة مدارس الأحد</h1>
              <p className="text-[11px] text-slate-500 font-medium">نظام النقاط والمتابعة الذكية</p>
            </div>
          </div>

          {/* Desktop Navigation for Admin */}
          {role === 'admin' && onTabChange && (
            <nav className="hidden lg:flex items-center gap-1 bg-church-50/80 p-1 rounded-xl border border-church-200">
              <button
                onClick={() => onTabChange('dashboard')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentTab === 'dashboard'
                    ? 'bg-church-600 text-white shadow'
                    : 'text-church-900 hover:bg-church-200/60'
                }`}
              >
                <Sparkles size={14} />
                الرئيسية
              </button>
              <button
                onClick={() => onTabChange('users')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentTab === 'users'
                    ? 'bg-church-600 text-white shadow'
                    : 'text-church-900 hover:bg-church-200/60'
                }`}
              >
                <UserCheck size={14} />
                المستخدمين
              </button>
              <button
                onClick={() => onTabChange('stages')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentTab === 'stages'
                    ? 'bg-church-600 text-white shadow'
                    : 'text-church-900 hover:bg-church-200/60'
                }`}
              >
                <Layers size={14} />
                المراحل
              </button>
              <button
                onClick={() => onTabChange('families')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentTab === 'families'
                    ? 'bg-church-600 text-white shadow'
                    : 'text-church-900 hover:bg-church-200/60'
                }`}
              >
                <Home size={14} />
                الأسر
              </button>
              <button
                onClick={() => onTabChange('children')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentTab === 'children'
                    ? 'bg-church-600 text-white shadow'
                    : 'text-church-900 hover:bg-church-200/60'
                }`}
              >
                <Users size={14} />
                الأولاد
              </button>
              <button
                onClick={() => onTabChange('rules')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentTab === 'rules'
                    ? 'bg-church-600 text-white shadow'
                    : 'text-church-900 hover:bg-church-200/60'
                }`}
              >
                <Award size={14} />
                قواعد النقاط
              </button>
              <button
                onClick={() => onTabChange('audit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentTab === 'audit'
                    ? 'bg-church-600 text-white shadow'
                    : 'text-church-900 hover:bg-church-200/60'
                }`}
              >
                <History size={14} />
                السجل والتدقيق
              </button>
            </nav>
          )}

          {/* Desktop Navigation for Servant */}
          {role === 'servant' && onTabChange && (
            <nav className="hidden sm:flex items-center gap-2 bg-church-50/80 p-1 rounded-xl border border-church-200">
              <button
                onClick={() => onTabChange('service')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  currentTab === 'service'
                    ? 'bg-church-600 text-white shadow'
                    : 'text-church-900 hover:bg-church-200/60'
                }`}
              >
                <Users size={16} />
                أسر الخدمة والأولاد
              </button>
              <button
                onClick={() => onTabChange('history')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  currentTab === 'history'
                    ? 'bg-church-600 text-white shadow'
                    : 'text-church-900 hover:bg-church-200/60'
                }`}
              >
                <History size={16} />
                سجل نقاط اليوم
              </button>
            </nav>
          )}

          {/* Right Action Icons & User Status */}
          <div className="flex items-center gap-3">
            {/* TV Display quick link */}
            <button
              onClick={() => onTabChange?.('display')}
              className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all shadow-sm ${
                currentTab === 'display'
                  ? 'bg-church-800 text-white border-church-900'
                  : 'bg-church-100/70 hover:bg-church-200/80 text-church-900 border-church-300'
              }`}
              title="فتح شاشة العرض التلفزيونية"
            >
              <Tv size={16} className="text-church-700" />
              <span className="hidden md:inline">شاشة العرض (TV)</span>
            </button>

            {/* Role Badge */}
            <div className="hidden sm:flex items-center gap-2">
              {getRoleBadge()}
              <div className="text-right">
                <div className="text-xs font-bold text-slate-800">{profile?.full_name || user?.email}</div>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={() => signOut()}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut size={18} />
            </button>

            {/* Mobile menu hamburger */}
            {role === 'admin' && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-slate-600 hover:bg-church-100 rounded-xl"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Dropdown for Admin */}
        {role === 'admin' && mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-church-200 flex flex-wrap gap-2 animate-in fade-in duration-150">
            {[
              { id: 'dashboard', label: 'الرئيسية', icon: Sparkles },
              { id: 'users', label: 'المستخدمين', icon: UserCheck },
              { id: 'stages', label: 'المراحل', icon: Layers },
              { id: 'families', label: 'الأسر', icon: Home },
              { id: 'children', label: 'الأولاد', icon: Users },
              { id: 'rules', label: 'قواعد النقاط', icon: Award },
              { id: 'audit', label: 'السجل', icon: History },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    onTabChange?.(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    currentTab === tab.id
                      ? 'bg-church-600 text-white'
                      : 'bg-church-100/70 text-church-900 hover:bg-church-200'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};
