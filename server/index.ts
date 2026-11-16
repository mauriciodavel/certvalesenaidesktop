import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { env } from './config.js';
import { db, rows, transaction } from './db.js';
import { authenticate, clearSession, csrf, requireAdmin, requirePasswordChanged, setSession } from './auth.js';
import { compareCandidates, parseWorkbook, type Candidate, type DatasetType } from './excel.js';
import { dashboardData } from './dashboard.js';

const app=express(); app.disable('x-powered-by'); app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:env.NODE_ENV==='production'?undefined:false,crossOriginResourcePolicy:{policy:'same-site'}}));
app.use(express.json({limit:'200kb'})); app.use(cookieParser());
app.use('/api',rateLimit({windowMs:15*60*1000,limit:500,standardHeaders:'draft-7',legacyHeaders:false}));
const loginLimit=rateLimit({windowMs:15*60*1000,limit:8,skipSuccessfulRequests:true,message:{error:'Muitas tentativas. Aguarde 15 minutos.'}});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024,files:1},fileFilter:(_req,file,cb)=>cb(null,file.originalname.toLowerCase().endsWith('.xlsx'))});
function decodeUploadFilename(value:string){
  const base=path.basename(value);
  // Multer/Busboy may expose UTF-8 filename bytes as Latin-1 in multipart headers.
  if(/[\u00c3\u00c2]/.test(base)){
    const repaired=Buffer.from(base,'latin1').toString('utf8');
    if(!repaired.includes('\uFFFD'))return repaired;
  }
  return base;
}
function comparableFilename(value:string){return decodeUploadFilename(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
const safe=(fn:(req:express.Request,res:express.Response)=>Promise<unknown>)=>(req:express.Request,res:express.Response,next:express.NextFunction)=>Promise.resolve(fn(req,res)).catch(next);

app.get('/api/health',safe(async(_req,res)=>{await db.query('SELECT 1');res.json({ok:true});}));
app.post('/api/auth/login',loginLimit,safe(async(req,res)=>{
  const data=z.object({email:z.string().email(),password:z.string().min(1).max(200)}).parse(req.body);
  const users=await rows<(RowDataPacket&{id:number;email:string;password_hash:string;name:string;role:'admin'|'viewer';active:number;must_change_password:number;failed_attempts:number;locked_until:Date|null})[]>('SELECT * FROM users WHERE email=? LIMIT 1',[data.email.toLowerCase()]); const user=users[0];
  if(!user||!user.active||user.locked_until&&new Date(user.locked_until)>new Date()||!await bcrypt.compare(data.password,user.password_hash)){
    if(user) await db.execute('UPDATE users SET failed_attempts=failed_attempts+1, locked_until=IF(failed_attempts+1>=5,DATE_ADD(NOW(),INTERVAL 15 MINUTE),locked_until) WHERE id=?',[user.id]);
    return res.status(401).json({error:'E-mail ou senha inválidos.'});
  }
  await db.execute('UPDATE users SET failed_attempts=0,locked_until=NULL,last_login_at=NOW() WHERE id=?',[user.id]); const session={id:user.id,email:user.email,name:user.name,role:user.role,mustChangePassword:Boolean(user.must_change_password)};setSession(res,session);res.json({user:session});
}));
app.get('/api/auth/me',authenticate,(req,res)=>res.json({user:req.user}));
app.post('/api/auth/logout',authenticate,csrf,(req,res)=>{clearSession(res);res.status(204).end();});
app.post('/api/auth/change-password',authenticate,csrf,safe(async(req,res)=>{const data=z.object({currentPassword:z.string().min(1).max(200),newPassword:z.string().min(12).max(200)}).refine(x=>x.currentPassword!==x.newPassword,{message:'A nova senha deve ser diferente da senha atual.',path:['newPassword']}).parse(req.body);const users=await rows<(RowDataPacket&{password_hash:string})[]>('SELECT password_hash FROM users WHERE id=? LIMIT 1',[req.user!.id]);if(!users[0]||!await bcrypt.compare(data.currentPassword,users[0].password_hash))return res.status(400).json({error:'A senha atual está incorreta.'});const hash=await bcrypt.hash(data.newPassword,12);await db.execute('UPDATE users SET password_hash=?,must_change_password=FALSE,failed_attempts=0,locked_until=NULL WHERE id=?',[hash,req.user!.id]);const session={...req.user!,mustChangePassword:false};setSession(res,session);res.json({user:session});}));

app.get('/api/users',authenticate,requirePasswordChanged,requireAdmin,safe(async(_req,res)=>{const users=await rows<(RowDataPacket&Record<string,unknown>)[]>('SELECT id,email,name,role,active,must_change_password,last_login_at,created_at FROM users ORDER BY name,email');res.json(users.map(({must_change_password,...user})=>({...user,mustChangePassword:Boolean(must_change_password)})));}));
app.post('/api/users',authenticate,requirePasswordChanged,requireAdmin,csrf,safe(async(req,res)=>{const data=z.object({name:z.string().trim().min(2).max(120),email:z.string().email().max(190),role:z.enum(['admin','viewer']),temporaryPassword:z.string().min(12).max(200)}).parse(req.body);const hash=await bcrypt.hash(data.temporaryPassword,12);try{const[result]=await db.execute('INSERT INTO users(email,password_hash,name,role,active,must_change_password) VALUES(?,?,?,?,TRUE,TRUE)',[data.email.toLowerCase(),hash,data.name,data.role]);res.status(201).json({id:(result as {insertId:number}).insertId});}catch(error){if((error as {code?:string}).code==='ER_DUP_ENTRY')return res.status(409).json({error:'Já existe um usuário com este e-mail.'});throw error;}}));
app.post('/api/users/:id/reset-password',authenticate,requirePasswordChanged,requireAdmin,csrf,safe(async(req,res)=>{const id=z.coerce.number().int().positive().parse(req.params.id);const data=z.object({temporaryPassword:z.string().min(12).max(200)}).parse(req.body);const hash=await bcrypt.hash(data.temporaryPassword,12);const[result]=await db.execute('UPDATE users SET password_hash=?,must_change_password=TRUE,failed_attempts=0,locked_until=NULL WHERE id=?',[hash,id]);if(!(result as {affectedRows:number}).affectedRows)return res.status(404).json({error:'Usuário não encontrado.'});res.status(204).end();}));
app.patch('/api/users/:id/status',authenticate,requirePasswordChanged,requireAdmin,csrf,safe(async(req,res)=>{const id=z.coerce.number().int().positive().parse(req.params.id);const{active}=z.object({active:z.boolean()}).parse(req.body);if(id===req.user!.id&&!active)return res.status(400).json({error:'Você não pode inativar o próprio usuário.'});const[result]=await db.execute('UPDATE users SET active=?,failed_attempts=IF(?,failed_attempts,0),locked_until=IF(?,locked_until,NULL) WHERE id=?',[active,active,active,id]);if(!(result as {affectedRows:number}).affectedRows)return res.status(404).json({error:'Usuário não encontrado.'});res.status(204).end();}));

app.get('/api/dashboard',authenticate,requirePasswordChanged,safe(async(_req,res)=>res.json(await dashboardData())));
app.get('/api/updates',authenticate,requirePasswordChanged,requireAdmin,safe(async(_req,res)=>{
  const data=await rows<(RowDataPacket&Record<string,unknown>)[]>(`SELECT l.*,u.name AS performed_by_name FROM update_logs l JOIN users u ON u.id=l.performed_by ORDER BY l.created_at DESC LIMIT 100`);res.json(data);
}));
app.post('/api/uploads/preview',authenticate,requirePasswordChanged,requireAdmin,csrf,upload.single('file'),safe(async(req,res)=>{
  const type=z.enum(['teorico','pratico']).parse(req.body.type) as DatasetType; if(!req.file) return res.status(400).json({error:'Selecione uma planilha XLSX.'});
  const uploadedName=decodeUploadFilename(req.file.originalname);
  const normalizedName=comparableFilename(req.file.originalname);
  const expected=type==='teorico'?'base_teorica.xlsx':'base_pratica.xlsx';
  if(normalizedName!==expected)return res.status(400).json({error:`O arquivo deve se chamar ${type==='teorico'?'Base_Teórica.xlsx':'Base_Prática.xlsx'}.`});
  const parsed=await parseWorkbook(req.file.buffer,type);
  const prior=await rows<(RowDataPacket&{raw_json:string;objects_json:string;candidate_key:string;matricula:string;prova:string;nome:string;genero:string|null;gerencia:string|null;coordenacao:string|null;turno:string|null;data_aplicacao:string|null;nota:number|null;resultado:string|null})[]>(`SELECT r.* FROM candidate_results r JOIN dataset_versions v ON v.id=r.version_id WHERE v.dataset_type=? AND v.is_active=TRUE`,[type]);
  const old:Candidate[]=prior.map(r=>({candidateKey:r.candidate_key,matricula:r.matricula,prova:r.prova,nome:r.nome,genero:r.genero,gerencia:r.gerencia,coordenacao:r.coordenacao,turno:r.turno,dataAplicacao:r.data_aplicacao,nota:r.nota,resultado:r.resultado,objects:typeof r.objects_json==='string'?JSON.parse(r.objects_json):r.objects_json,raw:typeof r.raw_json==='string'?JSON.parse(r.raw_json):r.raw_json}));
  const comparison=compareCandidates(old,parsed.candidates); const id=randomUUID();
  await db.execute(`INSERT INTO import_staging(id,dataset_type,filename,checksum,payload_json,comparison_json,created_by,expires_at) VALUES(?,?,?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 30 MINUTE))`,[id,type,uploadedName,parsed.checksum,JSON.stringify(parsed.candidates),JSON.stringify(comparison),req.user!.id]);
  res.json({previewId:id,filename:uploadedName,comparison});
}));
app.post('/api/uploads/:id/commit',authenticate,requirePasswordChanged,requireAdmin,csrf,safe(async(req,res)=>{
  const staged=await rows<(RowDataPacket&{id:string;dataset_type:DatasetType;filename:string;checksum:string;payload_json:string|Candidate[];comparison_json:string|ReturnType<typeof compareCandidates>})[]>('SELECT * FROM import_staging WHERE id=? AND created_by=? AND expires_at>NOW() LIMIT 1',[req.params.id,req.user!.id]); const item=staged[0];if(!item)return res.status(404).json({error:'Prévia inexistente ou expirada.'});
  const payload=typeof item.payload_json==='string'?JSON.parse(item.payload_json):item.payload_json; const comparison=typeof item.comparison_json==='string'?JSON.parse(item.comparison_json):item.comparison_json;
  await transaction(async conn=>{await conn.execute('UPDATE dataset_versions SET is_active=FALSE WHERE dataset_type=?',[item.dataset_type]);const [ins]=await conn.execute('INSERT INTO dataset_versions(dataset_type,filename,checksum,row_count,is_active,uploaded_by) VALUES(?,?,?,?,TRUE,?)',[item.dataset_type,item.filename,item.checksum,payload.length,req.user!.id]);const versionId=(ins as {insertId:number}).insertId;
    const sql='INSERT INTO candidate_results(version_id,dataset_type,candidate_key,matricula,prova,nome,genero,gerencia,coordenacao,turno,data_aplicacao,nota,resultado,objects_json,raw_json) VALUES ?';
    for(let i=0;i<payload.length;i+=300){const values=payload.slice(i,i+300).map((r:Candidate)=>[versionId,item.dataset_type,r.candidateKey,r.matricula,r.prova,r.nome,r.genero,r.gerencia,r.coordenacao,r.turno,r.dataAplicacao,r.nota,r.resultado,JSON.stringify(r.objects),JSON.stringify(r.raw)]);await conn.query(sql,[values]);}
    const c=comparison.counts;await conn.execute('INSERT INTO update_logs(dataset_type,filename,checksum,added_count,changed_count,removed_count,unchanged_count,total_count,status,performed_by) VALUES(?,?,?,?,?,?,?,?,\'success\',?)',[item.dataset_type,item.filename,item.checksum,c.added,c.changed,c.removed,c.unchanged,c.total,req.user!.id]);await conn.execute('DELETE FROM import_staging WHERE id=?',[item.id]);});res.json({ok:true});
}));

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist'); if(env.NODE_ENV==='production'){app.use(express.static(root,{maxAge:'1y',immutable:true,index:false}));app.get('/{*splat}',(_req,res)=>res.sendFile(path.join(root,'index.html')));}
app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error(err);if(err instanceof z.ZodError)return res.status(400).json({error:'Dados inválidos.',details:err.issues});if(err instanceof multer.MulterError)return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'A planilha excede 15 MB.':'Falha no upload.'});res.status(500).json({error:err instanceof Error?err.message:'Erro interno.'});});
app.listen(env.PORT,()=>console.log(`CertVale API em http://localhost:${env.PORT}`));
