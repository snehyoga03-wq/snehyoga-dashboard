export interface DailyLedgerEntry {
  date: string; // YYYY-MM-DD
  rawCalls: number;
  target: number; // Default 60
  netBalance: number; // rawCalls - target
  surplusGivenToPast: number; // surplus calls used to clear past deficits
  deficitPaidByFuture: number; // deficit calls cleared by surplus bank
  adjustedCalls: number; // rawCalls + deficitPaidByFuture
  isTargetMet: boolean; // adjustedCalls >= target
  unresolvedDeficit: number; // Math.max(0, target - adjustedCalls)
}

export interface UserTargetLedger {
  userName: string;
  totalRawCalls: number;
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
 * How the Surplus Bank works:
 * 1. Scan ALL active duty days in the past 60 days.
 * 2. Any day where rawCalls > 60 generates surplus into the bank.
 *    Bank = SUM of (rawCalls - 60) for all surplus days.
 * 3. When viewing a specific date (or date range), ONLY the viewed days
 *    draw from the bank to cover their deficits.
 * 4. This ensures that surplus from e.g. 10-08-2026 (+54) is available
 *    to cover today's deficit, not consumed by intermediate days.
 * 
 * Example:
 *   08/10: 114 raw calls → +54 surplus added to bank
 *   08/12 (today): 28 raw calls → 32 deficit → bank covers 32 → adjusted = 60
 *   Bank remaining: 54 - 32 = 22 surplus still available
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
    // 2. Calculate raw calls for each day in the window
    const dailyData: { date: string; rawCalls: number; assigned: number }[] = [];

    windowDates.forEach(dateKey => {
      const userLeads = leads.filter(l => isUserMatch(l.assigned_to, null, user) && matchesAutoDate(l, dateKey));
      // RAW CALLS = 100% synchronized with TOTAL CALLS DONE
      const rawCalls = userLeads.filter(l => 
        (l.lead_status && l.lead_status !== 'Select Option') || 
        (l.remark && l.remark !== '' && l.remark !== 'No remark') ||
        (l.calling_date && l.calling_date !== '') ||
        history.some(h => h.lead_id === l.id)
      ).length;

      dailyData.push({ date: dateKey, rawCalls, assigned: userLeads.length });
    });

    // 3. Build the Surplus Bank from ALL surplus days in the window
    //    (days where rawCalls exceeded the 60-call target)
    let surplusBank = 0;
    dailyData.forEach(day => {
      if (day.rawCalls > DAILY_TARGET) {
        surplusBank += (day.rawCalls - DAILY_TARGET);
      }
    });

    const totalSurplusGenerated = surplusBank;

    // 4. Build display entries for the requested date range
    //    ONLY these days draw from the surplus bank
    const displayEntries: DailyLedgerEntry[] = [];

    dailyData.forEach(day => {
      const isInViewRange = day.date >= reqStart && day.date <= reqEnd;
      if (!isInViewRange) return;

      const netBalance = day.rawCalls - DAILY_TARGET;
      let deficitPaidByBank = 0;
      let unresolvedDeficit = 0;

      if (netBalance < 0) {
        // This day has a deficit — draw from surplus bank
        const deficit = Math.abs(netBalance);
        deficitPaidByBank = Math.min(deficit, surplusBank);
        surplusBank -= deficitPaidByBank;
        unresolvedDeficit = deficit - deficitPaidByBank;
      }

      const adjustedCalls = day.rawCalls + deficitPaidByBank;
      const isTargetMet = adjustedCalls >= DAILY_TARGET;

      displayEntries.push({
        date: day.date,
        rawCalls: day.rawCalls,
        target: DAILY_TARGET,
        netBalance,
        surplusGivenToPast: 0,
        deficitPaidByFuture: deficitPaidByBank,
        adjustedCalls,
        isTargetMet,
        unresolvedDeficit
      });
    });

    // If no entries in the requested range, use latest active day as fallback
    if (displayEntries.length === 0) {
      const latestActive = [...dailyData].reverse().find(d => d.rawCalls > 0 || d.assigned >= 5);
      if (latestActive) {
        const netBalance = latestActive.rawCalls - DAILY_TARGET;
        const deficit = netBalance < 0 ? Math.abs(netBalance) : 0;
        const deficitPaidByBank = Math.min(deficit, surplusBank);
        surplusBank -= deficitPaidByBank;
        displayEntries.push({
          date: latestActive.date,
          rawCalls: latestActive.rawCalls,
          target: DAILY_TARGET,
          netBalance,
          surplusGivenToPast: 0,
          deficitPaidByFuture: deficitPaidByBank,
          adjustedCalls: latestActive.rawCalls + deficitPaidByBank,
          isTargetMet: (latestActive.rawCalls + deficitPaidByBank) >= DAILY_TARGET,
          unresolvedDeficit: deficit - deficitPaidByBank
        });
      }
    }

    // 5. Calculate summary metrics
    let totalRawCalls = 0;
    let totalTarget = 0;
    let totalAdjustedCalls = 0;
    let totalDeficitPaidBack = 0;
    let totalOutstandingDeficit = 0;
    let appreciationDaysEarned = 0;

    displayEntries.forEach(entry => {
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
