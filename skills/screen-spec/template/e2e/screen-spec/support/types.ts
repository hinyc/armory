import { z } from 'zod'

export const KINDS = ['page', 'state', 'dialog', 'alert', 'component'] as const
export type Kind = (typeof KINDS)[number]

export const KIND_LABELS: Readonly<Record<Kind, string>> = {
  page: '화면',
  state: '상태',
  dialog: '다이얼로그',
  alert: '알림',
  component: '컴포넌트',
}

export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 시나리오가 captureScreen에 넘기는 정보 */
export interface CaptureMeta {
  /** 전체에서 유일한 kebab-case id. 파일 이름으로도 쓴다. */
  readonly id: string
  /** spec.config.ts sections의 key */
  readonly section: string
  /** 같은 값끼리 한 화면으로 묶인다 */
  readonly screen: string
  readonly kind: Kind
  readonly title: string
  readonly description?: string
  readonly route?: string
  /** 이 캡처를 그리는 소스 파일. 업데이트 모드가 변경 영향을 찾을 때 쓴다. */
  readonly source?: readonly string[]
}

export const captureEntrySchema = z.object({
  id: z.string().regex(ID_PATTERN),
  section: z.string(),
  screen: z.string(),
  kind: z.enum(KINDS),
  title: z.string(),
  description: z.string().optional(),
  route: z.string().optional(),
  source: z.array(z.string()).optional(),
  image: z.string(),
  sortKey: z.string(),
  specFile: z.string(),
  nativeDialog: z.object({ type: z.string(), message: z.string() }).optional(),
})

export type CaptureEntry = z.infer<typeof captureEntrySchema>

export const REQUIREMENT_STATUSES = [
  'implemented',
  'partial',
  'planned',
  'notApplicable',
  'unclassified',
] as const

export const STATUS_LABELS: Readonly<Record<(typeof REQUIREMENT_STATUSES)[number], string>> = {
  implemented: '구현',
  partial: '일부 구현',
  planned: '예정',
  notApplicable: '해당 없음',
  unclassified: '미분류',
}

/** 링크·필터에 그대로 쓰므로 공백·%·# 없는 id만 허용한다. */
export const REQUIREMENT_ID_PATTERN = /^[\w.-]+$/

export const requirementSchema = z.object({
  id: z.string().regex(REQUIREMENT_ID_PATTERN, '영문·숫자·_·.·- 만 쓸 수 있습니다'),
  parentId: z.string().nullable().default(null),
  number: z.string().optional(),
  title: z.string(),
  text: z.string().optional(),
  note: z.string().optional(),
  status: z.enum(REQUIREMENT_STATUSES).default('unclassified'),
})

export type Requirement = z.infer<typeof requirementSchema>

export const mappingSchema = z.object({
  /** AI 초안이면 true. 사람이 검토를 마치면 false. */
  draft: z.boolean().default(true),
  /** captureId → 연결된 요구사항과 근거 */
  links: z
    .record(
      z.string(),
      z.array(z.object({ req: z.string(), rationale: z.string().min(1) })),
    )
    .default({}),
})

export type Mapping = z.infer<typeof mappingSchema>

export const overridesSchema = z.record(
  z.string(),
  z.object({ title: z.string().optional(), description: z.string().optional() }),
)

export type Overrides = z.infer<typeof overridesSchema>
