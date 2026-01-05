/**
 * World Engine 모듈 인덱스
 * 
 * 엔진(Core) 위에서 동작하는 이론 기반 모듈들
 */

// 소셜 그래프 모듈 (그래프 이론, PageRank)
export {
    SocialGraphState,
    Relationship,
    CharacterNode,
    createEmptySocialGraph,
    addCharacterNode,
    getRelationship,
    upsertRelationship,
    decayRelationships,
    calculatePageRank,
    calculateDegreeCentrality,
    detectCommunities,
    findMostTrusted,
    findLeastTrusted,
    findMostIntimate,
} from './socialGraph.js';

// 믿음 시스템 모듈 (베이지안 확률론)
export {
    BeliefState,
    Belief,
    ObservationContext,
    WorldEvent,
    PropositionImpact,
    createBeliefState,
    setInitialBelief,
    bayesianUpdate,
    updateBeliefFromEvent,
    decayBeliefs,
    getBeliefConfidence,
} from './beliefSystem.js';

// 효용 AI 모듈 (기대 효용 이론, 매슬로우)
export {
    NeedState,
    CharacterState,
    UtilityResult,
    calculateNeedWeights,
    calculateExpectedUtility,
    selectOptimalAction,
    updateNeeds,
    createDefaultNeedState,
} from './utilityAI.js';

// 행동 선택 모듈 (효용 극대화, 소셜 그래프 기반)
export {
    GameCharacter,
    GameState,
    selectAction,
    generateActionsForTurn,
    createInitialGameState,
    updateRelationsFromAction,
} from './actionSelector.js';
