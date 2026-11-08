import { requestLanguage } from '../../server/locale.mjs';

// Mounted only below /api. Standard Pages Preview hosts must never use the
// project's authentication, database or external-provider configuration.
// Do not read env here: dashboard binding isolation is a separate check.
export async function onRequest(context) {
  const hostname = new URL(context.request.url).hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname.endsWith('.a1fashion.pages.dev')) return context.next();

  const language = requestLanguage(context.request);
  return new Response(JSON.stringify({
    ok: false,
    allowed: false,
    error: 'preview_isolated',
    message: language === 'en'
      ? 'This preview does not connect member, subscription or external services. You can check the pages and free on-device photo analysis.'
      : '이 미리보기는 회원·구독·외부 서비스에 연결하지 않습니다. 화면과 무료 기기 내 사진 분석을 확인할 수 있습니다.'
  }), {
    status: 503,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Content-Language': language,
      'Vary': 'Accept-Language',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
