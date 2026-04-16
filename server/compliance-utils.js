export function calculateGates(activities) {
  const brainQueried = activities.some(a => a.activity_type === "brain_query");
  const reviewerRan = activities.some(a => a.activity_type === "reviewer_run");
  const profilesInjected = activities.filter(a => a.activity_type === "profile_inject");
  const commitCount = activities.filter(a => a.activity_type === "commit").length;
  const agentSpawnCount = activities.filter(a => a.activity_type === "agent_spawn").length;

  const gates = {
    brain_query_gate: brainQueried ? "pass" : "fail",
    agent_profile_gate: profilesInjected.length > 0 || agentSpawnCount === 0 ? "pass" : "fail",
    reviewer_gate: commitCount === 0 ? "not_applicable" : (reviewerRan ? "pass" : "fail"),
  };

  return { gates, brainQueried, reviewerRan, profilesInjected, commitCount, agentSpawnCount };
}

export function calculateScore(gates) {
  const applicable = Object.values(gates).filter(v => v !== "not_applicable");
  const passCount = applicable.filter(v => v === "pass").length;
  return applicable.length > 0 ? Math.round((passCount / applicable.length) * 100) / 100 : 1.0;
}

export function accumulateRates(rates, gates) {
  rates.brain_query.total++;
  if (gates.brain_query_gate === "pass") rates.brain_query.passed++;
  rates.agent_profile.total++;
  if (gates.agent_profile_gate === "pass") rates.agent_profile.passed++;
  if (gates.reviewer_gate !== "not_applicable") {
    rates.reviewer.total++;
    if (gates.reviewer_gate === "pass") rates.reviewer.passed++;
  }
}
