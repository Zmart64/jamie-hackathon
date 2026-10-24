export function assessmentPath(agentId: string, assessmentId?: string): string {
  return `/agents/${agentId}${assessmentQuery(assessmentId)}`;
}

export function findingsPath(agentId: string, assessmentId?: string): string {
  return `/agents/${agentId}/findings${assessmentQuery(assessmentId)}`;
}

function assessmentQuery(id: string | undefined): string {
  return id ? `?assessment=${encodeURIComponent(id)}` : "";
}
