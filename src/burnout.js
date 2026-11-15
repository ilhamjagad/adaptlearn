export function calculateBurnoutRisk(user, tasks = [], completions = [], studySessions = [], currentEnergy, now = Date.now()) {
  if (!user) return { score: 0, triggers: [], status: 'Low Risk', color: 'emerald' };

  // 1. Energy Factor: Lower energy = Higher burnout risk
  let energyVal = currentEnergy;
  if (typeof energyVal !== 'number') {
    energyVal = typeof user.energy === 'number' ? user.energy : 100;
  }
  const energyDeficit = Math.max(0, Math.min(100, 100 - energyVal)); // 0 (full) to 100 (depleted)

  // 2. Study Care Duration & Intensity: Longer study time = Higher burnout risk
  const userSessions = studySessions.filter(session => session.userId === user.id && session.completedAt);
  const recentSessions = userSessions.filter(session => now - new Date(session.completedAt).getTime() <= 7 * 24 * 60 * 60 * 1000);

  const dailyStudyMinutes = new Map();
  let lateNightSessions = 0;
  let totalStudyMinutesToday = 0;
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(now));

  recentSessions.forEach(session => {
    const date = new Date(session.completedAt);
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
    const mins = Number(session.durationMinutes || 0);
    dailyStudyMinutes.set(day, (dailyStudyMinutes.get(day) || 0) + mins);
    if (day === todayStr) {
      totalStudyMinutesToday += mins;
    }

    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', hourCycle: 'h23' }).format(date));
    const minute = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', minute: '2-digit' }).format(date));
    if (hour < 4 || (hour === 4 && minute <= 30)) {
      lateNightSessions += 1;
    }
  });

  const maxDailyMinutes = Math.max(0, ...dailyStudyMinutes.values());
  const liveTodayMinutes = Number(user.activeStudyMinutesToday || 0);
  const effectiveStudyMinutes = Math.max(totalStudyMinutesToday, maxDailyMinutes) + liveTodayMinutes;
  const studyIntensityScore = Math.min(100, Math.round((effectiveStudyMinutes / 240) * 100));

  // 3. Procrastination Factor
  const userCompletions = completions.filter(completion => completion.userId === user.id && completion.completedAt);
  const assignedTasks = tasks.filter(task => task.type === 'global' || task.ownerId === user.id);
  const overdueCount = assignedTasks.filter(task => !userCompletions.some(completion => completion.taskId === task.id) && new Date(task.deadline).getTime() < now).length;
  const dueSoonOrLateCount = userCompletions.filter(completion => {
    const task = assignedTasks.find(item => item.id === completion.taskId);
    return task && new Date(task.deadline).getTime() - new Date(completion.completedAt).getTime() <= 24 * 60 * 60 * 1000;
  }).length + overdueCount;

  const procrastinationRate = assignedTasks.length ? dueSoonOrLateCount / assignedTasks.length : 0;
  const procrastinationScore = Math.min(100, Math.round(procrastinationRate * 100));

  // 4. Late-Night Study
  const lateNightRate = recentSessions.length ? lateNightSessions / recentSessions.length : 0;
  const lateNightScore = lateNightRate >= 0.5 ? 100 : lateNightRate > 0 ? 50 : 0;

  // 5. Sudden Activity Drop
  const currentWeekStart = now - 7 * 24 * 60 * 60 * 1000;
  const previousWeekStart = now - 14 * 24 * 60 * 60 * 1000;
  const currentWeekCount = userCompletions.filter(completion => new Date(completion.completedAt).getTime() >= currentWeekStart).length;
  const previousWeekCount = userCompletions.filter(completion => {
    const timestamp = new Date(completion.completedAt).getTime();
    return timestamp >= previousWeekStart && timestamp < currentWeekStart;
  }).length;
  const activityDrop = previousWeekCount > 0 && currentWeekCount < previousWeekCount * 0.5 ? 15 : 0;

  // Weighted calculation:
  // Energy deficit: 35% weight
  // Study intensity: 35% weight
  // Procrastination: 18% weight
  // Late-night: 12% weight
  // + activity drop penalty
  const rawScore = (energyDeficit * 0.35) + (studyIntensityScore * 0.35) + (procrastinationScore * 0.18) + (lateNightScore * 0.12) + activityDrop;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  const triggers = [];
  if (energyDeficit >= 40) {
    triggers.push(`Low energy detected (${Math.round(energyVal)}% remaining)`);
  }
  if (effectiveStudyMinutes >= 45) {
    triggers.push(`High study duration (${effectiveStudyMinutes} mins accumulated)`);
  }
  if (procrastinationScore >= 40) {
    triggers.push('High concentration of tasks completed near or past deadline');
  }
  if (lateNightScore > 0) {
    triggers.push('Late-night study sessions detected (00:00–04:30 WIB)');
  }
  if (activityDrop > 0) {
    triggers.push('Task completion activity dropped by >50% compared to previous week');
  }

  const status = score >= 60 ? 'High (Burnout Indicated)' : score >= 30 ? 'Moderate (At Risk)' : 'Low Risk';
  const color = score >= 60 ? 'red' : score >= 30 ? 'amber' : 'emerald';

  return {
    score,
    triggers,
    status,
    color,
    energyVal,
    effectiveStudyMinutes,
  };
}
