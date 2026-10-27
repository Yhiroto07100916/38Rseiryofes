import { hasPermission, requireAuth } from "../lib/authz"

type Status = "submitted" | "changes_requested" | "representative_reviewed" | "chief_review_pending" | "chief_approved" | "chief_rejected" | "contact_pending" | "contacted" | "store_approved" | "store_rejected" | "scheduling" | "collecting" | "completed" | "cancelled"
const json = (body: unknown, status = 200) => Response.json(body, { status })
async function permitted(request: Request, env: Env, key: string) {
 const auth = await requireAuth(request, env)
 if (auth instanceof Response) return auth
 if (!(await hasPermission(env, auth.user.id, key))) return json({ error: "Forbidden", permission: key }, 403)
 return auth
}
async function history(env: Env, requestId: string, actorId: string, action: string, from: string|null, to: string|null, details: unknown = null) {
 await env.DB.prepare("INSERT INTO milk_collection_history(id,request_id,actor_id,action,from_status,to_status,details) VALUES(?,?,?,?,?,?,?)")
 .bind(crypto.randomUUID(),requestId,actorId,action,from,to,details===null?null:JSON.stringify(details)).run()
}
export async function handleMilkCollection(request: Request, env: Env, path: string[]) {
 const method=request.method, id=path[0], sub=path[1]
 if(method==="GET"&&!id){
  const auth=await permitted(request,env,"milk_collection.view"); if(auth instanceof Response)return auth
  const rows=await env.DB.prepare("SELECT r.*,u.name AS proposer_name FROM milk_collection_requests r LEFT JOIN users u ON u.id=r.created_by ORDER BY r.updated_at DESC,r.created_at DESC").all()
  return json({requests:rows.results})
 }
 if(method==="POST"&&!id){
  const auth=await permitted(request,env,"milk_collection.create"); if(auth instanceof Response)return auth
  const b=await request.json().catch(()=>null) as Record<string,unknown>|null
  if(!b||typeof b.store_name!=="string"||!b.store_name.trim()||typeof b.address!=="string"||!b.address.trim()||typeof b.contact_info!=="string"||!b.contact_info.trim())return json({error:"store_name、address、contact_info は必須です"},400)
  const rid=crypto.randomUUID()
  await env.DB.prepare("INSERT INTO milk_collection_requests(id,title,store_name,address,contact_info,expected_quantity,proposal_reason,created_by) VALUES(?,?,?,?,?,?,?,?)").bind(rid,b.store_name.trim(),b.store_name.trim(),b.address.trim(),b.contact_info.trim(),Number.isInteger(b.expected_quantity)&&Number(b.expected_quantity)>=0?Number(b.expected_quantity):null,(typeof b.proposal_reason==="string"?b.proposal_reason.trim():""),auth.user.id).run()
  await history(env,rid,auth.user.id,"submitted",null,"submitted")
  return json({id:rid},201)
 }
 if(!id)return json({error:"Not Found"},404)
 const current=await env.DB.prepare("SELECT id,status FROM milk_collection_requests WHERE id=?").bind(id).first<{id:string;status:Status}>()
 if(!current)return json({error:"Not Found"},404)
 if(method==="GET"&&!sub){
  const auth=await permitted(request,env,"milk_collection.view"); if(auth instanceof Response)return auth
  const [requestRow,comments,events]=await Promise.all([
   env.DB.prepare("SELECT r.*,u.name AS proposer_name FROM milk_collection_requests r LEFT JOIN users u ON u.id=r.created_by WHERE r.id=?").bind(id).first(),
   env.DB.prepare("SELECT c.*,u.name AS author_name FROM milk_collection_comments c LEFT JOIN users u ON u.id=c.author_id WHERE c.request_id=? ORDER BY c.created_at").bind(id).all(),
   env.DB.prepare("SELECT h.*,u.name AS actor_name FROM milk_collection_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.request_id=? ORDER BY h.created_at DESC").bind(id).all()
  ])
  return json({request:requestRow,comments:comments.results,history:events.results})
 }
 if(method==="POST"&&sub==="comments"){
  const auth=await permitted(request,env,"milk_collection.comment"); if(auth instanceof Response)return auth
  const b=await request.json().catch(()=>null) as {body?:unknown}|null
  if(typeof b?.body!=="string"||!b.body.trim())return json({error:"コメントを入力してください"},400)
  const cid=crypto.randomUUID()
  await env.DB.prepare("INSERT INTO milk_collection_comments(id,request_id,author_id,body) VALUES(?,?,?,?)").bind(cid,id,auth.user.id,b.body.trim()).run()
  await history(env,id,auth.user.id,"commented",current.status,current.status,{comment_id:cid})
  return json({id:cid},201)
 }
 if(method==="PATCH"&&!sub){
  const b=await request.json().catch(()=>null) as Record<string,unknown>|null
  if(!b)return json({error:"Invalid body"},400)
  if(b.action==="edit_resubmit"){
   const auth=await requireAuth(request,env); if(auth instanceof Response)return auth
   const owned=await env.DB.prepare("SELECT created_by FROM milk_collection_requests WHERE id=?").bind(id).first<{created_by:string}>()
   if(!owned||owned.created_by!==auth.user.id)return json({error:"提案者本人のみ修正できます"},403)
   if(current.status!=="changes_requested")return json({error:"修正依頼中の候補のみ再提出できます"},409)
   if(typeof b.store_name!=="string"||!b.store_name.trim()||typeof b.address!=="string"||!b.address.trim()||typeof b.contact_info!=="string"||!b.contact_info.trim())return json({error:"店舗名・住所・連絡先は必須です"},400)
   const quantity=Number.isInteger(b.expected_quantity)&&Number(b.expected_quantity)>=0?Number(b.expected_quantity):null
   const reason=typeof b.proposal_reason==="string"?b.proposal_reason.trim():""
   await env.DB.prepare("UPDATE milk_collection_requests SET title=?,store_name=?,address=?,contact_info=?,expected_quantity=?,proposal_reason=?,status='submitted',updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .bind(b.store_name.trim(),b.store_name.trim(),b.address.trim(),b.contact_info.trim(),quantity,reason,id).run()
   await history(env,id,auth.user.id,"resubmitted","changes_requested","submitted",{store_name:b.store_name.trim(),address:b.address.trim(),contact_info:b.contact_info.trim(),expected_quantity:quantity,proposal_reason:reason})
   return json({ok:true,status:"submitted"})
  }
  const from=current.status; let to:Status=from, permission="", action=""; const updates:Record<string,unknown>={}
  if(b.action==="request_changes"||b.action==="representative_reviewed"){
   permission="milk_collection.review"
   if(!["submitted","changes_requested"].includes(from))return json({error:"この状態ではクラ代レビューできません"},409)
   if(b.action==="request_changes"){if(typeof b.note!=="string"||!b.note.trim())return json({error:"修正依頼の理由は必須です"},400);to="changes_requested";updates.representative_note=b.note.trim();action="changes_requested"}
   else{to="representative_reviewed";updates.representative_note=typeof b.note==="string"?b.note.trim()||null:null;action="representative_reviewed"}
  }else if(b.action==="submit_to_chief"){
   permission="milk_collection.submit_to_chief";if(from!=="representative_reviewed")return json({error:"クラ代確認後に審議依頼できます"},409);to="chief_review_pending";action="submitted_to_chief"
  }else if(b.action==="chief_approved"||b.action==="chief_rejected"){
   permission="milk_collection.record_review";if(from!=="chief_review_pending")return json({error:"審議依頼中の申請のみ結果を記録できます"},409)
   to=b.action;updates.chief_review_result=b.action==="chief_approved"?"approved":"rejected";updates.chief_review_note=typeof b.note==="string"?b.note.trim()||null:null;action=b.action
  }else if(b.action==="contacted"||b.action==="store_approved"||b.action==="store_rejected"){
   permission="milk_collection.record_contact";if(!["chief_approved","contact_pending","contacted"].includes(from))return json({error:"チーフ会承認後に店舗連絡結果を記録できます"},409)
   to=b.action;updates.store_contact_result=b.action==="store_approved"?"approved":b.action==="store_rejected"?"rejected":"pending";updates.store_contact_note=typeof b.note==="string"?b.note.trim()||null:null;action=b.action
  }else if(["scheduling","collecting","completed","cancelled"].includes(String(b.action))){
   permission="milk_collection.manage_schedule"
   if(b.action==="scheduling"&&from!=="store_approved")return json({error:"店舗の許可後に日程調整へ進めます"},409)
   if(b.action==="collecting"&&!["store_approved","scheduling"].includes(from))return json({error:"店舗許可後に受け取りを開始できます"},409)
   if(b.action==="completed"&&from!=="collecting")return json({error:"受け取り開始後に完了できます"},409)
   to=b.action as Status;action=b.action
   if(b.scheduled_at!==undefined)updates.scheduled_at=typeof b.scheduled_at==="string"?b.scheduled_at:null
   if(b.first_collection_at!==undefined)updates.first_collection_at=typeof b.first_collection_at==="string"?b.first_collection_at:null
   if(b.collected_quantity!==undefined)updates.collected_quantity=Number.isInteger(b.collected_quantity)&&Number(b.collected_quantity)>=0?Number(b.collected_quantity):null
  }else return json({error:"Unsupported action"},400)
  const auth=await permitted(request,env,permission);if(auth instanceof Response)return auth
  const cols=Object.keys(updates), clause=["status=?","updated_at=CURRENT_TIMESTAMP",...cols.map(k=>k+"=?")].join(",")
  await env.DB.prepare("UPDATE milk_collection_requests SET "+clause+" WHERE id=?").bind(to,...cols.map(k=>updates[k]),id).run()
  await history(env,id,auth.user.id,action,from,to,updates)
  return json({ok:true,status:to})
 }
 return json({error:"Not Found"},404)
}
