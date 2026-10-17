import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Child, Attendance, Stage, Family } from '../../types/database';
import {
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  Award,
  QrCode,
  LogOut,
  Camera,
  Gift,
  Heart,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { profile, signOut } = useAuth();
  const [child, setChild] = useState<Child | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [todayAttended, setTodayAttended] = useState<Attendance | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [totalPoints, setTotalPoints] = useState<number>(0);

  // QR & Manual check-in modal
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const [qrInputCode, setQrInputCode] = useState<string>('');
  const [scanning, setScanning] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [celebrating, setCelebrating] = useState<boolean>(false);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let targetChildId = profile.child_id;

      // If child_id is not set on profile, find child by matching full_name & family_id
      if (!targetChildId && profile.full_name) {
        const query = supabase.from('children').select('*').ilike('full_name', profile.full_name);
        if (profile.family_id) query.eq('family_id', profile.family_id);
        const { data: matchedChildren } = await query.limit(1);
        if (matchedChildren && matchedChildren.length > 0) {
          targetChildId = matchedChildren[0].id;
          // Update profile with child_id
          await supabase.from('profiles').update({ child_id: targetChildId }).eq('id', profile.id);
        }
      }

      if (targetChildId) {
        // Fetch child details
        const { data: chData } = await supabase
          .from('children')
          .select('*, stage:stages(*), family:families(*)')
          .eq('id', targetChildId)
          .single();

        if (chData) {
          setChild(chData);
          setStage(chData.stage || null);
          setFamily(chData.family || null);
        }

        // Fetch attendances for current cycle
        const { data: attData } = await supabase
          .from('attendances')
          .select('*')
          .eq('child_id', targetChildId)
          .order('attended_at', { ascending: true });

        const attList = (attData as Attendance[]) || [];
        setAttendances(attList);

        // Check today's attendance
        const todayStr = new Date().toISOString().split('T')[0];
        const todayMatch = attList.find((a) => a.attendance_date === todayStr);
        setTodayAttended(todayMatch || null);

        // Calculate total points
        const { data: ptsData } = await supabase
          .from('point_logs')
          .select('points')
          .eq('child_id', targetChildId)
          .eq('is_reverted', false);

        if (ptsData) {
          const sum = ptsData.reduce((acc, curr) => acc + (curr.points || 0), 0);
          setTotalPoints(sum);
        }

        // If currently 4 stamps collected in current cycle
        const cycleAttendances = attList.slice(-4);
        if (cycleAttendances.length === 4) {
          setCelebrating(true);
        }
      }
    } catch (err) {
      console.error('Error fetching student data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile]);

  // Check if current time is considered "Early Attendance" (Before 9:15 AM)
  const isEarlyHour = () => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    return hours < 9 || (hours === 9 && minutes <= 15);
  };

  // Perform check-in (via QR code or manual confirmation)
  const handleRecordAttendance = async () => {
    if (!child) return;
    setActionMessage(null);
    setScanning(true);

    try {
      // 1. Check if already attended today locally and remotely
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('attendances')
        .select('*')
        .eq('child_id', child.id)
        .eq('attendance_date', todayStr)
        .maybeSingle();

      if (existing) {
        setTodayAttended(existing as Attendance);
        setActionMessage({
          type: 'error',
          text: `تم تسجيل حضورك اليوم بالفعل في تمام الساعة ${new Date(existing.attended_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}. الحضور مرة واحدة يومياً!`,
        });
        setScanning(false);
        return;
      }

      // 2. Execute attendance RPC or insert
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('record_student_attendance', {
        target_child_id: child.id,
        attendance_method: 'qr_self',
        force_early: isEarlyHour(),
      });

      if (rpcErr) {
        // Fallback to direct insert if RPC not executed yet
        const isEarly = isEarlyHour();
        const pts = isEarly ? 20 : 10;
        const currentStampIdx = (attendances.length % 4) + 1;

        const { data: insertedAtt, error: insErr } = await supabase
          .from('attendances')
          .insert({
            child_id: child.id,
            stage_id: child.stage_id,
            family_id: child.family_id,
            attendance_date: todayStr,
            attended_at: new Date().toISOString(),
            is_early: isEarly,
            method: 'qr_self',
            points_awarded: pts,
            stamp_index: currentStampIdx,
          })
          .select()
          .single();

        if (insErr) throw insErr;

        // Add point log
        await supabase.from('point_logs').insert({
          child_id: child.id,
          family_id: child.family_id,
          stage_id: child.stage_id,
          points: pts,
          reason: isEarly ? 'حضور بدري ممتاز (ختم كارت إعدادي)' : 'حضور الخدمة (ختم كارت إعدادي)',
          servant_id: profile?.id,
        });

        setActionMessage({
          type: 'success',
          text: `✓ تم تسجيل حضورك بنجاح وطباعة الختم رقم (${currentStampIdx})! أضيف لك +${pts} نقطة.`,
        });
      } else if (rpcRes) {
        if (!rpcRes.success) {
          setActionMessage({ type: 'error', text: rpcRes.message });
        } else {
          setActionMessage({ type: 'success', text: rpcRes.message });
          if (rpcRes.completed_card) {
            setCelebrating(true);
          }
        }
      }

      setQrModalOpen(false);
      await fetchData();
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'فشل تسجيل الحضور، يرجى المحاولة ثانية',
      });
    } finally {
      setScanning(false);
    }
  };

  // Determine current 4-stamp slot items
  // An attendance cycle consists of 4 slots
  const cycleAttendances = attendances.slice(-4);
  const slots = [0, 1, 2, 3].map((idx) => {
    return cycleAttendances[idx] || null;
  });

  return (
    <div className="min-h-screen bg-[#fff5f7] pb-12 text-slate-800 font-sans selection:bg-pink-200" dir="rtl">
      {/* Top Navbar */}
      <header className="bg-white/90 backdrop-blur-md border-b border-pink-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-100 border border-pink-300 flex items-center justify-center overflow-hidden shadow-xs">
              <img
                src="/girls-prep-logo.png"
                alt="لوجو خدمة بنات إعدادي"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <Heart size={20} className="text-pink-600" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 leading-tight">خدمة بنات إعدادي</h1>
              <p className="text-[10px] text-pink-700 font-bold">
                كنيسة العذراء مريم وبولس الرسول - الحضرة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl text-xs font-black text-amber-900">
              <span>⭐</span>
              <span>{totalPoints} نقطة</span>
            </div>
            <button
              onClick={() => signOut()}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 transition-all"
              title="تسجيل الخروج"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-xl mx-auto px-4 pt-6 space-y-5">
        {/* Welcome & Student Info Banner */}
        <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold tracking-wide mb-1">
                🌸 مرحباً بكِ يا بطلة
              </span>
              <h2 className="text-xl font-black text-white">
                {child?.full_name || profile?.full_name || 'مخدومة إعدادي'}
              </h2>
              <p className="text-xs text-pink-100 font-semibold mt-0.5">
                {family ? `أسرة: ${family.name}` : 'بنات إعدادي'} {stage ? `• ${stage.name}` : ''}
              </p>
            </div>

            <div className="text-center bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl p-2.5 px-4 shadow-inner">
              <span className="block text-[10px] font-bold text-pink-100">رصيدك الكلي</span>
              <span className="text-2xl font-black text-white">{totalPoints}</span>
              <span className="text-[10px] block font-bold text-pink-200">نقطة ⭐</span>
            </div>
          </div>
        </div>

        {/* Live Attendance Action Bar */}
        <div className="bg-white rounded-3xl p-4 border border-pink-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-pink-50 border border-pink-200 flex items-center justify-center text-pink-600 shadow-2xs">
              <Clock size={24} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">الوقت الآن:</span>
                <span className="font-mono text-sm font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
                  {currentTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <div className="text-[11px] font-bold mt-1">
                {todayAttended ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    تم تسجيل حضور اليوم بنجاح ({todayAttended.is_early ? 'حضور بدري +20' : 'حضور عادي +10'})
                  </span>
                ) : isEarlyHour() ? (
                  <span className="text-pink-600 font-bold flex items-center gap-1">
                    ✨ الحضور الآن: حضور بدري (+20 نقطة)
                  </span>
                ) : (
                  <span className="text-amber-700 font-bold">
                    الحضور الآن: حضور عادي (+10 نقاط)
                  </span>
                )}
              </div>
            </div>
          </div>

          {!todayAttended ? (
            <button
              onClick={() => setQrModalOpen(true)}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <QrCode size={18} />
              <span>تسجيل الحضور بالـ QR</span>
            </button>
          ) : (
            <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-black flex items-center gap-1.5 shadow-2xs">
              <span>✓ مسجل اليوم</span>
            </div>
          )}
        </div>

        {/* Action Message Alert */}
        {actionMessage && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Celebratory Banner for 4 Stamps Completion */}
        {celebrating && (
          <div className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 rounded-3xl p-4 text-slate-950 font-black text-center shadow-lg border-2 border-yellow-300 animate-bounce">
            <span className="text-2xl block mb-1">🎁 🎉 👑</span>
            <h3 className="text-base font-black text-slate-900">
              مبروك يا بطلة! جمعتِ ٤ أختام من غير غياب!
            </h3>
            <p className="text-xs text-yellow-950 font-bold mt-1">
              استلمي هديتك المميزة من الخادم في نهاية الخدمة ✨
            </p>
          </div>
        )}

        {/* ============================================================== */}
        {/* OFFICIAL 4-STAMP CARD (Exact replication of uploaded image)    */}
        {/* ============================================================== */}
        <div className="bg-white rounded-3xl border-2 border-pink-300 p-5 shadow-xl relative overflow-hidden">
          {/* Card Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
            <img src="/girls-prep-logo.png" alt="watermark" className="w-80 h-80 object-contain" />
          </div>

          {/* Card Header */}
          <div className="relative z-10 flex items-center justify-between border-b border-pink-100 pb-3 mb-4">
            {/* Left: St. Mary & St. Paul */}
            <div className="flex flex-col items-center">
              <div className="w-14 h-16 rounded-xl overflow-hidden flex items-center justify-center">
                <img
                  src="/stamp-card-sample.jpg"
                  alt="السيدة العذراء والقديس بولس"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback to cross icon
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            </div>

            {/* Center: Blue Cross & Church Name */}
            <div className="text-center px-2">
              <div className="text-church-600 text-3xl font-black leading-none mb-1">✝</div>
              <h3 className="text-xs sm:text-sm font-black text-[#1e3a8a] leading-tight">
                كنيسة السيدة العذراء مريم
              </h3>
              <h4 className="text-xs sm:text-sm font-black text-[#1e3a8a] leading-tight">
                والقديس بولس الرسول
              </h4>
              <p className="text-[10px] font-bold text-[#1e3a8a] mt-0.5">الحضرة الجديدة</p>
            </div>

            {/* Right: Girls Prep Logo */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden">
                <img
                  src="/girls-prep-logo.png"
                  alt="شعار خدمة بنات إعدادي"
                  className="w-full h-full object-contain drop-shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* Card Title Banner */}
          <div className="relative z-10 text-center mb-5">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-wide">
              جمع ٤ اختام من غير غياب ليك هديه
            </h2>
          </div>

          {/* ============================================================== */}
          {/* THE 4 PINK STAMP ROWS (Alternating Layout as in image)          */}
          {/* ============================================================== */}
          <div className="relative z-10 space-y-3.5">
            {/* -------------------- ROW 1 (Stamp on RIGHT) -------------------- */}
            <div className="bg-[#fbcfe8]/70 hover:bg-[#fbcfe8]/90 border border-[#f472b6]/60 rounded-3xl p-3.5 flex items-center justify-between shadow-xs transition-all">
              {/* Left Info: Date & Early check */}
              <div className="flex-1 space-y-1.5 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">تاريخ اليوم:</span>
                  <span className="font-mono text-xs font-bold text-slate-800 bg-white/70 px-2 py-0.5 rounded-lg border border-pink-200">
                    {slots[0]
                      ? new Date(slots[0].attendance_date).toLocaleDateString('ar-EG', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : '  /  /  '}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">الحضور بدري</span>
                  <div
                    className={`w-5 h-5 rounded-md border-2 border-slate-700 flex items-center justify-center font-bold text-xs ${
                      slots[0]?.is_early ? 'bg-pink-600 text-white border-pink-700' : 'bg-white/80'
                    }`}
                  >
                    {slots[0]?.is_early ? '✓' : ''}
                  </div>
                </div>
              </div>

              {/* Right: Round Stamp Slot */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-pink-400 bg-white/80 flex items-center justify-center overflow-hidden shadow-inner relative shrink-0">
                {slots[0] ? (
                  <div className="w-full h-full p-1 flex items-center justify-center animate-in zoom-in-50 duration-300">
                    <img
                      src="/girls-prep-logo.png"
                      alt="ختم ١"
                      className="w-full h-full object-contain filter drop-shadow-xs rotate-[-6deg]"
                    />
                  </div>
                ) : (
                  <span className="text-[11px] font-bold text-pink-400">ختم ١</span>
                )}
              </div>
            </div>

            {/* -------------------- ROW 2 (Stamp on LEFT) -------------------- */}
            <div className="bg-[#fbcfe8]/70 hover:bg-[#fbcfe8]/90 border border-[#f472b6]/60 rounded-3xl p-3.5 flex items-center justify-between shadow-xs transition-all">
              {/* Left: Round Stamp Slot */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-pink-400 bg-white/80 flex items-center justify-center overflow-hidden shadow-inner relative shrink-0">
                {slots[1] ? (
                  <div className="w-full h-full p-1 flex items-center justify-center animate-in zoom-in-50 duration-300">
                    <img
                      src="/girls-prep-logo.png"
                      alt="ختم ٢"
                      className="w-full h-full object-contain filter drop-shadow-xs rotate-[5deg]"
                    />
                  </div>
                ) : (
                  <span className="text-[11px] font-bold text-pink-400">ختم ٢</span>
                )}
              </div>

              {/* Right Info: Date & Early check */}
              <div className="flex-1 space-y-1.5 pl-2 text-left" dir="ltr">
                <div className="flex items-center gap-2 justify-end" dir="rtl">
                  <span className="text-xs font-black text-slate-900">تاريخ اليوم:</span>
                  <span className="font-mono text-xs font-bold text-slate-800 bg-white/70 px-2 py-0.5 rounded-lg border border-pink-200">
                    {slots[1]
                      ? new Date(slots[1].attendance_date).toLocaleDateString('ar-EG', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : '  /  /  '}
                  </span>
                </div>
                <div className="flex items-center gap-2 justify-end" dir="rtl">
                  <span className="text-xs font-black text-slate-900">الحضور بدري</span>
                  <div
                    className={`w-5 h-5 rounded-md border-2 border-slate-700 flex items-center justify-center font-bold text-xs ${
                      slots[1]?.is_early ? 'bg-pink-600 text-white border-pink-700' : 'bg-white/80'
                    }`}
                  >
                    {slots[1]?.is_early ? '✓' : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* -------------------- ROW 3 (Stamp on RIGHT) -------------------- */}
            <div className="bg-[#fbcfe8]/70 hover:bg-[#fbcfe8]/90 border border-[#f472b6]/60 rounded-3xl p-3.5 flex items-center justify-between shadow-xs transition-all">
              {/* Left Info: Date & Early check */}
              <div className="flex-1 space-y-1.5 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">تاريخ اليوم:</span>
                  <span className="font-mono text-xs font-bold text-slate-800 bg-white/70 px-2 py-0.5 rounded-lg border border-pink-200">
                    {slots[2]
                      ? new Date(slots[2].attendance_date).toLocaleDateString('ar-EG', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : '  /  /  '}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">الحضور بدري</span>
                  <div
                    className={`w-5 h-5 rounded-md border-2 border-slate-700 flex items-center justify-center font-bold text-xs ${
                      slots[2]?.is_early ? 'bg-pink-600 text-white border-pink-700' : 'bg-white/80'
                    }`}
                  >
                    {slots[2]?.is_early ? '✓' : ''}
                  </div>
                </div>
              </div>

              {/* Right: Round Stamp Slot */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-pink-400 bg-white/80 flex items-center justify-center overflow-hidden shadow-inner relative shrink-0">
                {slots[2] ? (
                  <div className="w-full h-full p-1 flex items-center justify-center animate-in zoom-in-50 duration-300">
                    <img
                      src="/girls-prep-logo.png"
                      alt="ختم ٣"
                      className="w-full h-full object-contain filter drop-shadow-xs rotate-[-4deg]"
                    />
                  </div>
                ) : (
                  <span className="text-[11px] font-bold text-pink-400">ختم ٣</span>
                )}
              </div>
            </div>

            {/* -------------------- ROW 4 (Stamp on LEFT) -------------------- */}
            <div className="bg-[#fbcfe8]/70 hover:bg-[#fbcfe8]/90 border border-[#f472b6]/60 rounded-3xl p-3.5 flex items-center justify-between shadow-xs transition-all">
              {/* Left: Round Stamp Slot */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-pink-400 bg-white/80 flex items-center justify-center overflow-hidden shadow-inner relative shrink-0">
                {slots[3] ? (
                  <div className="w-full h-full p-1 flex items-center justify-center animate-in zoom-in-50 duration-300">
                    <img
                      src="/girls-prep-logo.png"
                      alt="ختم ٤"
                      className="w-full h-full object-contain filter drop-shadow-xs rotate-[8deg]"
                    />
                  </div>
                ) : (
                  <span className="text-[11px] font-bold text-pink-400">ختم ٤</span>
                )}
              </div>

              {/* Right Info: Date & Early check */}
              <div className="flex-1 space-y-1.5 pl-2 text-left" dir="ltr">
                <div className="flex items-center gap-2 justify-end" dir="rtl">
                  <span className="text-xs font-black text-slate-900">تاريخ اليوم:</span>
                  <span className="font-mono text-xs font-bold text-slate-800 bg-white/70 px-2 py-0.5 rounded-lg border border-pink-200">
                    {slots[3]
                      ? new Date(slots[3].attendance_date).toLocaleDateString('ar-EG', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : '  /  /  '}
                  </span>
                </div>
                <div className="flex items-center gap-2 justify-end" dir="rtl">
                  <span className="text-xs font-black text-slate-900">الحضور بدري</span>
                  <div
                    className={`w-5 h-5 rounded-md border-2 border-slate-700 flex items-center justify-center font-bold text-xs ${
                      slots[3]?.is_early ? 'bg-pink-600 text-white border-pink-700' : 'bg-white/80'
                    }`}
                  >
                    {slots[3]?.is_early ? '✓' : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-5 pt-3 border-t border-pink-100 text-center">
            <p className="text-[11px] text-pink-700 font-bold flex items-center justify-center gap-1">
              <span>🌸</span>
              <span>احرصي على الحضور مبكراً لكسب نقاط إضافية وجمع الأختام لاستلام الهدية!</span>
            </p>
          </div>
        </div>
      </main>

      {/* ============================================================== */}
      {/* QR CHECK-IN MODAL DIALOG                                        */}
      {/* ============================================================== */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 border border-pink-200 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-pink-100 border border-pink-300 flex items-center justify-center mx-auto text-pink-700 shadow-sm">
              <QrCode size={30} />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">تسجيل حضور اليوم</h3>
              <p className="text-xs text-slate-500 mt-1">
                خدمة بنات إعدادي • {currentTime.toLocaleDateString('ar-EG')}
              </p>
            </div>

            <div className="p-4 bg-pink-50 border border-pink-200 rounded-2xl space-y-3">
              <span className="text-xs font-bold text-pink-900 block">
                تأكيد تسجيل الحضور وتوثيق الوقت الحالي:
              </span>
              <div className="font-mono text-lg font-black text-pink-950 bg-white py-1.5 rounded-xl border border-pink-200 shadow-2xs">
                {currentTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <span className="text-[11px] font-bold text-slate-600 block">
                {isEarlyHour()
                  ? '✨ الحضور الآن قبل 09:15 ص: يُحتسب حضور بدري (+20 نقطة)!'
                  : 'الحضور الآن: يُحتسب حضور عادي (+10 نقاط)'}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleRecordAttendance}
                disabled={scanning}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                {scanning ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <>
                    <span>✓</span>
                    <span>تسجيل الحضور الآن</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setQrModalOpen(false)}
                className="px-4 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
