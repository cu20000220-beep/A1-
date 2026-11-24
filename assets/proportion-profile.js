/* Keep only dimensionless proportions in the on-device styling profile. */
'use strict';
((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.A1ProportionProfile = api;
})(globalThis, () => {
  function limits(min, max) {
    return Object.freeze({ min, max });
  }

  const fields = Object.freeze({
    heightCm: limits(80, 260),
    shoulderWidthCm: limits(15, 100),
    hipWidthCm: limits(15, 110),
    torsoCm: limits(20, 110),
    legCm: limits(20, 155),
    armCm: limits(15, 110),
    waistCircumferenceCm: limits(30, 220),
    hipCircumferenceCm: limits(35, 240)
  });

  const ratios = {
    shoulderHip: { range: limits(.45, 2.5), pair: ['shoulderWidthCm', 'hipWidthCm'], photo: 'shoulderHipRatio' },
    legTorso: { range: limits(.6, 3.5), pair: ['legCm', 'torsoCm'], photo: 'legTorsoRatio' },
    waistHip: { range: limits(.3, 2), pair: ['waistCircumferenceCm', 'hipCircumferenceCm'] },
    armLeg: { range: limits(.2, 1.6), pair: ['armCm', 'legCm'], photo: 'armLegRatio' },
    torsoHeight: { range: limits(.08, .8), pair: ['torsoCm', 'heightCm'] },
    legHeight: { range: limits(.15, .85), pair: ['legCm', 'heightCm'] },
    armHeight: { range: limits(.1, .8), pair: ['armCm', 'heightCm'] }
  };
  const photoFields = Object.fromEntries(Object.values(ratios)
    .filter(ratio => ratio.photo)
    .map(ratio => [ratio.photo, ratio.range]));

  function checkObject(value, allowed) {
    if (Object.prototype.toString.call(value) !== '[object Object]') {
      throw new TypeError('proportion_fields_invalid');
    }
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!Object.hasOwn(allowed, key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
        throw new TypeError('proportion_fields_invalid');
      }
    }
  }

  function checkNumber(value, { min, max }) {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new TypeError('proportion_value_invalid');
    }
  }

  function validate(profile) {
    checkObject(profile, ratios);
    const result = {};
    for (const [key, entry] of Object.entries(profile)) {
      checkObject(entry, { value: true, basis: true });
      if (!Object.hasOwn(entry, 'value') || !Object.hasOwn(entry, 'basis') ||
          (entry.basis !== 'manual' && (entry.basis !== 'photo' || !ratios[key].photo))) {
        throw new TypeError('proportion_basis_invalid');
      }
      checkNumber(entry.value, ratios[key].range);
      result[key] = Object.freeze({ value: entry.value, basis: entry.basis });
    }
    return Object.freeze(result);
  }

  function build(photo = {}, manual = {}) {
    checkObject(photo, photoFields);
    checkObject(manual, fields);
    for (const [key, value] of Object.entries(photo)) checkNumber(value, photoFields[key]);
    for (const [key, value] of Object.entries(manual)) checkNumber(value, fields[key]);

    const profile = {};
    for (const [key, ratio] of Object.entries(ratios)) {
      const [numerator, denominator] = ratio.pair;
      if (Object.hasOwn(manual, numerator) && Object.hasOwn(manual, denominator)) {
        profile[key] = { value: manual[numerator] / manual[denominator], basis: 'manual' };
      } else if (ratio.photo && Object.hasOwn(photo, ratio.photo)) {
        profile[key] = { value: photo[ratio.photo], basis: 'photo' };
      }
    }
    return validate(profile);
  }

  return Object.freeze({ fields, build, validate });
});
