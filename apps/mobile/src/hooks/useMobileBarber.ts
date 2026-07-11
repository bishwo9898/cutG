import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type {
  SaveAddressRequest,
  SetMobileConfigRequest,
  TravelEstimateRequest,
} from '@barber-saas/shared-types';

import { mobileApi } from '@/lib/apiClient';
import { queryClient } from '@/lib/queryClient';
import type { ClientAddress, MobileBarberConfig, TravelEstimate } from '@/lib/types';

export const useMobileConfig = (): UseQueryResult<MobileBarberConfig> =>
  useQuery({ queryKey: ['barber', 'mobile-config'], queryFn: mobileApi.barber.mobileConfig });

export const useUpdateMobileConfig = (): UseMutationResult<
  MobileBarberConfig,
  Error,
  SetMobileConfigRequest
> =>
  useMutation({
    mutationFn: mobileApi.barber.updateMobileConfig,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['barber', 'mobile-config'] }),
  });

export const useClientAddresses = (): UseQueryResult<{ addresses: ClientAddress[] }> =>
  useQuery({ queryKey: ['client', 'addresses'], queryFn: mobileApi.client.addresses });

export const useCreateAddress = (): UseMutationResult<ClientAddress, Error, SaveAddressRequest> =>
  useMutation({
    mutationFn: mobileApi.client.createAddress,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client', 'addresses'] }),
  });

export const useDeleteAddress = (): UseMutationResult<{ message: string }, Error, string> =>
  useMutation({
    mutationFn: mobileApi.client.deleteAddress,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client', 'addresses'] }),
  });

export const useSetDefaultAddress = (): UseMutationResult<ClientAddress, Error, string> =>
  useMutation({
    mutationFn: mobileApi.client.setDefaultAddress,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client', 'addresses'] }),
  });

export const useTravelEstimate = (): UseMutationResult<
  TravelEstimate,
  Error,
  TravelEstimateRequest
> => useMutation({ mutationFn: mobileApi.barber.travelEstimate });
