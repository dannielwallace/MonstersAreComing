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

/**
 * Route fork — player chooses between two paths at a specific caravan position.
 */
export interface RouteForkChoice {
  label: string;
  description: string;
  modifier: RouteModifier;
}

export type RouteModifier =
  | 'combat-heavy'    // more enemies, higher boss HP
  | 'resource-rich'   // more reward circles, better resource drops
  | 'balanced';

export interface RouteFork {
  id: string;
  triggerDistance: number; // caravan x position where fork appears
  choiceA: RouteForkChoice;
  choiceB: RouteForkChoice;
  chosen: RouteForkChoice | null;
  triggered: boolean;
}

export const ROUTE_FORKS: RouteFork[] = [
  {
    id: 'fork-1',
    triggerDistance: 1800,
    choiceA: { label: '烈焰隘口', description: '敌人更多，但奖励更丰厚', modifier: 'combat-heavy' },
    choiceB: { label: '幽谷小径', description: '敌人较少，资源点更多', modifier: 'resource-rich' },
    chosen: null,
    triggered: false,
  },
  {
    id: 'fork-2',
    triggerDistance: 3800,
    choiceA: { label: '荒原大道', description: '开阔地带，大量敌人波次', modifier: 'combat-heavy' },
    choiceB: { label: '密林暗道', description: '隐蔽路线，精英怪+稀有升级', modifier: 'resource-rich' },
    chosen: null,
    triggered: false,
  },
];

export function createRouteForkState(): RouteFork[] {
  return ROUTE_FORKS.map((fork) => ({ ...fork, chosen: null, triggered: false }));
}
