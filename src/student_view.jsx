import React, { useState, useEffect } from 'react';
import { Clock, Bell, Trophy, Play, CheckSquare, Award, Square, Gamepad2, Plus, Minus, Paperclip, Link as LinkIcon, FileText, Image, X, Calendar, TrendingUp, Flame, Swords, Target, Sparkles, CheckCircle2, Coffee, RotateCcw, SkipForward, Sliders, ChevronDown, ChevronUp, Lightbulb, ArrowUpRight, Activity, BarChart3, Brain, HelpCircle } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';

const LEVEL_BADGES = [
  { name: 'EXP Trainee', icon: '🎯', color: 'bg-yellow-100 text-yellow-800' },
  { name: 'Focus Adventurer', icon: '🧭', color: 'bg-emerald-100 text-emerald-800' },
  { name: 'Task Hunter', icon: '🏹', color: 'bg-teal-100 text-teal-800' },
  { name: 'Time Weaver', icon: '⏳', color: 'bg-sky-100 text-sky-800' },
  { name: 'Deadline Knight', icon: '🛡️', color: 'bg-indigo-100 text-indigo-800' },
  { name: 'Productivity Mage', icon: '🧙‍♂️', color: 'bg-purple-100 text-purple-800' },
  { name: 'Wisdom Conqueror', icon: '⚔️', color: 'bg-fuchsia-100 text-fuchsia-800' },
  { name: 'Master Strategist', icon: '♟️', color: 'bg-amber-100 text-amber-800' },
  { name: 'EXP Overlord', icon: '💎', color: 'bg-cyan-100 text-cyan-800' },
  { name: 'Supreme Archmage of AdaptLearn', icon: '👑', color: 'bg-rose-100 text-rose-800' },
];

const LEVEL_REQ = (level) => level <= 3 ? 300 : level <= 6 ? 600 : level <= 8 ? 800 : level <= 10 ? 1000 : 2000;

const getLevel = (exp) => {
  let level = 1;
  let remainingExp = Math.max(0, exp);
  while (level < 100) {
    const requiredExp = LEVEL_REQ(level);
    if (remainingExp < requiredExp) break;
    remainingExp -= requiredExp;
    level += 1;
  }
  return level;
};

const getLevelProgress = (exp) => {
  let level = 1;
  let remainingExp = Math.max(0, exp);
  while (level < 100) {
    const requiredExp = LEVEL_REQ(level);
    if (remainingExp < requiredExp) return { level, progress: remainingExp, requiredExp };
    remainingExp -= requiredExp;
    level += 1;
  }
  return { level: 100, progress: 0, requiredExp: 0 };
};

const getBadge = (level) => level >= 100
  ? { level: 100, name: 'Demon King', icon: '👹', color: 'bg-red-100 text-red-900' }
  : { level, ...LEVEL_BADGES[Math.min(level - 1, 9)] };

const getUnlockedBadges = (level) => {
  const badgeLevels = [...Array(Math.min(level, 10)).keys()].map(index => index + 1);
  if (level >= 100) badgeLevels.push(100);
  return badgeLevels.map(getBadge);
};

const getNextBadge = (level) => level >= 100 ? null : getBadge(level + 1);

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-6 ${className}`}>
    {children}
  </div>
);

export function StudentView({ user, allTasks, completions, studySessions, currentView, setCurrentView, nextDeadlineId, onAwardExp, onStudySessionComplete, onBreakLockChange, db, appId, showToast, users }) {
  const [showAllBadges, setShowAllBadges] = useState(false);

  return (
    <>
      {currentView === 'dashboard' && (
        <StudentDashboard
          user={user}
          allTasks={allTasks}
          completions={completions}
          studySessions={studySessions}
          users={users}
          db={db}
          appId={appId}
          showToast={showToast}
          onAwardExp={onAwardExp}
          setCurrentView={setCurrentView}
          onSeeAllBadges={() => setShowAllBadges(true)}
        />
      )}
      {showAllBadges && <AllBadgesModal exp={user.exp} onClose={() => setShowAllBadges(false)} />}
      {currentView === 'study' && <StudyCare user={user} onAwardExp={onAwardExp} onStudySessionComplete={onStudySessionComplete} onBreakLockChange={onBreakLockChange} />}
      {currentView === 'todo' && <TodoList user={user} allTasksList={allTasks} completions={completions} onComplete={(exp) => onAwardExp(exp, 'Task Completed')} db={db} appId={appId} showToast={showToast} highlightTaskId={nextDeadlineId} />}
      {currentView === 'gamification' && (
        <GamificationHub
          user={user}
          allTasks={allTasks}
          completions={completions}
          studySessions={studySessions}
          users={users}
          db={db}
          appId={appId}
          showToast={showToast}
          onAwardExp={onAwardExp}
          onSeeAllBadges={() => setShowAllBadges(true)}
          setCurrentView={setCurrentView}
        />
      )}
      {currentView === 'leaderboard' && <Leaderboard users={users} currentUser={user} />}
    </>
  );
}

function StudentDashboard({ user, allTasks, completions, studySessions, users, db, appId, showToast, onAwardExp, setCurrentView, onSeeAllBadges }) {
  const { level, progress, requiredExp } = getLevelProgress(user.exp);
  const badges = getUnlockedBadges(level);
  const nextBadge = getNextBadge(level);
  const [claimingQuestId, setClaimingQuestId] = useState(null);

  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const todayStr = new Date().toDateString();

  // Task & Deadline Data
  const myTasks = allTasks.filter(t => t.type === 'global' || t.ownerId === user.id);
  const myCompletions = completions.filter(c => c.userId === user.id);
  const completedTaskIds = myCompletions.map(c => c.taskId);
  const pendingTasks = myTasks.filter(t => !completedTaskIds.includes(t.id)).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const nextDeadline = pendingTasks.length > 0 ? pendingTasks[0] : null;

  // Daily Streak Calculation
  const activeDates = new Set();
  (studySessions || []).filter(s => s.userId === user.id && s.completedAt).forEach(s => {
    activeDates.add(new Date(s.completedAt).toDateString());
  });
  myCompletions.filter(c => c.completedAt).forEach(c => {
    activeDates.add(new Date(c.completedAt).toDateString());
  });

  let streakCount = 0;
  const checkDate = new Date();
  if (!activeDates.has(checkDate.toDateString())) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  while (activeDates.has(checkDate.toDateString())) {
    streakCount++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Today's Progress for Quests & Insight
  const todayStudyMinutes = (studySessions || [])
    .filter(s => s.userId === user.id && s.completedAt && new Date(s.completedAt).toDateString() === todayStr)
    .reduce((acc, s) => acc + Number(s.durationMinutes || 0), 0);

  const todayTasksCompleted = myCompletions
    .filter(c => c.completedAt && new Date(c.completedAt).toDateString() === todayStr)
    .length;

  const claimedQuests = user.claimedQuests?.[todayKey] || {};

  const handleClaimQuest = async (questId, expReward, title) => {
    if (claimedQuests[questId] || claimingQuestId === questId) return;
    setClaimingQuestId(questId);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.id), {
        [`claimedQuests.${todayKey}.${questId}`]: true
      });
      await onAwardExp(expReward, `Quest Completed: ${title}`);
    } catch (err) {
      console.error('Failed to claim quest:', err);
      showToast?.('Failed to claim quest reward.');
    } finally {
      setClaimingQuestId(null);
    }
  };

  const dailyQuests = [
    {
      id: 'daily_focus_25',
      title: 'Deep Focus Scholar',
      current: Math.min(todayStudyMinutes, 25),
      target: 25,
      unit: 'm',
      reward: 30,
      actionView: 'study',
    },
    {
      id: 'daily_task_1',
      title: 'Task Crusher',
      current: Math.min(todayTasksCompleted, 1),
      target: 1,
      unit: 'task',
      reward: 25,
      actionView: 'todo',
    },
  ];

  // 1. Adaptive Study Insight Logic
  const getAdaptiveInsight = () => {
    if (nextDeadline) {
      const hoursLeft = (new Date(nextDeadline.deadline) - new Date()) / (1000 * 60 * 60);
      if (hoursLeft <= 48) {
        return {
          tag: 'Urgent Priority',
          color: 'border-amber-200 bg-amber-50/70',
          badgeColor: 'bg-amber-100 text-amber-800',
          message: `The deadline for "${nextDeadline.title}" is less than 48 hours away. Complete it now to secure maximum EXP before it's overdue!`,
          ctaLabel: 'Open To-Do List',
          ctaView: 'todo',
        };
      }
    }

    if (streakCount > 0 && todayStudyMinutes === 0 && todayTasksCompleted === 0) {
      return {
        tag: 'Streak Protection',
        color: 'border-orange-200 bg-orange-50/70',
        badgeColor: 'bg-orange-100 text-orange-800',
        message: `You are on a ${streakCount}-day study streak! Complete at least one Pomodoro session today to keep your streak alive.`,
        ctaLabel: 'Start Pomodoro',
        ctaView: 'study',
      };
    }

    if (todayStudyMinutes >= 25 && pendingTasks.length > 0 && todayTasksCompleted === 0) {
      return {
        tag: 'Balanced Productivity',
        color: 'border-indigo-200 bg-indigo-50/70',
        badgeColor: 'bg-indigo-100 text-indigo-800',
        message: `You've already focused for ${todayStudyMinutes} minutes today. Now is a great time to tackle a pending task from your To-Do List.`,
        ctaLabel: 'View Tasks',
        ctaView: 'todo',
      };
    }

    if (nextDeadline) {
      return {
        tag: 'Early Bird Bonus',
        color: 'border-blue-200 bg-blue-50/70',
        badgeColor: 'bg-blue-100 text-blue-800',
        message: `Work on "${nextDeadline.title}" early with a 25-minute Pomodoro focus session to maximize your daily EXP gains.`,
        ctaLabel: 'Start Focus Session',
        ctaView: 'study',
      };
    }

    return {
      tag: 'Great Momentum',
      color: 'border-emerald-200 bg-emerald-50/70',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      message: 'All tasks are cleared! Use Study Care to review your course materials and earn bonus EXP.',
      ctaLabel: 'Go to Study Care',
      ctaView: 'study',
    };
  };

  const insight = getAdaptiveInsight();

  // 2. 7-Day Activity Chart Data
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dStr = d.toDateString();
    const mins = (studySessions || [])
      .filter(s => s.userId === user.id && s.completedAt && new Date(s.completedAt).toDateString() === dStr)
      .reduce((acc, s) => acc + Number(s.durationMinutes || 0), 0);
    const doneTasks = myCompletions.filter(c => c.completedAt && new Date(c.completedAt).toDateString() === dStr).length;
    return {
      dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dateLabel: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      minutes: mins,
      tasks: doneTasks,
      isToday: dStr === todayStr,
    };
  });
  const maxChartMinutes = Math.max(60, ...last7Days.map(d => d.minutes));

  // 3. Leaderboard Snapshot Data
  const rankedStudents = (users || []).filter(u => u.role === 'student').sort((a, b) => b.exp - a.exp);
  const myRankIndex = rankedStudents.findIndex(s => s.id === user.id);
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : '-';
  const studentAbove = myRankIndex > 0 ? rankedStudents[myRankIndex - 1] : null;
  const studentBelow = myRankIndex >= 0 && myRankIndex < rankedStudents.length - 1 ? rankedStudents[myRankIndex + 1] : null;
  const expGapToAbove = studentAbove ? Math.max(1, studentAbove.exp - user.exp + 1) : 0;

  // 4. Recent EXP & Activity Feed Data
  const taskMap = new Map(allTasks.map(t => [t.id, t]));
  const recentActivities = [
    ...(studySessions || [])
      .filter(s => s.userId === user.id && s.completedAt && !s.partial)
      .map(s => ({
        id: `session-${s.id}`,
        type: 'study',
        title: `Pomodoro Focus (${s.durationMinutes} mins)`,
        exp: Number(s.durationMinutes || 0),
        timestamp: new Date(s.completedAt).getTime(),
      })),
    ...myCompletions
      .filter(c => c.completedAt)
      .map(c => {
        const t = taskMap.get(c.taskId);
        return {
          id: `comp-${c.id}`,
          type: 'task',
          title: t ? `Completed: ${t.title}` : 'Completed a task',
          exp: Number(c.expAwarded || 0),
          timestamp: new Date(c.completedAt).getTime(),
        };
      }),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Welcome back, {user.name}!</h1>
        <p className="text-slate-500 mt-1">Ready to earn some EXP today?</p>
      </div>

      {/* Adaptive Study Insight Banner */}
      <div className={`rounded-2xl border p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${insight.color}`}>
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0 text-blue-600 mt-0.5">
            <Lightbulb size={20} />
          </div>
          <div>
            <span className={`inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-1 ${insight.badgeColor}`}>
              Adaptive Insight · {insight.tag}
            </span>
            <p className="text-sm font-medium text-slate-800 leading-relaxed">{insight.message}</p>
          </div>
        </div>
        <button
          onClick={() => setCurrentView(insight.ctaView)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 shrink-0 self-start sm:self-center"
        >
          <span>{insight.ctaLabel}</span>
          <ArrowUpRight size={15} />
        </button>
      </div>

      {/* Row 1: Current Level Status & Next Deadline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 bg-gradient-to-br from-blue-600 to-blue-900 text-white border-none relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-blue-100 font-medium uppercase tracking-wider text-sm">Current Status</p>
                <h2 className="text-4xl font-bold mt-1">Level {level}</h2>
                <p className="text-blue-100 mt-1">{badges[badges.length - 1]?.name || 'Student'}</p>
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Award size={32} className="text-white" />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span>{level >= 100 ? 'Maximum level reached' : `${progress} / ${requiredExp} EXP to Next Level`}</span>
              </div>
              <div className="w-full h-3 bg-black/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${level >= 100 ? 100 : (progress / requiredExp) * 100}%` }}
                ></div>
              </div>
              {nextBadge && (
                <p className="text-xs text-blue-100 mt-3 flex items-center gap-1">
                  Next milestone: <span className="font-semibold text-white">{nextBadge.name}</span> at Level {nextBadge.level}
                </p>
              )}
            </div>
          </div>
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/5 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-black/10 blur-2xl"></div>
        </Card>

        <Card className="flex flex-col justify-center">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Bell size={18} className="text-amber-500" />
            Next Deadline
          </h3>
          {nextDeadline ? (
            <button
              onClick={() => setCurrentView('todo')}
              className="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50/50 transition-all w-full text-left"
            >
              <p className="font-semibold text-slate-800 line-clamp-1">{nextDeadline.course ? `${nextDeadline.title} - ${nextDeadline.course}` : nextDeadline.title}</p>
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                <Clock size={14} />
                {new Date(nextDeadline.deadline).toLocaleDateString('en-GB')}
              </p>
              <p className="text-xs text-blue-600 mt-2">Click to view in To-Do List</p>
            </button>
          ) : (
            <div className="text-center p-4 text-slate-500 bg-slate-50 rounded-xl">
              No upcoming deadlines! 🎉
            </div>
          )}
        </Card>
      </div>

      {/* Weekly Summary */}
      <WeeklySummaryCard user={user} completions={completions} studySessions={studySessions} />

      {/* Row 2: 7-Day Focus Activity Chart & Today's Quests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 size={20} className="text-blue-600" />
                7-Day Focus Activity
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Daily study minutes & completed tasks over the last 7 days</p>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              Goal: 25m / day
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-44 pt-4 px-1">
            {last7Days.map((day, idx) => {
              const heightPct = day.minutes > 0 ? Math.max(12, Math.round((day.minutes / maxChartMinutes) * 100)) : 6;
              return (
                <div key={idx} className="flex flex-col items-center h-full justify-end group">
                  <span className="text-[11px] font-bold text-slate-600 mb-1.5 opacity-80 group-hover:opacity-100">
                    {day.minutes > 0 ? `${day.minutes}m` : '-'}
                  </span>
                  <div className="w-full max-w-[38px] h-28 bg-slate-100 rounded-xl flex items-end overflow-hidden p-0.5">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-lg transition-all duration-500 ${
                        day.minutes >= 25
                          ? 'bg-blue-600'
                          : day.minutes > 0
                          ? 'bg-blue-400'
                          : 'bg-slate-200'
                      }`}
                    />
                  </div>
                  <span className={`text-xs font-bold mt-2 ${day.isToday ? 'text-blue-600' : 'text-slate-600'}`}>
                    {day.dayLabel}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {day.tasks > 0 ? `${day.tasks} ${day.tasks === 1 ? 'task' : 'tasks'}` : day.dateLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Today's Streak & Quests */}
        <Card className="flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Today&apos;s Quests</h3>
              <p className="text-xs text-slate-500">Complete daily missions for bonus EXP</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-extrabold">
              <Flame size={15} className="text-orange-500" fill="currentColor" />
              <span>{streakCount}d Streak</span>
            </div>
          </div>

          <div className="space-y-3.5">
            {dailyQuests.map(q => {
              const isDone = q.current >= q.target;
              const isClaimed = !!claimedQuests[q.id];
              const pct = Math.min(100, Math.round((q.current / q.target) * 100));

              return (
                <div key={q.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{q.title}</span>
                    <span className="font-bold text-amber-600">+{q.reward} EXP</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isDone ? 'bg-emerald-500' : 'bg-blue-600'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[11px] font-medium text-slate-500">
                      {q.current} / {q.target} {q.unit}
                    </span>
                    {isClaimed ? (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={13} /> Claimed
                      </span>
                    ) : isDone ? (
                      <button
                        disabled={claimingQuestId === q.id}
                        onClick={() => handleClaimQuest(q.id, q.reward, q.title)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-colors"
                      >
                        {claimingQuestId === q.id ? '...' : 'Claim EXP'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setCurrentView(q.actionView)}
                        className="text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        Start →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentView('gamification')}
            className="w-full py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
          >
            Open Gamifications Hub
          </button>
        </Card>
      </div>

      {/* Row 3: Leaderboard Snapshot & Recent EXP Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Trophy size={20} className="text-amber-500" />
                  Leaderboard Snapshot
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {myRank === 1
                    ? 'You are currently #1 in the class! Keep defending your spot.'
                    : studentAbove
                    ? `Need ${expGapToAbove} more EXP to overtake ${studentAbove.name}`
                    : 'Your current standing among classmates'}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-extrabold text-sm">
                Rank #{myRank}
              </span>
            </div>

            <div className="space-y-2.5">
              {studentAbove && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-bold text-slate-400 w-7">#{myRank - 1}</span>
                    <span className="font-semibold text-slate-700 truncate">{studentAbove.name}</span>
                  </div>
                  <span className="font-bold text-slate-600 shrink-0">{studentAbove.exp} EXP</span>
                </div>
              )}

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-black text-blue-700 w-7">#{myRank}</span>
                  <span className="font-bold text-blue-950 truncate">{user.name} (You)</span>
                </div>
                <span className="font-extrabold text-blue-700 shrink-0">{user.exp} EXP</span>
              </div>

              {studentBelow && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-bold text-slate-400 w-7">#{myRank + 1}</span>
                    <span className="font-semibold text-slate-700 truncate">{studentBelow.name}</span>
                  </div>
                  <span className="font-bold text-slate-600 shrink-0">{studentBelow.exp} EXP</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => setCurrentView('leaderboard')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
            >
              View Full Leaderboard →
            </button>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Activity size={20} className="text-emerald-600" />
                  Recent EXP Activity
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Your latest completed focus sessions & tasks</p>
              </div>
            </div>

            {recentActivities.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-slate-500 text-sm">
                No EXP activity yet. Start a Pomodoro session or complete a task!
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentActivities.map(act => (
                  <div key={act.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        act.type === 'study' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                      }`}>
                        {act.type === 'study' ? <Clock size={16} /> : <CheckSquare size={16} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{act.title}</p>
                        <p className="text-[11px] text-slate-400">
                          {new Date(act.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · {new Date(act.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full shrink-0">
                      +{act.exp} EXP
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Unlocked Badges */}
      <Card>
        <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
          <Trophy size={20} className="text-yellow-500" />
          Unlocked Badges
        </h3>
        <div className="flex flex-wrap gap-3">
          {badges.map((badge, i) => (
            <div key={i} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${badge.color}`}>
              <span>{badge.icon}</span>
              {badge.name}
            </div>
          ))}
          {badges.length === 0 && <p className="text-slate-500 text-sm">Level up to earn your first badge!</p>}
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={onSeeAllBadges} className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline">
            See All Badges
          </button>
        </div>
      </Card>
    </div>
  );
}

function GamificationHub({ user, allTasks, completions, studySessions, users, db, appId, showToast, onAwardExp, onSeeAllBadges, setCurrentView }) {
  const { level, progress, requiredExp } = getLevelProgress(user.exp);
  const currentBadge = getBadge(level);
  const [claimingQuestId, setClaimingQuestId] = useState(null);
  const [activeGameTab, setActiveGameTab] = useState('wordle');

  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const todayStr = new Date().toDateString();

  const activeDates = new Set();
  (studySessions || []).filter(s => s.userId === user.id && s.completedAt).forEach(s => {
    activeDates.add(new Date(s.completedAt).toDateString());
  });
  (completions || []).filter(c => c.userId === user.id && c.completedAt).forEach(c => {
    activeDates.add(new Date(c.completedAt).toDateString());
  });

  let streakCount = 0;
  const checkDate = new Date();
  if (!activeDates.has(checkDate.toDateString())) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  while (activeDates.has(checkDate.toDateString())) {
    streakCount++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  const streakMultiplier = streakCount >= 7 ? '1.5x' : streakCount >= 3 ? '1.2x' : '1.0x';

  const todayStudyMinutes = (studySessions || [])
    .filter(s => s.userId === user.id && s.completedAt && new Date(s.completedAt).toDateString() === todayStr)
    .reduce((acc, s) => acc + Number(s.durationMinutes || 0), 0);

  const todayTasksCompleted = (completions || [])
    .filter(c => c.userId === user.id && c.completedAt && new Date(c.completedAt).toDateString() === todayStr)
    .length;

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const earlySubmissionsThisWeek = (completions || []).filter(c => {
    if (c.userId !== user.id || !c.completedAt || new Date(c.completedAt).getTime() < oneWeekAgo) return false;
    return Number(c.expAwarded || 0) >= 15;
  }).length;

  const claimedQuests = user.claimedQuests?.[todayKey] || {};

  const handleClaimQuest = async (questId, expReward, title) => {
    if (claimedQuests[questId] || claimingQuestId === questId) return;
    setClaimingQuestId(questId);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.id), {
        [`claimedQuests.${todayKey}.${questId}`]: true
      });
      await onAwardExp(expReward, `Quest Completed: ${title}`);
    } catch (err) {
      console.error('Failed to claim quest:', err);
      showToast?.('Failed to claim quest reward.');
    } finally {
      setClaimingQuestId(null);
    }
  };

  const quests = [
    {
      id: 'daily_focus_25',
      type: 'Daily Quest',
      title: 'Deep Focus Scholar',
      description: 'Complete at least 25 minutes of Study Care today.',
      current: Math.min(todayStudyMinutes, 25),
      target: 25,
      unit: 'mins',
      reward: 30,
    },
    {
      id: 'daily_task_1',
      type: 'Daily Quest',
      title: 'Task Crusher',
      description: 'Complete at least 1 task from your To-Do List today.',
      current: Math.min(todayTasksCompleted, 1),
      target: 1,
      unit: 'task',
      reward: 25,
    },
    {
      id: 'weekly_early_2',
      type: 'Weekly Quest',
      title: 'Early Bird Strategist',
      description: 'Submit 2 assignments at least 3 days before the deadline this week.',
      current: Math.min(earlySubmissionsThisWeek, 2),
      target: 2,
      unit: 'tasks',
      reward: 100,
    },
  ];

  const studentsCount = Math.max(1, (users || []).filter(u => u.role === 'student').length);
  const globalTasks = (allTasks || []).filter(t => t.type === 'global');
  const globalTaskIds = new Set(globalTasks.map(t => t.id));
  const totalClassSubmissions = (completions || []).filter(c => globalTaskIds.has(c.taskId)).length;

  const bossMaxHp = Math.max(500, globalTasks.length * studentsCount * 100);
  const totalDamageDealt = totalClassSubmissions * 100;
  const bossRemainingHp = Math.max(0, bossMaxHp - totalDamageDealt);
  const bossHpPercent = Math.round((bossRemainingHp / bossMaxHp) * 100);
  const myRaidDamage = (completions || []).filter(c => c.userId === user.id && globalTaskIds.has(c.taskId)).length * 100;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2.5">
            <Sparkles className="text-blue-600" size={28} />
            Gamifications Hub
          </h1>
          <p className="text-slate-500 mt-1">Maintain your study streak, complete quests, play brain games, and defeat the Class Boss!</p>
        </div>
        <button
          onClick={onSeeAllBadges}
          className="px-4 py-2.5 bg-blue-50 text-blue-700 font-semibold rounded-xl hover:bg-blue-100 transition-colors text-sm flex items-center gap-2 self-start sm:self-auto"
        >
          <Trophy size={16} /> View All Rank Badges
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white border-none">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-4xl border border-white/15">
                {currentBadge.icon}
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-300">Current Title</span>
                <h2 className="text-2xl font-extrabold text-white">{currentBadge.name}</h2>
                <p className="text-sm text-slate-300">Level {level} · Total {user.exp} EXP</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex justify-between text-xs font-semibold text-blue-200 mb-1.5">
              <span>Level {level} Progress</span>
              <span>{level >= 100 ? 'MAX LEVEL' : `${progress} / ${requiredExp} EXP`}</span>
            </div>
            <div className="w-full h-3 bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-cyan-300 rounded-full transition-all duration-700"
                style={{ width: `${level >= 100 ? 100 : (progress / requiredExp) * 100}%` }}
              />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-none flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-100">Study Streak</p>
              <h3 className="text-4xl font-black mt-1">{streakCount} {streakCount === 1 ? 'Day' : 'Days'}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <Flame size={28} className="text-white" fill="currentColor" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-sm">
            <span className="text-amber-100">Streak Bonus Tier</span>
            <span className="font-extrabold bg-white/20 px-2.5 py-0.5 rounded-full">{streakMultiplier} EXP</span>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Target size={22} className="text-blue-600" />
              Active Quests & Missions
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">Complete study targets to claim bonus EXP rewards</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quests.map(quest => {
            const isReady = quest.current >= quest.target;
            const isClaimed = !!claimedQuests[quest.id];
            const isClaiming = claimingQuestId === quest.id;
            const pct = Math.min(100, Math.round((quest.current / quest.target) * 100));

            return (
              <div key={quest.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${quest.type === 'Daily Quest' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {quest.type}
                    </span>
                    <span className="text-xs font-extrabold text-amber-600">+{quest.reward} EXP</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{quest.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{quest.description}</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                      <span>Progress</span>
                      <span>{quest.current} / {quest.target} {quest.unit}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${isReady ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {isClaimed ? (
                    <button disabled className="w-full py-2 bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-default">
                      <CheckCircle2 size={15} /> Claimed
                    </button>
                  ) : isReady ? (
                    <button
                      disabled={isClaiming}
                      onClick={() => handleClaimQuest(quest.id, quest.reward, quest.title)}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors disabled:opacity-50"
                    >
                      {isClaiming ? 'Claiming...' : `Claim +${quest.reward} EXP`}
                    </button>
                  ) : (
                    <button
                      onClick={() => setCurrentView(quest.id === 'daily_focus_25' ? 'study' : 'todo')}
                      className="w-full py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                    >
                      Go to Task
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Brain Games Arcade: Daily Wordle (#3) & Memory Card Match (#4) */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Gamepad2 size={22} className="text-indigo-600" />
              Brain Games Arcade
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">Take a quick brain break and earn daily bonus EXP!</p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveGameTab('wordle')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeGameTab === 'wordle' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HelpCircle size={14} /> Daily Wordle (+20 EXP)
            </button>
            <button
              type="button"
              onClick={() => setActiveGameTab('memory')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeGameTab === 'memory' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Brain size={14} /> Memory Match (+15 EXP)
            </button>
          </div>
        </div>

        <div className="pt-6">
          {activeGameTab === 'wordle' ? (
            <CodeWordleGame
              isRewardClaimed={!!claimedQuests['wordle_daily']}
              onWinReward={() => handleClaimQuest('wordle_daily', 20, 'Daily Wordle')}
              showToast={showToast}
            />
          ) : (
            <MemoryMatchGame
              isRewardClaimed={!!claimedQuests['memory_daily']}
              onWinReward={() => handleClaimQuest('memory_daily', 15, 'Memory Card Match')}
            />
          )}
        </div>
      </Card>

      <Card className="border-red-200 bg-gradient-to-r from-red-50 via-white to-amber-50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-red-950 text-amber-400 flex items-center justify-center text-3xl shadow-md">
              🐉
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full flex items-center gap-1">
                  <Swords size={12} /> Class Boss Raid
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 mt-1">Semester Deadline Leviathan</h2>
              <p className="text-xs text-slate-600">Every class assignment submitted deals <strong>100 DMG</strong> to the Boss!</p>
            </div>
          </div>

          <div className="text-left md:text-right bg-white px-4 py-2.5 rounded-xl border border-red-100 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">Your Raid Contribution</p>
            <p className="text-lg font-black text-red-600">{myRaidDamage} DMG</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold text-slate-700">
            <span>Boss HP: {bossRemainingHp.toLocaleString()} / {bossMaxHp.toLocaleString()}</span>
            <span>{bossRemainingHp === 0 ? 'DEFEATED! 🎉' : `${bossHpPercent}% Remaining`}</span>
          </div>
          <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full transition-all duration-700"
              style={{ width: `${bossHpPercent}%` }}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

// Game #3: General 5-Letter Wordle
const WORDLE_BANK = [
  { word: 'FOCUS', hint: 'Concentrating deeply on a single task' },
  { word: 'BRAIN', hint: 'The organ inside your head used for thinking' },
  { word: 'STUDY', hint: 'Devoting time to gain knowledge' },
  { word: 'HABIT', hint: 'A routine behavior repeated regularly' },
  { word: 'SMART', hint: 'Having quick intelligence or sharp wit' },
  { word: 'CLOCK', hint: 'A device that measures and shows time' },
  { word: 'GOALS', hint: 'Targets or ambitions you aim to achieve' },
  { word: 'PEACE', hint: 'A state of calm, quiet, and tranquility' },
  { word: 'EARTH', hint: 'The third planet from the Sun' },
  { word: 'OCEAN', hint: 'A vast body of salt water covering the globe' },
  { word: 'LIGHT', hint: 'Natural agent that makes things visible' },
  { word: 'DREAM', hint: 'Thoughts and images occurring during sleep, or a big ambition' },
  { word: 'SPARK', hint: 'A tiny fiery particle or sudden burst of inspiration' },
  { word: 'TIGER', hint: 'A large striped wild cat native to Asia' },
  { word: 'MUSIC', hint: 'Vocal or instrumental sounds combined in harmony' },
];

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL'],
];

function evaluateWordleGuess(guess, target) {
  const result = Array(5).fill('absent');
  const targetChars = target.split('');
  const used = Array(5).fill(false);

  for (let i = 0; i < 5; i++) {
    if (guess[i] === targetChars[i]) {
      result[i] = 'correct';
      used[i] = true;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    const foundIdx = targetChars.findIndex((ch, idx) => !used[idx] && ch === guess[i]);
    if (foundIdx !== -1) {
      result[i] = 'present';
      used[foundIdx] = true;
    }
  }
  return result;
}

function CodeWordleGame({ isRewardClaimed, onWinReward, showToast }) {
  const [targetObj, setTargetObj] = useState(() => WORDLE_BANK[Math.floor(Math.random() * WORDLE_BANK.length)]);
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [status, setStatus] = useState('playing'); // 'playing' | 'won' | 'lost'
  const [showHint, setShowHint] = useState(false);

  const handleKeyInput = (key) => {
    if (status !== 'playing') return;

    if (key === 'DEL' || key === 'BACKSPACE') {
      setCurrentGuess(prev => prev.slice(0, -1));
      return;
    }

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) {
        showToast?.('Enter a 5-letter word!');
        return;
      }
      const nextGuesses = [...guesses, currentGuess];
      setGuesses(nextGuesses);
      setCurrentGuess('');

      if (currentGuess === targetObj.word) {
        setStatus('won');
        if (!isRewardClaimed) {
          onWinReward?.();
        }
      } else if (nextGuesses.length >= 6) {
        setStatus('lost');
      }
      return;
    }

    if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess(prev => prev + key);
    }
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.toUpperCase();
      if (k === 'ENTER' || k === 'BACKSPACE' || /^[A-Z]$/.test(k)) {
        e.preventDefault();
        handleKeyInput(k);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const resetGame = () => {
    const remaining = WORDLE_BANK.filter(item => item.word !== targetObj.word);
    const next = remaining[Math.floor(Math.random() * remaining.length)] || WORDLE_BANK[0];
    setTargetObj(next);
    setGuesses([]);
    setCurrentGuess('');
    setStatus('playing');
    setShowHint(false);
  };

  const keyStatuses = {};
  guesses.forEach(g => {
    const evals = evaluateWordleGuess(g, targetObj.word);
    g.split('').forEach((ch, idx) => {
      const prev = keyStatuses[ch];
      const next = evals[idx];
      if (next === 'correct') keyStatuses[ch] = 'correct';
      else if (next === 'present' && prev !== 'correct') keyStatuses[ch] = 'present';
      else if (!prev) keyStatuses[ch] = 'absent';
    });
  });

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Daily Wordle (5 Letters)</h3>
          <p className="text-xs text-slate-500">Guess the hidden 5-letter word in 6 tries</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors"
          >
            {showHint ? 'Hide Hint' : 'Hint'}
          </button>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
            isRewardClaimed ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
          }`}>
            {isRewardClaimed ? 'Daily EXP Claimed' : '+20 EXP Available'}
          </span>
        </div>
      </div>

      {showHint && (
        <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 font-medium">
          Clue: {targetObj.hint}
        </div>
      )}

      {/* 6x5 Wordle Grid */}
      <div className="grid grid-rows-6 gap-1.5 w-64 mx-auto">
        {[...Array(6)].map((_, rowIdx) => {
          const submittedGuess = guesses[rowIdx];
          const isCurrentRow = rowIdx === guesses.length && status === 'playing';
          const letters = submittedGuess
            ? submittedGuess.split('')
            : isCurrentRow
            ? currentGuess.padEnd(5, ' ').split('')
            : Array(5).fill('');
          const rowEval = submittedGuess ? evaluateWordleGuess(submittedGuess, targetObj.word) : null;

          return (
            <div key={rowIdx} className="grid grid-cols-5 gap-1.5">
              {letters.map((char, colIdx) => {
                const state = rowEval?.[colIdx];
                let tileStyle = 'bg-white border-slate-200 text-slate-800';
                if (state === 'correct') tileStyle = 'bg-emerald-500 border-emerald-500 text-white';
                else if (state === 'present') tileStyle = 'bg-amber-400 border-amber-400 text-white';
                else if (state === 'absent') tileStyle = 'bg-slate-400 border-slate-400 text-white';
                else if (char.trim()) tileStyle = 'bg-white border-blue-400 text-slate-900';

                return (
                  <div
                    key={colIdx}
                    className={`h-11 rounded-lg border-2 flex items-center justify-center font-extrabold text-lg uppercase select-none transition-colors ${tileStyle}`}
                  >
                    {char.trim()}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {status !== 'playing' && (
        <div className={`p-3.5 rounded-xl border text-center space-y-2 ${
          status === 'won' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-100 border-slate-200 text-slate-800'
        }`}>
          <p className="text-sm font-bold">
            {status === 'won'
              ? `Brilliant! You guessed "${targetObj.word}" in ${guesses.length}/6 tries!`
              : `Out of tries! The word was "${targetObj.word}".`}
          </p>
          <button
            type="button"
            onClick={resetGame}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Play New Word
          </button>
        </div>
      )}

      {/* Virtual Keyboard */}
      <div className="space-y-1.5 pt-1">
        {KEYBOARD_ROWS.map((row, rIdx) => (
          <div key={rIdx} className="flex justify-center gap-1">
            {row.map(k => {
              const kState = keyStatuses[k];
              let btnStyle = 'bg-slate-100 hover:bg-slate-200 text-slate-800';
              if (kState === 'correct') btnStyle = 'bg-emerald-500 text-white';
              else if (kState === 'present') btnStyle = 'bg-amber-400 text-white';
              else if (kState === 'absent') btnStyle = 'bg-slate-400 text-white';

              const isWide = k === 'ENTER' || k === 'DEL';
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleKeyInput(k)}
                  className={`${isWide ? 'px-2.5 text-[11px]' : 'w-8 sm:w-9 text-xs'} h-10 rounded-lg font-bold transition-colors ${btnStyle}`}
                >
                  {k}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Game #4: Classic Icon Memory Card Match (General Theme)
const MEMORY_ICONS = [
  { pairId: 'rocket', icon: '🚀', label: 'Rocket' },
  { pairId: 'compass', icon: '🧭', label: 'Compass' },
  { pairId: 'trophy', icon: '🏆', label: 'Trophy' },
  { pairId: 'fire', icon: '🔥', label: 'Flame' },
  { pairId: 'crown', icon: '👑', label: 'Crown' },
  { pairId: 'gem', icon: '💎', label: 'Diamond' },
];

function createShuffledDeck() {
  const cards = [];
  MEMORY_ICONS.forEach(item => {
    cards.push({ uid: `${item.pairId}-1`, pairId: item.pairId, icon: item.icon, label: item.label });
    cards.push({ uid: `${item.pairId}-2`, pairId: item.pairId, icon: item.icon, label: item.label });
  });
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function MemoryMatchGame({ isRewardClaimed, onWinReward }) {
  const [deck, setDeck] = useState(() => createShuffledDeck());
  const [flippedIndices, setFlippedIndices] = useState([]);
  const [matchedPairIds, setMatchedPairIds] = useState([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);

  const isCompleted = matchedPairIds.length === MEMORY_ICONS.length;

  const handleCardClick = (index) => {
    if (locked || isCompleted) return;
    if (flippedIndices.includes(index)) return;
    const card = deck[index];
    if (matchedPairIds.includes(card.pairId)) return;

    const nextFlipped = [...flippedIndices, index];
    setFlippedIndices(nextFlipped);

    if (nextFlipped.length === 2) {
      setMoves(m => m + 1);
      setLocked(true);
      const [firstIdx, secondIdx] = nextFlipped;
      const firstCard = deck[firstIdx];
      const secondCard = deck[secondIdx];

      if (firstCard.pairId === secondCard.pairId) {
        const updatedMatches = [...matchedPairIds, firstCard.pairId];
        setMatchedPairIds(updatedMatches);
        setFlippedIndices([]);
        setLocked(false);

        if (updatedMatches.length === MEMORY_ICONS.length && !isRewardClaimed) {
          onWinReward?.();
        }
      } else {
        setTimeout(() => {
          setFlippedIndices([]);
          setLocked(false);
        }, 750);
      }
    }
  };

  const resetDeck = () => {
    setDeck(createShuffledDeck());
    setFlippedIndices([]);
    setMatchedPairIds([]);
    setMoves(0);
    setLocked(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Memory Card Match</h3>
          <p className="text-xs text-slate-500">Flip the cards and find all 6 matching pairs</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            Moves: {moves}
          </span>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
            isRewardClaimed ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
          }`}>
            {isRewardClaimed ? 'Daily EXP Claimed' : '+15 EXP Available'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
        {deck.map((card, idx) => {
          const isMatched = matchedPairIds.includes(card.pairId);
          const isFlipped = isMatched || flippedIndices.includes(idx);

          return (
            <button
              key={card.uid}
              type="button"
              onClick={() => handleCardClick(idx)}
              className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-200 select-none ${
                isMatched
                  ? 'bg-emerald-50 border-emerald-400 scale-[0.98]'
                  : isFlipped
                  ? 'bg-white border-blue-500 shadow-sm'
                  : 'bg-gradient-to-br from-blue-600 to-indigo-700 border-blue-700 text-white hover:opacity-95'
              }`}
            >
              {isFlipped ? (
                <>
                  <span className="text-2xl">{card.icon}</span>
                  <span className="text-[10px] font-bold text-slate-600 mt-1">{card.label}</span>
                </>
              ) : (
                <span className="text-lg font-extrabold text-white/75">?</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs font-semibold text-slate-500">
          Matched: {matchedPairIds.length} / {MEMORY_ICONS.length} pairs
        </span>
        <button
          type="button"
          onClick={resetDeck}
          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5"
        >
          <RotateCcw size={13} /> Shuffle Cards
        </button>
      </div>

      {isCompleted && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center space-y-2">
          <p className="text-sm font-bold">
            Awesome! You matched all 6 pairs in {moves} moves!
          </p>
          <button
            type="button"
            onClick={resetDeck}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}

function WeeklySummaryCard({ user, completions, studySessions }) {
  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const weeklySessions = (studySessions || []).filter(
    s => s.userId === user.id && s.completedAt && new Date(s.completedAt).getTime() >= oneWeekAgo
  );
  const weeklyStudyMinutes = weeklySessions.reduce((acc, s) => acc + Number(s.durationMinutes || 0), 0);
  const studyHours = Math.floor(weeklyStudyMinutes / 60);
  const studyRemainingMins = weeklyStudyMinutes % 60;
  const studyTimeFormatted = studyHours > 0 ? `${studyHours}h ${studyRemainingMins}m` : `${studyRemainingMins}m`;

  const weeklyCompletions = (completions || []).filter(
    c => c.userId === user.id && c.completedAt && new Date(c.completedAt).getTime() >= oneWeekAgo
  );
  const weeklyTasksCount = weeklyCompletions.length;

  const taskExp = weeklyCompletions.reduce((acc, c) => acc + Number(c.expAwarded || 0), 0);
  const studyExp = weeklyStudyMinutes;
  const weeklyExpTotal = taskExp + studyExp;

  const activeDaysSet = new Set();
  weeklySessions.forEach(s => activeDaysSet.add(new Date(s.completedAt).toDateString()));
  weeklyCompletions.forEach(c => activeDaysSet.add(new Date(c.completedAt).toDateString()));
  const activeDaysCount = activeDaysSet.size;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-600" />
            Weekly Summary
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">Your learning activity over the past 7 days</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">
          Past 7 Days
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Study Time</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{studyTimeFormatted}</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckSquare size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Tasks Completed</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{weeklyTasksCount} {weeklyTasksCount === 1 ? 'Task' : 'Tasks'}</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Award size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">EXP Gained</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">+{weeklyExpTotal} EXP</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Active Days</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{activeDaysCount} / 7 Days</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function AllBadgesModal({ exp, onClose }) {
  const level = getLevel(exp);
  const badges = getUnlockedBadges(10);
  const archmageBadge = badges[9];
  const archmageUnlocked = level >= 10;
  const demonKingBadge = getBadge(100);
  const demonKingUnlocked = level >= 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">All Badges</h2>
            <p className="mt-1 text-sm text-slate-500">Unlocked {Math.min(level, 10)} of 10 badge ranks</p>
          </div>
          <button onClick={onClose} aria-label="Close badges" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {badges.slice(0, 9).map(badge => {
            const unlocked = level >= badge.level;
            return (
              <div key={badge.level} className={`flex items-center gap-3 rounded-xl border p-3 ${unlocked ? badge.color : 'border-slate-200 bg-slate-50 text-slate-400 grayscale'}`}>
                <span className="text-2xl">{badge.icon}</span>
                <div>
                  <p className="text-xs font-semibold">Level {badge.level}</p>
                  <p className="text-sm font-bold">{badge.name}</p>
                  <p className="text-xs">{unlocked ? 'Unlocked' : 'Locked'}</p>
                </div>
              </div>
            );
          })}
          <div className={`flex items-center gap-3 rounded-xl border p-3 ${archmageUnlocked ? archmageBadge.color : 'border-slate-200 bg-slate-50 text-slate-400 grayscale'}`}>
            <span className="text-2xl">{archmageBadge.icon}</span>
            <div>
              <p className="text-xs font-semibold">Levels 10–99</p>
              <p className="text-sm font-bold">{archmageBadge.name}</p>
              <p className="text-xs">{archmageUnlocked ? 'Unlocked' : 'Locked'}</p>
            </div>
          </div>
        </div>
        <div className={`mt-5 flex items-center justify-center gap-5 rounded-2xl border-2 p-6 text-center ${demonKingUnlocked ? demonKingBadge.color : 'border-slate-200 bg-slate-50 text-slate-400 grayscale'}`}>
          <span className="text-6xl">{demonKingBadge.icon}</span>
          <div>
            <p className="text-sm font-bold">Level 100 · Ultimate Secret Boss</p>
            <p className="text-2xl font-black">{demonKingBadge.name}</p>
            <p className="text-sm">{demonKingUnlocked ? 'Unlocked' : 'Locked'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudyCare({ user, onAwardExp, onStudySessionComplete, onBreakLockChange }) {
  const [focusMins, setFocusMins] = useState(25);
  const [shortBreakMins, setShortBreakMins] = useState(5);
  const [longBreakMins, setLongBreakMins] = useState(15);
  const [cyclesBeforeLongBreak, setCyclesBeforeLongBreak] = useState(4);

  const [phase, setPhase] = useState('setup');
  const [completedCycles, setCompletedCycles] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [showMiniGame, setShowMiniGame] = useState(false);

  const playNotificationChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Ignore if browser blocks audio
    }
  };

  useEffect(() => {
    let interval;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(current => Math.max(0, current - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  useEffect(() => {
    if (isActive && timeLeft === 0) {
      setIsActive(false);
      handlePhaseComplete();
    }
  }, [isActive, timeLeft]);

  const applyPreset = (focus, sBreak, lBreak, cycles = 4) => {
    setFocusMins(focus);
    setShortBreakMins(sBreak);
    setLongBreakMins(lBreak);
    setCyclesBeforeLongBreak(cycles);
  };

  const clampMinutes = (val, min, max) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) return min;
    return Math.min(max, Math.max(min, parsed));
  };

  const startPomodoro = () => {
    const validFocus = clampMinutes(focusMins, 1, 180);
    const validShort = clampMinutes(shortBreakMins, 1, 60);
    const validLong = clampMinutes(longBreakMins, 1, 90);
    const validCycles = clampMinutes(cyclesBeforeLongBreak, 1, 10);

    setFocusMins(validFocus);
    setShortBreakMins(validShort);
    setLongBreakMins(validLong);
    setCyclesBeforeLongBreak(validCycles);

    setCompletedCycles(0);
    setPhase('focus');
    setTimeLeft(validFocus * 60);
    setSessionStartedAt(new Date().toISOString());
    setIsActive(true);
    setShowMiniGame(false);
    onBreakLockChange?.(false);
  };

  const pauseTimer = () => setIsActive(false);

  const resetPomodoro = () => {
    if (phase === 'focus' && sessionStartedAt) {
      const elapsedMinutes = Math.floor((Date.now() - new Date(sessionStartedAt).getTime()) / 60000);
      if (elapsedMinutes >= 1) {
        onStudySessionComplete?.({
          userId: user.id,
          durationMinutes: elapsedMinutes,
          startedAt: sessionStartedAt,
          completedAt: new Date().toISOString(),
          partial: true,
        });
      }
    }
    setIsActive(false);
    setPhase('setup');
    setCompletedCycles(0);
    setSessionStartedAt(null);
    setTimeLeft(focusMins * 60);
    setShowMiniGame(false);
    onBreakLockChange?.(false);
  };

  const startNextFocusRound = () => {
    setPhase('focus');
    setTimeLeft(focusMins * 60);
    setSessionStartedAt(new Date().toISOString());
    setIsActive(true);
    setShowMiniGame(false);
    onBreakLockChange?.(false);
  };

  const handlePhaseComplete = async () => {
    playNotificationChime();

    if (phase === 'focus') {
      const completedAt = new Date().toISOString();
      const nextCycleCount = completedCycles + 1;
      setCompletedCycles(nextCycleCount);

      onAwardExp(focusMins, `Pomodoro Focus (${focusMins}m)`);
      await onStudySessionComplete?.({
        userId: user.id,
        durationMinutes: focusMins,
        startedAt: sessionStartedAt || completedAt,
        completedAt,
      });

      const isLongBreakTurn = nextCycleCount % cyclesBeforeLongBreak === 0;
      const nextPhase = isLongBreakTurn ? 'longBreak' : 'shortBreak';
      const breakDuration = isLongBreakTurn ? longBreakMins : shortBreakMins;

      setPhase(nextPhase);
      setTimeLeft(breakDuration * 60);
      setSessionStartedAt(null);
      setIsActive(true);
      onBreakLockChange?.(true);
    } else {
      startNextFocusRound();
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentPhaseTotalSeconds =
    phase === 'focus'
      ? focusMins * 60
      : phase === 'shortBreak'
      ? shortBreakMins * 60
      : phase === 'longBreak'
      ? longBreakMins * 60
      : focusMins * 60;

  const isBreakPhase = phase === 'shortBreak' || phase === 'longBreak';
  const currentCycleIndex = (completedCycles % cyclesBeforeLongBreak) + (phase === 'focus' ? 1 : 0);

  const presets = [
    { label: 'Classic', f: 25, s: 5, l: 15, c: 4 },
    { label: 'Deep Work', f: 50, s: 10, l: 20, c: 3 },
    { label: 'Quick', f: 15, s: 3, l: 10, c: 4 },
  ];

  const settingFields = [
    { label: 'Focus', sub: `+${focusMins || 1} EXP / round`, dot: 'bg-blue-600', val: focusMins, set: setFocusMins, min: 1, max: 180, step: 5 },
    { label: 'Short Break', sub: 'Between rounds', dot: 'bg-teal-500', val: shortBreakMins, set: setShortBreakMins, min: 1, max: 60, step: 1 },
    { label: 'Long Break', sub: 'After full cycle', dot: 'bg-indigo-500', val: longBreakMins, set: setLongBreakMins, min: 1, max: 90, step: 5 },
    { label: 'Rounds', sub: 'Per full cycle', dot: 'bg-amber-500', val: cyclesBeforeLongBreak, set: setCyclesBeforeLongBreak, min: 1, max: 10, step: 1 },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Study Care</h1>
          <p className="text-slate-500 mt-1">Pomodoro focus timer · Earn 1 EXP for every focused minute</p>
        </div>
        {phase !== 'setup' && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold self-start sm:self-auto">
            <span>Completed: {completedCycles} {completedCycles === 1 ? 'round' : 'rounds'}</span>
          </div>
        )}
      </div>

      {phase === 'setup' ? (
        <Card className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Sliders size={19} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Configure Timer</h2>
                <p className="text-xs text-slate-500">Pick a preset or customize minutes freely</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
              {presets.map(p => {
                const isSelected = focusMins === p.f && shortBreakMins === p.s && longBreakMins === p.l && cyclesBeforeLongBreak === p.c;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.f, p.s, p.l, p.c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isSelected ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {settingFields.map(item => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between transition-colors hover:border-slate-300"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-700">{item.label}</span>
                  <span className={`w-2 h-2 rounded-full ${item.dot}`} />
                </div>

                <div className="flex items-center justify-between gap-1.5 bg-white border border-slate-200 rounded-lg p-1">
                  <button
                    type="button"
                    aria-label={`Decrease ${item.label}`}
                    onClick={() => item.set(clampMinutes(Number(item.val || item.min) - item.step, item.min, item.max))}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min={item.min}
                    max={item.max}
                    value={item.val}
                    onChange={e => item.set(e.target.value === '' ? '' : Number(e.target.value))}
                    onBlur={() => item.set(clampMinutes(item.val, item.min, item.max))}
                    className="w-full text-center text-base font-bold text-slate-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    aria-label={`Increase ${item.label}`}
                    onClick={() => item.set(clampMinutes(Number(item.val || item.min) + item.step, item.min, item.max))}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 mt-2.5 text-center">{item.sub}</p>
              </div>
            ))}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Cycle flow: <span className="font-semibold text-slate-700">{focusMins || 1}m Focus</span> → <span className="font-semibold text-teal-700">{shortBreakMins || 1}m Break</span> ({cyclesBeforeLongBreak || 1}×) → <span className="font-semibold text-indigo-700">{longBreakMins || 1}m Long Break</span>
            </p>
            <button
              onClick={startPomodoro}
              className="w-full sm:w-auto px-7 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-sm hover:shadow transition-all inline-flex items-center justify-center gap-2 text-sm"
            >
              <Play size={17} fill="currentColor" />
              Start Session
            </button>
          </div>
        </Card>
      ) : (
        <Card className="p-6 md:p-10 text-center space-y-6">
          <div className="flex flex-col items-center gap-3">
            <span className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide ${
              phase === 'focus'
                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                : phase === 'shortBreak'
                ? 'bg-teal-50 text-teal-700 border border-teal-100'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
            }`}>
              {phase === 'focus' ? <Clock size={13} /> : <Coffee size={13} />}
              {phase === 'focus'
                ? `Focus · Round ${currentCycleIndex} of ${cyclesBeforeLongBreak}`
                : phase === 'shortBreak'
                ? `Short Break · ${shortBreakMins}m`
                : `Long Break · ${longBreakMins}m`}
            </span>

            <div className="flex items-center gap-1.5">
              {[...Array(cyclesBeforeLongBreak)].map((_, idx) => {
                const filled = idx < (completedCycles % cyclesBeforeLongBreak) || phase === 'longBreak';
                const active = phase === 'focus' && idx === (completedCycles % cyclesBeforeLongBreak);
                return (
                  <span
                    key={idx}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      filled ? 'w-6 bg-emerald-500' : active ? 'w-6 bg-blue-600' : 'w-2 bg-slate-200'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <div className="relative w-56 h-56 mx-auto">
            <svg viewBox="0 0 220 220" className="w-full h-full -rotate-90">
              <circle cx="110" cy="110" r="98" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
              <circle
                cx="110"
                cy="110"
                r="98"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 98}
                strokeDashoffset={(2 * Math.PI * 98) * (1 - timeLeft / Math.max(1, currentPhaseTotalSeconds))}
                className={`${isBreakPhase ? 'text-teal-500' : 'text-blue-600'} transition-all duration-1000 ease-linear`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold text-slate-900 tracking-tight tabular-nums">{formatTime(timeLeft)}</span>
              <span className="text-slate-400 text-xs mt-1.5 font-medium">
                {phase === 'focus' ? 'Stay focused' : 'Take a breather'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            {isActive ? (
              <button onClick={pauseTimer} className="px-5 py-2.5 bg-amber-100 text-amber-800 font-semibold rounded-xl hover:bg-amber-200 transition-colors inline-flex items-center gap-2 text-sm">
                <Square size={15} fill="currentColor" /> Pause
              </button>
            ) : (
              <button onClick={() => setIsActive(true)} className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors inline-flex items-center gap-2 text-sm">
                <Play size={15} fill="currentColor" /> Resume
              </button>
            )}

            {isBreakPhase && (
              <button onClick={startNextFocusRound} className="px-5 py-2.5 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors inline-flex items-center gap-2 text-sm">
                <SkipForward size={15} /> Skip Break
              </button>
            )}

            <button onClick={resetPomodoro} className="px-5 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-xl hover:bg-slate-200 transition-colors inline-flex items-center gap-2 text-sm">
              <RotateCcw size={15} /> Reset
            </button>
          </div>

          {isBreakPhase && (
            <div className="pt-4 border-t border-slate-100 max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => setShowMiniGame(!showMiniGame)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Gamepad2 size={16} className="text-teal-600" />
                  Break Mini-Game (Tic-Tac-Toe)
                </span>
                {showMiniGame ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showMiniGame && (
                <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <TicTacToe />
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function TicTacToe() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);

  const calculateWinner = (squares) => {
    const lines = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return squares[a];
    }
    return null;
  };

  const winner = calculateWinner(board);
  const isDraw = !winner && board.every(s => s !== null);

  const handleClick = (i) => {
    if (board[i] || winner) return;
    const newBoard = [...board];
    newBoard[i] = xIsNext ? 'X' : 'O';
    setBoard(newBoard);
    setXIsNext(!xIsNext);
  };

  const reset = () => { setBoard(Array(9).fill(null)); setXIsNext(true); };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 w-48 mx-auto mb-3">
        {board.map((cell, i) => (
          <button 
            key={i} 
            onClick={() => handleClick(i)}
            className="w-14 h-14 bg-white border border-slate-200 rounded-lg text-xl font-bold text-slate-700 flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            {cell}
          </button>
        ))}
      </div>
      <div className="h-5 font-medium text-xs text-slate-600 mb-1">
        {winner ? `Winner: ${winner}` : isDraw ? "It's a Draw!" : `Next player: ${xIsNext ? 'X' : 'O'}`}
      </div>
      {(winner || isDraw) && (
        <button onClick={reset} className="text-xs text-blue-600 font-semibold hover:underline">Play Again</button>
      )}
    </div>
  );
}

function TodoList({ user, allTasksList, completions, onComplete, db, appId, showToast, highlightTaskId }) {
  const [showAdd, setShowAdd] = useState(false);
  const [attachTaskId, setAttachTaskId] = useState(null);
  const [submission, setSubmission] = useState({});
  const [newTask, setNewTask] = useState({ title: '', description: '', deadline: '' });

  useEffect(() => {
    if (highlightTaskId) {
      const element = document.getElementById(`task-${highlightTaskId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-blue-500');
        setTimeout(() => element.classList.remove('ring-2', 'ring-blue-500'), 3000);
      }
    }
  }, [highlightTaskId]);

  const myTasks = allTasksList.filter(t => t.type === 'global' || t.ownerId === user.id);
  const myCompletions = completions.filter(c => c.userId === user.id);
  
  const tasksWithState = myTasks.map(task => {
    const comp = myCompletions.find(c => c.taskId === task.id);
    return { ...task, isCompleted: !!comp, completedAt: comp?.completedAt };
  }).sort((a, b) => {
    if (a.isCompleted && !b.isCompleted) return 1;
    if (!a.isCompleted && b.isCompleted) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title || !newTask.deadline) return;
    
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tasks'), {
      ...newTask,
      type: 'personal',
      ownerId: user.id,
      createdAt: new Date().toISOString()
    });
    
    setNewTask({ title: '', description: '', deadline: '' });
    setShowAdd(false);
    showToast("Personal task added!");
  };

  const handleStudentSubmit = async (task, subType, dataVal) => {
    try {
      const now = new Date();
      const deadlineDate = new Date(task.deadline);
      const diffTime = deadlineDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let expAwarded = 0;
      if (diffDays >= 7) expAwarded = 20;
      else if (diffDays >= 3) expAwarded = 15;
      else if (diffDays >= 0) expAwarded = 5;
      else expAwarded = 2;

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'completions'), {
        userId: user.id,
        taskId: task.id,
        submissionType: subType,
        submissionData: dataVal,
        submissionUrl: submission.url || '',
        expAwarded,
        completedAt: new Date().toISOString()
      });

      onComplete(expAwarded);
      setAttachTaskId(null);
      setSubmission({});
      showToast?.("Assignment submitted successfully!");
    } catch (err) {
      console.error(err);
      showToast?.("Failed to submit assignment.");
    }
  };

  const clearCompletedTasks = async () => {
    const completedPersonalTasks = myTasks.filter(task => task.type === 'personal' && myCompletions.some(completion => completion.taskId === task.id));
    if (!completedPersonalTasks.length) {
      showToast?.('No completed personal tasks to clear.');
      return;
    }
    await Promise.all(completedPersonalTasks.map(task => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', task.id))));
    showToast?.(`${completedPersonalTasks.length} completed ${completedPersonalTasks.length === 1 ? 'task' : 'tasks'} cleared.`);
  };

  const completeTask = async (task) => {
    if (task.isCompleted) return;
    const diffDays = Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24));
    const expAwarded = diffDays >= 7 ? 20 : diffDays >= 3 ? 15 : diffDays >= 0 ? 5 : 2;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'completions'), {
      userId: user.id,
      taskId: task.id,
      expAwarded,
      completedAt: new Date().toISOString()
    });
    onComplete(expAwarded);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">To-Do List</h1>
          <p className="text-slate-500 mt-1">Complete tasks early to earn more EXP!</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={clearCompletedTasks}
            className="px-4 py-2 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition-colors text-sm"
          >
            Clear Completed
          </button>
          <button 
            onClick={() => setShowAdd(!showAdd)}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            {showAdd ? 'Cancel' : <><Plus size={18} /> Add Personal Task</>}
          </button>
        </div>
      </div>

      {showAdd && (
        <Card className="bg-indigo-50 border-indigo-100">
          <form onSubmit={handleAddTask} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Task Title</label>
                <input required type="text" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="w-full px-3 py-2 rounded-md border border-slate-300" placeholder="e.g., Read chapter 4" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Deadline</label>
                <input required type="date" value={newTask.deadline} onChange={e => setNewTask({...newTask, deadline: e.target.value})} className="w-full px-3 py-2 rounded-md border border-slate-300" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
              <textarea value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} className="w-full px-3 py-2 rounded-md border border-slate-300 h-20 resize-none" />
            </div>
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-indigo-700">Save Task</button>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {tasksWithState.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-xl border border-slate-200 border-dashed">
            <CheckSquare size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">No tasks found. You're all caught up!</p>
          </div>
        ) : (
          tasksWithState.map(task => {
            const diffDays = Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24));
            let badgeColor = 'bg-slate-100 text-slate-600';
            let expHint = '';
            
            if (!task.isCompleted) {
              if (diffDays < 0) { badgeColor = 'bg-red-100 text-red-700'; expHint = '+2 EXP'; }
              else if (diffDays <= 3) { badgeColor = 'bg-orange-100 text-orange-700'; expHint = '+5 EXP'; }
              else if (diffDays <= 7) { badgeColor = 'bg-yellow-100 text-yellow-700'; expHint = '+15 EXP'; }
              else { badgeColor = 'bg-green-100 text-green-700'; expHint = '+20 EXP'; }
            }

            return (
              <Card key={task.id} id={`task-${task.id}`} className={`p-4 transition-all ${task.isCompleted ? 'opacity-60 bg-slate-50' : 'hover:shadow-md'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {task.type === 'global' && <span className="inline-block mb-1 text-[10px] uppercase font-bold tracking-wider bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Assigned</span>}
                    <h3 className={`font-bold ${task.isCompleted ? 'line-through text-slate-500' : 'text-slate-800'}`}>{task.course ? `${task.title} - ${task.course}` : task.title}</h3>
                  </div>
                  {task.type === 'global' && attachTaskId === task.id && (
                    <button onClick={() => setAttachTaskId(null)} className="shrink-0 text-xs text-slate-400 hover:text-slate-600 font-semibold">Close</button>
                  )}
                </div>
                {task.type === 'global' && attachTaskId === task.id ? (
                  <div className="space-y-3 mt-4">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Submit Assignment</p>
                    <div className="grid grid-cols-3 gap-3">
                      <label className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all">
                        <FileText className="text-blue-600" size={24} />
                        <span className="text-xs font-semibold text-slate-700">File (Word/PDF)</span>
                        <input type="file" accept=".doc,.docx,.pdf" className="hidden" onChange={e => setSubmission({ ...submission, file: e.target.files?.[0], image: null })} />
                      </label>
                      <label className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all">
                        <Image className="text-green-600" size={24} />
                        <span className="text-xs font-semibold text-slate-700">Image</span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => setSubmission({ ...submission, file: null, image: e.target.files?.[0] })} />
                      </label>
                      <label className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col items-center justify-center gap-2">
                        <LinkIcon className="text-purple-600" size={24} />
                        <span className="text-xs font-semibold text-slate-700">Link URL</span>
                        <input type="url" value={submission.url || ''} onChange={e => setSubmission({ ...submission, url: e.target.value, file: null, image: null })} placeholder="https://..." className="w-full rounded border border-slate-200 px-2 py-1 text-xs" />
                      </label>
                    </div>
                    {(submission.file || submission.image || submission.url) && (
                      <p className="text-xs text-slate-500">Selected: {submission.file?.name || submission.image?.name || submission.url}</p>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        let dataVal = submission.url;
                        let subType = 'url';
                        const file = submission.file || submission.image;
                        if (file) {
                          if (file.size > 700 * 1024) {
                            showToast?.('Maximum attachment size is 700 KB.');
                            return;
                          }
                          dataVal = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.onerror = () => reject(new Error('Failed to read file.'));
                            reader.readAsDataURL(file);
                          });
                          subType = submission.file ? 'file' : 'image';
                        }
                        if (!dataVal && !submission.url) {
                          showToast?.('Select a file or image, or enter a URL.');
                          return;
                        }
                        await handleStudentSubmit(task, subType, dataVal);
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-sm"
                    >
                      Submit Assignment
                    </button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <div>
                      {task.description && <p className="text-sm text-slate-500 mb-3">{task.description}</p>}
                      {task.attachment?.data && (
                        <a href={task.attachment.data} download={task.attachment.name} className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline">
                          <Paperclip size={15} /> {task.attachment.name || 'Download attachment'}
                        </a>
                      )}
                      {task.resourceUrl && (
                        <a href={task.resourceUrl} target="_blank" rel="noreferrer" className="mb-3 flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline break-all">
                          <LinkIcon size={15} /> Open resource link
                        </a>
                      )}
                      
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 text-sm font-medium">
                          <span className={`flex items-center gap-1 px-2 py-1 rounded-md ${task.isCompleted ? 'bg-slate-200 text-slate-500' : badgeColor}`}>
                            <Clock size={14} />
                            {task.isCompleted ? 'Completed' : `Due: ${new Date(task.deadline).toLocaleDateString('en-GB')}`}
                          </span>
                          {!task.isCompleted && (
                            <span className="text-blue-600 flex items-center gap-1">
                              <Award size={14} /> {expHint}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-center shrink-0">
                          {task.type === 'personal' ? (
                            <button onClick={() => completeTask(task)} disabled={task.isCompleted} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 disabled:opacity-50">
                              <CheckSquare size={14} /> Done
                            </button>
                          ) : (
                            <button onClick={() => setAttachTaskId(attachTaskId === task.id ? null : task.id)} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1">
                              <Paperclip size={14} /> Attach
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>
    </div>
  );
}

function Leaderboard({ users, currentUser }) {
  const students = users.filter(u => u.role === 'student').sort((a, b) => b.exp - a.exp);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 flex justify-center items-center gap-3">
          <Trophy className="text-yellow-500" size={32} /> Global Leaderboard
        </h1>
        <p className="text-slate-500 mt-2">See how you stack up against other learners.</p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 grid grid-cols-12 gap-4 text-sm font-semibold text-slate-500 uppercase tracking-wider">
          <div className="col-span-2 text-center">Rank</div>
          <div className="col-span-6">Student</div>
          <div className="col-span-2 text-center">Level</div>
          <div className="col-span-2 text-center">Total EXP</div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {students.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No students found yet.</div>
          ) : (
            students.map((student, index) => {
              const rank = index + 1;
              const isMe = currentUser?.id === student.id;
              
              let rankStyle = "text-slate-500 font-medium";
              if (rank === 1) rankStyle = "text-yellow-500 font-black text-lg";
              else if (rank === 2) rankStyle = "text-slate-400 font-bold text-lg";
              else if (rank === 3) rankStyle = "text-amber-600 font-bold text-lg";

              const badges = getUnlockedBadges(getLevel(student.exp));
              const topBadge = badges[badges.length - 1];

              return (
                <div key={student.id} className={`px-6 py-4 grid grid-cols-12 gap-4 items-center transition-colors hover:bg-slate-50 ${getLevel(student.exp) >= 100 ? 'bg-red-100' : getLevel(student.exp) >= 10 ? 'bg-rose-100' : isMe ? 'bg-blue-50' : ''}`}>
                  <div className={`col-span-2 text-center ${rankStyle}`}>
                    #{rank}
                  </div>
                  <div className="col-span-6 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${isMe ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className={`font-bold ${isMe ? 'text-indigo-900' : 'text-slate-800'}`}>
                        {student.name} {isMe && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">You</span>}
                      </p>
                      {topBadge && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <span>{topBadge.icon}</span> {topBadge.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 text-center">
                    <div className="inline-block px-3 py-1 bg-slate-100 rounded-full font-bold text-slate-700 text-sm">
                      {getLevel(student.exp)}
                    </div>
                  </div>
                  <div className="col-span-2 text-center font-bold text-blue-600">
                    {student.exp}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}