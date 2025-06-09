export type View='shop'|'bag'|'checkout'|'confirmation'|'admin';
export function routeView(search:string):View|null{const values=new URLSearchParams(search).getAll('view');if(values.length!==1)return null;const value=values[0];return ['shop','bag','checkout','confirmation','admin'].includes(value??'')?value as View:null;}
export function viewUrl(href:string,view:View){const url=new URL(href);url.searchParams.set('view',view);return url.pathname+url.search;}
