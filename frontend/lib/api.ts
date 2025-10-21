export const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL!;
export async function api<T=any>(path:string, init?:RequestInit):Promise<T>{
  const r = await fetch(`${BACKEND}${path}`,{
    ...init, headers:{'Content-Type':'application/json',...(init?.headers||{})}
  });
  if(!r.ok) throw new Error(`API ${path} ${r.status}`);
  return r.json();
}
