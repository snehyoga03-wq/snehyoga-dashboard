import { getLeadCallStatus } from './callStatusUtils';

export interface DailyLedgerEntry {
  date: string; // YYYY-MM-DD
  assigned: number;
  callsDone: number;
  connectedCalls: number;
  notConnectedCalls: number;
  rawCalls: number; // Connected calls count (used for 60-target calculation)
  target: number; // Default 60
  netBalance: number; // connectedCalls - target
  surplusGivenToPast: number; // surplus calls used to clear past deficits
  deficitPaidByFuture: number; // deficit calls cleared by surplus bank
  adjustedCalls: number; // connectedCalls + deficitPaidByFuture
  isTargetMet: boolean; // adjustedCalls >= target
  unresolvedDeficit: number; // Math.max(0, target - adjustedCalls)
}

export interface UserTargetLedger {
  userName: string;
  totalAssigned: number;
  totalCallsDone: number;
  totalConnectedCalls: number;
  totalNotConnectedCalls: number;
  totalRawCalls: number; // Connected calls count for target evaluation
  totalTarget: number;
  totalAdjustedCalls: number;
  totalSurplusGenerated: number;
  totalDeficitPaidBack: number;
  totalOutstandingDeficit: number;
  appreciationDaysEarned: number;
  totalActiveDays: number;
  appreciationPercentage: number;
  surplusBankBalance: number; // remaining surplus after covering selected days
  dailyEntries: DailyLedgerEntry[];
}

const DAILY_TARGET = 60;

const isUserMatch = (assignedTo: string | null | undefined, createdBy: string | null | undefined, targetUser: string): boolean => {
  if (!targetUser || targetUser === 'all') return true;
  const normTarget = targetUser.trim().toLowerCase();
  const targetFirstName = normTarget.split(' ')[0];

  const normAssigned = (assignedTo || "").trim().toLowerCase();
  const normCreatedBy = (createdBy || "").trim().toLowerCase();

  return (
    normAssigned.includes(normTarget) ||
    normAssigned.includes(targetFirstName) ||
    normCreatedBy.includes(normTarget) ||
    normCreatedBy.includes(targetFirstName)
  );
};

const matchesAutoDate = (lead: any, tDate: string): boolean => {
  if (!tDate) return true;
  const isMasterClassFollow = lead.lead_status === "Master Class Follow";
  if (!lead.created_at) {
    return lead.follow_up_date === tDate || isMasterClassFollow;
  }
  const leadDate = new Date(lead.created_at).toISOString().split('T')[0];
  const isCreatedToday = leadDate === tDate;
  const isFollowUpToday = lead.follow_up_date === tDate;
  const isUntouchedCarryForward = leadDate < tDate && lead.lead_status === "Select Option" && !lead.follow_up_date;
  return isCreatedToday || isFollowUpToday || isUntouchedCarryForward || isMasterClassFollow;
};

/**
 * Calculates daily performance ledger with a Surplus Bank model.
 * 
 * Rules:
 * 1. Target = 60 Connected Calls per day.
 * 2. ONLY Connected Calls count towards meeting the daily target and generating surplus.
 * 3. Any day where connectedCalls > 60 generates surplus into the bank.
 * 4. When viewing a specific date (or date range), ONLY the viewed days
 *    draw from the bank to cover their deficits.
 */
export function calculateCallTargetLedgers(
  history: any[],
  leads: any[],
  assignedUsers: string[],
  startDateStr: string,
  endDateStr: string
): Record<string, UserTargetLedger> {
  const reqStart = startDateStr || endDateStr || new Date().toISOString().split('T')[0];
  const reqEnd = endDateStr || startDateStr || new Date().toISOString().split('T')[0];

  // 1. Build a 60-day historical window up to reqEnd
  const endObj = new Date(reqEnd);
  const startObj = new Date(endObj);
  startObj.setDate(startObj.getDate() - 60);

  const windowDates: string[] = [];
  const curr = new Date(startObj);
  while (curr <= endObj) {
    windowDates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }

  const result: Record<string, UserTargetLedger> = {};

  assignedUsers.forEach(user => {
    // 2. Calculate daily metrics for each day in the window
    const dailyData: { 
      date: string; 
      assigned: number;
      callsDone: number;
      connectedCalls: number; 
      notConnectedCalls: number;
    }[] = [];

    windowDates.forEach(dateKey => {
      const userLeads = leads.filter(l => isUserMatch(l.assigned_to, null, user) && matchesAutoDate(l, dateKey));
      const userLeadIds = new Set(userLeads.map(l => l.id));
      const userHistory = history.filter(h => isUserMatch(null, h.created_by, user) || userLeadIds.has(h.lead_id));

      let connectedCalls = 0;
      let notConnectedCalls = 0;

      userLeads.forEach(lead => {
        const status = getLeadCallStatus(lead, userHistory);
        if (status === 'connected') connectedCalls++;
        else if (status === 'not_connected') notConnectedCalls++;
      });

      const callsDone = connectedCalls + notConnectedCalls;

      dailyData.push({ 
        date: dateKey, 
        assigned: userLeads.length,
        callsDone,
        connectedCalls, 
        notConnectedCalls 
      });
    });

    // 3. Build Surplus Bank from connected calls exceeding daily target (60)
    let surplusBank = 0;
    dailyData.forEach(day => {
      if (day.connectedCalls > DAILY_TARGET) {
        surplusBank += (day.connectedCalls - DAILY_TARGET);
      }
    });

    const totalSurplusGenerated = surplusBank;

    // 4. Build display entries for requested date range
    const displayEntries: DailyLedgerEntry[] = [];

    dailyData.forEach(day => {
      const isInViewRange = day.date >= reqStart && day.date <= reqEnd;
      if (!isInViewRange) return;

      const netBalance = day.connectedCalls - DAILY_TARGET;
      let deficitPaidByBank = 0;
      let unresolvedDeficit = 0;

      if (netBalance < 0) {
        const deficit = Math.abs(netBalance);
        deficitPaidByBank = Math.min(deficit, surplusBank);
        surplusBank -= deficitPaidByBank;
        unresolvedDeficit = deficit - deficitPaidByBank;
      }

      const adjustedCalls = day.connectedCalls + deficitPaidByBank;
      const isTargetMet = adjustedCalls >= DAILY_TARGET;

      displayEntries.push({
        date: day.date,
        assigned: day.assigned,
        callsDone: day.callsDone,
        connectedCalls: day.connectedCalls,
        notConnectedCalls: day.notConnectedCalls,
        rawCalls: day.connectedCalls, // Target is based on connected calls
        target: DAILY_TARGET,
        netBalance,
        surplusGivenToPast: 0,
        deficitPaidByFuture: deficitPaidByBank,
        adjustedCalls,
        isTargetMet,
        unresolvedDeficit
      });
    });

    // Fallback if range is empty
    if (displayEntries.length === 0) {
      const latestActive = [...dailyData].reverse().find(d => d.callsDone > 0 || d.assigned >= 5);
      if (latestActive) {
        const netBalance = latestActive.connectedCalls - DAILY_TARGET;
        const deficit = netBalance < 0 ? Math.abs(netBalance) : 0;
        const deficitPaidByBank = Math.min(deficit, surplusBank);
        surplusBank -= deficitPaidByBank;
        displayEntries.push({
          date: latestActive.date,
          assigned: latestActive.assigned,
          callsDone: latestActive.callsDone,
          connectedCalls: latestActive.connectedCalls,
          notConnectedCalls: latestActive.notConnectedCalls,
          rawCalls: latestActive.connectedCalls,
          target: DAILY_TARGET,
          netBalance,
          surplusGivenToPast: 0,
          deficitPaidByFuture: deficitPaidByBank,
          adjustedCalls: latestActive.connectedCalls + deficitPaidByBank,
          isTargetMet: (latestActive.connectedCalls + deficitPaidByBank) >= DAILY_TARGET,
          unresolvedDeficit: deficit - deficitPaidByBank
        });
      }
    }

    // 5. Calculate summary metrics
    let totalAssigned = 0;
    let totalCallsDone = 0;
    let totalConnectedCalls = 0;
    let totalNotConnectedCalls = 0;
    let totalRawCalls = 0;
    let totalTarget = 0;
    let totalAdjustedCalls = 0;
    let totalDeficitPaidBack = 0;
    let totalOutstandingDeficit = 0;
    let appreciationDaysEarned = 0;

    displayEntries.forEach(entry => {
      totalAssigned += entry.assigned;
      totalCallsDone += entry.callsDone;
      totalConnectedCalls += entry.connectedCalls;
      totalNotConnectedCalls += entry.notConnectedCalls;
      totalRawCalls += entry.rawCalls;
      totalTarget += entry.target;
      totalAdjustedCalls += entry.adjustedCalls;
      totalDeficitPaidBack += entry.deficitPaidByFuture;
      totalOutstandingDeficit += entry.unresolvedDeficit;
      if (entry.isTargetMet) {
        appreciationDaysEarned++;
      }
    });

    const totalActiveDays = displayEntries.length;
    const appreciationPercentage = totalActiveDays > 0 
      ? Math.round((appreciationDaysEarned / totalActiveDays) * 100) 
      : 0;

    result[user] = {
      userName: user,
      totalAssigned,
      totalCallsDone,
      totalConnectedCalls,
      totalNotConnectedCalls,
      totalRawCalls,
      totalTarget,
      totalAdjustedCalls,
      totalSurplusGenerated,
      totalDeficitPaidBack,
      totalOutstandingDeficit,
      appreciationDaysEarned,
      totalActiveDays,
      appreciationPercentage,
      surplusBankBalance: surplusBank,
      dailyEntries: displayEntries
    };
  });

  return result;
}
