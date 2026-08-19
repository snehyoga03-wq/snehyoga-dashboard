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

/**
 * Determine call status for a lead:
 * - 'connected': Call was done and connected
 * - 'not_connected': Call was done but not connected (e.g. call not received, busy, etc.)
 * - 'not_called': Lead was not acted upon / called
 */
export function getLeadCallStatus(lead: Partial<Lead>, historyEntries: any[] = []): 'connected' | 'not_connected' | 'not_called' {
  // 1. Explicit call_connected column takes highest priority if set
  if (lead.call_connected === 'connected') return 'connected';
  if (lead.call_connected === 'not_connected') return 'not_connected';

  // 2. Check if lead has been called / acted upon
  const hasStatus = lead.lead_status && lead.lead_status !== 'Select Option';
  const hasRemark = lead.remark && lead.remark !== '' && lead.remark !== 'No remark';
  const hasCallingDate = lead.calling_date && lead.calling_date !== '';
  const hasHistory = historyEntries.some(h => h.lead_id === lead.id);

  const isCallDone = hasStatus || hasRemark || hasCallingDate || hasHistory;
  if (!isCallDone) return 'not_called';

  // 3. If remark exists, check auto-detection from remark text
  if (lead.remark && lead.remark.trim() !== '' && lead.remark !== 'No remark') {
    const detected = autoDetectCallConnected(lead.remark);
    if (detected) return detected as 'connected' | 'not_connected';
  }

  // 4. Default for acted upon leads without explicit non-connected remark
  return 'connected';
}
