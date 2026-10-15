import { supabase } from "@/integrations/supabase/client";

export interface PendingLeadUpdate {
  leadId: string;
  updates: Record<string, any>;
  historyLogs?: Array<{ action_type: string; description: string; created_by?: string }>;
  timestamp: number;
  retryCount: number;
  lastAttempt?: number;
  lastError?: string;
}

export type SyncState = "idle" | "syncing" | "offline" | "pending";

export interface SyncStatusInfo {
  state: SyncState;
  pendingCount: number;
  lastSyncedAt: Date | null;
}

const QUEUE_STORAGE_KEY = "snehyoga_lead_sync_queue_v1";
const CACHE_STORAGE_KEY = "snehyoga_leads_cache_v1";

class LeadSyncService {
  private queue: Map<string, PendingLeadUpdate> = new Map();
  private isSyncing = false;
  private debounceTimer: any = null;
  private lastSyncedAt: Date | null = null;
  private listeners: Set<(info: SyncStatusInfo) => void> = new Set();
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;

    // Load persisted queue from localStorage
    try {
      const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (saved) {
        const parsed: PendingLeadUpdate[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            if (item.leadId && item.updates) {
              this.queue.set(item.leadId, item);
            }
          });
        }
      }
    } catch (e) {
      console.warn("[LeadSyncService] Failed to load pending queue from storage:", e);
    }

    // Setup network listeners
    window.addEventListener("online", () => {
      console.log("[LeadSyncService] Network online - triggering queue flush");
      this.flushQueue();
    });

    window.addEventListener("offline", () => {
      this.notifyListeners();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.queue.size > 0) {
        this.flushQueue();
      }
    });

    // Periodic heartbeat sync every 6 seconds if items are pending
    setInterval(() => {
      if (this.queue.size > 0 && !this.isSyncing) {
        this.flushQueue();
      }
    }, 6000);

    // Initial flush if items are already queued
    if (this.queue.size > 0) {
      setTimeout(() => this.flushQueue(), 1000);
    }
  }

  private persistQueue() {
    try {
      const items = Array.from(this.queue.values());
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("[LeadSyncService] Failed to persist queue to localStorage:", e);
    }
    this.notifyListeners();
  }

  private notifyListeners() {
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    let state: SyncState = "idle";
    if (this.queue.size > 0) {
      if (!isOnline) {
        state = "offline";
      } else if (this.isSyncing) {
        state = "syncing";
      } else {
        state = "pending";
      }
    } else if (this.isSyncing) {
      state = "syncing";
    }

    const info: SyncStatusInfo = {
      state,
      pendingCount: this.queue.size,
      lastSyncedAt: this.lastSyncedAt,
    };

    this.listeners.forEach(cb => {
      try {
        cb(info);
      } catch (err) {
        console.error("[LeadSyncService] Error in listener:", err);
      }
    });
  }

  public subscribe(cb: (info: SyncStatusInfo) => void): () => void {
    this.listeners.add(cb);
    // Send immediate initial status
    cb(this.getStatus());
    return () => {
      this.listeners.delete(cb);
    };
  }

  public getStatus(): SyncStatusInfo {
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    let state: SyncState = "idle";
    if (this.queue.size > 0) {
      if (!isOnline) {
        state = "offline";
      } else if (this.isSyncing) {
        state = "syncing";
      } else {
        state = "pending";
      }
    } else if (this.isSyncing) {
      state = "syncing";
    }

    return {
      state,
      pendingCount: this.queue.size,
      lastSyncedAt: this.lastSyncedAt,
    };
  }

  public getPendingCount(): number {
    return this.queue.size;
  }

  /**
   * Enqueue a lead update.
   * Updates are merged immediately so subsequent rapid changes to the same lead
   * are coalesced into a single database update.
   */
  public enqueueUpdate(
    leadId: string,
    updates: Record<string, any>,
    historyLog?: { action_type: string; description: string; created_by?: string }
  ) {
    if (!leadId) return;

    const existing = this.queue.get(leadId);
    if (existing) {
      existing.updates = { ...existing.updates, ...updates };
      existing.timestamp = Date.now();
      existing.retryCount = 0;
      if (historyLog) {
        existing.historyLogs = existing.historyLogs || [];
        existing.historyLogs.push({ ...historyLog, created_by: historyLog.created_by || "CRM User" });
      }
    } else {
      this.queue.set(leadId, {
        leadId,
        updates: { ...updates },
        historyLogs: historyLog ? [{ ...historyLog, created_by: historyLog.created_by || "CRM User" }] : [],
        timestamp: Date.now(),
        retryCount: 0,
      });
    }

    this.persistQueue();

    // Trigger debounced flush in background (150ms)
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.flushQueue();
    }, 150);
  }

  /**
   * Process and flush all pending updates to Supabase
   */
  public async flushQueue(): Promise<void> {
    if (this.isSyncing || this.queue.size === 0) return;

    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!isOnline) {
      this.notifyListeners();
      return;
    }

    this.isSyncing = true;
    this.notifyListeners();

    try {
      const itemsToProcess = Array.from(this.queue.values());

      for (const item of itemsToProcess) {
        try {
          const { error } = await supabase
            .from("leads")
            .update(item.updates)
            .eq("id", item.leadId);

          if (error) {
            console.error(`[LeadSyncService] Supabase update failed for lead ${item.leadId}:`, error);
            item.retryCount = (item.retryCount || 0) + 1;
            item.lastAttempt = Date.now();
            item.lastError = error.message;

            // If error is row not found or syntax error that will never succeed, discard
            if (error.code === "PGRST116" || error.code === "22P02") {
              this.queue.delete(item.leadId);
            }
            continue;
          }

          // Insert history logs if any
          if (item.historyLogs && item.historyLogs.length > 0) {
            try {
              await supabase.from("lead_history").insert(
                item.historyLogs.map(log => ({
                  lead_id: item.leadId,
                  action_type: log.action_type,
                  description: log.description,
                  created_by: log.created_by || "CRM User",
                }))
              );
            } catch (histErr) {
              console.warn("[LeadSyncService] Non-critical history log error:", histErr);
            }
          }

          // Successfully updated! Remove from pending queue
          this.queue.delete(item.leadId);
          this.lastSyncedAt = new Date();
          this.persistQueue();
        } catch (itemErr: any) {
          console.error(`[LeadSyncService] Network error processing item for lead ${item.leadId}:`, itemErr);
          item.retryCount = (item.retryCount || 0) + 1;
          item.lastAttempt = Date.now();
          item.lastError = itemErr?.message || "Network error";
        }
      }
    } finally {
      this.isSyncing = false;
      this.persistQueue();
      this.notifyListeners();
    }
  }

  /**
   * Applies any pending local queued updates over an array of leads.
   * This guarantees that freshly fetched server data does NOT overwrite
   * un-synced user edits while offline or on slow connection.
   */
  public applyPendingUpdates<T extends { id: string }>(leads: T[]): T[] {
    if (this.queue.size === 0 || !leads || leads.length === 0) return leads;

    return leads.map(lead => {
      const pending = this.queue.get(lead.id);
      if (pending) {
        return {
          ...lead,
          ...pending.updates,
        };
      }
      return lead;
    });
  }

  /**
   * Loads cached leads from localStorage for instant (0ms) first render.
   */
  public loadCachedLeads<T extends { id: string }>(): T[] | null {
    if (typeof window === "undefined") return null;
    try {
      const cached = localStorage.getItem(CACHE_STORAGE_KEY);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return this.applyPendingUpdates(parsed);
      }
    } catch (e) {
      console.warn("[LeadSyncService] Failed to read leads cache:", e);
    }
    return null;
  }

  /**
   * Saves leads to localStorage cache.
   */
  public saveCachedLeads<T>(leads: T[]): void {
    if (typeof window === "undefined" || !leads) return;
    try {
      // Store in cache
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(leads));
    } catch (e: any) {
      console.warn("[LeadSyncService] Could not write leads to cache (quota may be full):", e);
    }
  }

  /**
   * Force manual sync now
   */
  public syncNow(): Promise<void> {
    return this.flushQueue();
  }
}

export const leadSyncService = new LeadSyncService();
