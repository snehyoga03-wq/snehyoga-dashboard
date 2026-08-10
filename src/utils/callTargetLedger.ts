export interface DailyLedgerEntry {
  date: string; // YYYY-MM-DD
  rawCalls: number;
  target: number; // Default 60
  netBalance: number; // rawCalls - target
  surplusGivenToPast: number; // surplus calls used to clear past deficits
  deficitPaidByFuture: number; // deficit calls cleared by future surplus
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
  dailyEntries: DailyLedgerEntry[];
}

const DAILY_TARGET = 60;

/**
 * Calculates daily performance ledger with rolling back-adjustment for staff members.
 * 
 * Rules:
 * - Every active day target = 60 calls.
 * - If day N has surplus (calls > 60), surplus calls automatically pay back 
 *   unresolved deficits from earlier days (starting from oldest).
 * - Appreciation days are earned when a day's target is met (either directly or via back-adjustment).
 */
export function calculateCallTargetLedgers(
  history: any[],
  assignedUsers: string[],
  startDateStr: string,
  endDateStr: string
): Record<string, UserTargetLedger> {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  // Generate date list between start and end (inclusive)
  const dateList: string[] = [];
  const curr = new Date(start);
  while (curr <= end) {
    dateList.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }

  const result: Record<string, UserTargetLedger> = {};

  assignedUsers.forEach(user => {
    const firstName = user.split(' ')[0].toLowerCase();

    // Filter history entries for this user
    const userHistory = history.filter(h => {
      const assigned = (h.leads?.assigned_to || "").toLowerCase();
      const createdBy = (h.created_by || "").toLowerCase();
      return assigned.includes(firstName) || createdBy.includes(firstName);
    });

    // Group calls by date YYYY-MM-DD
    const callsByDate: Record<string, number> = {};
    userHistory.forEach(h => {
      if (h.created_at) {
        const dateKey = h.created_at.split('T')[0];
        callsByDate[dateKey] = (callsByDate[dateKey] || 0) + 1;
      }
    });

    // Initialize daily entries chronologically
    const dailyEntries: DailyLedgerEntry[] = dateList.map(dateKey => {
      const rawCalls = callsByDate[dateKey] || 0;
      const netBalance = rawCalls - DAILY_TARGET;
      return {
        date: dateKey,
        rawCalls,
        target: DAILY_TARGET,
        netBalance,
        surplusGivenToPast: 0,
        deficitPaidByFuture: 0,
        adjustedCalls: rawCalls,
        isTargetMet: rawCalls >= DAILY_TARGET,
        unresolvedDeficit: rawCalls < DAILY_TARGET ? (DAILY_TARGET - rawCalls) : 0
      };
    });

    // Roll Back-Adjustment Pass
    // Process days chronologically: when we hit a day with surplus, apply surplus to past unresolved deficits
    for (let i = 0; i < dailyEntries.length; i++) {
      const currentDay = dailyEntries[i];
      if (currentDay.netBalance > 0) {
        let availableSurplus = currentDay.netBalance - currentDay.surplusGivenToPast;

        // Look back at earlier days with unresolved deficits
        for (let j = 0; j < i && availableSurplus > 0; j++) {
          const pastDay = dailyEntries[j];
          if (pastDay.unresolvedDeficit > 0) {
            const amountToPay = Math.min(availableSurplus, pastDay.unresolvedDeficit);
            
            pastDay.deficitPaidByFuture += amountToPay;
            pastDay.adjustedCalls += amountToPay;
            pastDay.unresolvedDeficit -= amountToPay;
            pastDay.isTargetMet = pastDay.adjustedCalls >= pastDay.target;

            currentDay.surplusGivenToPast += amountToPay;
            availableSurplus -= amountToPay;
          }
        }
      }
    }

    // Calculate Summary Metrics
    let totalRawCalls = 0;
    let totalTarget = 0;
    let totalAdjustedCalls = 0;
    let totalSurplusGenerated = 0;
    let totalDeficitPaidBack = 0;
    let totalOutstandingDeficit = 0;
    let appreciationDaysEarned = 0;

    dailyEntries.forEach(entry => {
      totalRawCalls += entry.rawCalls;
      totalTarget += entry.target;
      totalAdjustedCalls += entry.adjustedCalls;
      if (entry.netBalance > 0) {
        totalSurplusGenerated += entry.netBalance;
      }
      totalDeficitPaidBack += entry.deficitPaidByFuture;
      totalOutstandingDeficit += entry.unresolvedDeficit;
      if (entry.isTargetMet) {
        appreciationDaysEarned++;
      }
    });

    const totalActiveDays = dailyEntries.length;
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
      dailyEntries
    };
  });

  return result;
}
