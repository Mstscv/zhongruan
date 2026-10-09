/** 合格线按卷面题量等比换算：题量不足 75 时（如练习卷/题库试产期）满卷也可达标。 */

export interface ExamParams {
  /** 满分卷的合格分数（如 45） */
  passLine: number
  /** 满分卷的总分（如 75） */
  passScore: number
}

/** 该卷面应有的合格线：total × passLine / passScore（四舍五入） */
export function passLineFor(total: number, exam: ExamParams): number {
  if (total <= 0) return 0
  return Math.round((total * exam.passLine) / exam.passScore)
}

/** 是否达标（按卷面换算后的合格线判定） */
export function hasPassed(score: number, total: number, exam: ExamParams): boolean {
  return score >= passLineFor(total, exam)
}

/** 合格线占文字样，如 "45 分（60%）" */
export function passLineLabel(total: number, exam: ExamParams): string {
  const pct = Math.round((exam.passLine / exam.passScore) * 100)
  return `${passLineFor(total, exam)} 分（${pct}%）`
}
