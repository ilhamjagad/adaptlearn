import React, { useState } from 'react';
import { Clock, CheckSquare, Users, Plus, Trophy, Edit2, Trash2, Save, X, Paperclip, Link as LinkIcon, AlertCircle, TrendingUp, BarChart3, UserX, Filter, UserPlus, Upload, CheckCircle2, ShieldCheck } from 'lucide-react';
import { doc, deleteDoc, updateDoc, setDoc, collection, addDoc } from 'firebase/firestore';
import emailjs from '@emailjs/browser';

const emailJsConfig = {
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID,
  templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
};

const COURSES = [
  'Data Structures and Algorithms',
  'Calculus II',
  'Software Engineering',
  'English',
  'Computer Organization and Architecture',
  'Computer Networks',
  'Database Systems',
];

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-6 ${className}`}>
    {children}
  </div>
);

export function LecturerView({ user, tasks, completions, studySessions, currentView, db, appId, showToast, users, roster = [] }) {
  return (
    <>
      {currentView === 'dashboard' && <LecturerDashboard users={users} tasks={tasks} completions={completions} studySessions={studySessions} />}
      {currentView === 'tasks' && <TaskManagement db={db} appId={appId} tasks={tasks} lecturerId={user.id} showToast={showToast} students={users.filter(u => u.role === 'student' && u.email)} />}
      {currentView === 'submissions' && <AssignmentSubmissions users={users} tasks={tasks} completions={completions} />}
      {currentView === 'progress' && <StudentProgress users={users} roster={roster} db={db} appId={appId} showToast={showToast} />}
      {currentView === 'leaderboard' && <Leaderboard users={users} currentUser={user} />}
    </>
  );
}

function LecturerDashboard({ users, tasks, completions, studySessions }) {
  const now = Date.now();
  const todayStr = new Date().toDateString();
  const students = users.filter(student => student.role === 'student');
  const globalTasks = tasks.filter(t => t.type === 'global');
  const studentsCount = students.length;
  const globalTasksCount = globalTasks.length;

  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const weeklyClassSessions = (studySessions || []).filter(
    s => s.completedAt && new Date(s.completedAt).getTime() >= oneWeekAgo
  );
  const totalClassStudyMinutes = weeklyClassSessions.reduce((acc, s) => acc + Number(s.durationMinutes || 0), 0);
  const classHours = Math.floor(totalClassStudyMinutes / 60);
  const classRemainingMins = totalClassStudyMinutes % 60;
  const classStudyFormatted = classHours > 0 ? `${classHours}h ${classRemainingMins}m` : `${classRemainingMins}m`;

  const activeStudentsThisWeek = new Set(weeklyClassSessions.map(s => s.userId)).size;
  const weeklyCompletionsCount = (completions || []).filter(
    c => c.completedAt && new Date(c.completedAt).getTime() >= oneWeekAgo
  ).length;

  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dStr = d.toDateString();
    const mins = (studySessions || [])
      .filter(s => s.completedAt && new Date(s.completedAt).toDateString() === dStr)
      .reduce((acc, s) => acc + Number(s.durationMinutes || 0), 0);
    const submissionsCount = (completions || [])
      .filter(c => c.completedAt && new Date(c.completedAt).toDateString() === dStr)
      .length;
    return {
      dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dateLabel: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      minutes: mins,
      submissions: submissionsCount,
      isToday: dStr === todayStr,
    };
  });
  const maxClassMinutes = Math.max(60, ...last7Days.map(d => d.minutes));

  const atRiskStudents = students.map(student => {
    const studentCompletions = (completions || []).filter(c => c.userId === student.id);
    const studentSessions = (studySessions || []).filter(s => s.userId === student.id);

    const submittedTaskIds = new Set(studentCompletions.map(c => c.taskId));
    const missingTasks = globalTasks.filter(t => !submittedTaskIds.has(t.id));
    const overdueCount = missingTasks.filter(t => new Date(t.deadline).getTime() < now).length;

    const activityTimestamps = [
      ...studentCompletions.map(c => c.completedAt ? new Date(c.completedAt).getTime() : 0),
      ...studentSessions.map(s => s.completedAt ? new Date(s.completedAt).getTime() : 0),
    ].filter(ts => ts > 0);

    const lastActiveTs = activityTimestamps.length > 0 ? Math.max(...activityTimestamps) : null;
    const isInactive7Days = !lastActiveTs || lastActiveTs < oneWeekAgo;

    return {
      student,
      missingCount: missingTasks.length,
      overdueCount,
      isInactive7Days,
      lastActiveTs,
    };
  })
    .filter(item => item.isInactive7Days || item.missingCount >= 2 || item.overdueCount >= 1)
    .sort((a, b) => (b.overdueCount - a.overdueCount) || (b.missingCount - a.missingCount));

  const deadlineAlerts = globalTasks.map(task => {
    const deadlineTime = new Date(task.deadline).getTime();
    const diffDays = Math.ceil((deadlineTime - now) / (1000 * 60 * 60 * 24));
    const submittedUserIds = completions.filter(c => c.taskId === task.id).map(c => c.userId);
    const submittedCount = submittedUserIds.length;
    const pendingCount = students.filter(s => !submittedUserIds.includes(s.id)).length;
    const isOverdue = diffDays < 0;
    const isUrgent = diffDays >= 0 && diffDays <= 3;
    return {
      task,
      diffDays,
      submittedCount,
      pendingCount,
      isOverdue,
      isUrgent,
    };
  }).filter(item => item.isOverdue || item.isUrgent)
    .sort((a, b) => a.diffDays - b.diffDays);

  const submissionTracker = globalTasks.map(task => {
    const submittedCount = completions.filter(c => c.taskId === task.id).length;
    const totalCount = students.length;
    const rate = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;
    return {
      task,
      submittedCount,
      totalCount,
      rate,
    };
  }).sort((a, b) => new Date(b.task.createdAt || 0) - new Date(a.task.createdAt || 0));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Lecturer Overview</h1>
        <p className="text-slate-500 mt-1">Monitor class activity, submissions, and deadline alerts.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="bg-gradient-to-br from-blue-600 to-blue-900 text-white border-none">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-blue-100 font-medium text-sm">Total Students</h3>
            <Users size={22} className="text-blue-200" />
          </div>
          <p className="text-3xl font-bold">{studentsCount}</p>
          <p className="text-xs text-blue-200 mt-2 flex items-center gap-1">
            <span className="font-semibold text-white">{activeStudentsThisWeek}</span> active this week
          </p>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-600 to-indigo-900 text-white border-none">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-indigo-100 font-medium text-sm">Active Assignments</h3>
            <CheckSquare size={22} className="text-indigo-200" />
          </div>
          <p className="text-3xl font-bold">{globalTasksCount}</p>
          <p className="text-xs text-indigo-200 mt-2 flex items-center gap-1">
            <span className="font-semibold text-white">{weeklyCompletionsCount}</span> submitted this week
          </p>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600 to-purple-900 text-white border-none">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-purple-100 font-medium text-sm">Class Study Time</h3>
            <Clock size={22} className="text-purple-200" />
          </div>
          <p className="text-3xl font-bold">{classStudyFormatted}</p>
          <p className="text-xs text-purple-200 mt-2">
            Total self-study (past 7 days)
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 size={20} className="text-blue-600" />
                7-Day Class Engagement
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Combined self-study minutes & daily task submissions</p>
            </div>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
              Past 7 Days
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-44 pt-4 px-1">
            {last7Days.map((day, idx) => {
              const heightPct = day.minutes > 0 ? Math.max(12, Math.round((day.minutes / maxClassMinutes) * 100)) : 6;
              return (
                <div key={idx} className="flex flex-col items-center h-full justify-end group">
                  <span className="text-[11px] font-bold text-slate-600 mb-1.5">
                    {day.minutes > 0 ? `${day.minutes}m` : '-'}
                  </span>
                  <div className="w-full max-w-[38px] h-28 bg-slate-100 rounded-xl flex items-end overflow-hidden p-0.5">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-lg transition-all duration-500 ${
                        day.minutes > 0 ? 'bg-indigo-600' : 'bg-slate-200'
                      }`}
                    />
                  </div>
                  <span className={`text-xs font-bold mt-2 ${day.isToday ? 'text-indigo-600' : 'text-slate-600'}`}>
                    {day.dayLabel}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {day.submissions > 0 ? `${day.submissions} sub` : day.dateLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <UserX size={20} className="text-rose-600" />
                  At-Risk Students
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Students inactive for 7+ days or behind on assignments</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-rose-50 text-rose-700 rounded-full">
                {atRiskStudents.length} Flagged
              </span>
            </div>

            {students.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                No students registered yet.
              </div>
            ) : atRiskStudents.length === 0 ? (
              <div className="p-8 text-center text-emerald-700 bg-emerald-50/70 rounded-xl border border-emerald-100 text-sm font-medium">
                All students are active and up to date with assignments!
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {atRiskStudents.map(({ student, missingCount, overdueCount, isInactive7Days, lastActiveTs }) => (
                  <div key={student.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{student.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {student.nim ? `NIM: ${student.nim} · ` : ''}
                        {lastActiveTs
                          ? `Last active: ${new Date(lastActiveTs).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
                          : 'No recorded activity'}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
                      {overdueCount > 0 && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          {overdueCount} Overdue
                        </span>
                      )}
                      {missingCount > 0 && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          {missingCount} Pending
                        </span>
                      )}
                      {isInactive7Days && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          Inactive 7d+
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <AlertCircle size={20} className="text-amber-500" />
              Upcoming Deadline Alerts
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">Assignments requiring attention due to impending deadlines</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full">
            {deadlineAlerts.length} Attention Needed
          </span>
        </div>

        {deadlineAlerts.length === 0 ? (
          <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
            No urgent or overdue deadlines right now. All assignments are on track!
          </div>
        ) : (
          <div className="space-y-3">
            {deadlineAlerts.map(({ task, diffDays, submittedCount, pendingCount, isOverdue }) => {
              const badgeStyle = isOverdue
                ? 'bg-red-100 text-red-800 border-red-200'
                : diffDays === 0
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-orange-100 text-orange-800 border-orange-200';
              const label = isOverdue
                ? 'Overdue'
                : diffDays === 0
                ? 'Due Today'
                : `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}`;

              return (
                <div key={task.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${badgeStyle}`}>
                        {label}
                      </span>
                      <h4 className="font-bold text-slate-800 text-base">{task.course ? `${task.title} - ${task.course}` : task.title}</h4>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                      <Clock size={13} />
                      Deadline: {new Date(task.deadline).toLocaleDateString('en-GB')}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-sm shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-red-600">{pendingCount} Not Submitted</p>
                      <p className="text-xs text-slate-500">{submittedCount} Submitted</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-600" />
              Assignment Submission Tracker
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">Real-time completion percentage for all global assignments</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">
            {submissionTracker.length} Active
          </span>
        </div>

        {submissionTracker.length === 0 ? (
          <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
            No assignments created yet. Create assignments in Task Management to track progress.
          </div>
        ) : (
          <div className="space-y-4">
            {submissionTracker.map(({ task, submittedCount, totalCount, rate }) => (
              <div key={task.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{task.course ? `${task.title} - ${task.course}` : task.title}</h4>
                    <p className="text-xs text-slate-500">Due: {new Date(task.deadline).toLocaleDateString('en-GB')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600">
                      {submittedCount} / {totalCount} Students
                    </span>
                    <span className="text-sm font-black text-blue-600 min-w-[42px] text-right">
                      {rate}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-700"
                    style={{ width: `${rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function TaskManagement({ db, appId, tasks, lecturerId, showToast, students }) {
  const [newTask, setNewTask] = useState({ title: '', description: '', deadline: '', resourceUrl: '', course: '' });
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);

  const [selectedCourseFilter, setSelectedCourseFilter] = useState('ALL');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskForm, setEditTaskForm] = useState({ title: '', course: '', deadline: '', description: '', resourceUrl: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const globalTasks = tasks
    .filter(t => t.type === 'global')
    .filter(t => selectedCourseFilter === 'ALL' || t.course === selectedCourseFilter)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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

      if (sendNotification) {
        const { serviceId, templateId, publicKey } = emailJsConfig;
        if (!serviceId || !templateId || !publicKey) {
          showToast?.('Assignment posted, but email service is not configured.');
        } else if (!students.length) {
          showToast?.('Assignment posted, but no student email addresses found.');
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
            showToast?.(`Assignment posted. ${failedEmails} of ${students.length} notification email(s) failed.`);
          } else {
            showToast?.(`Assignment posted and notification sent to ${students.length} student(s).`);
          }
        }
      } else {
        showToast?.('Assignment broadcasted to all students (without email notification).');
      }
      
      setNewTask({ title: '', description: '', deadline: '', resourceUrl: '', course: '' });
      setAttachment(null);
      e.target.reset();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Failed to create assignment.");
    } finally {
      setUploading(false);
    }
  };

  const startEditTask = (task) => {
    setEditingTaskId(task.id);
    setEditTaskForm({
      title: task.title || '',
      course: task.course || '',
      deadline: task.deadline ? task.deadline.slice(0, 10) : '',
      description: task.description || '',
      resourceUrl: task.resourceUrl || '',
    });
  };

  const handleSaveTaskEdit = async (taskId) => {
    if (!editTaskForm.title.trim() || !editTaskForm.deadline) {
      showToast?.('Title and deadline are required.');
      return;
    }
    setSavingEdit(true);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tasks', taskId), {
        title: editTaskForm.title.trim(),
        course: editTaskForm.course,
        deadline: editTaskForm.deadline,
        description: editTaskForm.description,
        resourceUrl: editTaskForm.resourceUrl,
        updatedAt: new Date().toISOString(),
      });
      setEditingTaskId(null);
      showToast?.('Assignment updated successfully.');
    } catch (error) {
      console.error(error);
      showToast?.('Failed to update assignment.');
    } finally {
      setSavingEdit(false);
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
            <button type="submit" disabled={uploading} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto disabled:opacity-50">
              {uploading ? 'Uploading...' : 'Assign to All Students'}
            </button>
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 select-none">
              <input
                type="checkbox"
                checked={sendNotification}
                onChange={e => setSendNotification(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
              />
              <span>Send email notification to students</span>
            </label>
          </div>
        </form>
      </Card>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 mt-8">
          <h3 className="text-xl font-bold text-slate-800">Past Assignments ({globalTasks.length})</h3>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={selectedCourseFilter}
              onChange={e => setSelectedCourseFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Courses</option>
              {COURSES.map(course => (
                <option key={course} value={course}>{course}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {globalTasks.length === 0 ? (
            <p className="text-slate-500 italic">No assignments found for the selected filter.</p>
          ) : (
            globalTasks.map(task => (
              <Card key={task.id}>
                {editingTaskId === task.id ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Edit Assignment</span>
                      <button
                        type="button"
                        onClick={() => setEditingTaskId(null)}
                        className="text-slate-400 hover:text-slate-700 p-1"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Assignment Title</label>
                        <input
                          type="text"
                          value={editTaskForm.title}
                          onChange={e => setEditTaskForm({ ...editTaskForm, title: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Course</label>
                        <select
                          value={editTaskForm.course}
                          onChange={e => setEditTaskForm({ ...editTaskForm, course: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                        >
                          <option value="">No Course</option>
                          {COURSES.map(course => (
                            <option key={course} value={course}>{course}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Deadline</label>
                        <input
                          type="date"
                          value={editTaskForm.deadline}
                          onChange={e => setEditTaskForm({ ...editTaskForm, deadline: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Instructions / Description</label>
                      <textarea
                        value={editTaskForm.description}
                        onChange={e => setEditTaskForm({ ...editTaskForm, description: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm h-20 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Resource URL</label>
                      <input
                        type="url"
                        value={editTaskForm.resourceUrl}
                        onChange={e => setEditTaskForm({ ...editTaskForm, resourceUrl: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingTaskId(null)}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => handleSaveTaskEdit(task.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Save size={14} /> {savingEdit ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-lg text-slate-800">{task.course ? `${task.title} - ${task.course}` : task.title}</h4>
                      {task.description && <p className="text-sm text-slate-500 line-clamp-2 my-1">{task.description}</p>}
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-semibold mt-1">
                        <Clock size={12} /> Due: {new Date(task.deadline).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => startEditTask(task)}
                        className="px-3.5 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                      >
                        <Edit2 size={15} /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="px-3.5 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                      >
                        <Trash2 size={15} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AssignmentSubmissions({ users, tasks, completions }) {
  const students = users.filter(u => u.role === 'student');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('ALL');
  const [expandedSubmission, setExpandedSubmission] = useState(null);

  const globalTasks = tasks
    .filter(t => t.type === 'global')
    .filter(t => selectedCourseFilter === 'ALL' || t.course === selectedCourseFilter)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Assignment Submissions</h1>
          <p className="text-slate-500 mt-1">Review and inspect student task submissions across courses.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Filter size={16} className="text-slate-400" />
          <select
            value={selectedCourseFilter}
            onChange={e => setSelectedCourseFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Courses</option>
            {COURSES.map(course => (
              <option key={course} value={course}>{course}</option>
            ))}
          </select>
        </div>
      </div>

      {globalTasks.length === 0 ? (
        <Card className="text-center p-8 text-slate-500">
          {selectedCourseFilter === 'ALL'
            ? 'Create an assignment in Task Management first.'
            : `No assignments found for ${selectedCourseFilter}.`}
        </Card>
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
                      <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                        {taskCompletions.length} / {students.length} Submitted
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${completionRate}%` }}></div>
                  </div>
                </div>
                
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {students.length === 0 ? (
                    <p className="px-6 py-4 text-sm text-slate-500 italic">No verified students registered yet.</p>
                  ) : (
                    students.map(student => {
                      const isCompleted = taskCompletions.some(c => c.userId === student.id);
                      return (
                        <div key={student.id} className="px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 transition-colors">
                          <div>
                            <span className="font-medium text-slate-700">{student.name}</span>
                            {student.nim && <span className="ml-2 text-xs text-slate-400">({student.nim})</span>}
                          </div>
                          <div className="flex flex-col sm:items-end">
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
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StudentProgress({ users, roster = [], db, appId, showToast }) {
  const students = users.filter(u => u.role === 'student');

  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editExp, setEditExp] = useState(0);

  const [rosterNim, setRosterNim] = useState('');
  const [rosterName, setRosterName] = useState('');
  const [rosterEmail, setRosterEmail] = useState('');
  const [addingRoster, setAddingRoster] = useState(false);
  const [showBulkRoster, setShowBulkRoster] = useState(false);
  const [bulkRosterText, setBulkRosterText] = useState('');

  const handleAddRosterEntry = async (e) => {
    e.preventDefault();
    const cleanNim = rosterNim.trim();
    const cleanName = rosterName.trim();
    const rawEmail = rosterEmail.trim().toLowerCase();
    const cleanEmail = rawEmail.includes('@') ? rawEmail : `${rawEmail}@mhs.uinjkt.ac.id`;

    if (!/^\d+$/.test(cleanNim)) {
      showToast?.('NIM must contain numbers only.');
      return;
    }
    if (!cleanName || !rawEmail) {
      showToast?.('NIM, Official Name, and Email are required.');
      return;
    }

    setAddingRoster(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'studentRoster', cleanNim), {
        nim: cleanNim,
        name: cleanName,
        email: cleanEmail,
        addedAt: new Date().toISOString()
      });
      setRosterNim('');
      setRosterName('');
      setRosterEmail('');
      showToast?.(`Added ${cleanName} (${cleanNim}) to class roster.`);
    } catch (err) {
      console.error(err);
      showToast?.('Failed to add student to roster.');
    } finally {
      setAddingRoster(false);
    }
  };

  const handleBulkImportRoster = async () => {
    const lines = bulkRosterText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) {
      showToast?.('Paste at least one line (NIM, Name, Email).');
      return;
    }

    setAddingRoster(true);
    try {
      let importedCount = 0;
      for (const line of lines) {
        const parts = line.split(/[,;\t|]+/).map(p => p.trim());
        if (parts.length < 3) continue;
        const [nimPart, namePart, emailPart] = parts;
        if (!/^\d+$/.test(nimPart) || !namePart || !emailPart) continue;
        const fullEmail = emailPart.includes('@') ? emailPart.toLowerCase() : `${emailPart.toLowerCase()}@mhs.uinjkt.ac.id`;

        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'studentRoster', nimPart), {
          nim: nimPart,
          name: namePart,
          email: fullEmail,
          addedAt: new Date().toISOString()
        });
        importedCount++;
      }

      if (importedCount === 0) {
        showToast?.('No valid rows found. Format: NIM, Full Name, Email');
      } else {
        setBulkRosterText('');
        setShowBulkRoster(false);
        showToast?.(`Successfully imported ${importedCount} student(s) to roster.`);
      }
    } catch (err) {
      console.error(err);
      showToast?.('Failed to import roster.');
    } finally {
      setAddingRoster(false);
    }
  };

  const handleDeleteRosterEntry = async (nimId, name) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'studentRoster', nimId));
      showToast?.(`Removed ${name} from class roster.`);
    } catch (err) {
      console.error(err);
      showToast?.('Failed to remove from roster.');
    }
  };

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
      showToast?.("The student's data has been updated.");
    } catch (err) {
      console.error(err);
      showToast?.("Failed to update the student's data.");
    }
  };

  const handleDeleteStudent = async (studentId, studentName) => {
    if (!window.confirm(`Remove student ${studentName}?`)) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', studentId));
      showToast?.("The student has been removed from the system.");
    } catch (err) {
      console.error(err);
      showToast?.("Failed to remove the student.");
    }
  };

  const sortedRoster = [...roster].sort((a, b) => (a.nim || '').localeCompare(b.nim || ''));
  const registeredNims = new Set(students.map(s => s.nim));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Student Progress & Management</h1>
        <p className="text-slate-500 mt-1">Manage official class roster whitelist, verify student identities, and track student levels.</p>
      </div>

      <Card className="border-blue-100 bg-blue-50/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck size={22} className="text-blue-600" />
              Official Class Roster / Whitelist ({sortedRoster.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Only students listed here can register, and their Full Name is automatically locked to this official record.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowBulkRoster(!showBulkRoster)}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Upload size={14} /> {showBulkRoster ? 'Single Entry Mode' : 'Bulk Import List'}
          </button>
        </div>

        {showBulkRoster ? (
          <div className="space-y-3 mb-5 bg-white p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-semibold text-slate-700">
              Paste Student List (Format per line: <code className="bg-slate-100 px-1.5 py-0.5 rounded">NIM, Official Full Name, UIN Email</code>)
            </label>
            <textarea
              rows={4}
              value={bulkRosterText}
              onChange={e => setBulkRosterText(e.target.value)}
              placeholder={"11230910000001, Muhammad Ilham Jagad, ilham.jagad23@mhs.uinjkt.ac.id\n11230910000002, Farish Ahmad, farish.ahmad23@mhs.uinjkt.ac.id"}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              disabled={addingRoster}
              onClick={handleBulkImportRoster}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
            >
              {addingRoster ? 'Importing...' : 'Import to Class Roster'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleAddRosterEntry} className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-5 bg-white p-4 rounded-xl border border-slate-200">
            <div className="md:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Student ID (NIM)</label>
              <input
                required
                type="text"
                value={rosterNim}
                onChange={e => setRosterNim(e.target.value)}
                placeholder="11230910000001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Official Full Name</label>
              <input
                required
                type="text"
                value={rosterName}
                onChange={e => setRosterName(e.target.value)}
                placeholder="Muhammad Ilham Jagad"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Institutional Email</label>
              <input
                required
                type="text"
                value={rosterEmail}
                onChange={e => setRosterEmail(e.target.value)}
                placeholder="ilham.jagad23@mhs.uinjkt.ac.id"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="md:col-span-2 flex items-end">
              <button
                type="submit"
                disabled={addingRoster}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <UserPlus size={16} /> Add
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-60 overflow-y-auto">
          {sortedRoster.length === 0 ? (
            <p className="p-4 text-xs text-slate-500 italic text-center">
              Class roster is empty. Add students above to allow them to register.
            </p>
          ) : (
            sortedRoster.map(entry => {
              const isActivated = registeredNims.has(entry.nim);
              return (
                <div key={entry.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{entry.name}</p>
                    <p className="text-xs text-slate-500 truncate">NIM: {entry.nim} · {entry.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isActivated ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold inline-flex items-center gap-1">
                        <CheckCircle2 size={12} /> Verified Account
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                        Awaiting Registration
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteRosterEntry(entry.id, entry.name)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove from Roster"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-bold text-slate-800 mb-4">Active Verified Students ({students.length})</h2>
        <div className="divide-y divide-slate-100">
          {students.length === 0 ? (
            <p className="text-slate-500 italic py-4">No verified students are registered yet.</p>
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
                      placeholder="Student Name"
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
                      title="Save"
                    >
                      <Save size={16} />
                    </button>
                    <button
                      onClick={() => setEditingStudentId(null)}
                      className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors"
                      title="Cancel"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-semibold text-slate-800">{student.name}</p>
                      <p className="text-xs text-slate-500">
                        {student.nim ? `NIM: ${student.nim} · ` : ''}Level {getLevel(student.exp || 0)} ({student.exp || 0} EXP)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(student)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Student"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteStudent(student.id, student.name)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove Student"
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