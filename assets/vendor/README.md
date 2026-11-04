# Third-party AI runtime and model

This directory includes the Lite subset of the official Google MediaPipe npm
package `@mediapipe/pose@0.5.1675469404`, licensed Apache-2.0 by that package.

- Source tarball: https://registry.npmjs.org/@mediapipe/pose/-/pose-0.5.1675469404.tgz
- Upstream project: https://github.com/google-ai-edge/mediapipe
- License: [mediapipe/LICENSE](mediapipe/LICENSE)
- Version, verified tarball integrity, per-file SHA-256: [mediapipe/PROVENANCE.json](mediapipe/PROVENANCE.json)

Upstream notices and distributed file contents have been preserved. Full and
Heavy model files are omitted. Application code explicitly sets `modelComplexity:
0` to use the included Lite model. Both SIMD and non-SIMD WASM execution paths are
included; only the browser's selected path downloads. The empty SIMD data file is
part of the upstream distribution and intentionally retained.

This performs real pose-landmark inference in the browser using WASM and a WebGL
context. It does not provide exact body measurements, garment synthesis or a
generative recommendation/chat model. The separate application recommendation
module uses transparent rules with the estimated 2D landmarks and explicit user
preferences. No photo or numeric analysis is sent to Google or another service.
