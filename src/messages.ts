export type PublicConfig = {apiBaseUrl:string; defaultDomain:string; configured:boolean; tokenConfigured:boolean};
export type Result = {shortUrl:string; copied:boolean};
export type Draft = {destinationUrl:string; domain:string; slug:string; requestId?:string};
export type ClientMessage =
  | {type:'GET_STATE'}
  | {type:'SAVE_SETTINGS'; apiBaseUrl:string; defaultDomain:string; token:string}
  | {type:'SIGN_OUT'}
  | {type:'CREATE'; destinationUrl:string; domain:string; slug:string; requestId:string}
  | {type:'COPY'; value:string}
  | {type:'CLEAR_DRAFT'};
export type ServerReply = {ok:true; config?:PublicConfig; result?:Result; draft?:Draft; copied?:boolean} | {ok:false; kind:string; message:string; retryable?:boolean};
