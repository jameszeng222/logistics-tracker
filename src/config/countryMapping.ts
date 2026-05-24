const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  '美国': 'US', '英国': 'GB', '德国': 'DE', '法国': 'FR', '意大利': 'IT',
  '西班牙': 'ES', '日本': 'JP', '韩国': 'KR', '加拿大': 'CA', '澳大利亚': 'AU',
  '新西兰': 'NZ', '墨西哥': 'MX', '巴西': 'BR', '印度': 'IN', '俄罗斯': 'RU',
  '荷兰': 'NL', '比利时': 'BE', '瑞士': 'CH', '奥地利': 'AT', '瑞典': 'SE',
  '挪威': 'NO', '丹麦': 'DK', '芬兰': 'FI', '波兰': 'PL', '捷克': 'CZ',
  '葡萄牙': 'PT', '爱尔兰': 'IE', '希腊': 'GR', '匈牙利': 'HU', '罗马尼亚': 'RO',
  '保加利亚': 'BG', '克罗地亚': 'HR', '斯洛伐克': 'SK', '斯洛文尼亚': 'SI',
  '爱沙尼亚': 'EE', '拉脱维亚': 'LV', '立陶宛': 'LT', '卢森堡': 'LU',
  '马耳他': 'MT', '塞浦路斯': 'CY', '以色列': 'IL', '沙特阿拉伯': 'SA',
  '阿联酋': 'AE', '土耳其': 'TR', '泰国': 'TH', '越南': 'VN', '马来西亚': 'MY',
  '新加坡': 'SG', '印度尼西亚': 'ID', '菲律宾': 'PH', '智利': 'CL',
  '哥伦比亚': 'CO', '阿根廷': 'AR', '秘鲁': 'PE', '南非': 'ZA',
  '尼日利亚': 'NG', '埃及': 'EG', '肯尼亚': 'KE', '乌克兰': 'UA',
}

export function normalizeCountryCode(value: string): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed
  if (/^[a-z]{2}$/.test(trimmed)) return trimmed.toUpperCase()
  const mapped = COUNTRY_NAME_TO_ISO[trimmed]
  if (mapped) return mapped
  return trimmed
}
