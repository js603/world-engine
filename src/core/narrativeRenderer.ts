import { Action, ActionLog, MeaningEvent, ChronicleEntry, MeaningType, ActionType } from './types.js';

/**
 * 서사 렌더러 - 로그/의미/연대기를 서사적 텍스트로 변환
 */

// ============================================================
// 1. 행동 서사 템플릿
// ============================================================

// 대상이 없는 경우 템플릿
const ACTION_TEMPLATES: Record<ActionType, string[]> = {
    MOVE: [
        '{actor}이(가) 조용히 이동했다.',
        '{actor}이(가) 발걸음을 옮겼다.',
        '{actor}이(가) 새로운 곳으로 향했다.',
    ],
    SPEAK: [
        '{actor}이(가) 혼잣말을 했다.',
        '{actor}이(가) 말문을 열었다.',
        '{actor}의 목소리가 울려 퍼졌다.',
    ],
    WAIT: [
        '{actor}이(가) 조용히 상황을 지켜보았다.',
        '{actor}이(가) 잠시 숨을 고르며 기다렸다.',
        '{actor}이(가) 침묵 속에 머물렀다.',
    ],
    ATTACK: [
        '{actor}이(가) 허공에 주먹을 휘둘렀다!',
        '{actor}이(가) 분노를 터뜨렸다!',
        '{actor}의 칼날이 허공을 갈랐다!',
    ],
};

// 대상이 있는 경우 템플릿
const ACTION_TEMPLATES_WITH_TARGET: Record<ActionType, string[]> = {
    MOVE: ACTION_TEMPLATES.MOVE, // MOVE는 대상 불필요
    SPEAK: [
        '{actor}이(가) {target}에게 말을 건넸다.',
        '{actor}이(가) {target}와(과) 대화를 나눴다.',
        '{actor}이(가) {target}에게 속삭였다.',
    ],
    WAIT: ACTION_TEMPLATES.WAIT, // WAIT은 대상 불필요
    ATTACK: [
        '{actor}이(가) {target}을(를) 공격했다!',
        '{actor}이(가) {target}에게 칼을 휘둘렀다!',
        '{actor}이(가) {target}을(를) 향해 돌진했다!',
    ],
};

const TAG_MODIFIERS: Record<string, string[]> = {
    RISKY: ['위험을 무릅쓰고 ', '무모하게 ', '위태롭게 '],
    SAFE: ['신중하게 ', '조심스럽게 ', '안전하게 '],
    SOCIAL: ['따뜻한 눈빛으로 ', '우호적으로 ', '진심을 담아 '],
    AGGRESSIVE: ['분노에 차서 ', '거칠게 ', '공격적으로 '],
    PASSIVE: ['소극적으로 ', '망설이며 ', '주저하며 '],
    NEUTRAL: ['담담하게 ', '무심히 ', ''],
};

// ============================================================
// 2. 의미 서사 템플릿
// ============================================================

interface MeaningTemplate {
    low: string[];    // intensity < 0.3
    mid: string[];    // 0.3 <= intensity < 0.7
    high: string[];   // intensity >= 0.7
}

const MEANING_TEMPLATES: Record<MeaningType, MeaningTemplate> = {
    FEAR: {
        low: [
            '불안의 기운이 스쳐 지나갔다.',
            '희미한 두려움이 감돌았다.',
        ],
        mid: [
            '두려움이 마을에 스며들고 있다.',
            '공포의 씨앗이 뿌려졌다.',
            '사람들의 눈빛에 두려움이 어렸다.',
        ],
        high: [
            '두려움의 그림자가 온 세상을 덮었다!',
            '공포가 심장을 조여 온다!',
            '모두가 두려움에 떨고 있다!',
        ],
    },
    TRUST: {
        low: [
            '작은 신뢰의 불씨가 피어났다.',
            '마음이 살짝 열렸다.',
        ],
        mid: [
            '신뢰가 쌓이고 있다.',
            '관계의 끈이 단단해지고 있다.',
            '서로를 바라보는 눈빛이 따뜻해졌다.',
        ],
        high: [
            '깊은 신뢰가 형성되었다!',
            '굳건한 유대가 만들어졌다!',
            '서로를 향한 믿음이 확고해졌다!',
        ],
    },
    RESPECT: {
        low: [
            '존경의 싹이 틔었다.',
            '상대를 다시 보게 되었다.',
        ],
        mid: [
            '존경심이 피어나고 있다.',
            '명성이 조금씩 퍼지고 있다.',
            '사람들이 그를 주목하기 시작했다.',
        ],
        high: [
            '위대한 명성이 울려 퍼졌다!',
            '모두가 그를 우러러보았다!',
            '전설이 되어가고 있다!',
        ],
    },
};

// ============================================================
// 3. 연대기 서사 템플릿
// ============================================================

const CHRONICLE_TEMPLATES: Record<MeaningType, string[]> = {
    FEAR: [
        '📜 역사에 기록되리라: 두려움의 시대가 시작되었다.',
        '📜 훗날 사람들은 이 시기를 "공포의 세월"이라 부르리라.',
        '📜 어둠의 연대기에 새로운 장이 열렸다.',
    ],
    TRUST: [
        '📜 역사에 기록되리라: 화합의 시대가 열렸다.',
        '📜 훗날 사람들은 이 시기를 "신뢰의 시대"라 기억하리라.',
        '📜 평화의 연대기에 새로운 장이 열렸다.',
    ],
    RESPECT: [
        '📜 역사에 기록되리라: 영웅의 시대가 도래했다.',
        '📜 훗날 사람들은 이 시기를 "영광의 시대"라 칭송하리라.',
        '📜 명예의 연대기에 새로운 장이 열렸다.',
    ],
};

// ============================================================
// 4. 턴 요약 템플릿
// ============================================================

const TURN_SUMMARY_TEMPLATES = {
    calm: [
        '평온한 시간이 흘렀다.',
        '고요 속에 하루가 저물었다.',
        '큰 일 없이 해가 졌다.',
    ],
    tense: [
        '긴장감이 감도는 시간이었다.',
        '불안과 갈등이 교차하는 순간이었다.',
        '무언가 일어날 것 같은 예감이 있었다.',
    ],
    violent: [
        '피와 분노의 시간이었다!',
        '폭풍 같은 하루였다!',
        '격동의 순간이 지나갔다!',
    ],
    hopeful: [
        '희망의 빛이 비추는 시간이었다.',
        '따뜻한 온기가 퍼져나갔다.',
        '더 나은 내일을 향한 발걸음이었다.',
    ],
};

// ============================================================
// 결정론적 선택 함수 (무작위 금지 원칙)
// ============================================================

/**
 * 결정론적 해시 → [0, n) 정수 변환
 * 
 * 동일 입력 → 동일 출력 보장
 */
function hashToIndex(input: string, arrayLength: number): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 32비트 정수로 변환
    }
    return Math.abs(hash) % arrayLength;
}

/**
 * 문맥 기반 결정론적 템플릿 선택
 * 
 * @param arr 템플릿 배열
 * @param context 문맥 문자열 (행동 정보 조합)
 */
function selectFromArray<T>(arr: readonly T[], context: string): T {
    const index = hashToIndex(context, arr.length);
    return arr[index];
}

function getActorName(actorId: string): string {
    // 나중에 실제 캐릭터 이름으로 확장 가능
    const names: Record<string, string> = {
        'npc-1': '첫째 자',
        'npc-2': '둘째 자',
        'npc-3': '셋째 자',
    };
    return names[actorId] ?? actorId;
}

// ============================================================
// 한국어 조사 자동 선택
// ============================================================

/**
 * 한글 문자인지 확인
 */
function isHangul(char: string): boolean {
    const code = char.charCodeAt(0);
    return code >= 0xAC00 && code <= 0xD7A3;
}

/**
 * 마지막 글자의 받침 유무 확인
 * 
 * 한글 유니코드: (초성 * 21 + 중성) * 28 + 종성 + 0xAC00
 * 종성이 0이면 받침 없음
 */
function hasFinalConsonant(text: string): boolean {
    if (!text || text.length === 0) return false;

    const lastChar = text[text.length - 1];
    if (!isHangul(lastChar)) return false;

    const code = lastChar.charCodeAt(0) - 0xAC00;
    const jongseong = code % 28;

    return jongseong !== 0;
}

/**
 * 조사 자동 선택 및 적용
 * 
 * 지원하는 패턴:
 * - 이(가) → 받침O: 이, 받침X: 가
 * - 을(를) → 받침O: 을, 받침X: 를
 * - 와(과) → 받침O: 과, 받침X: 와
 * - 은(는) → 받침O: 은, 받침X: 는
 * - 으로(로) → 받침O: 으로, 받침X: 로 (ㄹ받침: 로)
 */
function applyParticles(text: string): string {
    // 각 패턴을 찾아 앞 글자의 받침에 따라 치환
    const patterns = [
        { pattern: /(.)(이\(가\))/g, withBatchim: '이', withoutBatchim: '가' },
        { pattern: /(.)(을\(를\))/g, withBatchim: '을', withoutBatchim: '를' },
        { pattern: /(.)(와\(과\))/g, withBatchim: '과', withoutBatchim: '와' },
        { pattern: /(.)(은\(는\))/g, withBatchim: '은', withoutBatchim: '는' },
    ];

    let result = text;

    for (const { pattern, withBatchim, withoutBatchim } of patterns) {
        result = result.replace(pattern, (match, prevChar, particle) => {
            const hasConsonant = hasFinalConsonant(prevChar);
            return prevChar + (hasConsonant ? withBatchim : withoutBatchim);
        });
    }

    return result;
}

// ============================================================
// 메인 렌더링 함수들
// ============================================================

/**
 * 단일 행동을 서사 문장으로 변환
 */
export function renderAction(action: Action | ActionLog): string {
    // 문맥 생성 (결정론적 선택을 위한 고유 키)
    const context = `${action.actorId}:${action.type}:${action.targetId ?? 'none'}`;

    // 대상이 있으면 대상 포함 템플릿 사용
    const hasTarget = 'targetId' in action && action.targetId;
    const templates = hasTarget
        ? ACTION_TEMPLATES_WITH_TARGET[action.type]
        : ACTION_TEMPLATES[action.type];
    let text = selectFromArray(templates, context);

    // 배우 이름 치환
    const actorName = getActorName(action.actorId);
    text = text.replace('{actor}', actorName);

    // 대상 이름 치환
    if (hasTarget && action.targetId) {
        const targetName = getActorName(action.targetId);
        text = text.replace('{target}', targetName);
    }

    // 태그에 따른 수식어 선택
    let modifier = '';
    for (const tag of action.tags) {
        const modifiers = TAG_MODIFIERS[tag];
        if (modifiers) {
            const modContext = `${context}:${tag}`;
            const picked = selectFromArray(modifiers, modContext);
            if (picked && picked.trim()) {
                modifier = picked.trim();
                break;
            }
        }
    }

    // 조사 자동 선택 적용
    text = applyParticles(text);

    // 수식어가 있으면 문장 앞에 추가
    if (modifier) {
        return `▸ ${modifier} ${text}`;
    }

    return `▸ ${text}`;
}

/**
 * 행동 배열을 서사 문장들로 변환
 */
export function renderActions(actions: readonly (Action | ActionLog)[]): string[] {
    return actions.map(renderAction);
}

/**
 * 의미 이벤트를 서사 문장으로 변환
 */
export function renderMeaning(meaning: MeaningEvent): string {
    const templates = MEANING_TEMPLATES[meaning.type];

    let level: keyof MeaningTemplate;
    if (meaning.intensity < 0.3) {
        level = 'low';
    } else if (meaning.intensity < 0.7) {
        level = 'mid';
    } else {
        level = 'high';
    }

    const context = `${meaning.id}:${meaning.type}:${level}`;
    const text = selectFromArray(templates[level], context);
    return `⚡ ${text}`;
}

/**
 * 의미 이벤트 배열을 서사 문장들로 변환 (중복 제거)
 */
export function renderMeanings(meanings: readonly MeaningEvent[]): string[] {
    // 같은 타입의 의미는 가장 강한 것만 렌더링
    const strongest = new Map<MeaningType, MeaningEvent>();
    for (const m of meanings) {
        const current = strongest.get(m.type);
        if (!current || m.intensity > current.intensity) {
            strongest.set(m.type, m);
        }
    }

    return [...strongest.values()].map(renderMeaning);
}

/**
 * 연대기를 서사 문장으로 변환
 */
export function renderChronicle(chronicle: ChronicleEntry): string {
    // 연대기 요약에서 타입 추출
    const lower = chronicle.summary.toLowerCase();
    let type: MeaningType = 'RESPECT'; // 기본값

    if (lower.includes('fear')) type = 'FEAR';
    else if (lower.includes('trust')) type = 'TRUST';
    else if (lower.includes('respect')) type = 'RESPECT';

    const context = `${chronicle.id}:${type}`;
    return selectFromArray(CHRONICLE_TEMPLATES[type], context);
}

/**
 * 연대기 배열을 서사 문장들로 변환
 */
export function renderChronicles(chronicles: readonly ChronicleEntry[]): string[] {
    return chronicles.map(renderChronicle);
}

/**
 * 턴 전체 요약 생성
 */
export function renderTurnSummary(
    actions: readonly (Action | ActionLog)[],
    meanings: readonly MeaningEvent[]
): string {
    // 턴의 분위기 결정
    const hasViolence = actions.some(a => a.tags.includes('AGGRESSIVE') || a.type === 'ATTACK');
    const hasFear = meanings.some(m => m.type === 'FEAR' && m.intensity >= 0.3);
    const hasTrust = meanings.some(m => m.type === 'TRUST' && m.intensity >= 0.3);
    const hasRespect = meanings.some(m => m.type === 'RESPECT' && m.intensity >= 0.3);

    let mood: keyof typeof TURN_SUMMARY_TEMPLATES;

    if (hasViolence && hasFear) {
        mood = 'violent';
    } else if (hasFear || hasViolence) {
        mood = 'tense';
    } else if (hasTrust || hasRespect) {
        mood = 'hopeful';
    } else {
        mood = 'calm';
    }

    const actionIds = actions.map(a => a.actorId).join(':');
    const context = `turn:${mood}:${actionIds}`;
    const text = selectFromArray(TURN_SUMMARY_TEMPLATES[mood], context);
    return `📖 이번 턴: ${text}`;
}

/**
 * 전체 서사 블록 렌더링
 */
export function renderNarrativeBlock(
    actions: readonly (Action | ActionLog)[],
    meanings: readonly MeaningEvent[],
    chronicles: readonly ChronicleEntry[]
): string {
    const lines: string[] = [];

    lines.push('');
    lines.push('--- 서사 요약 ---');

    // 행동 서사
    const actionNarratives = renderActions(actions);
    lines.push(...actionNarratives);

    // 의미 서사
    const meaningNarratives = renderMeanings(meanings);
    if (meaningNarratives.length > 0) {
        lines.push(...meaningNarratives);
    }

    // 연대기 서사
    const chronicleNarratives = renderChronicles(chronicles);
    if (chronicleNarratives.length > 0) {
        lines.push(...chronicleNarratives);
    }

    // 턴 요약
    lines.push(renderTurnSummary(actions, meanings));

    return lines.join('\n');
}
