export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical' | 'danger';
export type NotificationAudience = 'all' | 'admins' | 'roles' | 'users';

export interface NotificationRecipient {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface ManagedNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  severity: NotificationSeverity;
  action_url: string | null;
  campaign_id: string | null;
  recipient: NotificationRecipient | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  sent_today: number;
}

export interface NotificationPagination {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

export interface NotificationFilters {
  search?: string;
  status?: 'all' | 'read' | 'unread';
  severity?: 'all' | NotificationSeverity;
  type?: string;
  page?: number;
  per_page?: number;
}

export interface NotificationFormData {
  title: string;
  message: string;
  type: string;
  severity: NotificationSeverity;
  action_url?: string | null;
  audience: NotificationAudience;
  recipient_roles?: string[];
  user_ids?: number[];
}

export type NotificationUpdateData = Pick<
  NotificationFormData,
  'title' | 'message' | 'type' | 'severity' | 'action_url'
>;
