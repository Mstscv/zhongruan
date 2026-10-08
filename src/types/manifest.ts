/** tools/gen-manifest.ts 生成的清单结构（src/generated/manifest.json） */

export interface ManifestSection {
  id: string
  file: string
  title: string
  topic: string | null
}

export interface ManifestShard {
  file: string
  count: number
}

export interface ManifestCase {
  id: string
  file: string
  title: string
  questionCount: number
}

export interface ManifestTopic {
  code: string
  title: string
}

export interface ManifestChapter {
  id: string
  no: number
  title: string
  group: string
  note?: string
  bankTarget: number
  caseTarget: number
  topics: ManifestTopic[]
  questionCount: number
  shards: ManifestShard[]
  sections: ManifestSection[]
  cases: ManifestCase[]
}

export interface ManifestExam {
  defaultDate: string
  passScore: number
  passLine: number
  paperQuestions: number
  paperMinutes: number
  note: string
}

export interface ManifestBlueprint {
  total: number
  difficultyRatio: [number, number, number]
  weights: Record<string, number>
}

export interface Manifest {
  generatedAt: string
  disclaimer: string
  exam: ManifestExam
  blueprint: ManifestBlueprint
  chapters: ManifestChapter[]
}
