export function editorAvailable(request:Request){
  const url=new URL(request.url);
  return process.env.NODE_ENV==='development'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&request.headers.get('host')===url.host&&!['cross-site','same-site'].includes(request.headers.get('sec-fetch-site')??'');
}
