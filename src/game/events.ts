import type { Point } from './math';
import type { ResourceAmounts } from './resources';

export type RouteEventKind = 'reward-circle' | 'chest' | 'fork-reward' | 'shop';

export interface RouteEvent {
  id: string;
  kind: RouteEventKind;
  position: Point;
  reward: ResourceAmounts;
  remaining: number;
  completed: boolean;
  claimed: boolean;
}

export interface RouteEventState {
  active: RouteEvent[];
  nextId: number;
}

export function createRouteEventState(): RouteEventState {
  return { active: [], nextId: 0 };
}

export function createRewardCircle(
  id: string,
  position: Point,
  reward: ResourceAmounts,
  duration = 6,
): RouteEvent {
  return {
    id,
    kind: 'reward-circle',
    position: { ...position },
    reward,
    remaining: duration,
    completed: false,
    claimed: false,
  };
}

export function updateRewardCircle(event: RouteEvent, deltaSeconds: number, occupied: boolean): RouteEvent {
  if (event.completed || !occupied) return event;
  const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  const remaining = Math.max(0, event.remaining - delta);
  return { ...event, remaining, completed: remaining === 0 };
}

export function completeRewardCircle(event: RouteEvent): { event: RouteEvent; reward: ResourceAmounts } {
  if (!event.completed || event.claimed) {
    return { event, reward: {} };
  }
  return { event: { ...event, claimed: true }, reward: event.reward };
}
