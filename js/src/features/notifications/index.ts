export type ContactReplyPayload = {
  messageId: string;
  replyText: string;
  attachments?: Array<Record<string, unknown>>;
};

export type SessionNotificationAction =
  | 'selection_finalized'
  | 'photos_ready';
