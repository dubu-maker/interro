import { describe, expect, it } from 'vitest';
import { case1 } from '../cases/case1';
import { judgeRelease, judgeReport } from './verdict';

const correct = {
  accusedId: 'park',
  motiveId: 'M_EMBEZZLEMENT',
  methodId: 'X_TROPHY',
};

describe('judgeReport', () => {
  it('진범과 증명 사슬이 모두 맞으면 유죄가 나온다', () => {
    const result = judgeReport(case1, {
      ...correct,
      evidenceIds: ['E4', 'E6', 'E8'],
    });

    expect(result.outcome).toBe('CONVICTED');
    expect(result.win).toBe(true);
    expect(result.matchedChain).toEqual(['E4', 'E6', 'E8']);
    expect(result.correctMotive).toBe(true);
    expect(result.correctMethod).toBe(true);
  });

  it('사슬에 없는 증거를 더 내도 유죄 판정은 유지된다', () => {
    const result = judgeReport(case1, {
      ...correct,
      evidenceIds: ['E1', 'E4', 'E5', 'E8'],
    });

    expect(result.outcome).toBe('CONVICTED');
    expect(result.matchedChain).toEqual(['E4', 'E5', 'E8']);
  });

  it('자백 없이도 증거만으로 사건이 해결된다 (동기·수법 오답이어도 유죄)', () => {
    const result = judgeReport(case1, {
      accusedId: 'park',
      motiveId: 'M_AFFAIR',
      methodId: 'X_PLANNED',
      evidenceIds: ['E4', 'E6', 'E8'],
    });

    expect(result.win).toBe(true);
    expect(result.correctMotive).toBe(false);
    expect(result.correctMethod).toBe(false);
  });

  it('진범은 맞지만 증거가 모자라면 증거 불충분이 되고 빠진 고리를 알려준다', () => {
    const result = judgeReport(case1, {
      ...correct,
      evidenceIds: ['E4', 'E6'],
    });

    expect(result.outcome).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.win).toBe(false);
    expect(result.missingEvidenceIds).toEqual(['E8']);
  });

  it('무고한 용의자를 기소하면 증거가 아무리 많아도 패배한다', () => {
    const result = judgeReport(case1, {
      ...correct,
      accusedId: 'sera',
      evidenceIds: ['E1', 'E3', 'E4', 'E5', 'E6', 'E8'],
    });

    expect(result.outcome).toBe('WRONG_SUSPECT');
    expect(result.win).toBe(false);
  });
});

describe('judgeRelease', () => {
  it('진범을 용의선상에서 제외하면 즉시 패배한다', () => {
    const result = judgeRelease(case1, 'park');
    expect(result?.outcome).toBe('CULPRIT_RELEASED');
    expect(result?.win).toBe(false);
  });

  it('무고한 용의자를 제외하는 것은 판정을 만들지 않는다', () => {
    expect(judgeRelease(case1, 'sera')).toBeUndefined();
    expect(judgeRelease(case1, 'minho')).toBeUndefined();
  });
});

describe('사건 1 보고서 선택지', () => {
  it('정답 동기·수법이 선택지에 존재하고 오답도 함께 제공된다', () => {
    expect(
      case1.motiveOptions.some((o) => o.id === case1.solution.motiveId),
    ).toBe(true);
    expect(
      case1.methodOptions.some((o) => o.id === case1.solution.methodId),
    ).toBe(true);
    expect(case1.motiveOptions.length).toBeGreaterThan(2);
    expect(case1.methodOptions.length).toBeGreaterThan(2);
  });
});
