# World Engine

수학적 모델 기반의 서사 RPG 시뮬레이션 엔진

## 핵심 철학

> "수학은 엔진이고, 텍스트는 인터페이스다"

LLM 생성에 의존하지 않고, 순수 수학적 모델을 통해 역동적인 "살아있는 세계(Living World)"를 구현합니다.

## 아키텍처

### 엔진 Core (완성형)
- `engine.ts` - 7단계 시뮬레이션 파이프라인
- `chronicle-pressure.ts` - 압력-연대기 시스템
- `meaningEngine.ts` - 플러그인 아키텍처

### 이론 기반 모듈 (`src/modules/`)

| 모듈                | 기반 이론                | 기능                        |
| ------------------- | ------------------------ | --------------------------- |
| `socialGraph.ts`    | 그래프 이론, PageRank    | 관계 관리, 중심성 계산      |
| `beliefSystem.ts`   | 베이지안 확률론          | 믿음 상태, 베이지안 갱신    |
| `utilityAI.ts`      | 기대 효용 이론, 매슬로우 | 욕구 가중치, 최적 행동 선택 |
| `actionSelector.ts` | 효용 극대화              | 소셜 그래프 기반 대상 선택  |

## 실행

```bash
# 설치
npm install

# 개발 실행
npm run dev

# 빌드
npm run build
```

## 시뮬레이션 흐름

```
Action → Meaning → Pressure → Chronicle → Tendency → Action
   ↑__________________________________________________|
```

피드백 루프를 통한 자기 조절 메커니즘으로 세계가 극단으로 치우치지 않도록 균형을 유지합니다.

## 라이선스

MIT
