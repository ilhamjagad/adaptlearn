import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from "firebase/auth";
import { getFirestore, collection, onSnapshot, doc, updateDoc, setDoc, getDoc, query, where, getDocs, addDoc } from "firebase/firestore";
import { calculateBurnoutRisk } from './burnout';
import { Clock, CheckSquare, Settings, Users, Trophy, LayoutDashboard, LogOut, Menu, X, UserRound, BookOpen, Zap } from 'lucide-react';
import { LoginView } from './login_view';
import { StudentView } from './student_view';
import { LecturerView } from './lecturer_view';
import uinLogo from './assets/uin_logo.jpg';

const firebaseConfig = {
  apiKey: "AIzaSyB_Xleytls38tXj0TbP4X8dcoILUf4UlVk",
  authDomain: "adaptlearn-6e64d.firebaseapp.com",
  projectId: "adaptlearn-6e64d",
  storageBucket: "adaptlearn-6e64d.firebasestorage.app",
  messagingSenderId: "418096353728",
  appId: "1:418096353728:web:5f5ac4d5f2f310e44d7825",
  measurementId: "G-ZWWY874739"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = firebaseConfig.appId;
const getLevel = (exp) => {
  let level = 1;
  let remainingExp = Math.max(0, exp);
  while (level < 100) {
    const requiredExp = level <= 3 ? 300 : level <= 6 ? 600 : level <= 8 ? 800 : level <= 10 ? 1000 : 2000;
    if (remainingExp < requiredExp) break;
    remainingExp -= requiredExp;
    level += 1;
  }
  return level;
};

export default function AdaptLearn() {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [studySessions, setStudySessions] = useState([]);
  const [studyBreakLocked, setStudyBreakLocked] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [toast, setToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const completedTaskIds = completions.filter(completion => completion.userId === dbUser?.id).map(completion => completion.taskId);
  const nextDeadline = tasks
    .filter(task => (task.type === 'global' || task.ownerId === dbUser?.id) && !completedTaskIds.includes(task.id))
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0] || null;

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      if (!authUser) {
        setDbUser(null);
        setAllUsers([]);
        setTasks([]);
        setCompletions([]);
        setStudySessions([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const tasksRef = collection(db, 'artifacts', appId, 'public', 'data', 'tasks');
    const completionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'completions');
    const studySessionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'studySessions');

    const unsubUsers = onSnapshot(usersRef, (snap) => {
      const uData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllUsers(uData);
      const currentUser = uData.find(u => u.id === user.uid);
      setDbUser(currentUser || null);
      setLoading(false);
    }, (err) => console.error("Error fetching users:", err));

    const unsubTasks = onSnapshot(tasksRef, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Error fetching tasks:", err));

    const unsubCompletions = onSnapshot(completionsRef, (snap) => {
      setCompletions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Error fetching completions:", err));

    const unsubStudySessions = onSnapshot(studySessionsRef, (snap) => {
      setStudySessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Error fetching study sessions:", err));

    return () => {
      unsubUsers();
      unsubTasks();
      unsubCompletions();
      unsubStudySessions();
    };
  }, [user]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = async (identifier, password, role) => {
    // Special lecturer credentials
    if (role === 'lecturer' && identifier === 'dosen@uinjkt.ac.id' && password === 'dosen123') {
      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
      const q = query(usersRef, where('email', '==', 'dosen@uinjkt.ac.id'), where('role', '==', 'lecturer'));
      const snap = await getDocs(q);
      
      let credential;
      if (snap.empty) {
        // Create lecturer account if not exists
        credential = await createUserWithEmailAndPassword(auth, 'dosen@uinjkt.ac.id', 'dosen123');
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', credential.user.uid), {
          name: 'Viva Arifin, MMSI',
          email: 'dosen@uinjkt.ac.id',
          role: 'lecturer',
          exp: 0,
          emailNotifsEnabled: false,
          createdAt: new Date().toISOString()
        });
      } else {
        credential = await signInWithEmailAndPassword(auth, 'dosen@uinjkt.ac.id', 'dosen123');
      }
      const lecturerProfileRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', credential.user.uid);
      const profileSnap = await getDoc(lecturerProfileRef);
      if (!profileSnap.exists() || profileSnap.data().role !== 'lecturer') {
        await signOut(auth);
        throw new Error('Akun dosen tidak valid.');
      }
      if (profileSnap.data().name !== 'Viva Arifin, MMSI') {
        await updateDoc(lecturerProfileRef, { name: 'Viva Arifin, MMSI' });
      }
      return;
    }

    let email = identifier.trim();
    if (role === 'student' && !email.includes('@')) {
      // Assume it's a NIM
      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
      const q = query(usersRef, where('nim', '==', email), where('role', '==', 'student'));
      const snap = await getDocs(q);
      if (snap.empty) throw new Error('Student ID (NIM) or email is not registered.');
      email = snap.docs[0].data().email;
    }
    const credential = await signInWithEmailAndPassword(auth, email, password);
    if (role === 'student' && !credential.user.emailVerified) {
      await signOut(auth);
      throw new Error('Please verify your email before signing in. Check your inbox for the verification link.');
    }
    const profileSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', credential.user.uid));
    if (!profileSnap.exists() || profileSnap.data().role !== role) {
      await signOut(auth);
      throw new Error('Akun tidak terdaftar untuk peran ini.');
    }
  };

  const handleForgotPassword = async (identifier) => {
    let email = identifier.trim();
    if (!email.includes('@')) {
      const snap = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('nim', '==', email), where('role', '==', 'student')));
      if (snap.empty) throw new Error('Student ID (NIM) or email is not registered.');
      email = snap.docs[0].data().email;
    }
    await sendPasswordResetEmail(auth, email);
  };

  const handleRegister = async (email, password, name, role, nim) => {
    if (role !== 'student') throw new Error('Self-registration is only available for students.');
    const nimQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('nim', '==', nim), where('role', '==', 'student'));
    const nimSnapshot = await getDocs(nimQuery);
    if (!nimSnapshot.empty) throw new Error('This Student ID (NIM) is already registered.');
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(credential.user);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', credential.user.uid), {
      name,
      email,
      nim,
      role,
      exp: 0,
      emailNotifsEnabled: false,
      createdAt: new Date().toISOString(),
      emailVerified: false
    });
    await signOut(auth);
    throw new Error('Verification email sent. Please verify your email before signing in.');
  };

  const addStudySession = async (session) => {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'studySessions'), session);
  };

  const addExp = async (amount, reason) => {
    if (!user || !dbUser || dbUser.role !== 'student') return;
    const newExp = dbUser.exp + amount;
    const oldLevel = getLevel(dbUser.exp);
    const newLevel = getLevel(newExp);
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
      exp: newExp
    });
    
    let msg = `+${amount} EXP: ${reason}`;
    if (newLevel > oldLevel) {
      msg += ` 🎉 Level Up to ${newLevel}!`;
    }
    showToast(msg);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setDbUser(null);
      setCurrentView('dashboard');
      showToast("Logged out successfully");
    } catch (error) {
      console.error("Gagal logout:", error);
      showToast("Gagal melakukan logout");
    }
  };

  if (!app) return <div className="p-8 text-center text-red-500">Firebase not configured.</div>;
  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  if (!user) {
    return <LoginView onLogin={handleLogin} onRegister={handleRegister} onForgotPassword={handleForgotPassword} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in-down">
          {toast}
        </div>
      )}

      {sidebarOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/20 md:bg-black/10" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 md:static md:shrink-0 md:transition-[margin] ${sidebarOpen ? 'translate-x-0 md:ml-0' : '-translate-x-full md:-ml-64'}`}>
        <div className="p-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={uinLogo} alt="UIN Logo" className="w-10 h-10 object-contain" />
            <h1 className="text-xl font-bold text-blue-600">AdaptLearn</h1>
          </div>
          <button aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="text-slate-500 hover:text-slate-800 p-1 md:hidden">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2">
          {dbUser?.role === 'student' ? (
            <>
              <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" isActive={currentView === 'dashboard'} onClick={() => { setCurrentView('dashboard'); setSidebarOpen(false); }} />
              <NavItem icon={<Clock size={20} />} label={studyBreakLocked ? 'Study Care (Break)' : 'Study Care'} isActive={currentView === 'study'} onClick={() => { setCurrentView('study'); setSidebarOpen(false); }} />
              <NavItem icon={<CheckSquare size={20} />} label="To-Do List" isActive={currentView === 'todo'} onClick={() => { setCurrentView('todo'); setSidebarOpen(false); }} />
              <NavItem icon={<BookOpen size={20} />} label="Courses" isActive={currentView === 'courses'} onClick={() => { setCurrentView('courses'); setSidebarOpen(false); }} />
              <NavItem icon={<Zap size={20} />} label="Energy" isActive={currentView === 'energy'} onClick={() => { setCurrentView('energy'); setSidebarOpen(false); }} />
              <NavItem icon={<Trophy size={20} />} label="Leaderboard" isActive={currentView === 'leaderboard'} onClick={() => { setCurrentView('leaderboard'); setSidebarOpen(false); }} />
              <NavItem icon={<Settings size={20} />} label="Settings" isActive={currentView === 'settings'} onClick={() => { setCurrentView('settings'); setSidebarOpen(false); }} />
            </>
          ) : (
            <>
              <NavItem icon={<LayoutDashboard size={20} />} label="Overview" isActive={currentView === 'dashboard'} onClick={() => { setCurrentView('dashboard'); setSidebarOpen(false); }} />
              <NavItem icon={<CheckSquare size={20} />} label="Task Management" isActive={currentView === 'tasks'} onClick={() => { setCurrentView('tasks'); setSidebarOpen(false); }} />
              <NavItem icon={<Users size={20} />} label="Student Progress" isActive={currentView === 'progress'} onClick={() => { setCurrentView('progress'); setSidebarOpen(false); }} />
              <NavItem icon={<Trophy size={20} />} label="Leaderboard" isActive={currentView === 'leaderboard'} onClick={() => { setCurrentView('leaderboard'); setSidebarOpen(false); }} />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 text-blue-700 flex items-center justify-center font-bold uppercase">
              {dbUser?.name?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="font-semibold text-sm truncate">{dbUser?.name}</p>
              <p className="text-xs text-slate-500 capitalize">{dbUser?.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium text-sm"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="bg-blue-700 border-b border-blue-800 p-4 flex justify-between items-center text-white">
          <button aria-label="Toggle navigation" onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white hover:text-blue-100 p-1">
            <Menu size={22} />
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <UserRound size={18} className="text-blue-100" />
              <span>{dbUser?.name}</span>
            </div>
            <button onClick={handleLogout} className="text-blue-100 hover:text-white p-1">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {dbUser?.role === 'student' && (
            <StudentView 
              user={dbUser} 
              allTasks={tasks} 
              completions={completions} 
              studySessions={studySessions}
              onStudySessionComplete={addStudySession}
              onBreakLockChange={setStudyBreakLocked}
              currentView={currentView} 
              setCurrentView={setCurrentView}
              nextDeadlineId={nextDeadline?.id}
              onAwardExp={addExp} 
              db={db} 
              appId={appId} 
              showToast={showToast} 
              users={allUsers}
              burnout={calculateBurnoutRisk(dbUser, tasks, completions, studySessions)}
            />
          )}
          
          {dbUser?.role === 'lecturer' && (
            <LecturerView 
              user={dbUser} 
              tasks={tasks} 
              completions={completions} 
              studySessions={studySessions}
              currentView={currentView} 
              db={db} 
              appId={appId} 
              showToast={showToast} 
              users={allUsers}
            />
          )}
        </div>
      </main>
    </div>
  );
}

const NavItem = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left font-medium ${
      isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);