'use client';

export type ResolvedGoogleAddress = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
};

const componentValue = (
  components: google.maps.GeocoderAddressComponent[],
  type: string,
  short = false,
): string => {
  const component = components.find((item) => item.types.includes(type));
  return component === undefined ? '' : short ? component.short_name : component.long_name;
};

export const placeToResolvedAddress = (
  place: google.maps.places.PlaceResult,
): ResolvedGoogleAddress | null => {
  const location = place.geometry?.location;
  const components = place.address_components;

  if (location === undefined || components === undefined) {
    return null;
  }

  const streetNumber = componentValue(components, 'street_number');
  const route = componentValue(components, 'route');
  const subpremise = componentValue(components, 'subpremise');
  const addressLine1 = [streetNumber, route].filter(Boolean).join(' ');
  const city =
    componentValue(components, 'locality') ||
    componentValue(components, 'postal_town') ||
    componentValue(components, 'sublocality') ||
    componentValue(components, 'administrative_area_level_2');
  const state = componentValue(components, 'administrative_area_level_1', true);
  const zipCode = componentValue(components, 'postal_code');
  const country = componentValue(components, 'country', true) || 'US';
  const formattedAddress = place.formatted_address ?? place.name ?? addressLine1;

  if (
    addressLine1.length === 0 ||
    city.length === 0 ||
    state.length === 0 ||
    zipCode.length === 0
  ) {
    return null;
  }

  return {
    addressLine1,
    ...(subpremise.length === 0 ? {} : { addressLine2: subpremise }),
    city,
    state,
    zipCode,
    country,
    latitude: location.lat(),
    longitude: location.lng(),
    formattedAddress,
  };
};

export const reverseGeocodeCoordinates = async (
  latitude: number,
  longitude: number,
): Promise<ResolvedGoogleAddress | null> => {
  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve) => {
    void geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
      const first = results?.[0];

      if (status !== google.maps.GeocoderStatus.OK || first === undefined) {
        resolve(null);
        return;
      }

      resolve(
        placeToResolvedAddress({
          address_components: first.address_components,
          formatted_address: first.formatted_address,
          geometry: {
            location: {
              lat: () => latitude,
              lng: () => longitude,
            } as google.maps.LatLng,
          },
        }),
      );
    });
  });
};
