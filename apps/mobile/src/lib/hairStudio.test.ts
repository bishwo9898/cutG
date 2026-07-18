import { describe, expect, it } from 'vitest';

import {
  appendDesignId,
  isHairGenerationActive,
  isHairScanYawReady,
  optionalDesignReference,
} from './hairStudio';

describe('mobile Hair Studio route and polling helpers', () => {
  it('polls only active generation states', () => {
    expect(isHairGenerationActive('QUEUED')).toBe(true);
    expect(isHairGenerationActive('PROCESSING')).toBe(true);
    expect(isHairGenerationActive('COMPLETED')).toBe(false);
    expect(isHairGenerationActive('FAILED')).toBe(false);
  });

  it('requires the correct head direction for each scan angle', () => {
    expect(isHairScanYawReady('FRONT', 5)).toBe(true);
    expect(isHairScanYawReady('FRONT', -18)).toBe(false);
    expect(isHairScanYawReady('LEFT', -24)).toBe(true);
    expect(isHairScanYawReady('LEFT', 24)).toBe(false);
    expect(isHairScanYawReady('RIGHT', 24)).toBe(true);
    expect(isHairScanYawReady('RIGHT', -24)).toBe(false);
  });

  it('preserves the design through booking routes and payloads', () => {
    expect(appendDesignId('/book/service', 'design-id')).toBe('/book/service?designId=design-id');
    expect(appendDesignId('/book/type?serviceId=service', 'design-id')).toBe(
      '/book/type?serviceId=service&designId=design-id',
    );
    expect(optionalDesignReference('design-id')).toEqual({ designId: 'design-id' });
    expect(optionalDesignReference(undefined)).toEqual({});
  });
});
