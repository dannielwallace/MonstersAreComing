export interface GameStats {
  wavesSurvived: number;
  timeElapsed: number;
  enemiesKilled: number;
  towersBuilt: number;
  woodGathered: number;
  stoneGathered: number;
  goldGathered: number;
  wallsBuilt: number;
}

export const MAX_WAVE = 10;

export function isVictoryConditionMet(currentWave: number, aliveEnemyCount: number): boolean {
  return currentWave >= MAX_WAVE && aliveEnemyCount === 0;
}

export function formatVictoryStats(stats: GameStats, isVictory: boolean): string {
  const title = isVictory ? '胜利！' : '行城被摧毁';
  return `${title}
坚持时间：${stats.timeElapsed.toFixed(1)} 秒
波次：${stats.wavesSurvived}
击杀敌人：${stats.enemiesKilled}
箭塔：${stats.towersBuilt}
城墙：${stats.wallsBuilt}
木材：${Math.floor(stats.woodGathered)}
石料：${Math.floor(stats.stoneGathered)}
金矿：${Math.floor(stats.goldGathered)}
按 R 重新开始`;
}
