/**
 * 효용 AI 모듈
 * 
 * 기반 이론:
 * - 기대 효용 이론 (Expected Utility Theory) - von Neumann & Morgenstern, 1944
 * - 매슬로우 욕구 위계 (Maslow's Hierarchy of Needs, 1943)
 * - 제한된 합리성 (Bounded Rationality) - Herbert Simon, 1955
 */

import { ActionType, ActionTag } from '../core/types.js';
import { SocialGraphState, getRelationship, findMostTrusted, findLeastTrusted, findMostIntimate } from './socialGraph.js';
import { BeliefState, getBeliefConfidence } from './beliefSystem.js';

// ============================================================
// 타입 정의
// ============================================================

/**
 * 매슬로우 욕구 위계 상태
 * 
 * 각 욕구의 충족도 [0, 1]
 * 0 = 완전 결핍, 1 = 완전 충족
 */
export interface NeedState {
    survival: number;          // 생존 (음식, 물, 수면)
    safety: number;            // 안전 (신체적 안전, 건강)
    social: number;           // 소속/사랑 (관계, 소속감)
    esteem: number;           // 존경 (자존감, 지위)
    selfActualization: number; // 자아실현 (잠재력 실현)
}

/**
 * 캐릭터 상태 (효용 계산에 필요한 정보)
 */
export interface CharacterState {
    id: string;
    needs: NeedState;
    traits: string[];         // 성격 특성 (예: "탐욕스러운", "용감한")
    intelligence: number;     // [0, 1] 지능 (효용 추정 정확도)
    location: string;
}

/**
 * 행동 후보
 */
export interface ActionCandidate {
    type: ActionType;
    targetId?: string;
    baseProbability: number;
}

/**
 * 효용 평가 결과
 */
export interface UtilityResult {
    action: ActionType;
    targetId?: string;
    expectedUtility: number;
    reasoning: string[];      // 의사결정 근거
}

// ============================================================
// 매슬로우 욕구 가중치 시스템
// ============================================================

/**
 * 욕구 우선순위 가중치 계산
 * 
 * 매슬로우 이론: 하위 욕구가 미충족되면 상위 욕구의 동기 감소
 * 
 * 수학적 모델:
 * w_i = (1 - satisfaction_i) × priority_i × gate_i
 * gate_i = Π_{j<i} sigmoid(satisfaction_j - threshold)
 */

const MASLOW_BASE_PRIORITY: Record<keyof NeedState, number> = {
    survival: 5.0,
    safety: 4.0,
    social: 3.0,
    esteem: 2.0,
    selfActualization: 1.0,
};

const MASLOW_THRESHOLD = 0.3; // 하위 욕구 임계값

function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-10 * x));
}

/**
 * 욕구 가중치 계산
 */
export function calculateNeedWeights(needs: NeedState): Record<keyof NeedState, number> {
    const weights: Record<keyof NeedState, number> = {
        survival: 0,
        safety: 0,
        social: 0,
        esteem: 0,
        selfActualization: 0,
    };

    // 계층적 게이트 계산
    const gateFactors = {
        survival: 1.0,
        safety: sigmoid(needs.survival - MASLOW_THRESHOLD),
        social: sigmoid(needs.survival - MASLOW_THRESHOLD) * sigmoid(needs.safety - MASLOW_THRESHOLD),
        esteem: sigmoid(needs.survival - MASLOW_THRESHOLD) * sigmoid(needs.safety - MASLOW_THRESHOLD) * sigmoid(needs.social - MASLOW_THRESHOLD),
        selfActualization: sigmoid(needs.survival - MASLOW_THRESHOLD) * sigmoid(needs.safety - MASLOW_THRESHOLD) * sigmoid(needs.social - MASLOW_THRESHOLD) * sigmoid(needs.esteem - MASLOW_THRESHOLD),
    };

    for (const key of Object.keys(needs) as (keyof NeedState)[]) {
        // 결핍도 × 기본 우선순위 × 게이트
        const deficiency = 1 - needs[key];
        weights[key] = deficiency * MASLOW_BASE_PRIORITY[key] * gateFactors[key];
    }

    return weights;
}

// ============================================================
// 행동-결과 영향 모델
// ============================================================

/**
 * 행동 타입별 욕구 영향
 */
interface ActionOutcome {
    needImpacts: Partial<Record<keyof NeedState, number>>;
    probability: number;  // 이 결과가 발생할 확률
}

/**
 * 행동 유형별 예상 결과
 */
function getActionOutcomes(
    actionType: ActionType,
    hasTarget: boolean,
    targetRelationship?: { trust: number; intimacy: number }
): ActionOutcome[] {
    switch (actionType) {
        case 'MOVE':
            return [
                {
                    needImpacts: { safety: 0.05 },
                    probability: 0.9,
                },
                {
                    needImpacts: { safety: -0.1 }, // 이동 중 위험
                    probability: 0.1,
                },
            ];

        case 'WAIT':
            return [
                {
                    needImpacts: { safety: 0.1, survival: 0.02 },
                    probability: 1.0,
                },
            ];

        case 'SPEAK':
            if (!hasTarget) {
                return [{ needImpacts: {}, probability: 1.0 }];
            }
            const speakTrust = targetRelationship?.trust ?? 0;
            return [
                {
                    needImpacts: {
                        social: 0.15 * (1 + speakTrust),
                        esteem: 0.05
                    },
                    probability: 0.7 + 0.2 * speakTrust,
                },
                {
                    needImpacts: { social: -0.05 },
                    probability: 0.3 - 0.2 * speakTrust,
                },
            ];

        case 'ATTACK':
            if (!hasTarget) {
                return [{ needImpacts: {}, probability: 1.0 }];
            }
            return [
                {
                    needImpacts: { safety: -0.2, esteem: 0.1 },
                    probability: 0.6,
                },
                {
                    needImpacts: { safety: -0.4, esteem: -0.1 },
                    probability: 0.4,
                },
            ];
    }
}

// ============================================================
// 효용 함수
// ============================================================

/**
 * 기대 효용 계산
 * 
 * 수학적 모델:
 * U(a) = Σ P(o|a) × V(o)
 * V(o) = Σ w_n × impact_n(o)
 */
export function calculateExpectedUtility(
    actor: CharacterState,
    actionType: ActionType,
    targetId: string | undefined,
    graph: SocialGraphState
): number {
    const needWeights = calculateNeedWeights(actor.needs);

    // 대상과의 관계 조회
    let targetRelationship: { trust: number; intimacy: number } | undefined;
    if (targetId) {
        const rel = getRelationship(graph, actor.id, targetId);
        if (rel) {
            targetRelationship = { trust: rel.trust, intimacy: rel.intimacy };
        }
    }

    const outcomes = getActionOutcomes(actionType, !!targetId, targetRelationship);

    let expectedUtility = 0;

    for (const outcome of outcomes) {
        // 결과의 가치 계산: Σ w_n × impact_n
        let value = 0;
        for (const [need, impact] of Object.entries(outcome.needImpacts)) {
            const weight = needWeights[need as keyof NeedState] ?? 0;
            value += weight * (impact ?? 0);
        }

        // 기대값: P(o|a) × V(o)
        expectedUtility += outcome.probability * value;
    }

    // 지능에 따른 노이즈 (제한된 합리성)
    // 지능이 낮으면 효용 추정이 부정확
    const noiseScale = (1 - actor.intelligence) * 0.3;
    const deterministicNoise = hashToFloat(actor.id + actionType + (targetId ?? ''));
    expectedUtility += (deterministicNoise - 0.5) * 2 * noiseScale;

    return expectedUtility;
}

// ============================================================
// 최적 행동 선택
// ============================================================

/**
 * 가능한 모든 행동의 효용을 평가하고 최적 행동 선택
 * 
 * 결정 규칙: argmax U(a)
 */
export function selectOptimalAction(
    actor: CharacterState,
    candidates: CharacterState[],
    graph: SocialGraphState,
    beliefs: BeliefState
): UtilityResult {
    const actionTypes: ActionType[] = ['MOVE', 'WAIT', 'SPEAK', 'ATTACK'];
    const reasoning: string[] = [];

    let bestAction: UtilityResult = {
        action: 'WAIT',
        expectedUtility: -Infinity,
        reasoning: [],
    };

    // 욕구 가중치 분석
    const needWeights = calculateNeedWeights(actor.needs);
    const dominantNeed = Object.entries(needWeights)
        .sort((a, b) => b[1] - a[1])[0];
    reasoning.push(`주요 욕구: ${dominantNeed[0]} (가중치: ${dominantNeed[1].toFixed(2)})`);

    for (const actionType of actionTypes) {
        // 대상이 필요한 행동인지 판별
        const needsTarget = actionType === 'SPEAK' || actionType === 'ATTACK';

        if (needsTarget) {
            // 각 대상에 대해 효용 계산
            for (const candidate of candidates) {
                if (candidate.id === actor.id) continue;

                const utility = calculateExpectedUtility(
                    actor,
                    actionType,
                    candidate.id,
                    graph
                );

                if (utility > bestAction.expectedUtility) {
                    bestAction = {
                        action: actionType,
                        targetId: candidate.id,
                        expectedUtility: utility,
                        reasoning: [...reasoning],
                    };
                }
            }
        } else {
            const utility = calculateExpectedUtility(actor, actionType, undefined, graph);

            if (utility > bestAction.expectedUtility) {
                bestAction = {
                    action: actionType,
                    expectedUtility: utility,
                    reasoning: [...reasoning],
                };
            }
        }
    }

    bestAction.reasoning.push(
        `선택: ${bestAction.action}${bestAction.targetId ? ` → ${bestAction.targetId}` : ''} (효용: ${bestAction.expectedUtility.toFixed(3)})`
    );

    return bestAction;
}

// ============================================================
// 대상 선택 (소셜 그래프 기반)
// ============================================================

/**
 * 말하기 대상 선택
 * 
 * 모델: argmax(intimacy × (1 + trust))
 */
export function selectSpeakTarget(
    actorId: string,
    graph: SocialGraphState
): string | undefined {
    return findMostIntimate(graph, actorId);
}

/**
 * 공격 대상 선택
 * 
 * 모델: argmin(trust)
 */
export function selectAttackTarget(
    actorId: string,
    graph: SocialGraphState
): string | undefined {
    return findLeastTrusted(graph, actorId);
}

// ============================================================
// 유틸리티 함수
// ============================================================

/**
 * 결정론적 해시 → [0, 1] 변환
 * 
 * 무작위 사용 금지 원칙을 따르면서 다양성 확보
 */
function hashToFloat(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 32비트 정수로 변환
    }
    // [0, 1] 범위로 정규화
    return (Math.abs(hash) % 10000) / 10000;
}

/**
 * 욕구 상태 업데이트
 */
export function updateNeeds(
    current: NeedState,
    deltas: Partial<Record<keyof NeedState, number>>
): NeedState {
    return {
        survival: clamp((current.survival) + (deltas.survival ?? 0), 0, 1),
        safety: clamp((current.safety) + (deltas.safety ?? 0), 0, 1),
        social: clamp((current.social) + (deltas.social ?? 0), 0, 1),
        esteem: clamp((current.esteem) + (deltas.esteem ?? 0), 0, 1),
        selfActualization: clamp((current.selfActualization) + (deltas.selfActualization ?? 0), 0, 1),
    };
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * 기본 욕구 상태 생성
 */
export function createDefaultNeedState(): NeedState {
    return {
        survival: 0.7,
        safety: 0.6,
        social: 0.5,
        esteem: 0.4,
        selfActualization: 0.3,
    };
}
