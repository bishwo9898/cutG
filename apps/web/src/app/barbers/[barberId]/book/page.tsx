'use client';

import { barberDiscoveryApi, clientApi } from '@barber-saas/api-client';
import { Autocomplete, LoadScript, type Libraries } from '@react-google-maps/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Car, Check, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ClientHeader } from '@/components/client-header';
import { BookingSteps, SlotPicker } from '@/components/client-ui';
import { Notice } from '@/components/notice';
import { useUser } from '@/hooks/use-user';
import { browserApi } from '@/lib/browser-api';
import type {
  ClientAddress,
  ClientAppointment,
  PublicMobileConfig,
  PublicService,
  PublicSlot,
  TravelEstimate,
} from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';

type Profile = {
  id: string;
  businessName: string;
  city: string | null;
  state: string | null;
};
type Services = { services: PublicService[] };
type Slots = { slots: PublicSlot[] };
type AddressList = { addresses: ClientAddress[] };
type AppointmentType = 'shop' | 'mobile';
type OneTimeAddress = {
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude: number;
  longitude: number;
};

const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const mapsLibraries: Libraries = ['places'];

const addressComponent = (
  components: google.maps.GeocoderAddressComponent[],
  type: string,
  short = false,
): string => {
  const component = components.find((item) => item.types.includes(type));
  return component === undefined ? '' : short ? component.short_name : component.long_name;
};

export default function BookBarberPage(): React.ReactElement {
  const { barberId } = useParams<{ barberId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  const autocomplete = useRef<google.maps.places.Autocomplete | null>(null);
  const [service, setService] = useState<PublicService | null>(null);
  const [appointmentType, setAppointmentType] = useState<AppointmentType | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [oneTimeAddress, setOneTimeAddress] = useState<OneTimeAddress | null>(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [saveAddress, setSaveAddress] = useState(false);
  const [slot, setSlot] = useState<PublicSlot | null>(null);
  const [clientNotes, setClientNotes] = useState('');

  const profile = useQuery({
    queryKey: ['public-barber-book', barberId],
    queryFn: () => barberDiscoveryApi.getProfile<Profile>(browserApi, barberId),
  });
  const mobile = useQuery({
    queryKey: ['public-barber-mobile', barberId],
    queryFn: () => barberDiscoveryApi.getMobileConfig<PublicMobileConfig>(browserApi, barberId),
  });
  const services = useQuery({
    queryKey: ['public-barber-book-services', barberId],
    queryFn: () => barberDiscoveryApi.getServices<Services>(browserApi, barberId),
  });
  const addresses = useQuery({
    enabled: user?.userType === 'CLIENT',
    queryKey: ['client-addresses'],
    queryFn: () => clientApi.addresses<AddressList>(browserApi),
  });
  const selectedAddress = useMemo(
    () => addresses.data?.addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses.data?.addresses, selectedAddressId],
  );
  const destination = selectedAddress ?? oneTimeAddress;
  const estimate = useMutation({
    mutationFn: (coordinates: { latitude: number; longitude: number }) =>
      browserApi.post<TravelEstimate>('/barbers/me/mobile/estimate', {
        barberId,
        destinationLatitude: coordinates.latitude,
        destinationLongitude: coordinates.longitude,
      }),
  });

  useEffect(() => {
    if (appointmentType !== 'mobile' || destination === null) return;
    estimate.mutate({ latitude: destination.latitude, longitude: destination.longitude });
  }, [appointmentType, destination?.latitude, destination?.longitude]);

  useEffect(() => {
    if (selectedAddressId !== null || oneTimeAddress !== null) return;
    const initial =
      addresses.data?.addresses.find((address) => address.isDefault) ??
      addresses.data?.addresses[0];
    if (initial !== undefined) setSelectedAddressId(initial.id);
  }, [addresses.data?.addresses, oneTimeAddress, selectedAddressId]);

  const slots = useQuery({
    enabled:
      service !== null &&
      appointmentType !== null &&
      (appointmentType === 'shop' || estimate.data !== undefined),
    queryKey: [
      'public-barber-book-slots',
      barberId,
      service?.id,
      appointmentType,
      estimate.data?.estimatedTravelMinutes,
    ],
    queryFn: () =>
      barberDiscoveryApi.getSlots<Slots>(browserApi, barberId, {
        days: 14,
        ...(appointmentType === 'mobile'
          ? {
              mobileService: true,
              travelMinutes: estimate.data?.estimatedTravelMinutes,
            }
          : {}),
      }),
  });
  const filteredSlots = useMemo(() => {
    if (service === null) return [];
    return (slots.data?.slots ?? []).filter((candidate) => {
      const start = new Date(`${candidate.date}T${candidate.startTime}:00`).getTime();
      const end = new Date(`${candidate.date}T${candidate.endTime}:00`).getTime();
      const durationFits = (end - start) / 60000 >= service.durationMinutes;
      const mobileFits = appointmentType !== 'mobile' || candidate.availableForMobile === true;
      return candidate.isAvailable && durationFits && mobileFits;
    });
  }, [appointmentType, service, slots.data?.slots]);

  const booking = useMutation({
    mutationFn: async () => {
      let clientAddressId = selectedAddress?.id;
      if (oneTimeAddress !== null && saveAddress) {
        const saved = await clientApi.createAddress<ClientAddress>(browserApi, {
          label: 'Mobile visit',
          addressLine1: oneTimeAddress.addressLine1,
          city: oneTimeAddress.city,
          state: oneTimeAddress.state,
          zipCode: oneTimeAddress.zipCode,
          country: oneTimeAddress.country,
        });
        clientAddressId = saved.id;
        await queryClient.invalidateQueries({ queryKey: ['client-addresses'] });
      }
      return clientApi.bookAppointment<ClientAppointment>(browserApi, {
        barberId,
        serviceId: service?.id,
        availabilitySlotId: slot?.id,
        clientNotes: clientNotes.trim() || undefined,
        isMobileService: appointmentType === 'mobile',
        ...(appointmentType !== 'mobile'
          ? {}
          : clientAddressId !== undefined
            ? { clientAddressId }
            : { clientAddressOneTime: oneTimeAddress ?? undefined }),
      });
    },
    onSuccess: (appointment) => {
      router.push(`/client/appointments/${appointment.id}`);
    },
  });

  const choosePlace = (): void => {
    const place = autocomplete.current?.getPlace();
    const location = place?.geometry?.location;
    const components = place?.address_components;
    if (location === undefined || components === undefined) return;
    const streetNumber = addressComponent(components, 'street_number');
    const route = addressComponent(components, 'route');
    setOneTimeAddress({
      addressLine1: [streetNumber, route].filter(Boolean).join(' '),
      city: addressComponent(components, 'locality') || addressComponent(components, 'sublocality'),
      state: addressComponent(components, 'administrative_area_level_1', true),
      zipCode: addressComponent(components, 'postal_code'),
      country: addressComponent(components, 'country', true) || 'US',
      latitude: location.lat(),
      longitude: location.lng(),
    });
    setAddressSearch(place?.formatted_address ?? place?.name ?? 'Selected address');
    setSelectedAddressId(null);
    setSlot(null);
  };

  const mobileEnabled = mobile.data?.isEnabled === true;
  const isMobile = appointmentType === 'mobile';
  const stepLabels = mobileEnabled
    ? ['Service', 'Type', 'Address', 'Time', 'Review']
    : ['Service', 'Time', 'Review'];
  const currentStep =
    service === null
      ? 1
      : appointmentType === null
        ? 2
        : isMobile && destination === null
          ? 3
          : slot === null
            ? mobileEnabled
              ? 4
              : 2
            : mobileEnabled
              ? 5
              : 3;
  const travelFee = isMobile ? (estimate.data?.travelFee ?? 0) : 0;
  const total = (service?.price ?? 0) + travelFee;

  return (
    <main className="market-page">
      <ClientHeader />
      <section className="booking-shell mobile-booking-shell">
        <div className="section-title">
          <div>
            <p className="eyebrow">Book appointment</p>
            <h1>{profile.data?.businessName ?? 'Barber'}</h1>
          </div>
        </div>
        <BookingSteps currentStep={currentStep} labels={stepLabels} />
        {user?.userType !== 'CLIENT' && (
          <Notice>
            You can explore the flow now. Sign in with a client account before confirming.
          </Notice>
        )}

        <div className="booking-flow">
          <section className="booking-step-panel">
            <h2>Choose a service</h2>
            <div className="list-stack">
              {(services.data?.services ?? []).map((item) => (
                <button
                  className={`list-row selectable${service?.id === item.id ? ' is-selected' : ''}`}
                  key={item.id}
                  onClick={() => {
                    setService(item);
                    setAppointmentType(mobileEnabled ? null : 'shop');
                    setSlot(null);
                  }}
                  type="button"
                >
                  <span>
                    <strong>{item.name}</strong>
                    <span className="muted">{item.durationMinutes} min</span>
                  </span>
                  <strong>${item.price.toFixed(2)}</strong>
                </button>
              ))}
            </div>
          </section>

          {service !== null && mobileEnabled && (
            <section className="booking-step-panel">
              <h2>How would you like your appointment?</h2>
              <div className="appointment-type-grid">
                <button
                  className={`appointment-type-option${appointmentType === 'shop' ? ' is-selected' : ''}`}
                  onClick={() => {
                    setAppointmentType('shop');
                    setSlot(null);
                  }}
                  type="button"
                >
                  <Building2 size={22} />
                  <strong>Visit the shop</strong>
                  <span>
                    {[profile.data?.city, profile.data?.state].filter(Boolean).join(', ') ||
                      'Barber location'}
                  </span>
                  <small>No travel fee</small>
                </button>
                <button
                  className={`appointment-type-option${appointmentType === 'mobile' ? ' is-selected' : ''}`}
                  onClick={() => {
                    setAppointmentType('mobile');
                    setSlot(null);
                  }}
                  type="button"
                >
                  <Car size={22} />
                  <strong>Mobile - come to me</strong>
                  <span>Your barber travels to your address</span>
                  <small>
                    {mobile.data?.feeStructure === 'flat'
                      ? `Travel fee about $${mobile.data.baseFee?.toFixed(2)}`
                      : 'Fee calculated from your address'}
                  </small>
                </button>
              </div>
            </section>
          )}

          {service !== null && isMobile && (
            <section className="booking-step-panel">
              <h2>Where should your barber come?</h2>
              <div className="address-choice-grid">
                {(addresses.data?.addresses ?? []).map((address) => (
                  <button
                    className={`address-option${selectedAddressId === address.id ? ' is-selected' : ''}`}
                    key={address.id}
                    onClick={() => {
                      setSelectedAddressId(address.id);
                      setOneTimeAddress(null);
                      setAddressSearch('');
                      setSlot(null);
                    }}
                    type="button"
                  >
                    <span className="address-option-icon">
                      <MapPin size={17} />
                    </span>
                    <span>
                      <strong>{address.label}</strong>
                      <small>
                        {address.addressLine1}, {address.city}, {address.state} {address.zipCode}
                      </small>
                    </span>
                    {selectedAddressId === address.id && <Check size={18} />}
                  </button>
                ))}
              </div>
              <div className="field">
                <label htmlFor="booking-address">Use a different address</label>
                {mapsKey.length === 0 ? (
                  <Notice>Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for address search.</Notice>
                ) : (
                  <LoadScript googleMapsApiKey={mapsKey} libraries={mapsLibraries}>
                    <Autocomplete
                      onLoad={(instance) => {
                        autocomplete.current = instance;
                      }}
                      onPlaceChanged={choosePlace}
                      options={{
                        componentRestrictions: { country: 'us' },
                        fields: ['address_components', 'formatted_address', 'geometry', 'name'],
                        types: ['address'],
                      }}
                    >
                      <div className="input-with-icon">
                        <MapPin size={17} />
                        <input
                          id="booking-address"
                          autoComplete="off"
                          placeholder="Search for an address"
                          value={addressSearch}
                          onChange={(event) => {
                            setAddressSearch(event.target.value);
                            setOneTimeAddress(null);
                          }}
                        />
                      </div>
                    </Autocomplete>
                  </LoadScript>
                )}
              </div>
              {oneTimeAddress !== null && (
                <label className="checkbox-row">
                  <input
                    checked={saveAddress}
                    onChange={(event) => setSaveAddress(event.target.checked)}
                    type="checkbox"
                  />
                  Save this address to my profile
                </label>
              )}
              {estimate.isPending && <p className="muted">Calculating travel time...</p>}
              {estimate.data !== undefined && (
                <div className="travel-estimate">
                  <MapPin size={19} />
                  <div>
                    <strong>
                      {estimate.data.distanceMiles.toFixed(1)} miles · about{' '}
                      {estimate.data.estimatedTravelMinutes} min
                    </strong>
                    <span>${estimate.data.travelFee.toFixed(2)} travel fee</span>
                  </div>
                </div>
              )}
              {estimate.isError && <Notice>{errorMessage(estimate.error)}</Notice>}
            </section>
          )}

          {service !== null &&
            appointmentType !== null &&
            (!isMobile || estimate.data !== undefined) && (
              <section className="booking-step-panel">
                <h2>Choose a time</h2>
                {isMobile && (
                  <Notice tone="success">
                    Showing slots with enough lead time for your barber to travel.
                  </Notice>
                )}
                <SlotPicker slots={filteredSlots} selectedId={slot?.id} onSelect={setSlot} />
              </section>
            )}

          {service !== null && slot !== null && (
            <section className="booking-step-panel booking-review">
              <h2>Review your appointment</h2>
              <div className="booking-summary-lines">
                <p>
                  <span>Service</span>
                  <strong>{service.name}</strong>
                </p>
                <p>
                  <span>Date and time</span>
                  <strong>
                    {slot.date} at {slot.startTime}
                  </strong>
                </p>
                <p>
                  <span>Appointment</span>
                  <strong>{isMobile ? 'Mobile visit' : 'At the shop'}</strong>
                </p>
                {isMobile && destination !== null && (
                  <p>
                    <span>Your location</span>
                    <strong>
                      {destination.addressLine1}, {destination.city}, {destination.state}
                    </strong>
                  </p>
                )}
                <hr />
                <p>
                  <span>Service fee</span>
                  <strong>${service.price.toFixed(2)}</strong>
                </p>
                {isMobile && (
                  <p>
                    <span>Travel fee</span>
                    <strong>${travelFee.toFixed(2)}</strong>
                  </p>
                )}
                <p className="booking-total">
                  <span>Total</span>
                  <strong>${total.toFixed(2)}</strong>
                </p>
              </div>
              <div className="field">
                <label htmlFor="clientNotes">Notes for your barber</label>
                <textarea
                  className="textarea"
                  id="clientNotes"
                  value={clientNotes}
                  onChange={(event) => setClientNotes(event.target.value)}
                />
              </div>
              {user?.userType === 'CLIENT' ? (
                <button
                  className="button button-primary button-full"
                  disabled={booking.isPending || (isMobile && estimate.data === undefined)}
                  onClick={() => booking.mutate()}
                  type="button"
                >
                  {booking.isPending
                    ? 'Confirming...'
                    : `Confirm & continue - $${total.toFixed(2)}`}
                </button>
              ) : (
                <Link
                  className="button button-primary button-full"
                  href={`/client/login?next=${encodeURIComponent(`/client/barbers/${barberId}/book`)}`}
                >
                  Sign in to book
                </Link>
              )}
              {booking.isError && <Notice>{errorMessage(booking.error)}</Notice>}
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
