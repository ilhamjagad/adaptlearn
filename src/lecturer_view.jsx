import React, { useState } from 'react';
import { Clock, CheckSquare, Users, Plus, Trophy, Edit2, Trash2, Save, X, Paperclip, Link as LinkIcon } from 'lucide-react';
import { doc, deleteDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import emailjs from '@emailjs/browser';

import { calculateBurnoutRisk as burnoutRiskUtil } from './burnout';

const emailJsConfig = {
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID,
  templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-6 ${className}`}>
    {children}
  </div>
);

export function LecturerView({ user, tasks, completions, studySessions, currentView, db, appId, showToast, users }) {
  return (
    <>
      {currentView === 'dashboard' && <LecturerDashboard users={users} tasks={tasks} completions={completions} studySessions={studySessions} />}
      {currentView === 'tasks' && <TaskManagement db={db} appId={appId} tasks={tasks} lecturerId={user.id} showToast={showToast} students={users.filter(u => u.role === 'student' && u.email)} />}
      {currentView === 'progress' && <StudentProgress users={users} tasks={tasks} completions={completions} db={db} appId={appId} showToast={showToast} />}
      {currentView === 'leaderboard' && <Leaderboard users={users} currentUser={user} />}
    </>
  );
}

function calculateBurnoutRisk(user, tasks, completions, studySessions) {
  const now = Date.now();
  const userCompletions = completions.filter(completion => completion.userId === user.id && completion.completedAt);
  const assignedTasks = tasks.filter(task => task.type === 'global' || task.ownerId === user.id);
  const overdueCount = assignedTasks.filter(task => !userCompletions.some(completion => completion.taskId === task.id) && new Date(task.deadline).getTime() < now).length;
  const dueSoonOrLateCount = userCompletions.filter(completion => {
    const task = assignedTasks.find(item => item.id === completion.taskId);
    if (!task) return false;
    const deadline = new Date(task.deadline).getTime();
    return deadline - new Date(completion.completedAt).getTime() <= 24 * 60 * 60 * 1000;
  }).length + overdueCount;
  const procrastinationRate = assignedTasks.length ? dueSoonOrLateCount / assignedTasks.length : 0;
  const procrastination = procrastinationRate > 0.6 ? 100 : 0;

  const recentSessions = studySessions.filter(session => session.userId === user.id && session.completedAt && now - new Date(session.completedAt).getTime() <= 7 * 24 * 60 * 60 * 1000);
  const dailyStudyMinutes = new Map();
  let lateNightSessions = 0;
  recentSessions.forEach(session => {
    const date = new Date(session.completedAt);
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
    dailyStudyMinutes.set(day, (dailyStudyMinutes.get(day) || 0) + Number(session.durationMinutes || 0));
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', hourCycle: 'h23' }).format(date));
    const minute = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', minute: '2-digit' }).format(date));
    if (hour < 4 || (hour === 4 && minute <= 30)) lateNightSessions += 1;
  });
  const studyIntensity = [...dailyStudyMinutes.values()].some(minutes => minutes > 300) ? 100 : 0;
  const lateNightRate = recentSessions.length ? lateNightSessions / recentSessions.length : 0;
  const lateNight = lateNightRate >= 0.5 ? 100 : lateNightRate > 0 ? 50 : 0;

  const currentWeekStart = now - 7 * 24 * 60 * 60 * 1000;
  const previousWeekStart = now - 14 * 24 * 60 * 60 * 1000;
  const currentWeekCount = userCompletions.filter(c => new Date(c.completedAt).getTime() >= currentWeekStart).length;
  const previousWeekCount = userCompletions.filter(c => {
    const timestamp = new Date(c.completedAt).getTime();
    return timestamp >= previousWeekStart && timestamp < currentWeekStart;
  }).length;
  const activityDrop = previousWeekCount > 0 && currentWeekCount < previousWeekCount * 0.5 ? 20 : 0;
  const score = Math.min(100, Math.round(procrastination * 0.35 + studyIntensity * 0.35 + lateNight * 0.3 + activityDrop));
  const triggers = [
    ...(procrastination ? ['Over 60% of assignments completed close to or after their deadlines'] : []),
    ...(studyIntensity ? ['Study Care exceeded 5 hours in one day'] : []),
    ...(lateNight ? ['Late-night study sessions detected (00:00–04:30 WIB)'] : []),
    ...(activityDrop ? ['Task completion activity dropped by over 50% compared with the previous week'] : []),
  ];

  return { score, triggers };
}

function LecturerBurnoutMonitor({ students }) {
  return (
    <Card>
      <h2 className="text-xl font-bold text-slate-800 mb-4">Student Well-being Monitor</h2>
      {!students.length ? <p className="text-sm text-slate-500">No students currently show moderate or high risk indicators.</p> : (
        <div className="space-y-3">
          {students.map(({ student, risk }) => (
            <div key={student.id} className={`flex items-center justify-between gap-4 rounded-xl p-4 ${risk.score >= 60 ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>
              <div><p className="font-semibold">{student.name}</p><p className="text-sm">{risk.score >= 60 ? 'High (Burnout Indicated)' : 'Moderate (At Risk)'}</p></div>
              <span className="text-xl font-bold">{risk.score}/100</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function LecturerDashboard({ users, tasks, completions, studySessions }) {
  const burnoutStudents = users.filter(student => student.role === 'student').map(student => ({
    student,
    risk: burnoutRiskUtil(student, tasks, completions, studySessions),
  })).filter(entry => entry.risk.score >= 30).sort((a, b) => b.risk.score - a.risk.score);
  const studentsCount = users.filter(u => u.role === 'student').length;
  const globalTasksCount = tasks.filter(t => t.type === 'global').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Lecturer Overview</h1>
        <p className="text-slate-500 mt-1">Manage tasks and monitor student progress.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-blue-600 to-blue-900 text-white border-none">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-blue-100 font-medium text-lg">Total Students</h3>
            <Users size={24} className="text-blue-200" />
          </div>
          <p className="text-4xl font-bold">{studentsCount}</p>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500 to-blue-800 text-white border-none">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-blue-100 font-medium text-lg">Active Assignments</h3>
            <CheckSquare size={24} className="text-blue-200" />
          </div>
          <p className="text-4xl font-bold">{globalTasksCount}</p>
        </Card>
      </div>
      <LecturerBurnoutMonitor students={burnoutStudents} />
    </div>
  );
}

const COURSES = [
  'Data Structures and Algorithms',
  'Calculus II',
  'Software Engineering',
  'English',
  'Computer Organization and Architecture',
  'Computer Networks',
  'Database Systems',
];

function TaskManagement({ db, appId, tasks, lecturerId, showToast, students }) {
  const [newTask, setNewTask] = useState({ title: '', description: '', deadline: '', resourceUrl: '', course: '' });
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const globalTasks = tasks.filter(t => t.type === 'global').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const handleCreateGlobalTask = async (e) => {
    e.preventDefault();
    if (!newTask.title || !newTask.deadline) return;
    setUploading(true);
    try {
      let attachmentData = null;
      if (attachment) {
        if (attachment.size > 700 * 1024) throw new Error('File maximum size is 700 KB.');
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Failed to read attachment.'));
          reader.readAsDataURL(attachment);
        });
        attachmentData = { name: attachment.name, data: dataUrl };
      }

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tasks'), {
        ...newTask,
        attachment: attachmentData,
        type: 'global',
        createdBy: lecturerId,
        createdAt: new Date().toISOString()
      });

      const { serviceId, templateId, publicKey } = emailJsConfig;
      if (!serviceId || !templateId || !publicKey) {
        throw new Error('Email notifications are not configured. Check the VITE_EMAILJS variables and restart the development server.');
      }
      if (!students.length) {
        showToast('Assignment posted, but no verified student email addresses were found.');
      } else {
        const emailResults = await Promise.allSettled(students.map(student => emailjs.send(
          serviceId,
          templateId,
          {
            to_email: student.email,
            email: student.email,
            to_name: student.name,
            name: student.name,
            assignment_title: newTask.title,
            course: newTask.course,
            deadline: new Date(newTask.deadline).toLocaleDateString('en-GB'),
            description: newTask.description,
            resource_url: newTask.resourceUrl,
          },
          { publicKey }
        )));
        const failedEmails = emailResults.filter(result => result.status === 'rejected').length;
        if (failedEmails) {
          console.error('EmailJS send errors:', emailResults.filter(result => result.status === 'rejected'));
          showToast(`${failedEmails} of ${students.length} notification email(s) failed. Check EmailJS configuration and template variables.`);
        } else {
          showToast(`Assignment posted and notification sent to ${students.length} student(s).`);
        }
      }
      
      setNewTask({ title: '', description: '', deadline: '', resourceUrl: '', course: '' });
      setAttachment(null);
      e.target.reset();
      showToast("Global assignment broadcasted to all students!");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Failed to create assignment.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', id));
    showToast("Assignment removed.");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold text-slate-900">Task Management</h1>
      
      <Card className="bg-slate-50 border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Plus size={20} className="text-indigo-600" /> Create New Assignment
        </h2>
        <form onSubmit={handleCreateGlobalTask} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assignment Title</label>
              <input required type="text" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-slate-300" placeholder="e.g., Final Essay Submission" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Course</label>
              <select required value={newTask.course} onChange={e => setNewTask({...newTask, course: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-slate-300">
                <option value="" disabled>Select a course</option>
                {COURSES.map(course => <option key={course} value={course}>{course}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Deadline</label>
              <input required type="date" value={newTask.deadline} onChange={e => setNewTask({...newTask, deadline: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-slate-300" />
            </div>
          </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Instructions / Description</label>
              <textarea value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-slate-300 h-24 resize-none" placeholder="Details about the assignment..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2"><LinkIcon size={16} /> Resource URL</label>
              <input type="url" value={newTask.resourceUrl} onChange={e => setNewTask({...newTask, resourceUrl: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-slate-300" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2"><Paperclip size={16} /> Attachment</label>
              <label className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-100">
                {attachment?.name || 'Choose File'}
                <input type="file" onChange={e => setAttachment(e.target.files?.[0] || null)} className="hidden" />
              </label>
            </div>
            <button type="submit" disabled={uploading} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors w-full md:w-auto disabled:opacity-50">
              {uploading ? 'Uploading...' : 'Assign to All Students'}
            </button>
        </form>
      </Card>

      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-4 mt-8">Past Assignments</h3>
        <div className="grid grid-cols-1 gap-4">
          {globalTasks.length === 0 ? (
            <p className="text-slate-500 italic">No assignments created yet.</p>
          ) : (
            globalTasks.map(task => (
              <Card key={task.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-lg text-slate-800">{task.course ? `${task.title} - ${task.course}` : task.title}</h4>
                  <p className="text-sm text-slate-500 line-clamp-2 my-1">{task.description}</p>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-semibold">
                    <Clock size={12} /> Due: {new Date(task.deadline).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <button onClick={() => handleDelete(task.id)} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors">
                  Delete
                </button>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StudentProgress({ users, tasks, completions, db, appId, showToast }) {
  const students = users.filter(u => u.role === 'student');
  const globalTasks = tasks.filter(t => t.type === 'global');
  const [expandedSubmission, setExpandedSubmission] = useState(null);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editExp, setEditExp] = useState(0);

  const handleEdit = (student) => {
    setEditingStudentId(student.id);
    setEditName(student.name);
    setEditExp(student.exp || 0);
  };

  const handleSave = async (studentId) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', studentId), {
        name: editName,
        exp: Number(editExp)
      });
      setEditingStudentId(null);
      showToast?.("Data mahasiswa berhasil diperbarui");
    } catch (err) {
      console.error(err);
      showToast?.("Gagal memperbarui data mahasiswa");
    }
  };

  const handleDeleteStudent = async (studentId, studentName) => {
    if (!window.confirm(`Hapus mahasiswa ${studentName}?`)) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', studentId));
      showToast?.("Mahasiswa berhasil dihapus");
    } catch (err) {
      console.error(err);
      showToast?.("Gagal menghapus mahasiswa");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Student Progress & Management</h1>
        <p className="text-slate-500 mt-1">Monitor completion status and manage student accounts.</p>
      </div>

      <Card>
        <h2 className="text-xl font-bold text-slate-800 mb-4">Student List ({students.length})</h2>
        <div className="divide-y divide-slate-100">
          {students.length === 0 ? (
            <p className="text-slate-500 italic py-4">No students are registered yet.</p>
          ) : (
            students.map(student => (
              <div key={student.id} className="py-3 flex items-center justify-between gap-4">
                {editingStudentId === student.id ? (
                  <div className="flex-1 flex items-center gap-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm flex-1"
                      placeholder="Nama Mahasiswa"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">EXP:</span>
                      <input
                        type="number"
                        value={editExp}
                        onChange={e => setEditExp(e.target.value)}
                        className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <button
                      onClick={() => handleSave(student.id)}
                      className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      title="Simpan"
                    >
                      <Save size={16} />
                    </button>
                    <button
                      onClick={() => setEditingStudentId(null)}
                      className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors"
                      title="Batal"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-semibold text-slate-800">{student.name}</p>
                      <p className="text-xs text-slate-500">Level {getLevel(student.exp || 0)} ({student.exp || 0} EXP)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(student)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Mahasiswa"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteStudent(student.id, student.name)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus Mahasiswa"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {globalTasks.length === 0 ? (
        <Card className="text-center p-8 text-slate-500">Create an assignment in Task Management first.</Card>
      ) : (
        <div className="space-y-8">
          {globalTasks.map(task => {
            const taskCompletions = completions.filter(c => c.taskId === task.id);
            const completionRate = students.length > 0 ? (taskCompletions.length / students.length) * 100 : 0;
            
            return (
              <Card key={task.id} className="overflow-hidden p-0">
                <div className="p-6 bg-slate-50 border-b border-slate-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{task.course ? `${task.title} - ${task.course}` : task.title}</h3>
                      <p className="text-sm text-slate-500">Due: {new Date(task.deadline).toLocaleDateString('en-GB')}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-indigo-600">{Math.round(completionRate)}%</span>
                      <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Completion</p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${completionRate}%` }}></div>
                  </div>
                </div>
                
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {students.map(student => {
                    const isCompleted = taskCompletions.some(c => c.userId === student.id);
                    return (
                      <div key={student.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <span className="font-medium text-slate-700">{student.name}</span>
                        {isCompleted ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                              <CheckSquare size={12} /> Submitted
                            </span>
                            <button
                              onClick={() => setExpandedSubmission(expandedSubmission === `${task.id}-${student.id}` ? null : `${task.id}-${student.id}`)}
                              className="text-xs font-semibold text-blue-600 hover:underline"
                            >
                              {expandedSubmission === `${task.id}-${student.id}` ? 'Hide submission' : 'View submission'}
                            </button>
                          </div>
                        ) : (
                          <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full flex items-center gap-1">
                            <Clock size={12} /> Pending
                          </span>
                        )}
                        {isCompleted && expandedSubmission === `${task.id}-${student.id}` && (() => {
                          const submission = taskCompletions
                            .filter(c => c.userId === student.id && c.submissionData)
                            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
                          if (!submission?.submissionData) return <p className="mt-2 text-xs text-slate-500">No attachment or link submitted.</p>;
                          const submissionType = submission.submissionType || (submission.submissionData.startsWith('data:image/') ? 'image' : /^https?:\/\//i.test(submission.submissionData) ? 'url' : 'file');
                          return (
                            <div className="mt-2 space-y-2">
                              {submissionType === 'url' ? (
                                <a href={submission.submissionData} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 underline break-all">{submission.submissionData}</a>
                              ) : submissionType === 'image' ? (
                                <a href={submission.submissionData} target="_blank" rel="noreferrer" className="block"><img src={submission.submissionData} alt="Student submission" className="max-h-48 rounded-lg border border-slate-200" /></a>
                              ) : (
                                <a href={submission.submissionData} download={`submission-${student.id}`} className="inline-block text-sm text-blue-600 underline">Download submitted file</a>
                              )}
                              {submission.submissionUrl && <a href={submission.submissionUrl} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 underline break-all">{submission.submissionUrl}</a>}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  );
}

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
const getBadge = (level) => level >= 100
  ? { level: 100, name: 'Demon King', icon: '👹', color: 'bg-red-100 text-red-900' }
  : { level, ...LEVEL_BADGES[Math.min(level - 1, 9)] };
const getUnlockedBadges = (level) => Array.from({ length: level }, (_, index) => getBadge(index + 1));

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
                <div key={student.id} className={`px-6 py-4 grid grid-cols-12 gap-4 items-center transition-colors hover:bg-slate-50 ${isMe ? 'bg-blue-50' : ''}`}>
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
                  <div className="col-span-2 text-center font-bold text-indigo-600">
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