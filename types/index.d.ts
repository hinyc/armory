// armory 플러그인 mod가 $.state에 보관하는 값의 타입 계약.

/** 질문의 진행 상태. */
export type QuestionStatus = 'running' | 'done' | 'aborted' | 'error'

/** 입력창 위 띠에 표시하는 현재(또는 마지막) 질문. */
export type Question = {
  /** 질문한 시각(ms). 질문 식별자로도 사용. */
  askedAt: number
  /** 사용자가 입력한 원문. 대기열에 있던 질문을 턴 시작 시 다시 찾는 데 사용. */
  prompt: string
  /** 화면에 표시할 요약, 최대 4줄. */
  summary: readonly string[]
  /** 모델 요약이 반영되었거나 요약이 필요 없으면 true. */
  isSummarized: boolean
  /** 이 질문을 처리하는 메인 턴 id. 아직 시작 전이면 null. */
  turnId: string | null
  /** 완료(또는 중단) 시각(ms). 진행 중이면 null. */
  endedAt: number | null
  status: QuestionStatus
}

declare module 'claude-code' {
  interface PluginState {
    armory: {
      question: Question | null
      /** 질문 띠 켜짐 여부. question-band 스킬로 바꾸며 $.store에도 저장. */
      enabled: boolean
      /** 경과 시간 표시용 현재 시각(ms). 진행 중일 때 1초마다 갱신. */
      now: number
    }
  }
}
