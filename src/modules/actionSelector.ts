/**
 * 행동 선택 모듈
 * 
 * 기반 이론:
 * - 효용 극대화 (Utility Maximization)
 * - 소셜 그래프 기반 대상 선택
 * - 상황 인식 (Situation Awareness)
 * 
 * 이 모듈은 기존 actionGenerator.ts를 대체합니다.
 */

import { Action, ActionType } from '../core/types.js';
import { ExtendedWorldState } from '../core/chronicle-pressure.js';
import {
    SocialGraphState,
    getRelationship,
    findMostIntimate,
    findLeastTrusted,
    addCharacterNode,
    createEmptySocialGraph,
    upsertRelationship
} from './socialGraph.js';
import {
    CharacterState,
    NeedState,
    selectOptimalAction,
    calculateExpectedUtility,
    createDefaultNeedState
} from './utilityAI.js';
import { BeliefState, createBeliefState } from './beliefSystem.js';

// ============================================================
// 확장된 캐릭터 상태
// ============================================================

/**
 * 게임 내 캐릭터 전체 상태
 */
export interface GameCharacter {
    id: string;
    name: string;
    needs: NeedState;
    beliefs: BeliefState;
    traits: string[];
    intelligence: number;
    location: string;
}

/**
 * 확장된 게임 상태 (모듈들이 사용)
 */
export interface GameState {
    world: ExtendedWorldState;
    characters: Map<string, GameCharacter>;
    socialGraph: SocialGraphState;
}

// ============================================================
// 대상 선택 로직
// ============================================================

/**
 * SPEAK 대상 선택
 * 
 * 수학적 모델:
 * target = argmax_{t ∈ Others} intimacy(actor, t) × (1 + trust(actor, t))
 */
export function selectSpeakTarget(
    actorId: string,
    candidates: string[],
    graph: SocialGraphState
): string | undefined {
    if (candidates.length === 0) return undefined;

    let bestTarget: string | undefined;
    let bestScore = -Infinity;

    for (const targetId of candidates) {
        if (targetId === actorId) continue;

        const rel = getRelationship(graph, actorId, targetId);
        const intimacy = rel?.intimacy ?? 0.1; // 기본 친밀도
        const trust = rel?.trust ?? 0;         // 기본 신뢰도

        // 점수: 친밀도 × (1 + 신뢰도)
        // 신뢰도가 -1이면 점수 0, 신뢰도가 1이면 점수 2배
        const score = intimacy * (1 + trust);

        if (score > bestScore) {
            bestScore = score;
            bestTarget = targetId;
        }
    }

    return bestTarget;
}

/**
 * ATTACK 대상 선택
 * 
 * 수학적 모델:
 * target = argmin_{t ∈ Others} trust(actor, t) × threat(t)
 * 
 * 현재 threat는 1로 고정 (향후 확장 가능)
 */
export function selectAttackTarget(
    actorId: string,
    candidates: string[],
    graph: SocialGraphState
): string | undefined {
    if (candidates.length === 0) return undefined;

    let bestTarget: string | undefined;
    let minScore = Infinity;

    for (const targetId of candidates) {
        if (targetId === actorId) continue;

        const rel = getRelationship(graph, actorId, targetId);
        const trust = rel?.trust ?? 0;

        // 가장 불신하는 대상 선택
        if (trust < minScore) {
            minScore = trust;
            bestTarget = targetId;
        }
    }

    return bestTarget;
}

/**
 * 행동 유형별 대상 선택
 */
export function selectTargetForAction(
    actorId: string,
    actionType: ActionType,
    candidates: string[],
    graph: SocialGraphState
): string | undefined {
    switch (actionType) {
        case 'SPEAK':
            return selectSpeakTarget(actorId, candidates, graph);
        case 'ATTACK':
            return selectAttackTarget(actorId, candidates, graph);
        default:
            return undefined; // MOVE, WAIT는 대상 불필요
    }
}

// ============================================================
// 행동 선택 (효용 기반)
// ============================================================

/**
 * 단일 캐릭터의 행동 선택
 */
export function selectAction(
    actor: GameCharacter,
    allCharacters: GameCharacter[],
    graph: SocialGraphState
): Action {
    // CharacterState로 변환
    const actorState: CharacterState = {
        id: actor.id,
        needs: actor.needs,
        traits: actor.traits,
        intelligence: actor.intelligence,
        location: actor.location,
    };

    const candidateStates: CharacterState[] = allCharacters
        .filter(c => c.id !== actor.id)
        .map(c => ({
            id: c.id,
            needs: c.needs,
            traits: c.traits,
            intelligence: c.intelligence,
            location: c.location,
        }));

    // 최적 행동 선택
    const result = selectOptimalAction(
        actorState,
        candidateStates,
        graph,
        actor.beliefs
    );

    // Action 객체로 변환
    return {
        actorId: actor.id,
        targetId: result.targetId,
        type: result.action,
        tags: getTagsForAction(result.action),
    };
}

/**
 * 턴의 모든 캐릭터 행동 생성
 */
export function generateActionsForTurn(
    gameState: GameState
): Action[] {
    const characters = Array.from(gameState.characters.values());

    return characters.map(actor =>
        selectAction(actor, characters, gameState.socialGraph)
    );
}

// ============================================================
// 유틸리티 함수
// ============================================================

/**
 * 행동 유형에 따른 태그 부여
 */
function getTagsForAction(actionType: ActionType): Action['tags'] {
    switch (actionType) {
        case 'MOVE':
            return ['NEUTRAL'];
        case 'WAIT':
            return ['SAFE'];
        case 'SPEAK':
            return ['SOCIAL'];
        case 'ATTACK':
            return ['RISKY', 'AGGRESSIVE'];
    }
}

/**
 * 초기 게임 상태 생성
 */
export function createInitialGameState(
    characterIds: string[],
    world: ExtendedWorldState
): GameState {
    const characters = new Map<string, GameCharacter>();
    let graph = createEmptySocialGraph();

    // 캐릭터 생성
    for (const id of characterIds) {
        characters.set(id, {
            id,
            name: getCharacterName(id),
            needs: createDefaultNeedState(),
            beliefs: createBeliefState(id),
            traits: [],
            intelligence: 0.7,
            location: 'TOWN',
        });

        graph = addCharacterNode(graph, id);
    }

    // 초기 관계 설정 (모든 캐릭터 간 기본 관계)
    for (const idA of characterIds) {
        for (const idB of characterIds) {
            if (idA !== idB) {
                graph = upsertRelationship(
                    graph,
                    idA,
                    idB,
                    { trust: 0, intimacy: 0.1 },
                    world.turn
                );
            }
        }
    }

    return { world, characters, socialGraph: graph };
}

/**
 * 캐릭터 이름 조회 (ID → 이름)
 */
function getCharacterName(id: string): string {
    const names: Record<string, string> = {
        'npc-1': '첫째 자',
        'npc-2': '둘째 자',
        'npc-3': '셋째 자',
    };
    return names[id] ?? id;
}

/**
 * 행동 후 관계 갱신
 */
export function updateRelationsFromAction(
    gameState: GameState,
    action: Action
): GameState {
    if (!action.targetId) return gameState;

    let graph = gameState.socialGraph;

    switch (action.type) {
        case 'SPEAK':
            // 대화 → 친밀도 및 신뢰 소폭 증가
            graph = upsertRelationship(
                graph,
                action.actorId,
                action.targetId,
                { trust: 0.05, intimacy: 0.08 },
                gameState.world.turn
            );
            // 양방향
            graph = upsertRelationship(
                graph,
                action.targetId,
                action.actorId,
                { trust: 0.03, intimacy: 0.05 },
                gameState.world.turn
            );
            break;

        case 'ATTACK':
            // 공격 → 신뢰 급감, 친밀도 감소
            graph = upsertRelationship(
                graph,
                action.actorId,
                action.targetId,
                { trust: -0.3, intimacy: -0.1 },
                gameState.world.turn
            );
            graph = upsertRelationship(
                graph,
                action.targetId,
                action.actorId,
                { trust: -0.5, intimacy: -0.2 },
                gameState.world.turn
            );
            break;
    }

    return { ...gameState, socialGraph: graph };
}
