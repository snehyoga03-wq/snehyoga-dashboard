import type { Lead } from '@/integrations/supabase/types';

// Patterns that indicate the call was NOT connected
export const NOT_CONNECTED_PATTERNS = [
  "call not received",
  "call not picked",
  "not received",
  "not picked",
  "not reachable",
  "unreachable",
  "switched off",
  "switch off",
  "out of coverage",
  "busy",
  "no response",
  "no answer",
  "no ans",
  "not ans",
  "didn't pick",
  "did not pick",
  "didn't answer",
  "did not answer",
  "not responding",
  "phone off",
  "number not working",
  "invalid number",
  "wrong number",
  "disconnected",
  "network issue",
  "network error",
  "rnr",
  "np",
  "cnr",
  "snr",
  "not available",
  "unavailable",
  "ring no reply",
  "call not connected",
  "couldn't connect",
  "could not connect",
  "can't reach",
  "cannot reach"
];

/** Auto-detect call connected status from remark text */
export const autoDetectCallConnected = (remark: string | null): string | null => {
  if (!remark || remark.trim() === "" || remark === "No remark") return null;
  const lower = remark.trim().toLowerCase();
  const isNotConnected = NOT_CONNECTED_PATTERNS.some(pattern => lower.includes(pattern));
  return isNotConnected ? "not_connected" : "connected";
};

export interface DateFilterOptions {
  startDate?: string;
  endDate?: string;
  targetDate?: string;
}

/** Check if a date string falls inside the provided date filter options */
export const isDateInFilter = (
  dateVal: string | null | undefined,
  filter?: DateFilterOptions
): boolean => {
  if (!filter || (!filter.startDate && !filter.endDate && !filter.targetDate)) return true;
  if (!dateVal) return false;

  const d = new Date(dateVal);
  if (isNaN(d.getTime())) {
    if (typeof dateVal === 'string') {
      const match = dateVal.slice(0, 10);
      if (filter.targetDate) return match === filter.targetDate;
      if (filter.startDate && filter.endDate) return match >= filter.startDate && match <= filter.endDate;
      if (filter.startDate) return match >= filter.startDate;
      if (filter.endDate) return match <= filter.endDate;
    }
    return false;
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const localYMD = `${y}-${m}-${day}`;

  if (filter.targetDate) {
    if (localYMD === filter.targetDate) return true;
    if (typeof dateVal === 'string' && dateVal.startsWith(filter.targetDate)) return true;
    return false;
  }

  if (filter.startDate && filter.endDate) {
    return localYMD >= filter.startDate && localYMD <= filter.endDate;
  }
  if (filter.startDate) return localYMD >= filter.startDate;
  if (filter.endDate) return localYMD <= filter.endDate;

  return true;
};

/**
 * Determine call status for a lead:
 * - 'connected': Explicitly set or confirmed connected in the target period
 * - 'not_connected': Explicitly set or confirmed not connected in the target period
 * - 'not_called': No call was made, no status update, or untouched
 * 
 * CRITICAL RULE: Unworked leads in 'Select Option' with no explicit call flag
 * or history entry must NEVER be automatically assumed 'connected'.
 */
export function getLeadCallStatus(
  lead: Partial<Lead>,
  historyEntries: any[] = [],
  dateFilter?: DateFilterOptions
): 'connected' | 'not_connected' | 'not_called' {
  const hasDateFilter = Boolean(dateFilter && (dateFilter.targetDate || (dateFilter.startDate && dateFilter.endDate)));
  const isUnworkedSelectOption = (!lead.lead_status || lead.lead_status === 'Select Option') && (!lead.call_connected || lead.call_connected === 'none');
  const leadHistory = historyEntries.filter(h => h.lead_id === lead.id);

  if (hasDateFilter) {
    // 1. Check history logged during this specific period
    const periodHistory = leadHistory.filter(h => isDateInFilter(h.created_at, dateFilter));
    if (periodHistory.length > 0) {
      for (const h of periodHistory) {
        if (h.call_connected === 'connected') return 'connected';
        if (h.call_connected === 'not_connected') return 'not_connected';
        if (h.action_type === 'Call Status') {
          if (h.description?.toLowerCase().includes('not connected')) return 'not_connected';
          if (h.description?.toLowerCase().includes('connected')) return 'connected';
        }
        const text = h.notes || h.remark || h.comment || h.remarks;
        if (text && text.trim() !== '' && text !== 'No remark') {
          const detected = autoDetectCallConnected(text);
          if (detected) return detected as 'connected' | 'not_connected';
        }
      }
    }

    // 2. Check explicit calling_date in the period
    if (lead.calling_date && isDateInFilter(lead.calling_date, dateFilter)) {
      if (lead.call_connected === 'connected') return 'connected';
      if (lead.call_connected === 'not_connected') return 'not_connected';
      if (lead.lead_status === 'Deal Done') return 'connected';
      if (lead.remark && lead.remark.trim() !== '' && lead.remark !== 'No remark') {
        const detected = autoDetectCallConnected(lead.remark);
        if (detected) return detected as 'connected' | 'not_connected';
      }
      return 'connected';
    }

    // 3. Check created_at in the period (newly created lead today)
    if (lead.created_at && isDateInFilter(lead.created_at, dateFilter)) {
      if (lead.call_connected === 'connected') return 'connected';
      if (lead.call_connected === 'not_connected') return 'not_connected';
      if (lead.lead_status === 'Deal Done') return 'connected';
      if (lead.lead_status && lead.lead_status !== 'Select Option') {
        if (lead.remark && lead.remark.trim() !== '' && lead.remark !== 'No remark') {
          const detected = autoDetectCallConnected(lead.remark);
          if (detected) return detected as 'connected' | 'not_connected';
        }
        return 'connected';
      }
    }

    // No telecaller call or activity occurred within this date filter
    return 'not_called';
  }

  // NO DATE FILTER (Overall Evaluation)
  if (isUnworkedSelectOption) {
    const hasCallInHistory = leadHistory.some(h =>
      h.call_connected === 'connected' ||
      h.call_connected === 'not_connected' ||
      h.action_type === 'Call Status' ||
      (h.description && (h.description.toLowerCase().includes('call status') || h.description.toLowerCase().includes('connected')))
    );
    if (!hasCallInHistory) {
      return 'not_called';
    }
  }

  // 1. Explicit call_connected column
  if (lead.call_connected === 'connected') return 'connected';
  if (lead.call_connected === 'not_connected') return 'not_connected';

  // 2. Check history entries
  if (leadHistory.length > 0) {
    for (const h of leadHistory) {
      if (h.call_connected === 'connected') return 'connected';
      if (h.call_connected === 'not_connected') return 'not_connected';
      const text = h.notes || h.remark || h.comment || h.remarks;
      if (text && text.trim() !== '' && text !== 'No remark') {
        const detected = autoDetectCallConnected(text);
        if (detected) return detected as 'connected' | 'not_connected';
      }
    }
  }

  // 3. Fallback for converted deals
  if (lead.lead_status === 'Deal Done') {
    return 'connected';
  }

  // 4. Status moved away from Select Option with notes
  if (lead.lead_status && lead.lead_status !== 'Select Option' && lead.remark && lead.remark.trim() !== '' && lead.remark !== 'No remark') {
    const detected = autoDetectCallConnected(lead.remark);
    if (detected) return detected as 'connected' | 'not_connected';
  }

  return 'not_called';
}

/** Check if telecaller actually interacted with or worked on this lead during the period */
export function isLeadWorkedInPeriod(
  lead: Partial<Lead>,
  historyEntries: any[] = [],
  dateFilter?: DateFilterOptions
): boolean {
  const callStatus = getLeadCallStatus(lead, historyEntries, dateFilter);
  if (callStatus !== 'not_called') return true;

  const hasDateFilter = Boolean(dateFilter && (dateFilter.targetDate || (dateFilter.startDate && dateFilter.endDate)));
  const leadHistory = historyEntries.filter(h => h.lead_id === lead.id);

  if (hasDateFilter) {
    const periodHistory = leadHistory.filter(h => isDateInFilter(h.created_at, dateFilter));
    if (periodHistory.length > 0) return true;
    if (lead.calling_date && isDateInFilter(lead.calling_date, dateFilter)) return true;
    if (lead.created_at && isDateInFilter(lead.created_at, dateFilter)) {
      if (lead.lead_status && lead.lead_status !== 'Select Option') return true;
      if (lead.call_connected && lead.call_connected !== 'none') return true;
    }
    return false;
  }

  if (lead.call_connected && lead.call_connected !== 'none') return true;
  if (leadHistory.length > 0) return true;
  if (lead.lead_status && lead.lead_status !== 'Select Option') return true;
  return false;
}
