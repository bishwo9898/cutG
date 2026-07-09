'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { browserApi } from '@/lib/browser-api';
import type { User } from '@/lib/contracts';

export const useUser = (): UseQueryResult<User> =>
  useQuery({
    queryKey: ['user'],
    queryFn: () => browserApi.get<User>('/auth/me'),
  });
