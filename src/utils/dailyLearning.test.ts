import { describe, expect, it } from 'vitest';
import {
  dedupeTypes,
  registerMistake,
  removeType,
  recordStreak,
  isMasteredStreak,
  pickNextPracticeType,
  buildPrevDayFromToday,
  mergeMistakeTypes,
  countsForMastery,
  applyTimeoutReward,
  nextPrevDayPhase,
  rolloverDailyState,
  createEmptyDailyState,
} from './dailyLearning';

describe('dailyLearning', () => {
  it('dedupeTypes removes duplicates', () => {
    expect(dedupeTypes(['a', 'b', 'a', ''])).toEqual(['a', 'b']);
  });

  it('registerMistake avoids duplicates', () => {
    expect(registerMistake(['a'], 'a')).toEqual(['a']);
    expect(registerMistake(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removeType removes', () => {
    expect(removeType(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('recordStreak increments on in-time correct and resets otherwise', () => {
    let s = recordStreak({}, 't', true);
    expect(s.t).toBe(1);
    s = recordStreak(s, 't', true);
    expect(s.t).toBe(2);
    s = recordStreak(s, 't', false);
    expect(s.t).toBe(0);
    // timeout-correct (not in-time) resets
    s = recordStreak({ t: 2 }, 't', false);
    expect(s.t).toBe(0);
  });

  it('isMasteredStreak true at 3', () => {
    expect(isMasteredStreak({ t: 3 }, 't')).toBe(true);
    expect(isMasteredStreak({ t: 2 }, 't')).toBe(false);
  });

  it('pickNextPracticeType avoids consecutive same when possible', () => {
    const rng = () => 0;
    expect(pickNextPracticeType(['a', 'b'], 'a', rng)).toBe('b');
    expect(pickNextPracticeType(['a'], 'a', rng)).toBe('a');
    expect(pickNextPracticeType([], 'a')).toBeNull();
  });

  it('buildPrevDayFromToday dedupes', () => {
    expect(buildPrevDayFromToday(['x', 'x', 'y'])).toEqual(['x', 'y']);
  });

  it('mergeMistakeTypes unions', () => {
    expect(mergeMistakeTypes(['a'], ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('countsForMastery', () => {
    expect(countsForMastery(true, false)).toBe(true);
    expect(countsForMastery(true, true)).toBe(false);
    expect(countsForMastery(false, false)).toBe(false);
  });

  it('applyTimeoutReward grants 1 per 3', () => {
    let r = applyTimeoutReward(0, 2);
    expect(r).toEqual({ progress: 2, rewardsGranted: 0 });
    r = applyTimeoutReward(2, 1);
    expect(r).toEqual({ progress: 0, rewardsGranted: 1 });
    r = applyTimeoutReward(0, 4);
    expect(r).toEqual({ progress: 1, rewardsGranted: 1 });
  });

  it('nextPrevDayPhase distinguishes first attempt', () => {
    expect(nextPrevDayPhase('pending', true)).toBe('done');
    expect(nextPrevDayPhase('pending', false)).toBe('mastering');
    expect(nextPrevDayPhase('mastering', true)).toBe('mastering');
    expect(nextPrevDayPhase('done', false)).toBe('done');
  });

  it('rollover merges today types into prev day', () => {
    const s = createEmptyDailyState('2026-01-01');
    s.todayTypes = ['a', 'b'];
    const r = rolloverDailyState(s, '2026-01-02');
    expect(r.prevDayTypes).toEqual(['a', 'b']);
    expect(r.todayTypes).toEqual([]);
    expect(r.normalSolvedCount).toBe(0);
  });
});
