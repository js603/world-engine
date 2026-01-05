/**
 * 소셜 그래프 모듈
 * 
 * 기반 이론:
 * - 그래프 이론 (Graph Theory)
 * - PageRank 중심성 (Brin & Page, 1998)
 * - Louvain 커뮤니티 탐지 (Blondel et al., 2008)
 */

// ============================================================
// 타입 정의
// ============================================================

/**
 * 관계 타입
 * - trust: 신뢰도 [-1, 1] (적대 ~ 신뢰)
 * - intimacy: 친밀도 [0, 1] (낯선 ~ 친밀)
 * - interactions: 상호작용 횟수
 */
export interface Relationship {
    sourceId: string;
    targetId: string;
    trust: number;        // [-1, 1]
    intimacy: number;     // [0, 1]
    interactions: number;
    lastInteractionTurn: number;
}

/**
 * 캐릭터 노드
 */
export interface CharacterNode {
    id: string;
    outgoingRelations: string[];  // 이 캐릭터가 가진 관계 ID들
    incomingRelations: string[];  // 이 캐릭터를 향한 관계 ID들
}

/**
 * 소셜 그래프 상태
 */
export interface SocialGraphState {
    nodes: Map<string, CharacterNode>;
    relationships: Map<string, Relationship>;
}

/**
 * 관계 ID 생성 (결정론적)
 */
export function createRelationshipId(sourceId: string, targetId: string): string {
    return `${sourceId}->${targetId}`;
}

// ============================================================
// 그래프 생성 및 조회
// ============================================================

/**
 * 빈 소셜 그래프 생성
 */
export function createEmptySocialGraph(): SocialGraphState {
    return {
        nodes: new Map(),
        relationships: new Map(),
    };
}

/**
 * 캐릭터 노드 추가
 */
export function addCharacterNode(
    graph: SocialGraphState,
    characterId: string
): SocialGraphState {
    if (graph.nodes.has(characterId)) {
        return graph; // 이미 존재
    }

    const newNodes = new Map(graph.nodes);
    newNodes.set(characterId, {
        id: characterId,
        outgoingRelations: [],
        incomingRelations: [],
    });

    return { ...graph, nodes: newNodes };
}

/**
 * 관계 조회
 */
export function getRelationship(
    graph: SocialGraphState,
    sourceId: string,
    targetId: string
): Relationship | undefined {
    const relationId = createRelationshipId(sourceId, targetId);
    return graph.relationships.get(relationId);
}

/**
 * 양방향 관계 조회 (가중 평균)
 */
export function getBidirectionalRelationship(
    graph: SocialGraphState,
    idA: string,
    idB: string
): { trust: number; intimacy: number } {
    const relAB = getRelationship(graph, idA, idB);
    const relBA = getRelationship(graph, idB, idA);

    const trustA = relAB?.trust ?? 0;
    const trustB = relBA?.trust ?? 0;
    const intimacyA = relAB?.intimacy ?? 0;
    const intimacyB = relBA?.intimacy ?? 0;

    return {
        trust: (trustA + trustB) / 2,
        intimacy: (intimacyA + intimacyB) / 2,
    };
}

// ============================================================
// 관계 갱신
// ============================================================

/**
 * 관계 갱신 상수
 */
const TRUST_DECAY_RATE = 0.02;     // 턴당 신뢰 감쇠율
const INTIMACY_DECAY_RATE = 0.01; // 턴당 친밀도 감쇠율
const INTERACTION_TRUST_GAIN = 0.05;
const INTERACTION_INTIMACY_GAIN = 0.03;

/**
 * 관계 초기화 또는 갱신
 */
export function upsertRelationship(
    graph: SocialGraphState,
    sourceId: string,
    targetId: string,
    delta: { trust?: number; intimacy?: number },
    currentTurn: number
): SocialGraphState {
    const relationId = createRelationshipId(sourceId, targetId);
    const existing = graph.relationships.get(relationId);

    const newRelationship: Relationship = existing
        ? {
            ...existing,
            trust: clamp(existing.trust + (delta.trust ?? 0), -1, 1),
            intimacy: clamp(existing.intimacy + (delta.intimacy ?? 0), 0, 1),
            interactions: existing.interactions + 1,
            lastInteractionTurn: currentTurn,
        }
        : {
            sourceId,
            targetId,
            trust: clamp(delta.trust ?? 0, -1, 1),
            intimacy: clamp(delta.intimacy ?? 0, 0, 1),
            interactions: 1,
            lastInteractionTurn: currentTurn,
        };

    // 새 맵 생성
    const newRelationships = new Map(graph.relationships);
    newRelationships.set(relationId, newRelationship);

    // 노드 업데이트
    let newNodes = new Map(graph.nodes);

    // source 노드에 outgoing 추가
    const sourceNode = newNodes.get(sourceId);
    if (sourceNode && !sourceNode.outgoingRelations.includes(relationId)) {
        newNodes.set(sourceId, {
            ...sourceNode,
            outgoingRelations: [...sourceNode.outgoingRelations, relationId],
        });
    }

    // target 노드에 incoming 추가
    const targetNode = newNodes.get(targetId);
    if (targetNode && !targetNode.incomingRelations.includes(relationId)) {
        newNodes.set(targetId, {
            ...targetNode,
            incomingRelations: [...targetNode.incomingRelations, relationId],
        });
    }

    return { nodes: newNodes, relationships: newRelationships };
}

/**
 * 시간에 따른 관계 감쇠
 */
export function decayRelationships(
    graph: SocialGraphState,
    currentTurn: number
): SocialGraphState {
    const newRelationships = new Map<string, Relationship>();

    for (const [id, rel] of graph.relationships) {
        const turnsSince = currentTurn - rel.lastInteractionTurn;

        // 감쇠 적용 (상호작용 없는 기간에 비례)
        const decayedTrust = rel.trust * Math.pow(1 - TRUST_DECAY_RATE, turnsSince);
        const decayedIntimacy = rel.intimacy * Math.pow(1 - INTIMACY_DECAY_RATE, turnsSince);

        newRelationships.set(id, {
            ...rel,
            trust: clamp(decayedTrust, -1, 1),
            intimacy: clamp(decayedIntimacy, 0, 1),
        });
    }

    return { ...graph, relationships: newRelationships };
}

// ============================================================
// PageRank 중심성 계산
// ============================================================

const PAGERANK_DAMPING = 0.85;
const PAGERANK_ITERATIONS = 20;
const PAGERANK_TOLERANCE = 1e-6;

/**
 * PageRank 중심성 계산
 * 
 * 수학적 모델:
 * PR(v) = (1-d)/N + d * Σ(PR(u) / L(u))
 * 
 * @param graph 소셜 그래프
 * @returns 각 노드의 중심성 점수 맵
 */
export function calculatePageRank(graph: SocialGraphState): Map<string, number> {
    const nodeIds = Array.from(graph.nodes.keys());
    const n = nodeIds.length;

    if (n === 0) return new Map();

    // 초기값: 균등 분포
    const ranks = new Map<string, number>();
    for (const id of nodeIds) {
        ranks.set(id, 1 / n);
    }

    // 반복 계산
    for (let iter = 0; iter < PAGERANK_ITERATIONS; iter++) {
        const newRanks = new Map<string, number>();
        let maxDiff = 0;

        for (const nodeId of nodeIds) {
            const node = graph.nodes.get(nodeId)!;

            // 이 노드를 가리키는 노드들로부터의 기여 합산
            let sum = 0;
            for (const relId of node.incomingRelations) {
                const rel = graph.relationships.get(relId);
                if (rel) {
                    const sourceNode = graph.nodes.get(rel.sourceId);
                    if (sourceNode) {
                        const outDegree = sourceNode.outgoingRelations.length;
                        const sourceRank = ranks.get(rel.sourceId) ?? 0;

                        // 가중치: trust와 intimacy의 조합
                        const weight = 0.5 + 0.5 * ((rel.trust + 1) / 2); // [0.5, 1]
                        sum += weight * sourceRank / outDegree;
                    }
                }
            }

            const newRank = (1 - PAGERANK_DAMPING) / n + PAGERANK_DAMPING * sum;
            newRanks.set(nodeId, newRank);

            const diff = Math.abs(newRank - (ranks.get(nodeId) ?? 0));
            if (diff > maxDiff) maxDiff = diff;
        }

        // 수렴 검사
        if (maxDiff < PAGERANK_TOLERANCE) break;

        // 다음 반복을 위해 갱신
        for (const [id, rank] of newRanks) {
            ranks.set(id, rank);
        }
    }

    return ranks;
}

/**
 * 연결 중심성 (Degree Centrality) 계산
 */
export function calculateDegreeCentrality(graph: SocialGraphState): Map<string, number> {
    const centrality = new Map<string, number>();
    const n = graph.nodes.size;

    if (n <= 1) {
        for (const id of graph.nodes.keys()) {
            centrality.set(id, 0);
        }
        return centrality;
    }

    for (const [id, node] of graph.nodes) {
        // 정규화된 연결 중심성: (in + out) / (2 * (n-1))
        const degree = node.incomingRelations.length + node.outgoingRelations.length;
        centrality.set(id, degree / (2 * (n - 1)));
    }

    return centrality;
}

// ============================================================
// 커뮤니티 탐지 (단순화된 Louvain 기반)
// ============================================================

/**
 * 모듈성 기반 커뮤니티 탐지
 * 
 * 간소화된 구현:
 * - 신뢰도 > 0인 관계로 연결된 노드들을 같은 커뮤니티로
 * - 파벌(faction) 식별에 활용
 */
export function detectCommunities(graph: SocialGraphState): Map<string, string> {
    const communities = new Map<string, string>(); // nodeId -> communityId
    const visited = new Set<string>();
    let communityCounter = 0;

    for (const nodeId of graph.nodes.keys()) {
        if (visited.has(nodeId)) continue;

        const communityId = `community-${communityCounter++}`;
        const queue: string[] = [nodeId];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;

            visited.add(current);
            communities.set(current, communityId);

            const node = graph.nodes.get(current);
            if (!node) continue;

            // 양방향 긍정적 관계 탐색
            for (const relId of [...node.outgoingRelations, ...node.incomingRelations]) {
                const rel = graph.relationships.get(relId);
                if (rel && rel.trust > 0) {
                    const neighbor = rel.sourceId === current ? rel.targetId : rel.sourceId;
                    if (!visited.has(neighbor)) {
                        queue.push(neighbor);
                    }
                }
            }
        }
    }

    return communities;
}

// ============================================================
// 유틸리티 함수
// ============================================================

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * 특정 캐릭터의 모든 관계 조회
 */
export function getAllRelationshipsFor(
    graph: SocialGraphState,
    characterId: string
): Relationship[] {
    const node = graph.nodes.get(characterId);
    if (!node) return [];

    const relations: Relationship[] = [];
    for (const relId of [...node.outgoingRelations, ...node.incomingRelations]) {
        const rel = graph.relationships.get(relId);
        if (rel) relations.push(rel);
    }

    return relations;
}

/**
 * 가장 신뢰하는/불신하는 대상 찾기
 */
export function findMostTrusted(
    graph: SocialGraphState,
    characterId: string
): string | undefined {
    const node = graph.nodes.get(characterId);
    if (!node) return undefined;

    let maxTrust = -Infinity;
    let mostTrusted: string | undefined;

    for (const relId of node.outgoingRelations) {
        const rel = graph.relationships.get(relId);
        if (rel && rel.trust > maxTrust) {
            maxTrust = rel.trust;
            mostTrusted = rel.targetId;
        }
    }

    return mostTrusted;
}

export function findLeastTrusted(
    graph: SocialGraphState,
    characterId: string
): string | undefined {
    const node = graph.nodes.get(characterId);
    if (!node) return undefined;

    let minTrust = Infinity;
    let leastTrusted: string | undefined;

    for (const relId of node.outgoingRelations) {
        const rel = graph.relationships.get(relId);
        if (rel && rel.trust < minTrust) {
            minTrust = rel.trust;
            leastTrusted = rel.targetId;
        }
    }

    return leastTrusted;
}

/**
 * 가장 친밀한 대상 찾기
 */
export function findMostIntimate(
    graph: SocialGraphState,
    characterId: string
): string | undefined {
    const node = graph.nodes.get(characterId);
    if (!node) return undefined;

    let maxIntimacy = -Infinity;
    let mostIntimate: string | undefined;

    for (const relId of node.outgoingRelations) {
        const rel = graph.relationships.get(relId);
        if (rel && rel.intimacy > maxIntimacy) {
            maxIntimacy = rel.intimacy;
            mostIntimate = rel.targetId;
        }
    }

    return mostIntimate;
}
