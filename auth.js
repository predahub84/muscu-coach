'use strict';
(async()=>{
 const button=document.getElementById('googleLogin'),feedback=document.getElementById('authFeedback');
 const fail=message=>{feedback.textContent=message;button.disabled=false};
 const mode=new URL(location.href).searchParams.get('mode');
 document.querySelector('.auth-panel h2').textContent=mode==='signup'?'Crée ton espace.':'Heureux de te retrouver.';
 const cfg=window.COACH_CONFIG||{};
 if(!cfg.supabaseUrl||!cfg.supabasePublishableKey){button.disabled=true;feedback.textContent='La connexion n’est pas encore configurée. Ton carnet local reste disponible.';return}
 const client=window.SupabaseSDK.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'},global:{fetch:(url,options={})=>fetch(url,{...options,signal:options.signal||AbortSignal.timeout(15000)})}});
 button.disabled=true;
 try{
  const url=new URL(location.href),hash=new URLSearchParams(url.hash.slice(1));
  if(url.searchParams.has('error')||hash.has('error')){history.replaceState(null,'','/connexion.html');fail('Connexion annulée ou refusée. Tu peux réessayer.');}
  else if(url.searchParams.has('code')){
   feedback.textContent='On retrouve ton carnet…';
   const code=url.searchParams.get('code');history.replaceState(null,'','/connexion.html');
   const {error}=await client.auth.exchangeCodeForSession(code);if(error)throw error;
   location.replace('/');return;
  }else{const {data,error}=await client.auth.getSession();if(error)throw error;if(data.session){location.replace('/');return}button.disabled=false}
 }catch{fail('La connexion n’a pas abouti. Réessaie depuis ce navigateur avec du réseau.')}
 button.addEventListener('click',async()=>{
  button.disabled=true;feedback.textContent='Ouverture de Google…';
  try{const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/connexion.html'}});if(error)throw error}
  catch{fail('Google est indisponible. Vérifie le réseau ; si cela persiste, la connexion Google doit être activée dans Supabase.')}
 });
})();
