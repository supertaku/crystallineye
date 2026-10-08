// Static paper-scale pigment variation. Song time still controls every reveal.
export const PIGMENT_SKSL = `
uniform float4 inkColor;
uniform float seed;
uniform float dryness;
float grain(float2 p) {
  return fract(sin(dot(floor(p), float2(12.9898, 78.233)) + seed) * 43758.5453);
}
half4 main(float2 p) {
  float fine = grain(p * 1.1);
  float fiber = grain(float2(p.x * 0.35, p.y * 1.8));
  float coverage = mix(1.0, 0.28 + 0.72 * fine * (0.65 + fiber * 0.35), dryness);
  float alpha = inkColor.a * coverage;
  return half4(inkColor.rgb * alpha, alpha);
}`;
