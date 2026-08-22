import type {
  NotificationEvent,
  NotificationPage,
  NotificationQuery,
  RegisterPushDeviceRequest,
} from '@barber-saas/shared-types';

import { pool } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

type Row = Record<string, unknown>;

const iso = (value: unknown): string => new Date(String(value)).toISOString();

const relatedData = (value: unknown): { appointmentId?: string } => {
  const data = value !== null && typeof value === 'object' ? (value as Row) : {};
  return typeof data.appointmentId === 'string' ? { appointmentId: data.appointmentId } : {};
};

export const registerPushDevice = async (
  userId: string,
  input: RegisterPushDeviceRequest,
): Promise<{ registered: true }> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM mobile_push_devices
       WHERE expo_push_token=$1 AND (user_id<>$2 OR installation_id<>$3)`,
      [input.expoPushToken, userId, input.installationId],
    );
    await client.query(
      `INSERT INTO mobile_push_devices
        (user_id,installation_id,expo_push_token,platform,app_version,is_enabled,last_seen_at)
       VALUES ($1,$2,$3,$4,$5,true,CURRENT_TIMESTAMP)
       ON CONFLICT (user_id,installation_id) DO UPDATE SET
         expo_push_token=EXCLUDED.expo_push_token,
         platform=EXCLUDED.platform,
         app_version=EXCLUDED.app_version,
         is_enabled=true,
         last_seen_at=CURRENT_TIMESTAMP,
         updated_at=CURRENT_TIMESTAMP`,
      [userId, input.installationId, input.expoPushToken, input.platform, input.appVersion],
    );
    await client.query('COMMIT');
    return { registered: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const unregisterPushDevice = async (
  userId: string,
  installationId: string,
): Promise<{ unregistered: boolean }> => {
  const result = await pool.query(
    `UPDATE mobile_push_devices SET is_enabled=false,updated_at=CURRENT_TIMESTAMP
     WHERE user_id=$1 AND installation_id=$2 AND is_enabled=true`,
    [userId, installationId],
  );
  return { unregistered: (result.rowCount ?? 0) > 0 };
};

export const listNotifications = async (
  userId: string,
  input: NotificationQuery,
): Promise<NotificationPage> => {
  const values: unknown[] = [userId];
  let cursorSql = '';
  if (input.cursor !== undefined) {
    values.push(input.cursor);
    cursorSql = `AND (created_at,id) < (
      SELECT created_at,id FROM notifications WHERE id=$2 AND user_id=$1
    )`;
  }
  values.push(input.limit + 1);
  const rows = await pool.query<Row>(
    `SELECT id,type,title,message,related_data,is_read,created_at
     FROM notifications
     WHERE user_id=$1 ${cursorSql}
     ORDER BY created_at DESC,id DESC
     LIMIT $${values.length}`,
    values,
  );
  const unread = await pool.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND is_read=false',
    [userId],
  );
  const hasMore = rows.rows.length > input.limit;
  const selected = rows.rows.slice(0, input.limit);
  return {
    notifications: selected.map((row) => ({
      id: String(row.id),
      type: String(row.type) as NotificationEvent,
      title: String(row.title),
      message: String(row.message),
      isRead: Boolean(row.is_read),
      createdAt: iso(row.created_at),
      relatedData: relatedData(row.related_data),
    })),
    unreadCount: Number(unread.rows[0]?.count ?? 0),
    nextCursor: hasMore ? String(selected.at(-1)?.id ?? '') : null,
  };
};

export const markNotificationRead = async (
  userId: string,
  notificationId: string,
): Promise<{ read: true }> => {
  const result = await pool.query(
    `UPDATE notifications SET is_read=true,read_at=COALESCE(read_at,CURRENT_TIMESTAMP)
     WHERE id=$1 AND user_id=$2 RETURNING id`,
    [notificationId, userId],
  );
  if (result.rows[0] === undefined) {
    throw new AppError(404, 'Notification not found.', 'NOTIFICATION_NOT_FOUND');
  }
  return { read: true };
};

export const markAllNotificationsRead = async (userId: string): Promise<{ readCount: number }> => {
  const result = await pool.query(
    `UPDATE notifications SET is_read=true,read_at=CURRENT_TIMESTAMP
     WHERE user_id=$1 AND is_read=false`,
    [userId],
  );
  return { readCount: result.rowCount ?? 0 };
};

type PushTicket = {
  status?: string;
  details?: { error?: string };
};

export const dispatchPendingPushNotifications = async (): Promise<void> => {
  const result = await pool.query<Row>(
    `SELECT n.id,n.type,n.title,n.message,n.related_data,d.id AS device_id,d.expo_push_token
     FROM notifications n
     JOIN mobile_push_devices d ON d.user_id=n.user_id AND d.is_enabled=true
     LEFT JOIN mobile_push_deliveries pd
       ON pd.notification_id=n.id AND pd.device_id=d.id
     WHERE (pd.id IS NULL OR pd.status='FAILED')
       AND d.created_at<=n.created_at
       AND COALESCE(n.scheduled_for,CURRENT_TIMESTAMP)<=CURRENT_TIMESTAMP
       AND n.created_at>CURRENT_TIMESTAMP-INTERVAL '24 hours'
     ORDER BY n.created_at ASC
     LIMIT 100`,
  );
  if (result.rows.length === 0) return;
  const messages = result.rows.map((row) => ({
    to: String(row.expo_push_token),
    sound: 'default',
    channelId: 'appointments',
    title: String(row.title),
    body: String(row.message),
    data: {
      notificationId: String(row.id),
      type: String(row.type),
      ...relatedData(row.related_data),
    },
  }));
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(env.EXPO_ACCESS_TOKEN.length > 0
          ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(messages),
    });
    if (!response.ok) throw new Error(`Push service responded with ${response.status}.`);
    const payload = (await response.json()) as { data?: PushTicket[] };
    const tickets = Array.isArray(payload.data) ? payload.data : [];
    const delivered = new Set<string>();
    const invalidDevices: string[] = [];
    const deliveries: Array<[string, string, string, string | null]> = [];
    result.rows.forEach((row, index) => {
      const ticket = tickets[index];
      const errorCode = ticket?.details?.error ?? null;
      const status =
        ticket?.status === 'ok'
          ? 'DELIVERED'
          : errorCode === 'DeviceNotRegistered'
            ? 'INVALID'
            : 'FAILED';
      deliveries.push([String(row.id), String(row.device_id), status, errorCode]);
    });
    tickets.forEach((ticket, index) => {
      const row = result.rows[index];
      if (row === undefined) return;
      if (ticket.status === 'ok') delivered.add(String(row.id));
      if (ticket.details?.error === 'DeviceNotRegistered')
        invalidDevices.push(String(row.device_id));
    });
    if (deliveries.length > 0) {
      const placeholders = deliveries
        .map((_, index) => {
          const offset = index * 4;
          return `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},CURRENT_TIMESTAMP)`;
        })
        .join(',');
      await pool.query(
        `INSERT INTO mobile_push_deliveries
          (notification_id,device_id,status,error_code,attempted_at)
         VALUES ${placeholders}
         ON CONFLICT (notification_id,device_id) DO UPDATE SET
           status=EXCLUDED.status,
           error_code=EXCLUDED.error_code,
           attempted_at=CURRENT_TIMESTAMP`,
        deliveries.flat(),
      );
    }
    if (delivered.size > 0) {
      await pool.query(
        `UPDATE notifications SET sent_via_push=true,sent_at=CURRENT_TIMESTAMP
         WHERE id=ANY($1::uuid[])`,
        [[...delivered]],
      );
    }
    if (invalidDevices.length > 0) {
      await pool.query(
        `UPDATE mobile_push_devices SET is_enabled=false,updated_at=CURRENT_TIMESTAMP
         WHERE id=ANY($1::uuid[])`,
        [invalidDevices],
      );
    }
  } catch (error) {
    logger.warn('Push notification dispatch failed', {
      message: error instanceof Error ? error.message : 'Unknown push error',
    });
  }
};
