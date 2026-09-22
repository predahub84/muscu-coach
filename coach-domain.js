(function(global){
'use strict';

const SCHEMA_VERSION='1.0.0';
const POLICY_VERSION='1.0.0';
const GAIN_PACE_PRESETS={
  controlled:{label:'Contrôlé',targetBodyweightPctPerWeek:0.25},
  normal:{label:'Normal',targetBodyweightPctPerWeek:0.50},
  aggressive:{label:'Agressif',targetBodyweightPctPerWeek:0.75}
};
const IMPORTANCE_LEVELS={low:1,medium:3,high:5};
const VALID_GOALS=new Set(['mass_gain']);
const VALID_EXPERIENCE=new Set(['beginner','novice','intermediate','advanced']);
const VALID_HEALTH_STATUS=new Set(['ok','managed','needs_clearance']);
const VALID_LOAD_CONVENTIONS=new Set(['total_external','per_hand','machine_stack','added_to_bodyweight','assistance']);

const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const finite=(v,min=-Infinity,max=Infinity)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const str=(v,min=1,max=200)=>typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max;
const isoDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'));
const clone=v=>JSON.parse(JSON.stringify(v));
const uniq=arr=>[...new Set(arr)];
const todayISO=()=>new Date().toISOString().slice(0,10);

function normalizeGainPace(value,currentWeightKg){
  let key=null,pct=null;
  if(typeof value==='string'&&GAIN_PACE_PRESETS[value]){
    key=value;pct=GAIN_PACE_PRESETS[value].targetBodyweightPctPerWeek;
  }else if(isObject(value)){
    if(typeof value.preset==='string'&&GAIN_PACE_PRESETS[value.preset])key=value.preset;
    if(finite(value.targetBodyweightPctPerWeek,0.05,2))pct=value.targetBodyweightPctPerWeek;
    if(pct==null&&key)pct=GAIN_PACE_PRESETS[key].targetBodyweightPctPerWeek;
  }else if(finite(value,0.05,2))pct=value;
  if(pct==null){key='normal';pct=GAIN_PACE_PRESETS.normal.targetBodyweightPctPerWeek;}
  return {
    preset:key||'custom',
    targetBodyweightPctPerWeek:Number(pct.toFixed(3)),
    targetKgPerWeek:finite(currentWeightKg,1,500)?Number((currentWeightKg*pct/100).toFixed(3)):null
  };
}

function normalizePriorities(list){
  if(!Array.isArray(list))return [];
  const out=[];
  for(const item of list){
    if(!isObject(item)||!str(item.muscle,1,80))continue;
    const importance=finite(item.importance,1,5)?item.importance:(typeof item.importance==='string'?IMPORTANCE_LEVELS[item.importance]:null);
    out.push({
      muscle:item.muscle.trim(),
      rank:int(item.rank,1,99)?item.rank:out.length+1,
      importance:finite(importance,1,5)?importance:3
    });
  }
  return out.sort((a,b)=>a.rank-b.rank||b.importance-a.importance);
}

function normalizeMassGainGenerationInput(raw){
  const input=isObject(raw)?clone(raw):{};
  input.schemaVersion=input.schemaVersion||SCHEMA_VERSION;
  input.request=isObject(input.request)?input.request:{};
  input.request.id=input.request.id||null;
  input.request.requestedAt=input.request.requestedAt||new Date().toISOString();
  input.user=isObject(input.user)?input.user:{};
  input.trainingProfile=isObject(input.trainingProfile)?input.trainingProfile:{};
  input.trainingProfile.experienceLevel=input.trainingProfile.experienceLevel||'novice';
  input.trainingProfile.experienceMonths=Number.isFinite(input.trainingProfile.experienceMonths)?input.trainingProfile.experienceMonths:0;
  input.trainingProfile.consistency=input.trainingProfile.consistency||'returning';
  input.trainingProfile.weeksSinceLast=Number.isFinite(input.trainingProfile.weeksSinceLast)?input.trainingProfile.weeksSinceLast:0;
  input.trainingProfile.equipmentProfile='full_gym';
  input.goal=isObject(input.goal)?input.goal:{};
  input.goal.type=input.goal.type||'mass_gain';
  input.goal.gainPace=normalizeGainPace(input.goal.gainPace,input.goal.currentWeightKg||input.user.weightKg);
  input.goal.targetDate=input.goal.targetDate||null;
  input.goal.musclePriorities=normalizePriorities(input.goal.musclePriorities);
  input.availability=isObject(input.availability)?input.availability:{};
  input.availability.daysPerWeek=Number.isInteger(input.availability.daysPerWeek)?input.availability.daysPerWeek:4;
  input.availability.weekdays=Array.isArray(input.availability.weekdays)?uniq(input.availability.weekdays.filter(x=>int(x,1,7))):[];
  input.availability.maxSessionMinutes=Number.isFinite(input.availability.maxSessionMinutes)?input.availability.maxSessionMinutes:75;
  input.availability.startDate=input.availability.startDate||todayISO();
  input.availability.timezone=input.availability.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Paris';
  input.constraints=isObject(input.constraints)?input.constraints:{};
  input.constraints.healthStatus=input.constraints.healthStatus||'ok';
  input.constraints.reportedIssues=Array.isArray(input.constraints.reportedIssues)?input.constraints.reportedIssues.map(String).filter(Boolean):[];
  input.constraints.excludedExerciseIds=Array.isArray(input.constraints.excludedExerciseIds)?uniq(input.constraints.excludedExerciseIds.map(String).filter(Boolean)):[];
  input.constraints.excludedMovementTags=Array.isArray(input.constraints.excludedMovementTags)?uniq(input.constraints.excludedMovementTags.map(String).filter(Boolean)):[];
  input.otherActivities=Array.isArray(input.otherActivities)?input.otherActivities:[];
  input.performanceReferences=Array.isArray(input.performanceReferences)?input.performanceReferences:[];
  input.trainingHistory=Array.isArray(input.trainingHistory)?input.trainingHistory:[];
  input.planning=isObject(input.planning)?input.planning:{};
  input.planning.requestedHorizonWeeks=int(input.planning.requestedHorizonWeeks,4,52)?input.planning.requestedHorizonWeeks:20;
  input.planning.allowStrengthBlocks=input.planning.allowStrengthBlocks!==false;
  input.planning.existingProgramId=input.planning.existingProgramId||null;
  return input;
}

function validateMassGainGenerationInput(raw){
  const value=normalizeMassGainGenerationInput(raw),errors=[],warnings=[];
  if(!VALID_GOALS.has(value.goal.type))errors.push({path:'goal.type',code:'unsupported_goal',message:'Cette version du moteur génère uniquement des programmes de prise de masse.'});
  if(!finite(value.goal.currentWeightKg,30,300))errors.push({path:'goal.currentWeightKg',code:'invalid_weight',message:'Poids actuel requis entre 30 et 300 kg.'});
  if(!finite(value.goal.targetWeightKg,30,350))errors.push({path:'goal.targetWeightKg',code:'invalid_target_weight',message:'Poids cible requis entre 30 et 350 kg.'});
  if(finite(value.goal.currentWeightKg,30,300)&&finite(value.goal.targetWeightKg,30,350)&&value.goal.targetWeightKg<=value.goal.currentWeightKg)errors.push({path:'goal.targetWeightKg',code:'target_not_above_current',message:'Pour une prise de masse, le poids cible doit être supérieur au poids actuel.'});
  if(!VALID_EXPERIENCE.has(value.trainingProfile.experienceLevel))errors.push({path:'trainingProfile.experienceLevel',code:'invalid_experience',message:'Niveau d’expérience non reconnu.'});
  if(!int(value.availability.daysPerWeek,3,6))errors.push({path:'availability.daysPerWeek',code:'unsupported_frequency',message:'Le générateur V1 prend en charge 3 à 6 séances de musculation par semaine.'});
  if(!finite(value.availability.maxSessionMinutes,35,180))errors.push({path:'availability.maxSessionMinutes',code:'invalid_session_duration',message:'Durée de séance attendue entre 35 et 180 minutes.'});
  if(!isoDate(value.availability.startDate))errors.push({path:'availability.startDate',code:'invalid_start_date',message:'Date de début invalide.'});
  if(value.goal.targetDate&&!isoDate(value.goal.targetDate))errors.push({path:'goal.targetDate',code:'invalid_target_date',message:'Date cible invalide.'});
  if(!VALID_HEALTH_STATUS.has(value.constraints.healthStatus))errors.push({path:'constraints.healthStatus',code:'invalid_health_status',message:'Statut de santé non reconnu.'});
  if(value.constraints.healthStatus==='needs_clearance')errors.push({path:'constraints.healthStatus',code:'clearance_required',message:'La génération est bloquée tant que le profil indique qu’un feu vert est nécessaire.'});
  for(let i=0;i<value.performanceReferences.length;i++){
    const r=value.performanceReferences[i];
    if(!isObject(r)||!str(r.exerciseId,1,160)||!VALID_LOAD_CONVENTIONS.has(r.loadConvention)||!finite(r.loadKg,0,2000)||!int(r.reps,1,100)||!finite(r.rir??0,0,5))errors.push({path:`performanceReferences[${i}]`,code:'invalid_reference',message:'Référence de performance invalide.'});
  }
  const ranks=value.goal.musclePriorities.map(x=>x.rank);if(ranks.length!==new Set(ranks).size)warnings.push({path:'goal.musclePriorities',code:'duplicate_priority_rank',message:'Plusieurs priorités ont le même rang ; l’importance départagera les volumes.'});
  if(value.goal.targetDate&&finite(value.goal.currentWeightKg,30,300)&&finite(value.goal.targetWeightKg,30,350)){
    const start=new Date(value.availability.startDate+'T12:00:00Z'),target=new Date(value.goal.targetDate+'T12:00:00Z'),weeks=(target-start)/604800000;
    if(weeks<=0)errors.push({path:'goal.targetDate',code:'target_date_before_start',message:'La date cible doit être postérieure au début du programme.'});
    else{
      const requiredPct=(Math.pow(value.goal.targetWeightKg/value.goal.currentWeightKg,1/weeks)-1)*100;
      value.goal.requiredBodyweightPctPerWeek=Number(requiredPct.toFixed(3));
      if(requiredPct>value.goal.gainPace.targetBodyweightPctPerWeek*1.35)warnings.push({path:'goal.targetDate',code:'target_date_aggressive',message:`La date cible demanderait environ ${requiredPct.toFixed(2)} % du poids corporel par semaine, au-dessus du rythme choisi (${value.goal.gainPace.targetBodyweightPctPerWeek.toFixed(2)} %).`});
    }
  }
  if(value.constraints.reportedIssues.length&&value.constraints.healthStatus==='managed'&&!value.constraints.excludedExerciseIds.length&&!value.constraints.excludedMovementTags.length)warnings.push({path:'constraints',code:'managed_without_exclusions',message:'Des problèmes sont signalés mais aucun mouvement/exercice n’est explicitement exclu. Le moteur ne devine pas les contre-indications.'});
  return {ok:errors.length===0,errors,warnings,value};
}

const progressionPolicies={
  hypertrophyDoubleProgression:{
    id:'hypertrophy-double-progression',version:POLICY_VERSION,
    appliesTo:['hypertrophy','hypertrophy_heavy','volume'],
    increase:{when:'all_work_sets_at_rep_max_and_rir_at_or_above_target',action:'increase_load_by_exercise_increment'},
    maintain:{when:'sets_inside_rep_range_without_failure',action:'keep_load_and_add_reps'},
    reduce:{when:'repeated_below_rep_min_or_unplanned_rir0',action:'reduce_load_one_increment_or_5_percent'},
    recalibrate:{when:'no_reliable_history_or_exercise_identity_changed_or_machine_variant_changed',action:'run_exercise_specific_calibration'},
    transfer:{sameExerciseIdOnly:true,differentMachineOrVariant:'never_transfer_automatically'}
  },
  strengthTension:{
    id:'strength-tension-e1rm',version:POLICY_VERSION,
    appliesTo:['strength_tension'],
    increase:{when:'prescribed_reps_completed_with_target_rir',action:'increase_next_exposure_by_small_increment'},
    maintain:{when:'reps_completed_but_rir_below_target',action:'keep_load'},
    reduce:{when:'multiple_missed_reps_or_unplanned_failure',action:'reduce_2_5_to_7_5_percent'},
    recalibrate:{when:'reference_older_than_block_or_material_change',action:'refresh_performance_reference'},
    transfer:{sameExerciseIdOnly:true,differentMachineOrVariant:'never_transfer_automatically'}
  }
};

const calibrationPolicy={
  id:'exercise-specific-calibration',version:POLICY_VERSION,
  rules:{
    start:'use_recent_reference_or_conservative_known_workload',
    unknown:'choose_a_load_allowing_target_rep_range_with_2_to_3_rir',
    stop:'save_first_stable_working_load_for_this_exact_exercise_id',
    machineVariant:'different_machine_or_variant_requires_its_own_calibration_unless_explicitly_linked'
  }
};

const schemas={
  MassGainGenerationInput:{version:SCHEMA_VERSION,required:['trainingProfile','goal','availability','constraints','planning'],notes:'gainPace est converti en % du poids corporel/semaine ; targetDate reste facultative.'},
  GeneratedProgram:{version:SCHEMA_VERSION,required:['id','revision','goalSnapshot','blocks','weeks','progressionPolicies','calibrationPolicy']},
  CompletedSession:{version:SCHEMA_VERSION,required:['id','programId','weekNumber','sessionId','completedAt','exercises']},
  WeeklyReview:{version:SCHEMA_VERSION,required:['id','programId','weekNumber','createdAt','bodyweightTrend','trainingSummary','decision']}
};

function defaultCoachingState(){return {schemaVersion:SCHEMA_VERSION,activeProgramId:null,generatedPrograms:[],weeklyReviews:[],progressionEvents:[],lastGenerationInput:null};}
function normalizeCoachingState(raw){const base=defaultCoachingState();if(!isObject(raw))return base;return {
  ...base,...raw,
  schemaVersion:SCHEMA_VERSION,
  generatedPrograms:Array.isArray(raw.generatedPrograms)?raw.generatedPrograms:[],
  weeklyReviews:Array.isArray(raw.weeklyReviews)?raw.weeklyReviews:[],
  progressionEvents:Array.isArray(raw.progressionEvents)?raw.progressionEvents:[]
};}

function validateGeneratedProgram(program){const errors=[];
  if(!isObject(program))return {ok:false,errors:[{path:'program',code:'invalid_program',message:'Programme absent ou invalide.'}]};
  if(!str(program.id,1,160))errors.push({path:'id',code:'missing_id',message:'Identifiant du programme manquant.'});
  if(!int(program.revision,1,9999))errors.push({path:'revision',code:'invalid_revision',message:'Révision invalide.'});
  if(!Array.isArray(program.blocks)||!program.blocks.length)errors.push({path:'blocks',code:'missing_blocks',message:'Le programme doit contenir des blocs.'});
  if(!Array.isArray(program.weeks)||!program.weeks.length)errors.push({path:'weeks',code:'missing_weeks',message:'Le programme doit contenir des semaines.'});
  if(Array.isArray(program.weeks))for(const [wi,w] of program.weeks.entries()){
    if(!int(w.weekNumber,1,52)||!Array.isArray(w.sessions))errors.push({path:`weeks[${wi}]`,code:'invalid_week',message:'Semaine invalide.'});
    for(const [si,s] of (w.sessions||[]).entries())for(const [ei,e] of (s.exercises||[]).entries()){
      if(!str(e.exerciseId,1,180)||!int(e.sets,1,12)||!isObject(e.repRange)||!int(e.repRange.min,1,100)||!int(e.repRange.max,1,100)||e.repRange.min>e.repRange.max||!finite(e.rirTarget,0,5)||!int(e.restSeconds,15,900))errors.push({path:`weeks[${wi}].sessions[${si}].exercises[${ei}]`,code:'invalid_exercise_prescription',message:'Prescription d’exercice invalide.'});
      if(Object.hasOwn(e,'restAfterSeconds')||Object.hasOwn(e,'restBetweenSetsSeconds'))errors.push({path:`weeks[${wi}].sessions[${si}].exercises[${ei}]`,code:'ambiguous_rest',message:'Une seule source de vérité est autorisée : restSeconds.'});
    }
  }
  return {ok:errors.length===0,errors};
}

const api={SCHEMA_VERSION,POLICY_VERSION,GAIN_PACE_PRESETS,schemas,progressionPolicies,calibrationPolicy,normalizeGainPace,normalizePriorities,normalizeMassGainGenerationInput,validateMassGainGenerationInput,validateGeneratedProgram,defaultCoachingState,normalizeCoachingState};
global.MuscuCoachDomain=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
