import React, { useState } from 'react';
import { Clock, CheckSquare, Users, Plus, Trophy, Edit2, Trash2, Save, X, Paperclip, Link as LinkIcon } from 'lucide-react';
import { doc, deleteDoc, updateDoc, collection, addDoc } from 'firebase/firestore';

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-6 ${className}`}>
    {children}
  </div>
);

export function LecturerView({ user, tasks, completions, currentView, db, appId, showToast, users }) {
  return (
    <>
      {currentView === 'dashboard' && <LecturerDashboard users={users} tasks={tasks} />}
      {currentView === 'tasks' && <TaskManagement db={db} appId={appId} tasks={tasks} lecturerId={user.id} showToast={showToast} />}
      {currentView === 'progress' && <StudentProgress users={users} tasks={tasks} completions={completions} db={db} appId={appId} showToast={showToast} />}
      {currentView === 'leaderboard' && <Leaderboard users={users} currentUser={user} />}
    </>
  );
}

function LecturerDashboard({ users, tasks }) {
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

function TaskManagement({ db, appId, tasks, lecturerId, showToast }) {
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
        <h2 className="text-xl font-bold text-slate-800 mb-4">Daftar Mahasiswa ({students.length})</h2>
        <div className="divide-y divide-slate-100">
          {students.length === 0 ? (
            <p className="text-slate-500 italic py-4">Belum ada mahasiswa terdaftar.</p>
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
                      <h3 className="font-bold text-lg text-slate-900">{task.title}</h3>
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

const LEVEL_NAMES = ['EXP Trainee', 'Focus Adventurer', 'Task Hunter', 'Time Weaver', 'Deadline Knight', 'Productivity Mage', 'Wisdom Conqueror', 'Master Strategist', 'EXP Overlord', 'Supreme Archmage of AdaptLearn'];
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
const getBadgeName = (level) => level >= 100 ? 'Demon King' : LEVEL_NAMES[Math.min(level - 1, 9)];
const getUnlockedBadges = (level) => Array.from({ length: level }, (_, index) => ({ level: index + 1, name: getBadgeName(index + 1), icon: index + 1 >= 100 ? '👹' : '🏅', color: 'bg-blue-100 text-blue-800' }));

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
                  <div className="col-span-2 text-right font-bold text-indigo-600">
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