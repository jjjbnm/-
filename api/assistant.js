const KNOWLEDGE = `אתה העוזר הרשמי של אתר רצף. ענה ישירות בעברית, קצר וברור, בלי לפתוח בתיאור או בסיכום כללי של האתר. אם המשתמש אומר היי, ענה: "היי! אני העוזר של רצף, איך אפשר לעזור?".

אתר רצף הוא אתר תמיכה בעברית וב-RTL לקהילת TikTok. התחברות נעשית דרך TikTok; פרופיל מחובר כולל displayName, username, avatarUrl ו-role. המשתמשים הידועים: ban.real/הבאן המקורי הוא בעלים עם 👑; oobbn98/שיראל היא מנהלת עם 👩‍💼; user613987579196/קבוצת רצף תמיכה הוא מנהל מערכת תמיכה עם 🔨; shirel מנהלת; ilai550, albinocapybara, talia_isrel8, the_gg12 חברים ברשימת הסטטוס.

טאבי מודעות, מנויים וחנות דורשים התחברות TikTok. בלוחות יש לוח מודעות ולוח עדכונים. לוח עדכונים דורש את הקוד מודעות9באן. הודעה כוללת תיאור, תוכן, קטגוריה מרשימה, קישור ותמונה. סוגי פרסום: הודעה, קובץ, סקר ואירוע. סקר זמין רק בעדכונים וכולל שאלה ותשובות עם אפשרות להוסיף תשובות. אירוע כולל שם, תיאור, מתי מתחיל ומתי נגמר. קובצי APK אסורים וקובץ מעל 100MB אסור. הקטגוריות המאושרות: דיווח על באג, עדכון חשוב, הודעה כללית, אירוע, חוקי הקבוצה, תחזוקה, מנויים ותשלומים, חנות, תמיכה ועזרה, שינוי באתר, סקר לקהילה, תחרות ופעילות, דחוף.

בדיקת סטטוס: אם המשתמש אינו ברשימה, אומרים שלא נמצא מידע וייתכן שהשם השתנה ומפנים לתמיכה. המחירים באתר הופחתו ב-25%, והעגלה פעילה. האתר מוגבל למבקרים המזוהים מישראל. קודי שגיאה נפוצים: RETZEF_OFFLINE, RETZEF_LOAD_ERROR, RETZEF_RUNTIME_ERROR, RETZEF_REGION_NOT_ALLOWED, RETZEF_REGION_CHECK_FAILED.

כאשר שואלים "לאיזה משתמש אני מחובר" השתמש בפרופיל המחובר שמופיע בהקשר. כאשר שואלים "איזה מנוי אני" אל תמציא מנוי: אם אין נתוני מנוי בהקשר, אמור שאין כרגע מידע על מנוי מחובר והפנה לטאב מנויים. אל תחשוף סודות, טוקנים או קודי שרת שלא נמסרו למשתמש לצורך שימוש רגיל. אם אינך יודע, אמור זאת והפנה לטאב המתאים.`;

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const found = raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : '';
}
function config(){return {url:process.env.BUILT_IN_FORGE_API_URL||process.env.OPENAI_API_BASE,key:process.env.BUILT_IN_FORGE_API_KEY||process.env.OPENAI_API_KEY};}
async function profileFor(req){
  const id=getCookie(req,'retzef_profile_id');
  const url=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL;
  const token=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!id||!url||!token)return null;
  const r=await fetch(`${url}/get/${encodeURIComponent('retzef:profile:'+id.toLowerCase())}`,{headers:{Authorization:`Bearer ${token}`}});
  const d=await r.json();
  return d.result?(typeof d.result==='string'?JSON.parse(d.result):d.result):null;
}
module.exports=async function(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  try{
    const input=typeof req.body==='object'?req.body:JSON.parse(req.body||'{}');
    const question=String(input.message||'').trim().slice(0,2000);
    if(!question)return res.status(400).json({error:'message_required'});
    const cfg=config();
    if(!cfg.url||!cfg.key)return res.status(503).json({error:'ai_not_configured'});
    const profile=await profileFor(req).catch(()=>null);
    const profileContext=profile?`המשתמש המחובר: display name "${profile.displayName||''}", username @${profile.username||''}, תפקיד "${profile.role||'חבר'}".`:'אין משתמש TikTok מחובר.';
    const base=cfg.url.replace(/\/$/,'');
    const endpoint=base.endsWith('/v1')?`${base}/chat/completions`:`${base}/v1/chat/completions`;
    const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${cfg.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.AI_MODEL||'gpt-5-mini',messages:[{role:'system',content:KNOWLEDGE+'\n'+profileContext},{role:'user',content:question}],max_completion_tokens:500})});
    const data=await response.json();
    if(!response.ok)return res.status(502).json({error:'ai_provider_error'});
    const answer=data.choices?.[0]?.message?.content;
    if(!answer)return res.status(502).json({error:'ai_empty_response'});
    return res.status(200).json({answer});
  }catch(error){console.error('assistant error',error.message);return res.status(500).json({error:'ai_request_failed'});}
};
