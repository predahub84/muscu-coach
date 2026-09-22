(function(global){
'use strict';
const D=global.MuscuCoachDomain;if(!D)throw new Error('MuscuCoachDomain doit être chargé avant coach-storage.js');
const clone=v=>JSON.parse(JSON.stringify(v));
let remote={client:null,userId:null};

function uuid(){
  if(global.crypto?.randomUUID)return global.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16)});
}
function ensureNotebookCoaching(notebook){if(!notebook||typeof notebook!=='object')throw new Error('Carnet invalide');notebook.coaching=D.normalizeCoachingState(notebook.coaching);return notebook.coaching;}
function saveProgramInNotebook(notebook,program,{activate=true,input=null}={}){const c=ensureNotebookCoaching(notebook),valid=D.validateGeneratedProgram(program);if(!valid.ok)throw new Error('Programme invalide: '+valid.errors.map(x=>x.message).join(' '));const copy=clone(program),i=c.generatedPrograms.findIndex(p=>p.id===copy.id);if(i>=0)c.generatedPrograms[i]=copy;else c.generatedPrograms.push(copy);if(activate)c.activeProgramId=copy.id;if(input)c.lastGenerationInput=clone(input);return copy;}
function activeProgramFromNotebook(notebook){const c=ensureNotebookCoaching(notebook);return c.generatedPrograms.find(p=>p.id===c.activeProgramId)||null;}
function saveWeeklyReviewInNotebook(notebook,review){const c=ensureNotebookCoaching(notebook);if(!review||typeof review!=='object'||!review.id||!review.programId)throw new Error('Bilan hebdomadaire invalide');const copy={...clone(review),createdAt:review.createdAt||new Date().toISOString()},i=c.weeklyReviews.findIndex(x=>x.id===copy.id);if(i>=0)c.weeklyReviews[i]=copy;else c.weeklyReviews.push(copy);return copy;}
function appendProgressionEventInNotebook(notebook,event){const c=ensureNotebookCoaching(notebook);if(!event||typeof event!=='object'||!event.exerciseId)throw new Error('Événement de progression invalide');const copy={...clone(event),id:event.id||uuid(),createdAt:event.createdAt||new Date().toISOString()};const i=c.progressionEvents.findIndex(x=>x.id===copy.id);if(i>=0)c.progressionEvents[i]=copy;else c.progressionEvents.push(copy);return copy;}

function supabaseRepository(client,userId){if(!client||typeof client.from!=='function')throw new Error('Client Supabase invalide');if(!userId)throw new Error('userId requis');return {
  async saveProgram(program){const valid=D.validateGeneratedProgram(program);if(!valid.ok)throw new Error('Programme invalide');const row={user_id:userId,id:program.id,revision:program.revision,status:program.status||'generated',goal_type:program.goalSnapshot?.type||'mass_gain',input_snapshot:program.inputSnapshot||{},payload:program,updated_at:new Date().toISOString()};const {data,error}=await client.from('coach_programs').upsert(row,{onConflict:'user_id,id'}).select().single();if(error)throw error;return data;},
  async listPrograms(){const {data,error}=await client.from('coach_programs').select('id,revision,status,goal_type,payload,created_at,updated_at').eq('user_id',userId).order('updated_at',{ascending:false});if(error)throw error;return data||[];},
  async saveWeeklyReview(review){if(!review?.id||!review?.programId||!Number.isInteger(review?.weekNumber))throw new Error('Bilan hebdomadaire invalide');const row={user_id:userId,id:review.id,program_id:review.programId,week_number:review.weekNumber,payload:review,updated_at:new Date().toISOString()};const {data,error}=await client.from('coach_weekly_reviews').upsert(row,{onConflict:'user_id,id'}).select().single();if(error)throw error;return data;},
  async listWeeklyReviews(){const {data,error}=await client.from('coach_weekly_reviews').select('id,program_id,week_number,payload,created_at,updated_at').eq('user_id',userId).order('created_at',{ascending:true});if(error)throw error;return data||[];},
  async saveProgressionEvent(event){if(!event?.exerciseId)throw new Error('Événement de progression invalide');const copy={...event,id:event.id||uuid(),createdAt:event.createdAt||new Date().toISOString()};const row={user_id:userId,id:copy.id,program_id:copy.programId||null,exercise_id:copy.exerciseId,event_type:copy.type||'adjustment',payload:copy,created_at:copy.createdAt};const {data,error}=await client.from('coach_progression_events').upsert(row,{onConflict:'user_id,id'}).select().single();if(error)throw error;return data;},
  async listProgressionEvents(){const {data,error}=await client.from('coach_progression_events').select('id,program_id,exercise_id,event_type,payload,created_at').eq('user_id',userId).order('created_at',{ascending:true});if(error)throw error;return data||[];},
  async saveProfile(profile){const row={user_id:userId,display_name:profile.displayName||'Athlète',age_years:profile.ageYears||null,sex:profile.sex||null,height_cm:profile.heightCm||null,current_weight_kg:profile.currentWeightKg||null,activity_level:profile.activityLevel||null,experience_level:profile.experienceLevel||null,experience_months:profile.experienceMonths||0,consistency:profile.consistency||null,health_status:profile.healthStatus||null,reported_issues:profile.reportedIssues||[],other_activities:profile.otherActivities||[],onboarding_completed_at:profile.onboardingCompletedAt||new Date().toISOString(),profile_version:profile.profileVersion||'1.0.0',updated_at:new Date().toISOString()};const {data,error}=await client.from('coach_profiles').upsert(row,{onConflict:'user_id'}).select().single();if(error)throw error;return data;},
  async getProfile(){const {data,error}=await client.from('coach_profiles').select('*').eq('user_id',userId).maybeSingle();if(error)throw error;return data;},
  async saveGoal(goal){const id=goal.id||uuid();const row={user_id:userId,id,goal_type:goal.goalType||'mass_gain',current_weight_kg:goal.currentWeightKg,target_weight_kg:goal.targetWeightKg||null,target_date:goal.targetDate||null,gain_pace_preset:goal.gainPacePreset||null,target_bodyweight_pct_per_week:goal.targetBodyweightPctPerWeek||null,days_per_week:goal.daysPerWeek||null,weekdays:goal.weekdays||[],max_session_minutes:goal.maxSessionMinutes||null,horizon_weeks:goal.horizonWeeks||null,muscle_priorities:goal.musclePriorities||[],constraints:goal.constraints||{},active:goal.active!==false,updated_at:new Date().toISOString()};if(row.active)await client.from('coach_goals').update({active:false,updated_at:new Date().toISOString()}).eq('user_id',userId).eq('active',true).neq('id',id);const {data,error}=await client.from('coach_goals').upsert(row,{onConflict:'user_id,id'}).select().single();if(error)throw error;return data;},
  async getActiveGoal(){const {data,error}=await client.from('coach_goals').select('*').eq('user_id',userId).eq('active',true).order('updated_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;return data;},
  async saveNutritionTarget(target,goalId=null){const id=target.id||uuid();if(target.active!==false)await client.from('coach_nutrition_targets').update({active:false}).eq('user_id',userId).eq('active',true).neq('id',id);const row={user_id:userId,id,goal_id:goalId||target.goalId||null,effective_from:target.effectiveFrom||new Date().toISOString().slice(0,10),calories_kcal:Math.round(target.caloriesKcal),protein_g:target.proteinG,carbs_g:target.carbsG,fat_g:target.fatG,estimated_bmr_kcal:target.estimatedBmrKcal||null,estimated_tdee_kcal:target.estimatedTdeeKcal||null,planned_surplus_kcal:target.plannedSurplusKcal||null,target_bodyweight_pct_per_week:target.targetBodyweightPctPerWeek||null,target_kg_per_week:target.targetKgPerWeek||null,calculation_method:target.calculationMethod||'manual',confidence:target.confidence||'estimated',source_inputs:target.sourceInputs||{},adjustment:target.adjustment||null,active:target.active!==false};const {data,error}=await client.from('coach_nutrition_targets').upsert(row,{onConflict:'user_id,id'}).select().single();if(error)throw error;return data;},
  async getActiveNutritionTarget(){const {data,error}=await client.from('coach_nutrition_targets').select('*').eq('user_id',userId).eq('active',true).order('effective_from',{ascending:false}).limit(1).maybeSingle();if(error)throw error;return data;},
  async saveCheckin(checkin,goalId=null){const id=checkin.id||uuid();const row={user_id:userId,id,goal_id:goalId||checkin.goalId||null,week_start:checkin.weekStart,average_weight_kg:checkin.averageWeightKg||null,average_calories_kcal:checkin.averageCaloriesKcal||null,adherence_pct:checkin.adherencePct??null,sessions_completed:checkin.sessionsCompleted??null,sessions_planned:checkin.sessionsPlanned??null,average_steps:checkin.averageSteps??null,fatigue_score:checkin.fatigueScore??null,notes:checkin.notes||null,adjustment:checkin.adjustment||null,updated_at:new Date().toISOString()};const {data,error}=await client.from('coach_checkins').upsert(row,{onConflict:'user_id,id'}).select().single();if(error)throw error;return data;},
  async listCheckins(limit=12){const {data,error}=await client.from('coach_checkins').select('*').eq('user_id',userId).order('week_start',{ascending:false}).limit(limit);if(error)throw error;return data||[];}
};}

function bindSupabase(client,userId){remote={client:client||null,userId:userId||null};return isRemoteBound();}
function unbindSupabase(){remote={client:null,userId:null};}
function isRemoteBound(){return !!(remote.client&&remote.userId);}
function repository(){return isRemoteBound()?supabaseRepository(remote.client,remote.userId):null;}
async function saveProgramRemote(program){const repo=repository();if(!repo)return {status:'local_only'};return {status:'saved',row:await repo.saveProgram(program)};}
async function saveWeeklyReviewRemote(review){const repo=repository();if(!repo)return {status:'local_only'};return {status:'saved',row:await repo.saveWeeklyReview(review)};}
async function saveProgressionEventRemote(event){const repo=repository();if(!repo)return {status:'local_only'};return {status:'saved',row:await repo.saveProgressionEvent(event)};}
async function saveProfileRemote(profile){const repo=repository();if(!repo)return {status:'local_only'};return {status:'saved',row:await repo.saveProfile(profile)};}
async function saveGoalRemote(goal){const repo=repository();if(!repo)return {status:'local_only'};return {status:'saved',row:await repo.saveGoal(goal)};}
async function saveNutritionTargetRemote(target,goalId){const repo=repository();if(!repo)return {status:'local_only'};return {status:'saved',row:await repo.saveNutritionTarget(target,goalId)};}
async function saveCheckinRemote(checkin,goalId){const repo=repository();if(!repo)return {status:'local_only'};return {status:'saved',row:await repo.saveCheckin(checkin,goalId)};}
async function loadAccountProfileBundle(){const repo=repository();if(!repo)return {status:'local_only',profile:null,goal:null,nutritionTarget:null,checkins:[]};const [profile,goal,nutritionTarget,checkins]=await Promise.all([repo.getProfile(),repo.getActiveGoal(),repo.getActiveNutritionTarget(),repo.listCheckins()]);return {status:'loaded',profile,goal,nutritionTarget,checkins};}

async function syncNotebookToSupabase(notebook){
  const repo=repository();if(!repo)return {status:'local_only',programs:0,reviews:0,events:0,errors:[]};
  const c=ensureNotebookCoaching(notebook),errors=[];let programs=0,reviews=0,events=0;
  for(const program of c.generatedPrograms){try{await repo.saveProgram(program);programs++}catch(error){errors.push({kind:'program',id:program?.id,error:String(error?.message||error)})}}
  for(const review of c.weeklyReviews){try{await repo.saveWeeklyReview(review);reviews++}catch(error){errors.push({kind:'review',id:review?.id,error:String(error?.message||error)})}}
  for(const event of c.progressionEvents){try{await repo.saveProgressionEvent(event);events++}catch(error){errors.push({kind:'event',id:event?.id,error:String(error?.message||error)})}}
  return {status:errors.length?'partial':'synced',programs,reviews,events,errors};
}

function mergePrograms(local,rows){const map=new Map((local||[]).map(p=>[p.id,p]));for(const row of rows||[]){const p=row?.payload;if(!p?.id)continue;const old=map.get(p.id);if(!old||Number(p.revision||0)>=Number(old.revision||0))map.set(p.id,p)}return [...map.values()];}
function mergeById(local,rows){const map=new Map((local||[]).filter(x=>x?.id).map(x=>[x.id,x]));for(const row of rows||[]){const value=row?.payload;if(value?.id)map.set(value.id,value)}return [...map.values()];}
async function pullSupabaseIntoNotebook(notebook){
  const repo=repository();if(!repo)return {status:'local_only',changed:false};
  const c=ensureNotebookCoaching(notebook),before=JSON.stringify({a:c.activeProgramId,p:c.generatedPrograms,r:c.weeklyReviews,e:c.progressionEvents});
  const [programRows,reviewRows,eventRows]=await Promise.all([repo.listPrograms(),repo.listWeeklyReviews(),repo.listProgressionEvents()]);
  c.generatedPrograms=mergePrograms(c.generatedPrograms,programRows);
  c.weeklyReviews=mergeById(c.weeklyReviews,reviewRows);
  c.progressionEvents=mergeById(c.progressionEvents,eventRows);
  if(c.activeProgramId&&!c.generatedPrograms.some(p=>p.id===c.activeProgramId))c.activeProgramId=null;
  if(!c.activeProgramId&&programRows[0]?.payload?.id)c.activeProgramId=programRows[0].payload.id;
  const after=JSON.stringify({a:c.activeProgramId,p:c.generatedPrograms,r:c.weeklyReviews,e:c.progressionEvents});
  return {status:'pulled',changed:before!==after,programs:programRows.length,reviews:reviewRows.length,events:eventRows.length};
}
async function reconcileNotebookWithSupabase(notebook){
  if(!isRemoteBound())return {status:'local_only',changed:false};
  const pull=await pullSupabaseIntoNotebook(notebook);
  const push=await syncNotebookToSupabase(notebook);
  return {status:push.status==='partial'?'partial':'synced',changed:pull.changed,pull,push};
}

global.MuscuCoachStorage=Object.freeze({
  version:'1.2.0',ensureNotebookCoaching,saveProgramInNotebook,activeProgramFromNotebook,saveWeeklyReviewInNotebook,appendProgressionEventInNotebook,
  supabaseRepository,bindSupabase,unbindSupabase,isRemoteBound,saveProgramRemote,saveWeeklyReviewRemote,saveProgressionEventRemote,saveProfileRemote,saveGoalRemote,saveNutritionTargetRemote,saveCheckinRemote,loadAccountProfileBundle,syncNotebookToSupabase,pullSupabaseIntoNotebook,reconcileNotebookWithSupabase
});
})(typeof window!=='undefined'?window:globalThis);
