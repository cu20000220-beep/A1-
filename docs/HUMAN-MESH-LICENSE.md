# Generic human mesh: source, licence and limits

The fitting avatar now uses the **MakeHuman hm08 core body mesh** when the local
asset is available. This is a generic body asset, not a reconstruction of an
uploaded photograph, face, identity or measured body surface.

## Pinned upstream source

- Project: [MakeHuman Community](https://github.com/makehumancommunity/makehuman)
- Reviewed commit: `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`
- [Original `base.obj`](https://raw.githubusercontent.com/makehumancommunity/makehuman/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/3dobjs/base.obj)
- Original file size: 1,749,303 bytes
- Original SHA-256: `8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c`
- [Upstream licence explanation](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.md), sections C and D
- [Upstream CC0 legal statement](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.ASSETS.md)
- [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)

The source asset itself states it was explicitly released as CC0 in September
2020. Its credited copyright holders at that release are Data Collection AB,
Joel Palmius and Jonas Hauquier. Upstream identifies the base mesh, targets,
textures, clothing, poses and expressions as CC0 assets. The MakeHuman program
code is separately AGPL; **no MakeHuman program code, shaders, plugins or runtime
are copied or executed here**. This change does not use third-party assets from
the separate MakeHuman community asset repositories.

## Local derivative and reproduction

`assets/human-base.js` contains only the `g body` surface, reindexed and
triangulated: 13,380 vertices and 26,756 triangles. Helper geometry, joints,
helper hair, tongue, genital and eye helper groups are excluded. The original
OBJ is a development input outside the public build.

The original A1 converter scales the surface to a 1.7 m visual reference,
centres it, and applies a gentle weighted A-pose-to-relaxed-arm rotation. It
exports bounded position and arm-weight arrays as a static JavaScript data
asset, about 813 KB. It performs no network access. The original source hash
and CC0 header must match before conversion:

```bash
node scripts/prepare-human-base.cjs /private/reviewed-base.obj assets/human-base.js
```

`A1AvatarGeometry.installBase()` validates array sizes, coordinates, weights and
triangle indices, and copies them into internal arrays. The browser receives
the generated static asset from the same origin with the other scripts. No
fetch, API, paid model, service account or external photo processing is needed;
the avatar page's `connect-src 'none'` can stay unchanged.

## Rendering and fitting limits

The original model has a generic fitted neutral suit, generic skin material, simple
short-hair colouring and eyes. No skin tone, face or identity is inferred from
a user's photo. The existing entered-measurement controls and two separately
consented photo ratios deform the actual body triangles. These are bounded
visual morphs rather than calibrated anthropometric measurements or exact body
reconstruction. The photo does not provide unknown girths, body depth or precise
clothing size.

The existing fictional clothing surfaces remain visual references. A generic
body mesh does not supply the pattern, material or licensed 3D shape of an
actual retail garment, and this change does not implement cloth physics or
photorealistic AI try-on. The existing procedural model is retained as an
explicitly labelled fallback if the local human asset is missing or invalid.

Unit checks cover malformed data, invalid replacement preservation, finite
unit normals at boundary controls, body/manual/photo-ratio changes and clothing
changes. Browser checks must confirm `data-human-model="hm08-cc0"` and real pixel
changes; displaying a button or this notice alone is not a completion test.

An optional **Lee Perry-Smith CC BY 3.0 scan head** and its reviewed colour/normal
maps now supplement this preserved CC0 body. It has separate attribution and
licensing, is a generic static asset, and does not reconstruct a user's face.
See [DIGITAL-HUMAN-MATERIALS.md](DIGITAL-HUMAN-MATERIALS.md) for exact original
sources, hashes, changes and limits. The original head remains selectable and
is used when the new asset cannot be prepared.
