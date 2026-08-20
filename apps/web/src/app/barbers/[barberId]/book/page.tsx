'use client';

import { ApiError, barberDiscoveryApi, clientApi, paymentApi } from '@barber-saas/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  Building2,
  Car,
  Check,
  ChevronLeft,
  Clock3,
  CreditCard,
  ImageIcon,
  MapPin,
  Navigation,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import {
  PinLocationPicker,
  type ResolvedPinAddress,
} from '@/components/client/pin-location-picker';
import { StripePaymentPanel } from '@/components/client/stripe-payment-panel';
import { ClientHeader } from '@/components/client-header';
import { SlotPicker, TravelEstimateCard } from '@/components/client-ui';
import { Notice } from '@/components/notice';
import { useSavedHairDesigns } from '@/hooks/use-saved-hair-designs';
import { useUser } from '@/hooks/use-user';
import { bookingStepState } from '@/lib/appointment-ui';
import {
  appointmentEndsAt,
  formatClockTime,
  formatShortDate,
  formatTimeRange,
  slotStartsAt,
  travelLeadStartsAt,
} from '@/lib/booking-time';
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
  onlinePaymentsAvailable: boolean;
};
type Services = { services: PublicService[] };
type Slots = { slots: PublicSlot[] };
type AddressList = { addresses: ClientAddress[] };
type AppointmentType = 'shop' | 'mobile';
type PaymentMethod = 'CASH' | 'CARD';
type Stage = 'service' | 'style' | 'type' | 'location' | 'time' | 'review' | 'payment';
type PaymentConfig = { onlinePaymentsEnabled: boolean; publishableKey: string | null };
type PaymentIntent = { clientSecret: string; amount: number };

const danvilleCenter = { latitude: 37.6456, longitude: -84.7722 };

export default function BookBarberPage(): React.ReactElement {
  const { barberId } = useParams<{ barberId: string }>();
  const searchParams = useSearchParams();
  const requestedDesignId = searchParams.get('designId');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  const [stage, setStage] = useState<Stage>('service');
  const [service, setService] = useState<PublicService | null>(null);
  const [appointmentType, setAppointmentType] = useState<AppointmentType | null>(null);
  const [destination, setDestination] = useState<ResolvedPinAddress | null>(null);
  const [pinStart, setPinStart] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pinKey, setPinKey] = useState('current');
  const [saveAddress, setSaveAddress] = useState(false);
  const [slot, setSlot] = useState<PublicSlot | null>(null);
  const [clientNotes, setClientNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [createdAppointment, setCreatedAppointment] = useState<ClientAppointment | null>(null);
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(requestedDesignId);
  const [styleNotes, setStyleNotes] = useState('');

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
  const paymentConfig = useQuery({
    enabled: user?.userType === 'CLIENT',
    queryKey: ['client-payment-config'],
    queryFn: () => paymentApi.config<PaymentConfig>(browserApi),
  });
  const savedLooks = useSavedHairDesigns(user?.userType === 'CLIENT' ? user.id : null);
  const estimate = useMutation({
    mutationFn: (coordinates: { latitude: number; longitude: number }) =>
      browserApi.post<TravelEstimate>('/barbers/me/mobile/estimate', {
        barberId,
        destinationLatitude: coordinates.latitude,
        destinationLongitude: coordinates.longitude,
      }),
  });
  const intent = useMutation({
    mutationFn: (appointmentId: string) =>
      paymentApi.createIntent<PaymentIntent>(browserApi, appointmentId),
  });

  const mobileEnabled = mobile.data?.isEnabled === true;
  const isMobile = appointmentType === 'mobile';
  const estimateOutsideRadius =
    estimate.error instanceof ApiError && estimate.error.code === 'OUTSIDE_SERVICE_AREA';
  const cardAvailable =
    profile.data?.onlinePaymentsAvailable === true &&
    paymentConfig.data?.onlinePaymentsEnabled === true &&
    paymentConfig.data.publishableKey !== null;
  const completedLooks = useMemo(
    () =>
      (savedLooks.data?.designs ?? []).filter(
        (look) =>
          (look.generationStatus === 'COMPLETED' || look.aiStatus === 'completed') &&
          look.generatedPreviewUrl !== null,
      ),
    [savedLooks.data?.designs],
  );
  const selectedDesign = completedLooks.find((look) => look.id === selectedDesignId) ?? null;

  useEffect(() => {
    if (!isMobile || destination === null) return;
    const timer = window.setTimeout(
      () =>
        estimate.mutate({
          latitude: destination.latitude,
          longitude: destination.longitude,
        }),
      350,
    );
    return (): void => window.clearTimeout(timer);
  }, [destination?.latitude, destination?.longitude, isMobile]);

  useEffect(() => {
    if (service !== null || services.data === undefined || mobile.data === undefined) return;
    const requestedServiceId = new URLSearchParams(window.location.search).get('serviceId');
    const requested = services.data.services.find((item) => item.id === requestedServiceId);
    if (requested === undefined) return;
    setService(requested);
    setAppointmentType(mobileEnabled ? null : 'shop');
    setStage('style');
  }, [mobile.data, mobileEnabled, service, services.data]);

  useEffect(() => {
    if (
      savedLooks.data === undefined ||
      selectedDesignId === null ||
      completedLooks.some((look) => look.id === selectedDesignId)
    ) {
      return;
    }
    setSelectedDesignId(null);
  }, [completedLooks, savedLooks.data, selectedDesignId]);

  const slots = useQuery({
    enabled:
      service !== null &&
      appointmentType !== null &&
      (!isMobile || (destination !== null && !estimate.isPending && !estimateOutsideRadius)),
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
        ...(isMobile && estimate.data !== undefined
          ? { mobileService: true, travelMinutes: estimate.data.estimatedTravelMinutes }
          : {}),
      }),
  });
  const filteredSlots = useMemo(() => {
    if (service === null) return [];
    return (slots.data?.slots ?? []).filter((candidate) => {
      const start = new Date(`${candidate.date}T${candidate.startTime}:00`).getTime();
      const end = new Date(`${candidate.date}T${candidate.endTime}:00`).getTime();
      return (
        candidate.isAvailable &&
        (end - start) / 60_000 >= service.durationMinutes &&
        (!isMobile || estimate.data === undefined || candidate.availableForMobile === true)
      );
    });
  }, [estimate.data, isMobile, service, slots.data?.slots]);

  const booking = useMutation({
    mutationFn: async () => {
      if (service === null || slot === null || appointmentType === null) {
        throw new Error('Complete each booking step before confirming.');
      }
      if (isMobile && destination === null) throw new Error('Confirm the service pin first.');
      if (isMobile && destination !== null && saveAddress) {
        await clientApi.createAddress(browserApi, {
          label: 'Mobile visit',
          addressLine1: destination.addressLine1,
          city: destination.city,
          state: destination.state,
          zipCode: destination.zipCode,
          country: destination.country,
          latitude: destination.latitude,
          longitude: destination.longitude,
        });
        await queryClient.invalidateQueries({ queryKey: ['client-addresses'] });
      }
      return clientApi.bookAppointment<ClientAppointment>(browserApi, {
        barberId,
        serviceId: service.id,
        availabilitySlotId: slot.id,
        ...(selectedDesign === null ? {} : { designId: selectedDesign.id }),
        ...(styleNotes.trim() === '' ? {} : { styleNotes: styleNotes.trim() }),
        clientNotes: clientNotes.trim() || undefined,
        paymentMethod,
        isMobileService: isMobile,
        ...(isMobile && destination !== null
          ? {
              clientAddressOneTime: {
                addressLine1: destination.addressLine1,
                city: destination.city,
                state: destination.state,
                zipCode: destination.zipCode,
                country: destination.country,
                latitude: destination.latitude,
                longitude: destination.longitude,
                formattedAddress: destination.formattedAddress,
                source: destination.source,
                isApproximateAddress: destination.isApproximateAddress,
              },
            }
          : {}),
      });
    },
    onSuccess: (appointment) => {
      setCreatedAppointment(appointment);
      if (paymentMethod === 'CASH') {
        router.push(`/client/appointments/${appointment.id}?booked=success`);
        return;
      }
      setStage('payment');
      intent.mutate(appointment.id);
    },
  });

  const chooseService = (item: PublicService): void => {
    setService(item);
    setSlot(null);
    setCreatedAppointment(null);
    setAppointmentType(mobileEnabled ? null : 'shop');
    setStage('style');
  };

  const updateDesignSelection = (designId: string | null): void => {
    setSelectedDesignId(designId);
    const next = new URLSearchParams(searchParams.toString());
    if (designId === null) next.delete('designId');
    else next.set('designId', designId);
    const query = next.toString();
    router.replace(`/client/barbers/${barberId}/book${query.length > 0 ? `?${query}` : ''}`, {
      scroll: false,
    });
  };

  const continueFromStyle = (): void => {
    if (mobileEnabled) {
      setAppointmentType(null);
      setStage('type');
      return;
    }
    setAppointmentType('shop');
    setStage('time');
  };

  const chooseType = (type: AppointmentType): void => {
    setAppointmentType(type);
    setSlot(null);
    estimate.reset();
    setStage(type === 'mobile' ? 'location' : 'time');
  };

  const useSavedAddress = (address: ClientAddress): void => {
    setPinStart({ latitude: address.latitude, longitude: address.longitude });
    setPinKey(address.id);
    setDestination(null);
    setSlot(null);
    estimate.reset();
  };

  const travelFee = isMobile ? (estimate.data?.travelFee ?? 0) : 0;
  const total = (service?.price ?? 0) + travelFee;
  const appointmentStart = slot === null ? null : slotStartsAt(slot.date, slot.startTime);
  const appointmentEnd =
    slot === null || service === null
      ? null
      : appointmentEndsAt(slot.date, slot.startTime, service.durationMinutes);
  const travelLead =
    slot === null || !isMobile || estimate.data === undefined
      ? null
      : travelLeadStartsAt(slot.date, slot.startTime, estimate.data.estimatedTravelMinutes);
  const fallbackCenter = mobile.data?.approximateOrigin ?? danvilleCenter;
  const visibleSteps: Stage[] = mobileEnabled
    ? appointmentType === 'shop'
      ? ['service', 'style', 'type', 'time', 'review']
      : ['service', 'style', 'type', 'location', 'time', 'review']
    : ['service', 'style', 'time', 'review'];
  const currentStep = Math.max(0, visibleSteps.indexOf(stage));
  const stepNumber = (value: Stage): string =>
    String(Math.max(0, visibleSteps.indexOf(value)) + 1).padStart(2, '0');

  return (
    <main className="market-page client-booking-page">
      <ClientHeader />
      <section className="booking-shell client-booking-shell">
        <header className="booking-page-header">
          <Link className="booking-back-link" href={`/client/barbers/${barberId}`}>
            <ChevronLeft size={17} /> Back to profile
          </Link>
          <p className="eyebrow">Book appointment</p>
          <h1>{profile.data?.businessName ?? 'Choose your appointment'}</h1>
          <p>Complete one step at a time. You can review everything before confirming.</p>
        </header>

        <nav className="booking-progress" aria-label="Booking progress">
          {visibleSteps.map((item, index) => {
            const stepState = bookingStepState(index, currentStep);
            return (
              <span
                aria-current={index === currentStep ? 'step' : undefined}
                className={`is-${stepState}`}
                data-state={stepState}
                key={item}
              >
                <b>{index < currentStep ? <Check size={13} /> : index + 1}</b>
                {item[0]?.toUpperCase()}
                {item.slice(1)}
              </span>
            );
          })}
        </nav>

        {user?.userType !== 'CLIENT' && (
          <Notice tone="warning">
            Sign in with a customer account before confirming your booking.
          </Notice>
        )}

        <div className="client-booking-layout">
          <div className="booking-stage">
            {stage === 'service' && (
              <section className="booking-step-panel">
                <div className="booking-step-heading">
                  <span>01</span>
                  <div>
                    <h2>Choose a service</h2>
                    <p>Select the cut or service you want to book.</p>
                  </div>
                </div>
                <div className="booking-option-list">
                  {(services.data?.services ?? []).map((item) => (
                    <button
                      className={`booking-service-option${service?.id === item.id ? ' is-selected' : ''}`}
                      key={item.id}
                      onClick={() => chooseService(item)}
                      type="button"
                    >
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.durationMinutes} min · {item.category}
                        </small>
                      </span>
                      <strong>${item.price.toFixed(2)}</strong>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {stage === 'style' && service !== null && (
              <section className="booking-step-panel booking-style-step">
                <div className="booking-step-heading">
                  <span>{stepNumber('style')}</span>
                  <div>
                    <h2>What look are you going for?</h2>
                    <p>
                      Bring a saved AI look, describe something new, or decide with your barber.
                    </p>
                  </div>
                </div>

                {savedLooks.isLoading ? (
                  <div className="booking-style-loading">
                    <Sparkles size={18} />
                    Checking your private saved looks…
                  </div>
                ) : completedLooks.length > 0 ? (
                  <>
                    <div className="booking-style-title">
                      <div>
                        <strong>Your saved looks</strong>
                        <span>Only looks from this signed-in account appear here.</span>
                      </div>
                      {savedLooks.isFetching && <small>Refreshing…</small>}
                    </div>
                    <div className="booking-look-grid">
                      {completedLooks.map((look, index) => (
                        <button
                          aria-pressed={selectedDesignId === look.id}
                          className={selectedDesignId === look.id ? 'is-selected' : undefined}
                          key={look.id}
                          onClick={() => {
                            updateDesignSelection(look.id);
                            setStyleNotes('');
                          }}
                          type="button"
                        >
                          <span className="booking-look-image">
                            <Image
                              alt={`${look.styleName} saved look`}
                              fill
                              onError={() => void savedLooks.refetch()}
                              priority={index < 4}
                              sizes="180px"
                              src={look.generatedPreviewUrl as string}
                              unoptimized
                            />
                            {selectedDesignId === look.id && (
                              <b>
                                <Check size={14} />
                              </b>
                            )}
                          </span>
                          <strong>{look.styleName}</strong>
                          <small>{look.styleCategory}</small>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="booking-look-empty">
                    <span>
                      <WandSparkles size={24} />
                    </span>
                    <div>
                      <strong>Turn your idea into a picture first.</strong>
                      <p>
                        AI Hair Studio creates a private style preview you can bring straight into a
                        future booking.
                      </p>
                    </div>
                    <Link className="button button-secondary" href="/client/design">
                      Try AI Hair Studio
                    </Link>
                  </div>
                )}

                {requestedDesignId !== null &&
                  savedLooks.data !== undefined &&
                  !completedLooks.some((look) => look.id === requestedDesignId) && (
                    <Notice>
                      That saved look is not available in this account. Choose another or describe a
                      new style.
                    </Notice>
                  )}

                <button
                  aria-pressed={selectedDesignId === null}
                  className={`booking-new-style-option${selectedDesignId === null ? ' is-selected' : ''}`}
                  onClick={() => updateDesignSelection(null)}
                  type="button"
                >
                  <span>
                    <ImageIcon size={20} />
                  </span>
                  <div>
                    <strong>New style</strong>
                    <small>Describe a fresh idea, or leave it blank and decide together.</small>
                  </div>
                  {selectedDesignId === null && <Check size={17} />}
                </button>

                {selectedDesignId === null && (
                  <label className="field booking-style-notes">
                    <span>Describe the new style (optional)</span>
                    <textarea
                      className="textarea"
                      maxLength={1000}
                      onChange={(event) => setStyleNotes(event.target.value)}
                      placeholder="Example: Keep the curls longer on top with a low taper and a clean neckline…"
                      value={styleNotes}
                    />
                    <small>This goes directly to your barber with the booking.</small>
                  </label>
                )}

                <div className="booking-stage-actions">
                  <button
                    className="button button-ghost"
                    onClick={() => setStage('service')}
                    type="button"
                  >
                    <ChevronLeft size={16} /> Change service
                  </button>
                  <button
                    className="button button-primary"
                    disabled={savedLooks.isLoading}
                    onClick={continueFromStyle}
                    type="button"
                  >
                    {selectedDesign !== null
                      ? 'Continue with saved look'
                      : styleNotes.trim() === ''
                        ? 'Continue without a reference'
                        : 'Continue with new style'}
                  </button>
                </div>
              </section>
            )}

            {stage === 'type' && service !== null && (
              <section className="booking-step-panel">
                <div className="booking-step-heading">
                  <span>{stepNumber('type')}</span>
                  <div>
                    <h2>Where should the appointment happen?</h2>
                    <p>Visit the shop or have this barber travel to you.</p>
                  </div>
                </div>
                <div className="booking-type-grid">
                  <button onClick={() => chooseType('shop')} type="button">
                    <Building2 size={22} />
                    <strong>At the shop</strong>
                    <span>
                      {[profile.data?.city, profile.data?.state].filter(Boolean).join(', ') ||
                        'Barber location'}
                    </span>
                    <small>No travel fee</small>
                  </button>
                  <button onClick={() => chooseType('mobile')} type="button">
                    <Car size={22} />
                    <strong>Mobile visit</strong>
                    <span>The barber comes to your exact pin</span>
                    <small>
                      {mobile.data?.feeStructure === 'flat'
                        ? `$${mobile.data.baseFee?.toFixed(2)} travel fee`
                        : 'Travel fee calculated by distance'}
                    </small>
                  </button>
                </div>
                <button
                  className="button button-ghost"
                  onClick={() => setStage('style')}
                  type="button"
                >
                  <ChevronLeft size={16} /> Back to style
                </button>
              </section>
            )}

            {stage === 'location' && isMobile && (
              <section className="booking-step-panel">
                <div className="booking-step-heading">
                  <span>{stepNumber('location')}</span>
                  <div>
                    <h2>Pin the exact arrival point</h2>
                    <p>Your barber navigates to the pin. The nearest address provides context.</p>
                  </div>
                </div>
                {(addresses.data?.addresses.length ?? 0) > 0 && (
                  <div className="saved-location-shortcuts">
                    <span>Recenter from a saved place</span>
                    <div>
                      {addresses.data?.addresses.map((address) => (
                        <button
                          key={address.id}
                          onClick={() => useSavedAddress(address)}
                          type="button"
                        >
                          <MapPin size={14} /> {address.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <PinLocationPicker
                  barberId={barberId}
                  fallbackAddressContext={{
                    ...(profile.data?.city === undefined ? {} : { city: profile.data.city }),
                    ...(profile.data?.state === undefined ? {} : { state: profile.data.state }),
                  }}
                  fallbackCenter={fallbackCenter}
                  initialPoint={pinStart}
                  key={pinKey}
                  onLocationChange={(address) => {
                    setDestination(address);
                    setSlot(null);
                  }}
                />
                <TravelEstimateCard
                  estimate={estimate.data}
                  errorMessage={estimate.isError ? errorMessage(estimate.error) : undefined}
                  isLoading={estimate.isPending}
                  outsideRadius={estimateOutsideRadius}
                />
                {estimate.data !== undefined && (
                  <div className="travel-stats-grid">
                    <div className="travel-stat">
                      <Clock3 size={16} />
                      <span>
                        <strong>{estimate.data.estimatedTravelMinutes} min</strong>Drive time
                      </span>
                    </div>
                    <div className="travel-stat">
                      <Navigation size={16} />
                      <span>
                        <strong>{estimate.data.distanceMiles.toFixed(1)} mi</strong>Distance
                      </span>
                    </div>
                    <div className="travel-stat">
                      <Car size={16} />
                      <span>
                        <strong>${estimate.data.travelFee.toFixed(2)}</strong>Travel fee
                      </span>
                    </div>
                  </div>
                )}
                {destination !== null && (
                  <label className="checkbox-row">
                    <input
                      checked={saveAddress}
                      onChange={(event) => setSaveAddress(event.target.checked)}
                      type="checkbox"
                    />
                    Save this destination for later
                  </label>
                )}
                <div className="booking-stage-actions">
                  <button
                    className="button button-ghost"
                    onClick={() => setStage('type')}
                    type="button"
                  >
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    className="button button-primary"
                    disabled={destination === null || estimate.isPending || estimateOutsideRadius}
                    onClick={() => setStage('time')}
                    type="button"
                  >
                    Confirm location
                  </button>
                </div>
              </section>
            )}

            {stage === 'time' && service !== null && appointmentType !== null && (
              <section className="booking-step-panel">
                <div className="booking-step-heading">
                  <span>{stepNumber('time')}</span>
                  <div>
                    <h2>Choose an available time</h2>
                    <p>
                      {isMobile
                        ? 'Times include enough lead time for travel.'
                        : 'All times are local.'}
                    </p>
                  </div>
                </div>
                <div className="booking-context-strip">
                  <div>
                    <span>Service</span>
                    <strong>{service.name}</strong>
                  </div>
                  <div>
                    <span>Type</span>
                    <strong>{isMobile ? 'Mobile visit' : 'Shop appointment'}</strong>
                  </div>
                  {isMobile && destination !== null && (
                    <div>
                      <span>Arrival point</span>
                      <strong>{destination.formattedAddress}</strong>
                    </div>
                  )}
                  {isMobile && estimate.data !== undefined && (
                    <div>
                      <span>Travel</span>
                      <strong>
                        {estimate.data.distanceMiles.toFixed(1)} mi ·{' '}
                        {estimate.data.estimatedTravelMinutes} min
                      </strong>
                    </div>
                  )}
                </div>
                {!isMobile && mobileEnabled && (
                  <div className="booking-mobile-nudge">
                    <span>
                      <Car size={21} />
                    </span>
                    <div>
                      <strong>Why make the trip?</strong>
                      <p>
                        This barber can come to your place instead. Add your pin and see the fee.
                      </p>
                    </div>
                    <button
                      className="button button-secondary"
                      onClick={() => chooseType('mobile')}
                      type="button"
                    >
                      Switch to mobile
                    </button>
                  </div>
                )}
                <SlotPicker
                  durationMinutes={service.durationMinutes}
                  onSelect={setSlot}
                  selectedId={slot?.id}
                  slots={filteredSlots}
                  {...(isMobile && estimate.data !== undefined
                    ? { travelMinutes: estimate.data.estimatedTravelMinutes }
                    : {})}
                />
                <div className="booking-stage-actions">
                  <button
                    className="button button-ghost"
                    onClick={() =>
                      setStage(isMobile ? 'location' : mobileEnabled ? 'type' : 'style')
                    }
                    type="button"
                  >
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    className="button button-primary"
                    disabled={slot === null}
                    onClick={() => setStage('review')}
                    type="button"
                  >
                    Review appointment
                  </button>
                </div>
              </section>
            )}

            {stage === 'review' && service !== null && slot !== null && (
              <section className="booking-step-panel">
                <div className="booking-step-heading">
                  <span>{stepNumber('review')}</span>
                  <div>
                    <h2>Review and choose payment</h2>
                    <p>Your appointment is reserved after you confirm below.</p>
                  </div>
                </div>
                <div className="booking-review-grid">
                  {selectedDesign !== null && (
                    <div className="review-detail-card hair-booking-reference">
                      <span>Style reference</span>
                      <strong>{selectedDesign.styleName}</strong>
                      {selectedDesign.generatedPreviewUrl !== null && (
                        <Image
                          alt={`${selectedDesign.styleName} AI preview`}
                          height={120}
                          onError={() => void savedLooks.refetch()}
                          src={selectedDesign.generatedPreviewUrl}
                          unoptimized
                          width={96}
                        />
                      )}
                      <p>Your barber will receive this private preview.</p>
                    </div>
                  )}
                  {selectedDesign === null && styleNotes.trim() !== '' && (
                    <div className="review-detail-card">
                      <span>New style</span>
                      <strong>Your description</strong>
                      <p>{styleNotes.trim()}</p>
                    </div>
                  )}
                  <div className="review-detail-card">
                    <span>Appointment</span>
                    <strong>{service.name}</strong>
                    <p>
                      {appointmentStart === null || appointmentEnd === null
                        ? 'Time not selected'
                        : `${formatShortDate(appointmentStart)} · ${formatTimeRange(appointmentStart, appointmentEnd)}`}
                    </p>
                  </div>
                  <div className="review-detail-card">
                    <span>Location</span>
                    <strong>{isMobile ? 'Mobile visit' : 'Shop visit'}</strong>
                    <p>
                      {isMobile && destination !== null
                        ? destination.formattedAddress
                        : [profile.data?.city, profile.data?.state].filter(Boolean).join(', ') ||
                          'Barber location'}
                    </p>
                  </div>
                  <div className="review-detail-card">
                    <span>Total</span>
                    <strong>${total.toFixed(2)}</strong>
                    <p>
                      ${service.price.toFixed(2)} service
                      {isMobile ? ` + $${travelFee.toFixed(2)} travel` : ''}
                    </p>
                  </div>
                </div>
                <div className="payment-method-grid">
                  <button
                    className={paymentMethod === 'CASH' ? 'is-selected' : ''}
                    onClick={() => setPaymentMethod('CASH')}
                    type="button"
                  >
                    <Banknote size={21} />
                    <span>
                      <strong>Pay in cash</strong>
                      <small>Pay your barber at the appointment</small>
                    </span>
                    {paymentMethod === 'CASH' && <Check size={17} />}
                  </button>
                  <button
                    className={paymentMethod === 'CARD' ? 'is-selected' : ''}
                    disabled={!cardAvailable}
                    onClick={() => setPaymentMethod('CARD')}
                    type="button"
                  >
                    <CreditCard size={21} />
                    <span>
                      <strong>Pay online</strong>
                      <small>
                        {cardAvailable
                          ? 'Secure card payment with Stripe'
                          : 'Unavailable for this barber'}
                      </small>
                    </span>
                    {paymentMethod === 'CARD' && <Check size={17} />}
                  </button>
                </div>
                <div className="field">
                  <label htmlFor="clientNotes">Notes for your barber</label>
                  <textarea
                    className="textarea"
                    id="clientNotes"
                    maxLength={1000}
                    placeholder="Access instructions or details about your cut"
                    value={clientNotes}
                    onChange={(event) => setClientNotes(event.target.value)}
                  />
                </div>
                <div className="booking-stage-actions">
                  <button
                    className="button button-ghost"
                    onClick={() => setStage('time')}
                    type="button"
                  >
                    <ChevronLeft size={16} /> Back
                  </button>
                  {user?.userType === 'CLIENT' ? (
                    <button
                      className="button button-primary"
                      disabled={booking.isPending}
                      onClick={() => booking.mutate()}
                      type="button"
                    >
                      {booking.isPending
                        ? 'Reserving appointment...'
                        : paymentMethod === 'CARD'
                          ? `Continue to payment · $${total.toFixed(2)}`
                          : 'Confirm cash booking'}
                    </button>
                  ) : (
                    <Link
                      className="button button-primary"
                      href={`/client/login?next=${encodeURIComponent(`/client/barbers/${barberId}/book`)}`}
                    >
                      Sign in to book
                    </Link>
                  )}
                </div>
                {booking.isError && <Notice>{errorMessage(booking.error)}</Notice>}
              </section>
            )}

            {stage === 'payment' && createdAppointment !== null && (
              <section className="booking-step-panel">
                <div className="booking-step-heading">
                  <span>{String(visibleSteps.length + 1).padStart(2, '0')}</span>
                  <div>
                    <h2>Complete secure payment</h2>
                    <p>Your time is reserved. Finish payment or return to the appointment later.</p>
                  </div>
                </div>
                <div className="payment-reserved-card">
                  <Check size={18} />
                  <div>
                    <strong>Appointment reserved</strong>
                    <span>
                      Your slot is held. If payment fails, you can retry here or from appointment
                      details.
                    </span>
                  </div>
                </div>
                {intent.isPending && <div className="loading">Preparing secure checkout...</div>}
                {intent.isError && (
                  <Notice>
                    {errorMessage(intent.error)} Your appointment is still reserved and payment can
                    be retried.
                  </Notice>
                )}
                {intent.isError && (
                  <button
                    className="button button-secondary"
                    onClick={() => intent.mutate(createdAppointment.id)}
                    type="button"
                  >
                    Retry payment setup
                  </button>
                )}
                {intent.data !== undefined && paymentConfig.data?.publishableKey != null && (
                  <StripePaymentPanel
                    amount={intent.data.amount}
                    appointmentId={createdAppointment.id}
                    clientSecret={intent.data.clientSecret}
                    publishableKey={paymentConfig.data.publishableKey}
                    onComplete={(confirmed) =>
                      router.push(
                        `/client/appointments/${createdAppointment.id}?payment=${confirmed ? 'success' : 'processing'}`,
                      )
                    }
                  />
                )}
                <Link className="text-link" href={`/client/appointments/${createdAppointment.id}`}>
                  Finish payment later
                </Link>
              </section>
            )}
          </div>

          <aside className="booking-summary-panel">
            <p className="eyebrow">Your appointment</p>
            <h2>{profile.data?.businessName ?? 'Booking summary'}</h2>
            <div className="booking-summary-lines">
              <p>
                <span>Service</span>
                <strong>{service?.name ?? 'Not selected'}</strong>
              </p>
              <p>
                <span>Appointment</span>
                <strong>
                  {appointmentType === 'mobile'
                    ? 'Mobile visit'
                    : appointmentType === 'shop'
                      ? 'At the shop'
                      : 'Not selected'}
                </strong>
              </p>
              {destination !== null && isMobile && (
                <p>
                  <span>Destination</span>
                  <strong>
                    {destination.addressLine1}, {destination.city}
                  </strong>
                </p>
              )}
              <p>
                <span>Style</span>
                <strong>
                  {selectedDesign?.styleName ??
                    (styleNotes.trim() === '' ? 'Decide with barber' : 'New style request')}
                </strong>
              </p>
              <p>
                <span>Date and time</span>
                <strong>
                  {appointmentStart === null || appointmentEnd === null
                    ? 'Not selected'
                    : `${formatShortDate(appointmentStart)} · ${formatTimeRange(appointmentStart, appointmentEnd)}`}
                </strong>
              </p>
              {travelLead !== null && (
                <p>
                  <span>Barber departure</span>
                  <strong>About {formatClockTime(travelLead)}</strong>
                </p>
              )}
              <hr />
              <p>
                <span>Service</span>
                <strong>${(service?.price ?? 0).toFixed(2)}</strong>
              </p>
              {isMobile && (
                <p>
                  <span>Travel</span>
                  <strong>${travelFee.toFixed(2)}</strong>
                </p>
              )}
              <p className="booking-total">
                <span>Total</span>
                <strong>${total.toFixed(2)}</strong>
              </p>
            </div>
            <small>Card payments are charged only after you confirm with Stripe.</small>
          </aside>
        </div>
      </section>
    </main>
  );
}
