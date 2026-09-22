'use strict';

(async()=>{
  const qs=(s)=>document.querySelector(s);
  const byId=(id)=>document.getElementById(id);
  const panel=qs('.auth-panel');
  const title=qs('.auth-panel h2');
  const intro=byId('authModeIntro');
  const feedback=byId('authFeedback');
  const googleButton=byId('googleLogin');
  const emailForm=byId('emailAuthForm');
  const submitButton=byId('emailSubmit');
  const emailField=byId('authEmail');
  const passwordField=byId('authPassword');
  const confirmField=byId('authPasswordConfirm');
  const displayNameField=byId('authDisplayName');
  const displayNameRow=byId('displayNameRow');
  const passwordRow=byId('passwordRow');
  const confirmRow=byId('confirmPasswordRow');
  const forgotLink=byId('forgotPassword');
  const backToLogin=byId('backToLogin');
  const tabs=byId('authTabs');
  const socialBlock=byId('socialAuthBlock');
  const localLink=byId('localAccess');

  const url=new URL(location.href);
  let mode=url.searchParams.get('mode')||'login';
  if(!['login','signup','forgot','reset','confirm'].includes(mode))mode='login';

  const cfg=window.COACH_CONFIG||{};
  let client=null;
  let busy=false;

  const copy={
    login:{title:'Heureux de te retrouver.',intro:'Connecte-toi avec ton email ou Google pour retrouver ton carnet.',submit:'Se connecter'},
    signup:{title:'Crée ton espace.',intro:'Crée ton compte avec ton email ou Google. Ton carnet restera lié au même compte.',submit:'Créer mon compte'},
    forgot:{title:'Réinitialise ton mot de passe.',intro:'Entre ton email. On t’enverra un lien sécurisé pour choisir un nouveau mot de passe.',submit:'Envoyer le lien'},
    reset:{title:'Choisis un nouveau mot de passe.',intro:'Ton lien est validé. Choisis maintenant un nouveau mot de passe.',submit:'Enregistrer le mot de passe'},
    confirm:{title:'Validation du compte…',intro:'On valide ton adresse email et on retrouve ton espace.',submit:'Continuer'}
  };

  function setFeedback(message,type=''){
    feedback.textContent=message||'';
    feedback.dataset.type=type;
  }

  function setBusy(value,message=''){
    busy=value;
    [...panel.querySelectorAll('button,input')].forEach(el=>{el.disabled=value});
    if(message)setFeedback(message);
  }

  function setMode(next,{replace=false}={}){
    mode=next;
    const c=copy[mode]||copy.login;
    title.textContent=c.title;
    intro.textContent=c.intro;
    submitButton.textContent=c.submit;

    const signup=mode==='signup';
    const login=mode==='login';
    const forgot=mode==='forgot';
    const reset=mode==='reset';
    const confirm=mode==='confirm';

    tabs.hidden=!(login||signup);
    socialBlock.hidden=!(login||signup);
    localLink.hidden=reset||confirm;
    displayNameRow.hidden=!signup;
    passwordRow.hidden=forgot||confirm;
    confirmRow.hidden=!(signup||reset);
    forgotLink.hidden=!login;
    backToLogin.hidden=!(forgot||reset);
    emailField.closest('.auth-field').hidden=reset||confirm;
    emailForm.hidden=confirm;

    displayNameField.required=signup;
    emailField.required=!reset&&!confirm;
    passwordField.required=login||signup||reset;
    confirmField.required=signup||reset;
    passwordField.autocomplete=(signup||reset)?'new-password':'current-password';
    confirmField.autocomplete='new-password';

    qs('[data-auth-tab="login"]')?.classList.toggle('active',login);
    qs('[data-auth-tab="signup"]')?.classList.toggle('active',signup);

    if(replace){
      const u=new URL(location.href);
      u.searchParams.set('mode',next);
      u.searchParams.delete('code');
      history.replaceState(null,'',u.pathname+u.search+u.hash);
    }
    setFeedback('');
  }

  function validatePassword(password){
    if(password.length<8)return 'Choisis un mot de passe d’au moins 8 caractères.';
    return '';
  }

  setMode(mode);

  if(!cfg.supabaseUrl||!cfg.supabasePublishableKey){
    [...panel.querySelectorAll('button,input')].forEach(el=>{el.disabled=true});
    setFeedback('La connexion n’est pas encore configurée. Ton carnet local reste disponible.','error');
    return;
  }

  client=window.SupabaseSDK.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'},
    global:{fetch:(requestUrl,options={})=>fetch(requestUrl,{...options,signal:options.signal||AbortSignal.timeout(15000)})}
  });

  try{
    const hash=new URLSearchParams(url.hash.slice(1));
    if(url.searchParams.has('error')||hash.has('error')){
      const message=url.searchParams.get('error_description')||hash.get('error_description')||'Connexion annulée ou refusée.';
      history.replaceState(null,'','/connexion.html?mode=login');
      setMode('login');
      setFeedback(message,'error');
    }else if(url.searchParams.has('code')){
      const callbackMode=mode;
      setBusy(true,callbackMode==='reset'?'Validation du lien…':'On retrouve ton carnet…');
      const code=url.searchParams.get('code');
      const {error}=await client.auth.exchangeCodeForSession(code);
      if(error)throw error;
      history.replaceState(null,'','/connexion.html?mode='+encodeURIComponent(callbackMode));
      if(callbackMode==='reset'){
        setMode('reset');
        setBusy(false);
        setFeedback('Lien validé. Tu peux choisir ton nouveau mot de passe.','success');
      }else{
        location.replace('/');
        return;
      }
    }else{
      const {data,error}=await client.auth.getSession();
      if(error)throw error;
      if(data.session&&mode!=='reset'){
        location.replace('/');
        return;
      }
    }
  }catch(error){
    setBusy(false);
    setMode(mode==='reset'?'forgot':'login');
    setFeedback(error?.message||'La connexion n’a pas abouti. Réessaie depuis ce navigateur avec du réseau.','error');
  }

  panel.addEventListener('click',(event)=>{
    const tab=event.target.closest('[data-auth-tab]');
    if(tab){
      event.preventDefault();
      if(busy)return;
      setMode(tab.dataset.authTab,{replace:true});
      return;
    }
    if(event.target.closest('#backToLogin')){
      event.preventDefault();
      if(busy)return;
      setMode('login',{replace:true});
      emailField.focus();
      return;
    }
    if(event.target.closest('#forgotPassword')){
      event.preventDefault();
      if(busy)return;
      setMode('forgot',{replace:true});
      emailField.focus();
    }
  });

  googleButton.addEventListener('click',async()=>{
    if(busy)return;
    setBusy(true,'Ouverture de Google…');
    try{
      const {error}=await client.auth.signInWithOAuth({
        provider:'google',
        options:{redirectTo:location.origin+'/connexion.html?mode=login'}
      });
      if(error)throw error;
    }catch(error){
      setBusy(false);
      setFeedback(error?.message||'Google est indisponible. Vérifie le réseau ou la configuration Supabase.','error');
    }
  });

  emailForm.addEventListener('submit',async(event)=>{
    event.preventDefault();
    if(busy)return;
    setFeedback('');

    const email=emailField.value.trim().toLowerCase();
    const password=passwordField.value;
    const confirmation=confirmField.value;
    const displayName=displayNameField.value.trim();

    if((mode==='login'||mode==='signup'||mode==='forgot')&&!email){
      setFeedback('Entre ton adresse email.','error');
      emailField.focus();
      return;
    }
    if(mode==='signup'&&!displayName){
      setFeedback('Entre ton prénom ou ton pseudo.','error');
      displayNameField.focus();
      return;
    }
    if(mode==='signup'||mode==='reset'){
      const passwordError=validatePassword(password);
      if(passwordError){setFeedback(passwordError,'error');passwordField.focus();return;}
      if(password!==confirmation){setFeedback('Les deux mots de passe ne correspondent pas.','error');confirmField.focus();return;}
    }

    try{
      if(mode==='login'){
        setBusy(true,'Connexion…');
        const {error}=await client.auth.signInWithPassword({email,password});
        if(error)throw error;
        location.replace('/');
        return;
      }

      if(mode==='signup'){
        setBusy(true,'Création de ton compte…');
        const {data,error}=await client.auth.signUp({
          email,password,
          options:{
            data:{display_name:displayName},
            emailRedirectTo:location.origin+'/connexion.html?mode=confirm'
          }
        });
        if(error)throw error;
        if(data.session){
          location.replace('/');
          return;
        }
        setBusy(false);
        emailForm.reset();
        const identities=Array.isArray(data?.user?.identities)?data.user.identities:null;
        if(identities&&identities.length===0){
          setFeedback('Si cette adresse est déjà liée à un compte (par exemple via Google), aucun nouveau compte ni nouvel e-mail de confirmation ne sont créés. Essaie « J’ai déjà un compte » ou « Continuer avec Google ».','info');
        }else{
          setFeedback('Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis tu pourras ouvrir ton carnet.','success');
        }
        return;
      }

      if(mode==='forgot'){
        setBusy(true,'Envoi du lien…');
        const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/connexion.html?mode=reset'});
        if(error)throw error;
        setBusy(false);
        setFeedback('Si un compte existe avec cet email, un lien de réinitialisation vient d’être envoyé.','success');
        return;
      }

      if(mode==='reset'){
        setBusy(true,'Enregistrement…');
        const {error}=await client.auth.updateUser({password});
        if(error)throw error;
        setFeedback('Mot de passe modifié. Ouverture de ton carnet…','success');
        setTimeout(()=>location.replace('/'),650);
      }
    }catch(error){
      setBusy(false);
      const message=String(error?.message||'Une erreur est survenue. Réessaie.');
      if(mode==='login'&&/invalid login credentials/i.test(message))setFeedback('Email ou mot de passe incorrect.','error');
      else if(/email signups are disabled/i.test(message))setFeedback('Les inscriptions par email ne sont pas encore activées dans Supabase.','error');
      else if(/user already registered/i.test(message))setFeedback('Un compte existe déjà avec cet email. Essaie de te connecter.','error');
      else setFeedback(message,'error');
    }
  });
})();
