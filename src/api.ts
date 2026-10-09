import {apiBase, destination, domain, requestId, slug} from './validation.js';
import {copy} from './strings.js';

export interface CreateInput {apiBaseUrl:string; token:string; domain:string; destinationUrl:string; path?:string; requestId:string; development:boolean}
export interface ShortLink {shortUrl:string; destinationUrl?:string; path?:string; name?:string}
export type ApiErrorKind = 'destination'|'domain'|'slug'|'token'|'conflict'|'network'|'timeout'|'cancelled'|'protocol'|'server';
export class ApiError extends Error {
  constructor(public kind:ApiErrorKind, message:string, public retryable:boolean, public status?:number, public code?:number) {super(message); this.name='ApiError';}
}

function statusError(status:number, data:unknown):ApiError {
  const obj = data && typeof data === 'object' ? data as Record<string,unknown> : {};
  const code = typeof obj.code === 'number' ? obj.code : undefined;
  const raw = typeof obj.message === 'string' ? obj.message.slice(0,300) : '';
  const msg = raw.toLowerCase();
  // google.rpc.Code is authoritative when returned; text is a fallback for implementations without it.
  if (code === 6 || /already exists|already taken|duplicate/.test(msg)) return new ApiError('conflict','That custom path is already taken. Choose another.',false,status,code);
  if (code === 16 || /invalid.*token|expired.*token|unauthenticated/.test(msg)) return new ApiError('token','The token is invalid or expired. Update it in settings.',false,status,code);
  if (code === 7 || /permission denied|missing.*scope|not authorized/.test(msg)) return new ApiError('token',/domain/.test(msg) ? 'This token cannot create links on that domain.' : 'This token lacks CreateShortLink access.',false,status,code);
  if (code === 3) {
    const kind = /domain/.test(msg) ? 'domain' : /path|slug/.test(msg) ? 'slug' : 'destination';
    return new ApiError(kind,raw || 'Check the highlighted input.',false,status,code);
  }
  return new ApiError('server',raw || `API request failed (HTTP ${status}).`,status >= 500 || status === 429,status,code);
}

export async function createShortLink(input:CreateInput, options:{signal?:AbortSignal; timeoutMs?:number; fetcher?:typeof fetch} = {}):Promise<ShortLink> {
  const base = apiBase(input.apiBaseUrl,input.development), host = domain(input.domain), target = destination(input.destinationUrl);
  if (!base.ok) throw new ApiError('protocol',base.error,false);
  if (!host.ok) throw new ApiError('domain',host.error,false);
  if (!target.ok) throw new ApiError('destination',target.error,false);
  if (!input.token || /[\r\n]/.test(input.token)) throw new ApiError('token',copy.tokenNeeded,false);
  if (!requestId(input.requestId)) throw new ApiError('protocol','Invalid request ID.',false);
  const path = input.path === undefined ? undefined : slug(input.path);
  if (path && !path.ok) throw new ApiError('slug',path.error,false);
  const url = `${base.value}/v1alpha/domains/${encodeURIComponent(host.value)}/shortLinks?requestId=${encodeURIComponent(input.requestId)}`;
  const body = path?.ok ? {destinationUrl:target.value,path:path.value} : {destinationUrl:target.value};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),options.timeoutMs ?? 15000);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort',abort,{once:true});
  try {
    const response = await (options.fetcher ?? fetch)(url,{method:'POST',headers:{Authorization:`Bearer ${input.token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
    const raw = await response.text();
    let data:unknown;
    try { data = raw ? JSON.parse(raw) : undefined; } catch { data = undefined; }
    if (!response.ok) throw statusError(response.status,data);
    if (!data || typeof data !== 'object' || typeof (data as Record<string,unknown>).shortUrl !== 'string') throw new ApiError('protocol',copy.protocol,true,response.status);
    const result = data as ShortLink;
    const parsed = destination(result.shortUrl);
    if (!parsed.ok) throw new ApiError('protocol',copy.protocol,true,response.status);
    const short = new URL(result.shortUrl);
    const allowedHttp = input.development && short.protocol==='http:' && ['localhost','127.0.0.1'].includes(short.hostname);
    if (!parsed.ok || short.username || short.password || !(short.protocol==='https:' || allowedHttp)) throw new ApiError('protocol',copy.protocol,true,response.status);
    return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (options.signal?.aborted) throw new ApiError('cancelled','Request cancelled.',false);
    if (controller.signal.aborted) throw new ApiError('timeout',copy.timeout,true);
    throw new ApiError('network',copy.network,true);
  } finally { clearTimeout(timeout); options.signal?.removeEventListener('abort',abort); }
}
