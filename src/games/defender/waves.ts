import type { WaveConfig } from './types'

export const WAVE_CONFIGS: WaveConfig[] = [
  {
    wave: 1,
    commands: ['h', 'j', 'k', 'l', 'w', 'b', '0', '$'],
    enemyCount: 8,
    spawnIntervalMs: 2500,
    baseSpeed: 30,
    speedVariance: 10,
  },
  {
    wave: 2,
    commands: ['dw', 'dd', 'yy', 'p', 'u', 'gg', 'G', 'x', 'D', 'C'],
    enemyCount: 12,
    spawnIntervalMs: 2200,
    baseSpeed: 40,
    speedVariance: 15,
  },
  {
    wave: 3,
    commands: ['ci"', 'di(', 'daw', 'ciw', '3j', '2k', 'yiw', 'diw', 'ct;', 'dt.'],
    enemyCount: 15,
    spawnIntervalMs: 2000,
    baseSpeed: 50,
    speedVariance: 20,
  },
  {
    wave: 4,
    commands: ['ggVG', 'dap', 'cib', 'vat', 'yi(', 'da"', 'viw', 'cit'],
    enemyCount: 18,
    spawnIntervalMs: 1800,
    baseSpeed: 60,
    speedVariance: 25,
  },
  {
    wave: 5,
    commands: [':%s/a/b/g', 'gg=G', 'vip', 'das', 'ci{', 'di[', 'va"', 'ci<', 'dip', 'yap'],
    enemyCount: 22,
    spawnIntervalMs: 1500,
    baseSpeed: 70,
    speedVariance: 30,
  },
]