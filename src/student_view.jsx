import React, { useState, useEffect } from 'react';
import { Clock, Bell, Trophy, BookOpen, Play, CheckSquare, Settings, Award, Square, Gamepad2, Plus, Paperclip, Link as LinkIcon, FileText, Image, Upload, X } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';

const LEVEL_NAMES = [
  'EXP Trainee',
  'Focus Adventurer',
  'Task Hunter',
  'Time Weaver',
  'Deadline Knight',
  'Productivity Mage',
  'Wisdom Conqueror',
  'Master Strategist',
  'EXP Overlord',
  'Supreme Archmage of AdaptLearn',
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
const getBadgeName = (level) => level >= 100 ? 'Demon King' : LEVEL_NAMES[Math.min(level - 1, 9)];
const getUnlockedBadges = (level) => Array.from({ length: level }, (_, index) => ({ level: index + 1, name: getBadgeName(index + 1), icon: index + 1 >= 100 ? '👹' : '🏅', color: 'bg-blue-100 text-blue-800' }));
const getNextBadge = (level) => level >= 100 ? null : { level: level + 1, name: getBadgeName(level + 1) };

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-6 ${className}`}>
    {children}
  </div>
);

export function StudentView({ user, allTasks, completions, currentView, setCurrentView, nextDeadlineId, onAwardExp, db, appId, showToast, users }) {
  return (
    <>
      {currentView === 'dashboard' && <StudentDashboard user={user} allTasks={allTasks} completions={completions} nextDeadlineId={nextDeadlineId} setCurrentView={setCurrentView} />}
      {currentView === 'study' && <StudyCare onAwardExp={onAwardExp} />}
      {currentView === 'todo' && <TodoList user={user} allTasksList={allTasks} completions={completions} onComplete={(exp) => onAwardExp(exp, 'Task Completed')} db={db} appId={appId} showToast={showToast} highlightTaskId={nextDeadlineId} />}
      {currentView === 'leaderboard' && <Leaderboard users={users} currentUser={user} />}
      {currentView === 'settings' && <StudentSettings user={user} db={db} appId={appId} showToast={showToast} />}
    </>
  );
}

function StudentDashboard({ user, allTasks, completions, nextDeadlineId, setCurrentView }) {
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
              onClick={() => {
                setCurrentView('todo');
                // The TodoList will handle auto-scrolling to the task based on nextDeadlineId
              }}
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
      </Card>
    </div>
  );
}

function StudyCare({ onAwardExp }) {
  const [minutes, setMinutes] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('setup');

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (isActive && timeLeft === 0) {
      setIsActive(false);
      handleSessionComplete();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const startTimer = () => {
    setTimeLeft(minutes * 60);
    setIsActive(true);
    setMode('study');
  };

  const stopTimer = () => setIsActive(false);
  
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(minutes * 60);
    setMode('setup');
  };

  const handleSessionComplete = () => {
    onAwardExp(minutes, `Completed ${minutes}m study session`);
    setMode('break');
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Study Care</h1>
        <p className="text-slate-500 mt-2">Focus on your tasks and earn EXP for every minute studied.</p>
      </div>

      {mode !== 'break' && (
        <Card className="text-center py-12">
          {mode === 'setup' ? (
            <div className="space-y-6">
              <div className="w-24 h-24 mx-auto bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                <Clock size={40} className="text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Set Target Time</h2>
              <div className="flex items-center justify-center gap-4">
                {[15, 25, 30, 45, 60].map(m => (
                  <button
                    key={m}
                    onClick={() => setMinutes(m)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${minutes === m ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <button onClick={startTimer} className="mt-8 px-8 py-3 bg-blue-600 text-white font-bold rounded-full hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all flex items-center gap-2 mx-auto">
                <Play size={20} fill="currentColor" />
                Start Focus Session
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="relative w-64 h-64 mx-auto">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                  <circle cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="8" fill="transparent" 
                    strokeDasharray={2 * Math.PI * 120}
                    strokeDashoffset={(2 * Math.PI * 120) * (1 - timeLeft / (minutes * 60))}
                    className="text-blue-600 transition-all duration-1000 ease-linear" 
                  />
                </svg>
                <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
                  <span className="text-5xl font-bold text-slate-800 tracking-tighter">{formatTime(timeLeft)}</span>
                  <span className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-medium">Remaining</span>
                </div>
              </div>
              
              <div className="flex justify-center gap-4">
                {isActive ? (
                  <button onClick={stopTimer} className="px-6 py-3 bg-amber-100 text-amber-700 font-bold rounded-xl hover:bg-amber-200 transition-colors flex items-center gap-2">
                    <Square size={18} fill="currentColor" /> Pause
                  </button>
                ) : (
                  <button onClick={() => setIsActive(true)} className="px-6 py-3 bg-blue-100 text-blue-700 font-bold rounded-xl hover:bg-indigo-200 transition-colors flex items-center gap-2">
                    <Play size={18} fill="currentColor" /> Resume
                  </button>
                )}
                <button onClick={resetTimer} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {mode === 'break' && (
        <Card className="text-center p-8 bg-white border-blue-100">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-100 text-teal-600 rounded-full mb-4">
            <Gamepad2 size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Great Job! Time for a Break.</h2>
          <p className="text-slate-600 mb-8">You earned {minutes} EXP. Rest your mind before the next session.</p>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 max-w-sm mx-auto mb-8">
            <h3 className="font-bold text-slate-700 mb-4">Mini-Game: Tic-Tac-Toe</h3>
            <TicTacToe />
          </div>

          <button onClick={resetTimer} className="px-8 py-3 bg-teal-600 text-white font-bold rounded-full hover:bg-teal-700 transition-colors">
            End Break & Return
          </button>
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
      <div className="grid grid-cols-3 gap-2 w-48 mx-auto mb-4">
        {board.map((cell, i) => (
          <button 
            key={i} 
            onClick={() => handleClick(i)}
            className="w-14 h-14 bg-slate-50 border-2 border-slate-200 rounded-lg text-2xl font-bold text-slate-700 flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            {cell}
          </button>
        ))}
      </div>
      <div className="h-6 font-medium text-sm text-slate-600 mb-2">
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

  // Auto-scroll to highlighted task
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
          <div className="col-span-2 text-right">Total EXP</div>
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
                <div key={student.id} className={`px-6 py-4 grid grid-cols-12 gap-4 items-center transition-colors hover:bg-slate-50 ${isMe ? 'bg-blue-50 text-blue-900' : ''}`}>
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
                  <div className="col-span-2 text-right font-bold text-blue-600">
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

function StudentSettings({ user, db, appId, showToast }) {
  const [notifs, setNotifs] = useState(user.emailNotifsEnabled || false);

  const toggleNotifs = async () => {
    const newVal = !notifs;
    setNotifs(newVal);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.id), {
      emailNotifsEnabled: newVal
    });
    showToast(newVal ? "Notifications enabled" : "Notifications disabled");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Settings</h1>
      
      <Card>
        <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-4">Notifications & Privacy</h3>
        
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="font-semibold text-slate-800">Email Notifications for Deadlines</p>
            <p className="text-sm text-slate-500 mt-1">Receive simulated Outlook emails at H-3 and H-1 before task deadlines.</p>
          </div>
          <button 
            onClick={toggleNotifs}
            className={`w-12 h-6 rounded-full transition-colors relative ${notifs ? 'bg-blue-600' : 'bg-slate-300'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${notifs ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </Card>
    </div>
  );
}