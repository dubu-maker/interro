import { describe, expect, it } from 'vitest';
import {
  allowedClaims,
  applyEvidencePresentation,
  createContractState,
  getClaim,
  getStage,
} from '../../engine/contract';
import { case1 } from './index';

describe('사건 1 계약 무결성', () => {
  it('모든 단계·전환·힌트가 존재하는 claim과 증거만 참조한다', () => {
    const evidenceIds = new Set(case1.evidences.map((entry) => entry.id));
    for (const suspect of case1.suspects) {
      const contract = suspect.contract;
      const claimIds = new Set(contract.claims.map((claim) => claim.id));
      const stageIds = new Set(contract.stages.map((stage) => stage.id));

      expect(stageIds.has(contract.initialStageId)).toBe(true);
      for (const stage of contract.stages) {
        for (const claimId of stage.allowedClaimIds) {
          expect(claimIds.has(claimId), `${suspect.id}/${stage.id}/${claimId}`).toBe(true);
        }
      }
      for (const transition of contract.transitions) {
        expect(stageIds.has(transition.from)).toBe(true);
        expect(stageIds.has(transition.to)).toBe(true);
        expect(
          evidenceIds.has(transition.whenEvidencePresented),
          `${suspect.id} 전환 증거 ${transition.whenEvidencePresented}`,
        ).toBe(true);
      }
      for (const hint of contract.hints) {
        for (const stageId of hint.stageIds) {
          expect(stageIds.has(stageId)).toBe(true);
        }
        if (hint.targetClaimId) {
          expect(claimIds.has(hint.targetClaimId)).toBe(true);
        }
        if (hint.targetEvidenceId) {
          expect(evidenceIds.has(hint.targetEvidenceId)).toBe(true);
        }
      }
      for (const claim of contract.claims) {
        for (const evidenceId of claim.contradictedBy ?? []) {
          expect(evidenceIds.has(evidenceId)).toBe(true);
        }
      }
    }
  });

  it('정답 증명 사슬은 존재하는 증거만 쓰고 진범이 용의자 목록에 있다', () => {
    const evidenceIds = new Set(case1.evidences.map((entry) => entry.id));
    expect(
      case1.suspects.some((entry) => entry.id === case1.solution.culpritId),
    ).toBe(true);
    for (const chain of case1.solution.proofEvidenceChains) {
      for (const evidenceId of chain) {
        expect(evidenceIds.has(evidenceId)).toBe(true);
      }
    }
  });
});

describe('사건 1 진행 경로', () => {
  it('박진태: E4 → E5 → E6 순서로 최후 변명까지 도달한다', () => {
    const contract = case1.suspects[1]!.contract;
    let state = createContractState(contract);
    expect(state.stageId).toBe('S0');

    state = applyEvidencePresentation(contract, state, 'E4').state;
    expect(state.stageId).toBe('S1');
    state = applyEvidencePresentation(contract, state, 'E5').state;
    expect(state.stageId).toBe('S2');
    state = applyEvidencePresentation(contract, state, 'E6').state;
    expect(state.stageId).toBe('S3');

    const claims = allowedClaims(contract, state).map((claim) => claim.id);
    expect(claims).toContain('C_PJ_FOUND_DEAD');
    expect(getClaim(contract, 'C_PJ_FOUND_DEAD')?.truth).toBe('false');
  });

  it('박진태: 증거 순서가 어긋나면 전진하지 않는다 (S0에서 E6)', () => {
    const contract = case1.suspects[1]!.contract;
    const state = createContractState(contract);
    const outcome = applyEvidencePresentation(contract, state, 'E6');
    expect(outcome.state.stageId).toBe('S0');
  });

  it('유민호: E7 → E6으로 목격 진술이 열린다', () => {
    const contract = case1.suspects[2]!.contract;
    let state = createContractState(contract);
    state = applyEvidencePresentation(contract, state, 'E7').state;
    expect(state.stageId).toBe('S1');
    const outcome = applyEvidencePresentation(contract, state, 'E6');
    expect(outcome.state.stageId).toBe('S2');
    expect(outcome.transition?.reactionLine).toContain('Director Park');

    const claims = allowedClaims(contract, outcome.state).map(
      (claim) => claim.id,
    );
    expect(claims).toContain('C_YM_SAW_PARK');
  });

  it('한세라: 통화 단어는 E5로 내부고발이 열리기 전까지 잠겨 있다', () => {
    const contract = case1.suspects[0]!.contract;
    let state = createContractState(contract);
    state = applyEvidencePresentation(contract, state, 'E1').state;
    state = applyEvidencePresentation(contract, state, 'E3').state;
    expect(state.stageId).toBe('S2');

    let claims = allowedClaims(contract, state).map((claim) => claim.id);
    expect(claims).not.toContain('C_HS_CALL_WORDS');
    expect(claims).toContain('C_HS_REFUSE_WORDS');

    state = applyEvidencePresentation(contract, state, 'E5').state;
    expect(state.stageId).toBe('S3');
    claims = allowedClaims(contract, state).map((claim) => claim.id);
    expect(claims).toContain('C_HS_CALL_WORDS');
    expect(claims).toContain('C_HS_WHISTLEBLOW');
    expect(getStage(contract, 'S3').strategy).toContain('whistleblowing');
  });
});
