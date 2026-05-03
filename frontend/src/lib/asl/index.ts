/**
 * Browser-side ASL word recognizer ported from the Python `aether.sign`
 * pipeline. Pairs with `useWordSignRecognition` to consume MediaPipe Hands
 * landmarks and emit recognized word labels.
 */
export * from "./features";
export * from "./dtw";
export * from "./segmenter";
export * from "./wordRecognizer";
