/**
 * 内容统计报告：npm run stats
 */
import { join } from 'node:path'
import { CONTENT, listDirs, listFiles, readJSON } from './lib/fsutil'
import { QuestionSchema } from '../src/types/schema'

interface ChaptersFile {
  chapters: Array<{ id: string; title: string; bankTarget: number; caseTarget: number }>
}

function main() {
  const chaptersFile = readJSON<ChaptersFile>(join(CONTENT, 'meta', 'chapters.json'))
  const rows: string[] = []
  let gN = 0
  let gD = [0, 0, 0]
  let gExpLen = 0
  let gExpN = 0

  rows.push('章     题量/目标   难1 难2 难3   解析均长  手册节  案例/目标')

  for (const ch of chaptersFile.chapters) {
    let n = 0
    const d = [0, 0, 0]
    let expLen = 0
    for (const file of listFiles(join(CONTENT, 'bank', ch.id), '.json')) {
      try {
        const arr = readJSON<unknown[]>(join(CONTENT, 'bank', ch.id, file))
        for (const raw of arr) {
          const p = QuestionSchema.safeParse(raw)
          if (!p.success) continue
          n++
          d[p.data.difficulty - 1]++
          expLen += p.data.explanation.length
        }
      } catch {
        /* 忽略坏文件，validate 会报 */
      }
    }
    const sections = listFiles(join(CONTENT, 'handbook', ch.id), '.md').length
    const cases = listFiles(join(CONTENT, 'cases', ch.id), '.json').length
    const expAvg = n ? Math.round(expLen / n) : 0
    rows.push(
      `${ch.id}  ${String(n).padStart(4)}/${String(ch.bankTarget).padEnd(4)}  ` +
        `${String(d[0]).padStart(3)} ${String(d[1]).padStart(3)} ${String(d[2]).padStart(3)}   ` +
        `${String(expAvg).padStart(6)}    ${String(sections).padStart(3)}    ` +
        `${cases}/${ch.caseTarget}`,
    )
    gN += n
    gD = gD.map((v, i) => v + d[i])
    gExpLen += expLen
    gExpN += n
  }

  console.log(rows.join('\n'))
  console.log(
    `\n合计 ${gN} 题（难度 ${gD.join('/')}）  解析均长 ${gExpN ? Math.round(gExpLen / gExpN) : 0} 字`,
  )
}

main()
