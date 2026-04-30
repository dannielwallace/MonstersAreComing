import { describe, expect, it } from 'vitest';
import {
  createRewardCircle,
  completeRewardCircle,
  createRouteEventState,
  updateRewardCircle,
} from '../src/game/events';

describe('route events', () => {
  it('creates a reward circle with a timer and reward', () => {
    expect(createRewardCircle('circle-1', { x: 100, y: 120 }, { gold: 12 }, 6)).toMatchObject({
      id: 'circle-1',
      kind: 'reward-circle',
      position: { x: 100, y: 120 },
      remaining: 6,
      reward: { gold: 12 },
      completed: false,
    });
  });

  it('only advances reward circles when occupied', () => {
    const event = createRewardCircle('circle-1', { x: 0, y: 0 }, { wood: 20 }, 3);
    expect(updateRewardCircle(event, 1, false).remaining).toBe(3);
    expect(updateRewardCircle(event, 1, true).remaining).toBe(2);
  });

  it('completes reward circles and grants once', () => {
    const event = updateRewardCircle(createRewardCircle('circle-1', { x: 0, y: 0 }, { gold: 5 }, 1), 2, true);
    expect(event.completed).toBe(true);
    expect(completeRewardCircle(event).reward).toEqual({ gold: 5 });
    expect(completeRewardCircle({ ...event, claimed: true }).reward).toEqual({});
  });

  it('starts with no active events', () => {
    expect(createRouteEventState()).toEqual({ active: [], nextId: 0 });
  });
});
