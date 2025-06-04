export interface AuditEntry {
  id: string;
  sessionId: string;
  userId: string;
  type: string;
  timestamp: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditResponse {
  totalCount: number;
  items: AuditEntry[];
}

export type AuditAction = 
  | 'create' 
  | 'edit' 
  | 'merge' 
  | 'reorder' 
  | 'comment'
  | 'export' 
  | 'share' 
  | 'unshare' 
  | 'view'; 