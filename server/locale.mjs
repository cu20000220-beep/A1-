/** A small allowlist for request language. Never use a raw header in a URL or provider option. */
export function normalizeLanguage(value, fallback = 'ko') {
  return value === 'en' ? 'en' : value === 'ko' ? 'ko' : fallback === 'en' ? 'en' : 'ko';
}

export function requestLanguage(request) {
  const header = request?.headers?.get?.('Accept-Language');
  if (typeof header !== 'string' || !header.trim()) return 'ko';
  if (header.length > 1024) return 'en';
  const choices = [];
  for (const [index, raw] of header.split(',').slice(0, 20).entries()) {
    const match = /^\s*([a-z]{1,8}(?:-[a-z0-9]{1,8})*|\*)\s*(?:;\s*q=(0(?:\.\d{1,3})?|1(?:\.0{1,3})?))?\s*$/i.exec(raw);
    if (!match) continue;
    const quality = match[2] === undefined ? 1 : Number(match[2]);
    if (!quality) continue;
    const tag = match[1].toLowerCase().split('-')[0];
    if (tag === 'ko' || tag === 'en' || tag === '*') choices.push({ language: tag === '*' ? 'en' : tag, quality, index });
  }
  choices.sort((a, b) => b.quality - a.quality || a.index - b.index);
  return choices[0]?.language || 'en';
}

function label(labels, value, fallback) {
  return typeof value === 'string' ? Object.hasOwn(labels, value) ? labels[value] : value : fallback;
}
export const englishCollection = value => label({ '전체': 'All collections', '여성': 'Women', '남성': 'Men', '유니섹스': 'Unisex' }, value, 'selected');
export const englishStyle = value => label({ '전체': 'All styles', '미니멀': 'Minimal', '캐주얼': 'Casual', '클래식': 'Classic', '스트리트': 'Streetwear' }, value, 'selected');
export const englishCategory = value => label({ '상의': 'tops', '하의': 'bottoms', '아우터': 'outerwear', '원피스': 'dresses', '액세서리': 'accessories' }, value, 'item');
