import { COLOR_CONFIG } from '../config';
import type { MappingFeatures } from './types';

export function attackRelease(current: number, target: number, seconds: number, attack: number, release: number): number {
  const tau = target > current ? attack : release;
  return current + (target - current) * (1 - Math.exp(-Math.max(0, seconds) / tau));
}

export class FeatureSmoother {
  private current: MappingFeatures = { energy: 0, brightness: 0, balance: [1 / 3, 1 / 3, 1 / 3], onset: 0 };

  reset() { this.current = { energy: 0, brightness: 0, balance: [1 / 3, 1 / 3, 1 / 3], onset: 0 }; }

  update(target: MappingFeatures, dt: number): MappingFeatures {
    const smooth = (value: number, next: number, config: { attack: number; release: number }) => attackRelease(value, next, dt, config.attack, config.release);
    const c = COLOR_CONFIG.smoothing;
    const balance = this.current.balance.map((value, i) => smooth(value, target.balance[i]!, c.balance)) as MappingFeatures['balance'];
    const sum = balance.reduce((total, value) => total + value, 0);
    this.current = {
      energy: smooth(this.current.energy, target.energy, c.energy),
      brightness: smooth(this.current.brightness, target.brightness, c.brightness),
      balance: balance.map((value) => value / Math.max(sum, 1e-12)) as MappingFeatures['balance'],
      onset: smooth(this.current.onset, target.onset, c.onset),
    };
    return this.current;
  }
}
