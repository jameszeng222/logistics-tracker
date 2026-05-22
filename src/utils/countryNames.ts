export const COUNTRY_NAMES: Record<string, string> = {
  VN: '越南', TH: '泰国', PH: '菲律宾', MY: '马来西亚', ID: '印度尼西亚',
  SG: '新加坡', KH: '柬埔寨', MM: '缅甸', LA: '老挝', BN: '文莱', TL: '东帝汶',
  CN: '中国', JP: '日本', KR: '韩国', TW: '中国台湾', HK: '中国香港', MO: '中国澳门',
  IN: '印度', PK: '巴基斯坦', BD: '孟加拉国', LK: '斯里兰卡', NP: '尼泊尔',
  SA: '沙特阿拉伯', AE: '阿联酋', IL: '以色列', TR: '土耳其', IR: '伊朗',
  QA: '卡塔尔', KW: '科威特', BH: '巴林', OM: '阿曼',
  GB: '英国', DE: '德国', FR: '法国', IT: '意大利', ES: '西班牙', NL: '荷兰',
  BE: '比利时', PL: '波兰', CZ: '捷克', PT: '葡萄牙', SE: '瑞典', AT: '奥地利',
  CH: '瑞士', DK: '丹麦', NO: '挪威', FI: '芬兰', IE: '爱尔兰', GR: '希腊',
  RO: '罗马尼亚', HU: '匈牙利', UA: '乌克兰', RU: '俄罗斯',
  US: '美国', CA: '加拿大', MX: '墨西哥',
  BR: '巴西', AR: '阿根廷', CL: '智利', CO: '哥伦比亚', PE: '秘鲁', VE: '委内瑞拉',
  EG: '埃及', ZA: '南非', NG: '尼日利亚', KE: '肯尼亚', MA: '摩洛哥',
  GH: '加纳', TZ: '坦桑尼亚', ET: '埃塞俄比亚',
  AU: '澳大利亚', NZ: '新西兰',
  unknown: '未知',
}

export function getCountryName(code: string): string {
  return COUNTRY_NAMES[code] || code
}
