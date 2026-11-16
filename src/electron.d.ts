export {};
declare global { interface Window { authStore?: { getToken():Promise<string|null>;setToken(token:string):Promise<boolean>;clearToken():Promise<boolean> } } }
