import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import type { NotificationPage } from '@barber-saas/shared-types';

import { mobileApi } from '@/lib/apiClient';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';

export const useNotifications = (limit = 30): UseQueryResult<NotificationPage> => {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: () => mobileApi.notifications.list({ limit }),
    enabled: userId !== undefined,
    refetchInterval: 30_000,
  });
};

export const useMarkNotificationRead = (): UseMutationResult<{ read: true }, Error, string> =>
  useMutation({
    mutationFn: (notificationId: string) => mobileApi.notifications.markRead(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

export const useMarkAllNotificationsRead = (): UseMutationResult<{ readCount: number }, Error, void> =>
  useMutation({
    mutationFn: () => mobileApi.notifications.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
