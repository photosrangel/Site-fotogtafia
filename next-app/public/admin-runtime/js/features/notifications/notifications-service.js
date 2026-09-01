import { supabase } from '../../core/supabase-client.js';

async function invokeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data || {};
}

export async function sendContactReply({ messageId, replyText, attachments = [] }) {
  return invokeFunction('contact-notifications', {
    action: 'reply',
    message_id: messageId,
    reply_text: replyText,
    attachments
  });
}

export async function notifySession(action, { sessionId, ...extra } = {}) {
  return invokeFunction('ensaio-notifications', {
    action,
    ensaio_id: sessionId,
    ...extra
  });
}
