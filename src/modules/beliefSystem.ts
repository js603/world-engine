/**
 * 믿음 시스템 모듈
 * 
 * 기반 이론:
 * - 베이지안 확률론 (Bayesian Probability Theory)
 * - Theory of Mind (Baron-Cohen et al., 1985)
 * - 인지 편향 및 휴리스틱 (Tversky & Kahneman, 1974)
 */

// ============================================================
// 타입 정의
// ============================================================

/**
 * 개별 믿음 엔트리
 */
export interface Belief {
    proposition: string;    // 명제 (예: "왕은 선하다", "전쟁이 온다")
    confidence: number;     // 확신도 [0, 1]
    lastUpdatedTurn: number;
    sources: string[];      // 이 믿음의 출처 (이벤트 ID들)
}

/**
 * 캐릭터의 믿음 상태
 */
export interface BeliefState {
    characterId: string;
    beliefs: Map<string, Belief>;
}

/**
 * 관찰 컨텍스트 - 캐릭터가 사건을 어떻게 관찰하는지
 */
export interface ObservationContext {
    observerId: string;
    observerLocation: string;
    attentionLevel: number;   // [0, 1] 주의력
    intelligence: number;     // [0, 1] 지능 (해석 정확도)
}

/**
 * 세계 이벤트 (관찰 대상)
 */
export interface WorldEvent {
    id: string;
    type: string;
    actorId: string;
    targetId?: string;
    location: string;
    turn: number;
    visibility: number;       // [0, 1] 사건의 가시성
}

// ============================================================
// 믿음 시스템 생성 및 초기화
// ============================================================

/**
 * 캐릭터의 빈 믿음 상태 생성
 */
export function createBeliefState(characterId: string): BeliefState {
    return {
        characterId,
        beliefs: new Map(),
    };
}

/**
 * 초기 믿음 설정
 */
export function setInitialBelief(
    state: BeliefState,
    proposition: string,
    confidence: number,
    turn: number
): BeliefState {
    const newBeliefs = new Map(state.beliefs);
    newBeliefs.set(proposition, {
        proposition,
        confidence: clamp(confidence, 0, 1),
        lastUpdatedTurn: turn,
        sources: ['initial'],
    });

    return { ...state, beliefs: newBeliefs };
}

// ============================================================
// 관찰 필터링
// ============================================================

/**
 * 사건의 관찰 가능성 계산
 * 
 * 모델:
 * P(observe) = visibility × distance_factor × attention
 */
export function calculateObservability(
    event: WorldEvent,
    context: ObservationContext
): number {
    // 같은 위치면 거리 계수 1.0, 다르면 0.3
    const distanceFactor = event.location === context.observerLocation ? 1.0 : 0.3;

    // 관찰 확률
    const observability = event.visibility * distanceFactor * context.attentionLevel;

    return clamp(observability, 0, 1);
}

/**
 * 사건이 관찰되었는지 결정 (결정론적)
 * 
 * 무작위 사용 금지 원칙에 따라,
 * 임계값 기반 결정론적 판단 사용
 */
export function isEventObserved(
    event: WorldEvent,
    context: ObservationContext,
    threshold: number = 0.5
): boolean {
    const observability = calculateObservability(event, context);
    return observability >= threshold;
}

// ============================================================
// 베이지안 갱신
// ============================================================

/**
 * 사건-명제 관련성 매핑
 * 
 * 특정 사건 타입이 특정 명제에 미치는 영향 정의
 */
export interface PropositionImpact {
    proposition: string;
    likelihoodIfTrue: number;   // P(E|H)
    likelihoodIfFalse: number;  // P(E|¬H)
}

/**
 * 베이지안 믿음 갱신
 * 
 * 수학적 모델:
 * P(H|E) = P(E|H) × P(H) / P(E)
 * P(E) = P(E|H) × P(H) + P(E|¬H) × P(¬H)
 * 
 * @param prior 사전 확률 P(H)
 * @param likelihoodTrue P(E|H)
 * @param likelihoodFalse P(E|¬H)
 * @returns 사후 확률 P(H|E)
 */
export function bayesianUpdate(
    prior: number,
    likelihoodTrue: number,
    likelihoodFalse: number
): number {
    // P(E) = P(E|H) × P(H) + P(E|¬H) × (1 - P(H))
    const evidence = likelihoodTrue * prior + likelihoodFalse * (1 - prior);

    if (evidence === 0) return prior; // 증거가 없으면 사전 확률 유지

    // P(H|E) = P(E|H) × P(H) / P(E)
    const posterior = (likelihoodTrue * prior) / evidence;

    return clamp(posterior, 0, 1);
}

/**
 * 사건을 기반으로 믿음 상태 갱신
 */
export function updateBeliefFromEvent(
    state: BeliefState,
    event: WorldEvent,
    context: ObservationContext,
    impacts: PropositionImpact[]
): BeliefState {
    // 관찰 불가능하면 갱신 없음
    if (!isEventObserved(event, context)) {
        return state;
    }

    const newBeliefs = new Map(state.beliefs);

    for (const impact of impacts) {
        const existing = newBeliefs.get(impact.proposition);
        const prior = existing?.confidence ?? 0.5; // 기본 사전 확률

        // 지능에 따른 우도 조정 (지능 낮으면 우도 차이 감소)
        const adjustedLikelihoodTrue = adjustForIntelligence(
            impact.likelihoodIfTrue,
            context.intelligence
        );
        const adjustedLikelihoodFalse = adjustForIntelligence(
            impact.likelihoodIfFalse,
            context.intelligence
        );

        const posterior = bayesianUpdate(
            prior,
            adjustedLikelihoodTrue,
            adjustedLikelihoodFalse
        );

        newBeliefs.set(impact.proposition, {
            proposition: impact.proposition,
            confidence: posterior,
            lastUpdatedTurn: event.turn,
            sources: [...(existing?.sources ?? []), event.id],
        });
    }

    return { ...state, beliefs: newBeliefs };
}

/**
 * 지능에 따른 우도 조정
 * 
 * 지능이 낮으면 true/false 우도가 0.5에 가까워짐
 * 즉, 증거를 덜 정확하게 해석
 */
function adjustForIntelligence(likelihood: number, intelligence: number): number {
    // intelligence = 1: 원래 값 사용
    // intelligence = 0: 0.5에 가까워짐
    return 0.5 + (likelihood - 0.5) * intelligence;
}

// ============================================================
// 믿음 감쇠 및 망각
// ============================================================

const BELIEF_DECAY_RATE = 0.01; // 턴당 감쇠율
const BELIEF_EQUILIBRIUM = 0.5; // 불확실성으로 수렴

/**
 * 시간에 따른 믿음 감쇠
 * 
 * 갱신되지 않은 믿음은 점차 0.5(불확실)로 수렴
 */
export function decayBeliefs(
    state: BeliefState,
    currentTurn: number
): BeliefState {
    const newBeliefs = new Map<string, Belief>();

    for (const [prop, belief] of state.beliefs) {
        const turnsSince = currentTurn - belief.lastUpdatedTurn;
        const decayFactor = Math.pow(1 - BELIEF_DECAY_RATE, turnsSince);

        // 확신도가 0.5를 향해 수렴
        const diff = belief.confidence - BELIEF_EQUILIBRIUM;
        const decayedConfidence = BELIEF_EQUILIBRIUM + diff * decayFactor;

        newBeliefs.set(prop, {
            ...belief,
            confidence: clamp(decayedConfidence, 0, 1),
        });
    }

    return { ...state, beliefs: newBeliefs };
}

// ============================================================
// 믿음 조회
// ============================================================

/**
 * 특정 명제에 대한 믿음 조회
 */
export function getBeliefConfidence(
    state: BeliefState,
    proposition: string
): number {
    return state.beliefs.get(proposition)?.confidence ?? 0.5;
}

/**
 * 가장 강한 믿음 (긍정)
 */
export function getStrongestPositiveBelief(
    state: BeliefState
): Belief | undefined {
    let strongest: Belief | undefined;
    let maxConfidence = 0.5;

    for (const belief of state.beliefs.values()) {
        if (belief.confidence > maxConfidence) {
            maxConfidence = belief.confidence;
            strongest = belief;
        }
    }

    return strongest;
}

/**
 * 가장 강한 믿음 (부정)
 */
export function getStrongestNegativeBelief(
    state: BeliefState
): Belief | undefined {
    let strongest: Belief | undefined;
    let minConfidence = 0.5;

    for (const belief of state.beliefs.values()) {
        if (belief.confidence < minConfidence) {
            minConfidence = belief.confidence;
            strongest = belief;
        }
    }

    return strongest;
}

// ============================================================
// 유틸리티 함수
// ============================================================

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * 두 캐릭터의 믿음 유사성 계산 (코사인 유사도)
 */
export function calculateBeliefSimilarity(
    stateA: BeliefState,
    stateB: BeliefState
): number {
    const allProps = new Set([
        ...stateA.beliefs.keys(),
        ...stateB.beliefs.keys(),
    ]);

    if (allProps.size === 0) return 1.0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const prop of allProps) {
        const confA = stateA.beliefs.get(prop)?.confidence ?? 0.5;
        const confB = stateB.beliefs.get(prop)?.confidence ?? 0.5;

        dotProduct += confA * confB;
        normA += confA * confA;
        normB += confB * confB;
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
