export interface SpawnTimerResult {
  timer: number;
  spawnCount: number;
}

export function getSpawnInterval(elapsedSeconds: number): number {
  if (elapsedSeconds >= 180) {
    return 1.4;
  }

  if (elapsedSeconds >= 90) {
    return 2;
  }

  if (elapsedSeconds >= 30) {
    return 2.8;
  }

  return 4;
}

export function updateSpawnTimer(currentTimer: number, deltaSeconds: number, interval: number): SpawnTimerResult {
  let timer = currentTimer + deltaSeconds;
  let spawnCount = 0;

  while (timer >= interval) {
    timer -= interval;
    spawnCount += 1;
  }

  return {
    timer: Number(timer.toFixed(6)),
    spawnCount,
  };
}
