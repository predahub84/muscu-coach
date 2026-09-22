'use strict';
let profileSection='identity';
const profileSettingsView=settingsView;
const settingsTab=TABINFO.find(t=>t[0]==='settings');
if(settingsTab){settingsTab[2]='Mon profil';settingsTab[3]='Profil';}
shell();
function accountProviderLabel(){
 const ids=Array.isArray(cloud.user?.identities)?cloud.user.identities:[];
 const providers=[...new Set(ids.map(x=>x?.provider).filter(Boolean))];
 if(providers.includes('google')&&providers.includes('email'))return 'Google + email';
 if(providers.includes('google'))return 'Google';
 if(providers.includes('email')||cloud.user?.app_metadata?.provider==='email')return 'Email + mot de passe';
 return cloud.user?'Compte connecté':'Mode local';
}
function profileSummary(){
 const sets=state.history.reduce((n,h)=>n+h.sets.length,0);
 const volume=state.history.reduce((n,h)=>n+workload(h.sets),0);
 return `<div class="profile-stats"><div class="profile-stat"><strong>${state.history.length}</strong><span>Séances enregistrées</span></div><div class="profile-stat"><strong>${sets}</strong><span>Séries réalisées</span></div><div class="profile-stat"><strong>${fmt(volume/1000)} t</strong><span>Volume cumulé</span></div></div>`;
}
settingsView=function(){
 const p=state.profile,name=p.name||'Athlète';
 const head=`<section class="profile-hero"><div class="profile-avatar" aria-hidden="true">${esc(name.slice(0,1).toUpperCase())}</div><div><span class="auth-tag">MON ESPACE</span><h1>${esc(name)}</h1><p>${cloud.user?accountProviderLabel()+' connecté':'Mode découverte · sur cet appareil'} · Semaine ${p.week}</p></div></section><nav class="profile-tabs" aria-label="Rubriques du profil">${[['identity','Mon profil'],['progress','Progression'],['account','Mon compte'],['settings','Réglages']].map(([id,label])=>`<button class="seg-btn ${profileSection===id?'active':''}" data-profile-section="${id}" aria-pressed="${profileSection===id}">${label}</button>`).join('')}</nav>`;
 if(profileSection==='settings')return head+profileSettingsView();
 if(profileSection==='progress')return head+profileSummary()+progressView();
 if(profileSection==='account'){
  const u=cloud.user;
  return head+`<section class="card"><h2>Les infos de ton compte.</h2><div class="account-detail"><span>Adresse e-mail</span><b>${u?esc(u.email||'Non renseignée'):'Aucun compte connecté'}</b></div><div class="account-detail"><span>Connexion</span><b>${u?esc(accountProviderLabel()):'Mode local'}</b></div><div class="account-detail"><span>Membre depuis</span><b>${u?.created_at?esc(new Date(u.created_at).toLocaleDateString('fr-FR')):'—'}</b></div></section><div style="margin-top:20px">${cloudCard()}</div>`;
 }
 return head+profileSummary()+`<section class="card"><h2>Un profil qui te ressemble.</h2><p class="profile-intro">Tes repères personnels. Avec un compte, ils sont enregistrés dans ton carnet synchronisé.</p><form id="personalProfileForm" class="profile-form"><label>Prénom ou pseudo<input name="name" maxlength="50" required value="${esc(name)}" autocomplete="nickname"></label><label>Poids actuel · kg<input name="weight" type="number" min="1" max="500" step="0.1" required value="${p.weight}"></label><label>Objectif personnel<select name="goal">${['Prise de masse','Remise en forme','Renforcement','Entretien'].map(g=>`<option ${p.goal===g?'selected':''}>${g}</option>`).join('')}</select></label><label>Expérience<select name="experience">${['Débutant','Intermédiaire','Confirmé'].map(g=>`<option ${p.experience===g?'selected':''}>${g}</option>`).join('')}</select></label><p class="micro muted">Ces informations personnalisent ton profil ; elles ne changent pas automatiquement ton programme.</p><button type="submit" class="btn btn-primary">Enregistrer mon profil →</button><span data-cloud-status class="cloud-status ${cloud.status}">${labels[cloud.status]}</span></form></section>`;
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-profile-section]');if(b){profileSection=b.dataset.profileSection;render();}});
document.addEventListener('submit',e=>{
 if(e.target.id!=='personalProfileForm')return;e.preventDefault();
 const data=new FormData(e.target),name=String(data.get('name')).trim(),weight=Number(data.get('weight'));
 if(!name||!Number.isFinite(weight)||weight<1||weight>500){toast('Vérifie ton prénom et ton poids.');return}
 const previous=clone(state.profile);state.profile={...previous,name,weight,goal:String(data.get('goal')),experience:String(data.get('experience'))};
 if(!save()){state.profile=previous;toast('Profil non enregistré. Vérifie le stockage de cet appareil.');return}render();toast('Profil enregistré sur cet appareil.');
});
render();
