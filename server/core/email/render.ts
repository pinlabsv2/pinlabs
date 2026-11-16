import { allowedVariables } from './registry.js';

export type TemplateSource = {
  templateKey: string;
  mode: 'structured' | 'advanced_html';
  subject: string;
  preheader?: string;
  heading?: string;
  bodyText?: string;
  ctaLabel?: string;
  ctaUrlTemplate?: string;
  advancedHtml?: string;
  advancedText?: string;
};

export type TemplateValues = Record<string, string | number | null | undefined>;
export type RenderedEmail = { subject: string; html: string; text: string };

const tokenPattern = /{{\s*([a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*)*)\s*}}/g;
const escapeHtml = (value: unknown) => String(value ?? '').replace(/&(?!(?:amp|lt|gt|quot|#39|#x[0-9a-f]+|#\d+);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escapeAttribute = escapeHtml;

export function validateTemplateVariables(templateKey: string, fields: string[]) {
  const allowed = new Set(allowedVariables(templateKey));
  const unknown = new Set<string>();
  for (const field of fields) {
    for (const match of field.matchAll(tokenPattern)) if (!allowed.has(match[1])) unknown.add(match[1]);
  }
  if (unknown.size) throw new Error(`Unsupported template variables: ${[...unknown].sort().join(', ')}`);
}

export function interpolate(value: string, values: TemplateValues, mode: 'text' | 'html' = 'text') {
  return value.replace(tokenPattern, (_, key: string) => mode === 'html' ? escapeHtml(values[key]) : String(values[key] ?? ''));
}

const allowedTags = new Set(['a', 'blockquote', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'hr', 'li', 'ol', 'p', 'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul']);
const voidTags = new Set(['br', 'hr']);

function safeLink(raw: string) {
  try {
    const parsed = new URL(raw);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

export function sanitizeAdvancedHtml(source: string) {
  let output = '';
  let cursor = 0;
  const tags = /<!--[\s\S]*?-->|<![^>]*>|<[^>]*>/g;
  for (const match of source.matchAll(tags)) {
    const index = match.index ?? 0;
    output += escapeHtml(source.slice(cursor, index));
    cursor = index + match[0].length;
    if (match[0].startsWith('<!')) continue;
    const parsed = match[0].match(/^<\s*(\/?)\s*([a-zA-Z0-9]+)([\s\S]*?)\/?\s*>$/);
    if (!parsed) continue;
    const closing = parsed[1] === '/';
    const tag = parsed[2].toLowerCase();
    if (!allowedTags.has(tag)) continue;
    if (closing) {
      if (!voidTags.has(tag)) output += `</${tag}>`;
      continue;
    }
    if (tag === 'a') {
      const hrefMatch = parsed[3].match(/\bhref\s*=\s*(["'])(.*?)\1/i);
      const href = safeLink(hrefMatch?.[2] ?? '');
      output += href ? `<a href="${escapeAttribute(href)}" rel="noopener noreferrer">` : '<a>';
      continue;
    }
    output += `<${tag}>`;
  }
  output += escapeHtml(source.slice(cursor));
  return output;
}

function paragraphs(value: string) {
  return value.split(/\n{2,}/).map((part) => `<p style="margin:0 0 16px">${escapeHtml(part).replace(/\n/g, '<br>')}</p>`).join('');
}

function plainTextFromHtml(value: string) {
  return value.replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-3]|tr)>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim();
}

function cta(label: string, rawUrl: string) {
  const href = safeLink(rawUrl);
  return label && href ? `<p style="margin:24px 0 0"><a href="${escapeAttribute(href)}" style="display:inline-block;background:#131311;color:#fbfaf6;padding:12px 18px;text-decoration:none;font-weight:700">${escapeHtml(label)}</a></p>` : '';
}

export function renderTemplate(source: TemplateSource, values: TemplateValues, brand: { name: string; primary?: string; accent?: string }): RenderedEmail {
  const fields = [source.subject, source.preheader ?? '', source.heading ?? '', source.bodyText ?? '', source.ctaLabel ?? '', source.ctaUrlTemplate ?? '', source.advancedHtml ?? '', source.advancedText ?? ''];
  validateTemplateVariables(source.templateKey, fields);
  const subject = interpolate(source.subject, values).trim();
  if (!subject) throw new Error('Email subject cannot be empty');
  const preheader = interpolate(source.preheader ?? '', values, 'html');
  const heading = interpolate(source.heading ?? '', values, 'html');
  const ctaLabel = interpolate(source.ctaLabel ?? '', values);
  const ctaUrl = interpolate(source.ctaUrlTemplate ?? '', values);
  const body = source.mode === 'advanced_html'
    ? interpolate(sanitizeAdvancedHtml(source.advancedHtml ?? ''), values, 'html')
    : paragraphs(interpolate(source.bodyText ?? '', values));
  const unsubscribeUrl = source.templateKey === 'campaign_announcement' ? safeLink(String(values['campaign.unsubscribeUrl'] ?? '')) : '';
  const unsubscribe = unsubscribeUrl ? `<p style="margin:28px 0 0;font-size:12px;color:#67675f"><a href="${escapeAttribute(unsubscribeUrl)}" style="color:#67675f">Unsubscribe from announcements</a></p>` : '';
  const content = `${heading ? `<h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:34px;font-weight:400;text-transform:lowercase">${heading}</h1>` : ''}${body}${cta(ctaLabel, ctaUrl)}${unsubscribe}`;
  const primary = /^#[0-9a-f]{6}$/i.test(brand.primary ?? '') ? brand.primary : '#131311';
  const html = `<!doctype html><html><body style="margin:0;background:#fbfaf6;color:#131311;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${preheader}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;border-top:4px solid ${primary}"><tr><td style="padding:24px 0 16px;font-weight:700">${escapeHtml(brand.name)}</td></tr><tr><td style="padding:24px 0;border-top:1px solid #d8d6cf;border-bottom:1px solid #d8d6cf">${content}</td></tr><tr><td style="padding:16px 0;color:#67675f;font-size:12px">${escapeHtml(brand.name)}</td></tr></table></td></tr></table></body></html>`;
  const textBody = source.mode === 'advanced_html'
    ? interpolate(source.advancedText || plainTextFromHtml(source.advancedHtml ?? ''), values)
    : interpolate(source.bodyText ?? '', values);
  const text = [interpolate(source.heading ?? '', values), textBody, ctaLabel && safeLink(ctaUrl) ? `${ctaLabel}: ${safeLink(ctaUrl)}` : '', unsubscribeUrl ? `Unsubscribe from announcements: ${unsubscribeUrl}` : ''].filter(Boolean).join('\n\n').trim();
  if (!text) throw new Error('Email plain-text body cannot be empty');
  return { subject, html, text };
}
