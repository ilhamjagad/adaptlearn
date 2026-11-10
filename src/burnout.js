export function calculateBurnoutRisk(user, tasks, completions, studySessions, now = Date.now()) {
  const userCompletions = completions.filter(completion => completion.userId === user.id && completion.completedAt);
  const assignedTasks = tasks.filter(task => task.type === 'global' || task.ownerId === user.id);
  const overdueCount = assignedTasks.filter(task => !userCompletions.some(completion => completion.taskId === task.id) && new Date(task.deadline).getTime() < now).length;
  const dueSoonOrLateCount = userCompletions.filter(completion => {
    const task = assignedTasks.find(item => item.id === completion.taskId);
    return task && new Date(task.deadline).getTime() - new Date(completion.completedAt).getTime() <= 24 * 60 * 60 * 1000;
  }).length + overdueCount;
  const procrastination = assignedTasks.length && dueSoonOrLateCount / assignedTasks.length > 0.6 ? 100 : 0;

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
  const currentWeekCount = userCompletions.filter(completion => new Date(completion.completedAt).getTime() >= currentWeekStart).length;
  const previousWeekCount = userCompletions.filter(completion => {
    const timestamp = new Date(completion.completedAt).getTime();
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

  return {
    score,
    triggers,
    status: score >= 60 ? 'High (Burnout Indicated)' : score >= 30 ? 'Moderate (At Risk)' : 'Low Risk',
    color: score >= 60 ? 'red' : score >= 30 ? 'amber' : 'emerald',
  };
}
