import React, { useState, useEffect } from 'react';
import { Clock, Bell, Trophy, Play, CheckSquare, Award, Square, Gamepad2, Plus, Minus, Paperclip, Link as LinkIcon, FileText, Image, X, Calendar, TrendingUp, Flame, Swords, Target, Sparkles, CheckCircle2, Coffee, RotateCcw, SkipForward, Sliders, ChevronDown, ChevronUp } from 'lucide-react';
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
      {currentView === 'dashboard' && <StudentDashboard user={user} allTasks={allTasks} completions={completions} studySessions={studySessions} setCurrentView={setCurrentView} onSeeAllBadges={() => setShowAllBadges(true)} />}
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

function StudentDashboard({ user, allTasks, completions, studySessions, setCurrentView, onSeeAllBadges }) {
  const { level, progress, requiredExp } = getLevelProgress(user.exp);
  const badges = getUnlockedBadges(level);
  const nextBadge = getNextBadge(level);
  
  const myTasks = allTasks.filter(t => t.type === 'global' || t.ownerId === user.id);
  const completedTaskIds = completions.filter(c => c.userId === user.id).map(c => c.taskId);
  const pendingTasks = myTasks.filter(t => !completedTaskIds.includes(t.id)).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const nextDeadline = pendingTasks.length > 0 ? pendingTasks[0] : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Welcome back, {user.name}!</h1>
        <p className="text-slate-500 mt-1">Ready to earn some EXP today?</p>
      </div>

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

      <WeeklySummaryCard user={user} completions={completions} studySessions={studySessions} />

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
          <p className="text-slate-500 mt-1">Maintain your study streak, complete quests, and defeat the Class Boss together!</p>
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

  const [phase, setPhase] = useState('setup'); // 'setup' | 'focus' | 'shortBreak' | 'longBreak'
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
      // Abaikan jika browser memblokir autoplay audio
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
    { label: 'Classic', desc: '25 / 5 / 15m', f: 25, s: 5, l: 15, c: 4 },
    { label: 'Deep Work', desc: '50 / 10 / 20m', f: 50, s: 10, l: 20, c: 3 },
    { label: 'Quick', desc: '15 / 3 / 10m', f: 15, s: 3, l: 10, c: 4 },
  ];

  const settingFields = [
    {
      label: 'Focus',
      sub: `+${focusMins || 1} EXP / round`,
      dot: 'bg-blue-600',
      val: focusMins,
      set: setFocusMins,
      min: 1,
      max: 180,
      step: 5,
    },
    {
      label: 'Short Break',
      sub: 'Between rounds',
      dot: 'bg-teal-500',
      val: shortBreakMins,
      set: setShortBreakMins,
      min: 1,
      max: 60,
      step: 1,
    },
    {
      label: 'Long Break',
      sub: 'After full cycle',
      dot: 'bg-indigo-500',
      val: longBreakMins,
      set: setLongBreakMins,
      min: 1,
      max: 90,
      step: 5,
    },
    {
      label: 'Rounds',
      sub: 'Per full cycle',
      dot: 'bg-amber-500',
      val: cyclesBeforeLongBreak,
      set: setCyclesBeforeLongBreak,
      min: 1,
      max: 10,
      step: 1,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
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
          {/* Baris atas: Label & Quick Presets */}
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
                      isSelected
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid 4 Kartu Pengaturan Rapi dengan Tombol - / + */}
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

          {/* Ringkasan Siklus & Tombol Start */}
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
          {/* Status Fase & Indikator Siklus */}
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

            {/* Cycle Progress Pills */}
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

          {/* Circular Timer */}
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

          {/* Action Buttons */}
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

          {/* Collapsible Mini-Game saat Break */}
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
      showToast?.("Tugas berhasil dikumpulkan!");
    } catch (err) {
      console.error(err);
      showToast?.("Gagal mengumpulkan tugas.");
    }
  };

  const clearCompletedTasks = async () => {
    const completedPersonalTasks = myTasks.filter(task => task.type === 'personal' && myCompletions.some(completion => completion.taskId === task.id));
    if (!completedPersonalTasks.length) {
      showToast?.('Tidak ada tugas personal selesai untuk dihapus.');
      return;
    }
    await Promise.all(completedPersonalTasks.map(task => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', task.id))));
    showToast?.(`${completedPersonalTasks.length} tugas selesai dihapus.`);
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
                        <span className="text-xs font-semibold text-slate-700">Gambar</span>
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