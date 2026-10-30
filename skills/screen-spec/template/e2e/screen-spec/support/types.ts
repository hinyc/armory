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

/** 번호 배지를 박스의 어디에 붙일지. none이면 박스만 그린다. */
export const BADGE_POSITIONS = ['tl', 'tr', 'bl', 'br', 'left', 'right', 'none'] as const
export type BadgePosition = (typeof BADGE_POSITIONS)[number]

const pointSchema = z.tuple([z.number(), z.number()])
const rectSchema = z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()])

/** 스샷 위에 그릴 표시. 좌표는 스샷 픽셀 기준 [x, y, 너비, 높이]. */
export const markSchema = z.object({
  box: rectSchema,
  num: z.union([z.number(), z.string().max(3)]).optional(),
  badge: z.enum(BADGE_POSITIONS).optional(),
  color: z.string().optional(),
})

export type Mark = z.infer<typeof markSchema>

export const arrowSchema = z.object({ from: pointSchema, to: pointSchema, color: z.string().optional() })

export type Arrow = z.infer<typeof arrowSchema>

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
  /** captureScreen의 marks 옵션으로 캡처할 때 잰 표시. 다시 찍으면 좌표도 다시 잰다. */
  marks: z.array(markSchema).optional(),
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

/**
 * e2e/screen-spec/annotations/*.json: 좌표를 직접 적는 표시와 잘라내기.
 * 매뉴얼·보고서에 넣을 이미지처럼 화면설계서 밖에서 쓸 때 주로 쓴다.
 * name이 capture와 같으면 문서의 캡처 이미지도 이것으로 바뀐다.
 */
export const annotationSpecSchema = z.object({
  name: z.string().regex(ID_PATTERN),
  capture: z.string().regex(ID_PATTERN),
  /** 스샷 픽셀 기준 [x, y, 너비, 높이]. 없으면 전체. */
  crop: rectSchema.optional(),
  marks: z.array(markSchema).default([]),
  arrows: z.array(arrowSchema).default([]),
  /** true면 캡처할 때 잰 marks도 함께 그린다. */
  withCaptureMarks: z.boolean().default(false),
})

export type AnnotationSpec = z.infer<typeof annotationSpecSchema>
