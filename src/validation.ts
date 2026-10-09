import {copy} from './strings.js';

export const HOSTED_API = 'https://api.x40.link';
export const HOSTED_DOMAIN = 'x40.link';
export function hostPermissionPattern(origin:string):string {const u=new URL(origin);return `${u.protocol}//${u.hostname}/*`;}
export type Validation = {ok:true; value:string} | {ok:false; error:string};
const ok = (value:string):Validation => ({ok:true,value});
const bad = (error:string):Validation => ({ok:false,error});

export function destination(value:unknown):Validation {
  if (typeof value !== 'string' || !value || /[\u0000-\u001f\u007f]/.test(value)) return bad(copy.invalidDestination);
  try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) && u.hostname ? ok(value) : bad(copy.invalidDestination); }
  catch { return bad(copy.invalidDestination); }
}

export function domain(value:unknown):Validation {
  if (typeof value !== 'string' || value.length > 253 || !value || value !== value.trim()) return bad(copy.invalidDomain);
  if (!/^[A-Za-z0-9.-]+$/.test(value) || value.endsWith('.') || value.includes('..')) return bad(copy.invalidDomain);
  if (value.split('.').some(label => !label || label.length > 63 || !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label))) return bad(copy.invalidDomain);
  return ok(value.toLowerCase());
}

export function apiBase(value:unknown, development:boolean):Validation {
  if (typeof value !== 'string' || !value || value !== value.trim()) return bad(copy.invalidBase);
  if (/[?#]/.test(value)) return bad(copy.invalidBase);
  try {
    const u = new URL(value);
    const loopback = development && u.protocol === 'http:' && ['localhost','127.0.0.1'].includes(u.hostname);
    if (!(u.protocol === 'https:' || loopback) || !u.hostname || u.username || u.password || u.search || u.hash || u.pathname !== '/' ) return bad(copy.invalidBase);
    return ok(u.origin);
  } catch { return bad(copy.invalidBase); }
}

export function slug(value:unknown):Validation {
  if (typeof value !== 'string') return bad(copy.invalidSlug);
  if (value === '') return ok('');
  if (/[?#\u0000-\u001f\u007f]/.test(value) || value.startsWith('//') || value.includes('\\')) return bad(copy.invalidSlug);
  const path = value.startsWith('/') ? value : `/${value}`;
  if (path.length > 2048) return bad(copy.invalidSlug);
  try { decodeURI(path); } catch { return bad(copy.invalidSlug); }
  return ok(path);
}

export function requestId(value:unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 36 && /^[\x21-\x7e]+$/.test(value);
}
