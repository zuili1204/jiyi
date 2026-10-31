/**
 * BYOK 服务商预设（JY-07 §3「设置页分组」）
 *
 * 纪律：
 * - 请求由用户设备**直连所选服务商**，本项目没有也不得有任何中转服务端（JY-07 §2 硬约束）；
 * - 预设只提供名称与默认 Base URL，**不预设模型档位**：模型名由用户按服务商文档自由填写
 *   （chat / flash / pro 之类的档位各家不同、更新频繁，写死只会过期）；
 * - 全部为 OpenAI 兼容 `chat/completions` 端点，客户端零新增依赖（JY-07 §4）。
 */
export interface AiProviderPreset {
  id: string
  label: string
  baseUrl: string
  /** 申请密钥的说明（引导用户自己去服务商官网，不经我方） */
  note?: string
}

export const AI_PROVIDERS: AiProviderPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek（深度求索）',
    baseUrl: 'https://api.deepseek.com',
    note: '在 platform.deepseek.com 申请 API Key'
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    note: '在 open.bigmodel.cn 申请 API Key'
  },
  {
    id: 'moonshot',
    label: 'Moonshot（Kimi）',
    baseUrl: 'https://api.moonshot.cn/v1',
    note: '在 platform.moonshot.cn 申请 API Key'
  },
  {
    id: 'qwen',
    label: '通义千问（百炼兼容模式）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    note: '在 bailian.console.aliyun.com 申请 API Key'
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    note: '在 platform.openai.com 申请 API Key'
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    note: '在 openrouter.ai 申请 API Key，可聚合多家模型'
  },
  {
    id: 'custom',
    label: '自定义（OpenAI 兼容）',
    baseUrl: '',
    note: '自填 Base URL 与模型名，需兼容 /chat/completions'
  }
]

export function aiProviderById(id: string): AiProviderPreset | undefined {
  return AI_PROVIDERS.find((p) => p.id === id)
}
