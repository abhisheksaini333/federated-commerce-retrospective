export type View='shop'|'bag'|'checkout'|'confirmation'|'admin';
export function routeView(search:string):View|null{const value=new URLSearchParams(search).get('view');return ['shop','bag','checkout','confirmation','admin'].includes(value??'')?value as View:null;}
export function viewUrl(href:string,view:View){const url=new URL(href);url.searchParams.set('view',view);return url.pathname+url.search;}
