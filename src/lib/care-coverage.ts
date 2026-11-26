export function careCoverage(
  tasks: { customerId?: string }[],
  activities: { customerId: string }[],
) {
  const due = new Set(tasks.flatMap(task => task.customerId ? [task.customerId] : []));
  const reached = new Set(activities.flatMap(activity => due.has(activity.customerId) ? [activity.customerId] : []));
  return { due: due.size, reached: reached.size, rate: due.size ? reached.size / due.size : null };
}
