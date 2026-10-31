/**
 * 错误消息 → 用户可读文案（唯一权威源）
 *
 * 引擎与平台层抛出的错误携带内部术语（字段名 / 干支 / 八卦表等），
 * 直接透给用户等于展示开发日志。这里按错误类别映射成「可执行的建议」；
 * 映射不上的走兜底文案 —— 原始错误只进控制台（可诊断、不可见）。
 *
 * 纪律：文案不含开发术语与代码（面向使用者），不猜测具体原因（只给下一步动作）。
 */

const RULES: [RegExp, string][] = [
  // 起卦输入类：给填写指引
  [/数字起卦需要/, '请填写两个有效数字后再起卦'],
  [/字数起卦需要\s*(非空文本|text)/, '请填写要占算的文字'],
  [/字数起卦需要|时间起卦需要/, '问占时刻有误，请确认后重试'],
  [/经度非法/, '出生地经度有误，请重新选择'],
  // 历法推算类：日期超出可算范围（lunar 库与干支表的共同边界）
  [
    /小时非法|年份必须是整数|无法解析年支|非法干支|干支组合不存在|干支必须是两个字|无法解析纳音五行|空亡计算异常|日干支必须是两个字/,
    '所选日期或时刻超出可推算范围，请调整后重试'
  ]
]

export const GENERIC_ERROR_TEXT = '操作未完成，请稍后再试'

/** 把抛出的错误转成用户可读文案；映射不上时用 fallback */
export function friendlyMessage(e: unknown, fallback: string = GENERIC_ERROR_TEXT): string {
  const msg = e instanceof Error ? e.message : String(e)
  for (const [re, text] of RULES) {
    if (re.test(msg)) return text
  }
  return fallback
}
