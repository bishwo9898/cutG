'use client';

import { clientApi } from '@barber-saas/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { browserApi } from '@/lib/browser-api';
import type { HairDesign } from '@/lib/contracts';

export type SavedHairDesignsResponse = { designs: HairDesign[] };

export const savedHairDesignsKey = (clientId: string | null): readonly ['hair-designs', string] => [
  'hair-designs',
  clientId ?? 'signed-out',
];

export const useSavedHairDesigns = (
  clientId: string | null,
): UseQueryResult<SavedHairDesignsResponse> =>
  useQuery({
    enabled: clientId !== null,
    queryKey: savedHairDesignsKey(clientId),
    queryFn: () => clientApi.designs<SavedHairDesignsResponse>(browserApi),
    refetchInterval: (query) =>
      query.state.data?.designs.some((design) =>
        ['QUEUED', 'PROCESSING'].includes(design.generationStatus ?? ''),
      )
        ? 2000
        : false,
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: 'always',
    retry: 2,
    staleTime: 0,
  });
