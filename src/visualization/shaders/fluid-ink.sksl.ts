import { SHADER_CONFIG, VISUAL_CONFIG } from '../../config';

// Fixed-depth procedural noise on Skia. No persistent simulation or JS pixels.
export const FLUID_INK_SKSL = `
uniform float2 uResolution;
uniform float uTime;
uniform float uEnergy;
uniform float uBrightness;
uniform float uSpectralLow;
uniform float uSpectralMid;
uniform float uSpectralHigh;
uniform float uOnset;
uniform float uTempoNormalized;
uniform float uTempoConfidence;
uniform float uBeatPhase;
uniform float uBeatPulse;
uniform float3 uColorA;
uniform float3 uColorB;
uniform float3 uColorC;
uniform float uReducedMotion;
uniform float uTurbulence;
uniform float uMacroScale;
uniform float uDetailScale;
uniform float uBloom;
uniform float uPigment;
uniform float uBeatExpansion;
uniform float uOnsetWarp;

float hash21(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + float2(1, 0)), f.x),
             mix(hash21(i + float2(0, 1)), hash21(i + float2(1, 1)), f.x), f.y);
}
float fbm(float2 p) {
  float sum = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < ${SHADER_CONFIG.fbmOctaves}; i++) {
    sum += amplitude * noise(p);
    p = float2(0.8 * p.x - 0.6 * p.y, 0.6 * p.x + 0.8 * p.y) * 2.02 + 17.1;
    amplitude *= 0.5;
  }
  return sum;
}
half4 main(float2 xy) {
  float2 uv = (xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float motion = mix(1.0, ${VISUAL_CONFIG.reducedMotionScale.toFixed(3)}, uReducedMotion);
  float beat = uBeatPulse * motion;
  float2 p = uv * uMacroScale / (1.0 + uBeatExpansion * beat);
  p += 0.06 * motion * uTempoConfidence * float2(sin(6.28318 * uBeatPhase), cos(6.28318 * uBeatPhase));
  float t = uTime;
  float2 drift = float2(t * 0.43, -t * 0.31);
  float2 q = float2(fbm(p + drift), fbm(p + float2(4.7, 8.3) - drift * 0.7)) - 0.45;
  float warp = uTurbulence + uOnsetWarp * uOnset * motion + 0.25 * beat;
  float2 r = q;
  ${SHADER_CONFIG.warpStages > 1 ? `r = float2(fbm(p + ${SHADER_CONFIG.warpAmplitude.toFixed(3)} * warp * q + float2(1.7, 9.2) + drift), fbm(p + ${SHADER_CONFIG.warpAmplitude.toFixed(3)} * warp * q + float2(8.3, 2.8) - drift)) - 0.45;` : ''}
  float density = fbm(p + ${SHADER_CONFIG.warpAmplitude.toFixed(3)} * warp * r + drift * 0.25);
  float detail = noise((p + r * 0.8) * uDetailScale + drift);
  float wisps = pow(1.0 - abs(sin((density + ${SHADER_CONFIG.detailStrength.toFixed(3)} * detail * uSpectralHigh) * ${SHADER_CONFIG.filamentFrequency.toFixed(3)})), 3.0);
  float pigmentA = smoothstep(0.22, 0.66, density + 0.35 * q.x);
  float pigmentB = smoothstep(-0.14, 0.17, r.y + 0.15 * q.x + 0.04 * uSpectralMid);
  float pigmentC = smoothstep(0.35, 0.7, density + 0.16 * wisps * uBrightness);
  float3 ink = mix(uColorA, uColorB, pigmentB);
  ink = mix(ink, uColorC, pigmentC * 0.75);
  float presence = clamp(0.14 + uPigment * (0.25 + ${SHADER_CONFIG.pigmentContrast.toFixed(3)} * pigmentA + 0.2 * wisps) + 0.08 * uEnergy * uSpectralLow, 0.0, 1.0);
  float3 paper = uColorA * 0.24;
  float3 color = mix(paper, ink, presence);
  float highlight = uBloom * wisps * smoothstep(0.3, 0.65, density) * (0.7 + 0.3 * uTempoNormalized);
  color = mix(color, uColorC, highlight);
  float vignette = 1.0 - 0.12 * smoothstep(0.25, 1.1, length(uv));
  return half4(clamp(color * vignette, 0.0, 1.0), 1.0);
}
`;
