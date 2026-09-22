(function(global){
'use strict';

const VERSION='1.1.0';
/*
 * Les facteurs ci-dessous décrivent uniquement la vie quotidienne HORS entraînement.
 * Les séances de musculation sont ajoutées séparément pour éviter le double comptage.
 */
const ACTIVITY_FACTORS={
  low:{label:'Sédentaire hors entraînement',factor:1.20},
  moderate:{label:'Un peu actif hors entraînement',factor:1.30},
  high:{label:'Actif physiquement au quotidien',factor:1.45},
  very_high:{label:'Métier très physique / beaucoup de marche',factor:1.60}
};
const SEX_OFFSETS={male:5,female:-161,other:-78,prefer_not:-78};
const GAIN_PACE_PCT={controlled:0.25,normal:0.50,aggressive:0.75};
const KCAL_PER_KG_BODYWEIGHT_CHANGE=7700;
const roundTo=(value,step)=>Math.round(value/step)*step;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=(v,min=-Infinity,max=Infinity)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const clone=v=>JSON.parse(JSON.stringify(v));
const isoDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'));

function normalizeProfile(raw={}){
  return {
    displayName:String(raw.displayName||raw.name||'Athlète').trim().slice(0,60)||'Athlète',
    ageYears:Number(raw.ageYears||raw.age||0),
    sex:['male','female','other','prefer_not'].includes(raw.sex)?raw.sex:'prefer_not',
    heightCm:Number(raw.heightCm||0),
    currentWeightKg:Number(raw.currentWeightKg||raw.weightKg||raw.weight||0),
    activityLevel:ACTIVITY_FACTORS[raw.activityLevel]?raw.activityLevel:'moderate',
    experienceLevel:['beginner','novice','intermediate','advanced'].includes(raw.experienceLevel)?raw.experienceLevel:'novice',
    experienceMonths:Math.max(0,Math.round(Number(raw.experienceMonths||0))),
    consistency:String(raw.consistency||'returning'),
    otherActivities:Array.isArray(raw.otherActivities)?clone(raw.otherActivities):[],
    reportedIssues:Array.isArray(raw.reportedIssues)?raw.reportedIssues.map(String).filter(Boolean):[],
    healthStatus:['ok','managed','needs_clearance'].includes(raw.healthStatus)?raw.healthStatus:'ok'
  };
}

function validateProfile(raw){
  const value=normalizeProfile(raw),errors=[];
  if(!value.displayName)errors.push({path:'displayName',message:'Prénom ou pseudo requis.'});
  if(!finite(value.ageYears,16,90))errors.push({path:'ageYears',message:'Âge attendu entre 16 et 90 ans.'});
  if(!finite(value.heightCm,130,230))errors.push({path:'heightCm',message:'Taille attendue entre 130 et 230 cm.'});
  if(!finite(value.currentWeightKg,30,300))errors.push({path:'currentWeightKg',message:'Poids attendu entre 30 et 300 kg.'});
  return {ok:errors.length===0,value,errors};
}

function calculateBmr(profile){
  const p=normalizeProfile(profile);
  if(!finite(p.currentWeightKg,30,300)||!finite(p.heightCm,130,230)||!finite(p.ageYears,16,90))return null;
  return 10*p.currentWeightKg+6.25*p.heightCm-5*p.ageYears+(SEX_OFFSETS[p.sex]??SEX_OFFSETS.prefer_not);
}

function dateDiffDays(startDate,targetDate){
  if(!isoDate(startDate)||!isoDate(targetDate))return null;
  return (Date.parse(targetDate+'T12:00:00Z')-Date.parse(startDate+'T12:00:00Z'))/86400000;
}

function calculateGoalTimeline(profile,goal={}){
  const p=normalizeProfile(profile);
  const current=Number(goal.currentWeightKg||p.currentWeightKg),target=Number(goal.targetWeightKg),paceKey=GAIN_PACE_PCT[goal.gainPacePreset]?goal.gainPacePreset:'normal';
  const selectedPct=finite(Number(goal.targetBodyweightPctPerWeek),0.05,3)?Number(goal.targetBodyweightPctPerWeek):GAIN_PACE_PCT[paceKey];
  const startDate=String(goal.startDate||new Date().toISOString().slice(0,10)),targetDate=goal.targetDate?String(goal.targetDate):null;
  const gainKg=finite(target,30,350)&&finite(current,30,300)?Math.max(0,target-current):0;
  let exactWeeks=null,horizonWeeks=null,requiredKgPerWeek=null,requiredPctPerWeek=null,source='pace';
  if(targetDate&&isoDate(startDate)&&isoDate(targetDate)){
    const days=dateDiffDays(startDate,targetDate);
    if(days!=null&&days>0){
      exactWeeks=days/7;
      horizonWeeks=clamp(Math.ceil(days/7),1,52);
      requiredKgPerWeek=gainKg/exactWeeks;
      requiredPctPerWeek=current>0?requiredKgPerWeek/current*100:null;
      source='target_date';
    }
  }
  if(horizonWeeks==null){
    const selectedKgPerWeek=current*selectedPct/100;
    horizonWeeks=clamp(Math.ceil(gainKg/Math.max(0.05,selectedKgPerWeek)),4,52);
    exactWeeks=horizonWeeks;
    requiredKgPerWeek=gainKg/Math.max(1,exactWeeks);
    requiredPctPerWeek=current>0?requiredKgPerWeek/current*100:null;
  }
  const ratio=selectedPct>0&&requiredPctPerWeek!=null?requiredPctPerWeek/selectedPct:1;
  let feasibility='aligned',feasibilityMessage='Le rythme demandé est cohérent avec le réglage choisi.';
  if(requiredPctPerWeek!=null&&requiredPctPerWeek>1.25){
    feasibility='very_aggressive';
    feasibilityMessage=`L’échéance demande environ ${requiredKgPerWeek.toFixed(2)} kg/semaine (${requiredPctPerWeek.toFixed(2)} % du poids/semaine). C’est une trajectoire de poids total très agressive, pas une promesse de prise de muscle.`;
  }else if(ratio>1.35){
    feasibility='aggressive';
    feasibilityMessage=`L’échéance demande environ ${requiredKgPerWeek.toFixed(2)} kg/semaine, au-dessus du rythme « ${paceKey} » sélectionné.`;
  }
  return {
    source,startDate,targetDate,currentWeightKg:current,targetWeightKg:target,gainKg:Number(gainKg.toFixed(3)),
    exactWeeks:Number(exactWeeks.toFixed(3)),horizonWeeks,
    selectedBodyweightPctPerWeek:Number(selectedPct.toFixed(3)),
    requiredKgPerWeek:Number(requiredKgPerWeek.toFixed(3)),
    requiredBodyweightPctPerWeek:Number(requiredPctPerWeek.toFixed(3)),
    feasibility,feasibilityMessage
  };
}

function estimateTrainingCaloriesPerDay(profile,goal={}){
  const p=normalizeProfile(profile),days=clamp(Math.round(Number(goal.daysPerWeek||0)),0,7),maxMinutes=clamp(Number(goal.maxSessionMinutes||0),0,180);
  if(!days||!maxMinutes)return {dailyKcal:0,weeklyKcal:0,effectiveMinutesPerSession:0,met:5};
  // La durée saisie est un maximum : on estime 80 % de ce créneau comme temps réellement actif.
  const effectiveMinutes=Math.min(90,maxMinutes*0.80),met=5;
  // Calories nettes au-dessus du repos : (MET - 1) × 3.5 × kg / 200 × minutes.
  const sessionKcal=(met-1)*3.5*p.currentWeightKg/200*effectiveMinutes;
  const weeklyKcal=sessionKcal*days;
  return {dailyKcal:weeklyKcal/7,weeklyKcal,effectiveMinutesPerSession:effectiveMinutes,met};
}

function calculateInitialNutritionTarget(profile,goal={}){
  const check=validateProfile(profile);
  if(!check.ok)return {status:'blocked',errors:check.errors};
  const p=check.value,paceKey=GAIN_PACE_PCT[goal.gainPacePreset]?goal.gainPacePreset:'normal';
  const timeline=calculateGoalTimeline(p,{...goal,gainPacePreset:paceKey});
  const bmr=calculateBmr(p),factor=ACTIVITY_FACTORS[p.activityLevel].factor;
  const nonTrainingTdee=bmr*factor;
  const training=estimateTrainingCaloriesPerDay(p,goal);
  const tdee=nonTrainingTdee+training.dailyKcal;
  const theoreticalSurplus=Math.max(0,timeline.requiredKgPerWeek*KCAL_PER_KG_BODYWEIGHT_CHANGE/7);
  // La cible suit réellement l’objectif/date. Un garde-fou technique évite seulement les valeurs aberrantes.
  const surplus=clamp(theoreticalSurplus,150,2500);
  const calories=roundTo(tdee+surplus,25);
  const protein=roundTo(p.currentWeightKg*2.0,5);
  const fat=roundTo(clamp(calories*0.22/9,p.currentWeightKg*0.8,p.currentWeightKg*1.2),5);
  const carbs=roundTo(Math.max(50,(calories-protein*4-fat*9)/4),5);
  const confidence=(p.sex==='male'||p.sex==='female')?'estimated':'low';
  return {
    status:'calculated',
    id:global.crypto?.randomUUID?.()||('nutrition-'+Date.now()),
    effectiveFrom:timeline.startDate,
    goalType:'mass_gain',
    caloriesKcal:calories,
    proteinG:protein,
    carbsG:carbs,
    fatG:fat,
    estimatedBmrKcal:roundTo(bmr,25),
    estimatedTdeeKcal:roundTo(tdee,25),
    estimatedNonTrainingTdeeKcal:roundTo(nonTrainingTdee,25),
    estimatedTrainingKcalPerDay:roundTo(training.dailyKcal,25),
    plannedSurplusKcal:Math.round(calories-tdee),
    theoreticalSurplusKcal:Math.round(theoreticalSurplus),
    targetBodyweightPctPerWeek:timeline.requiredBodyweightPctPerWeek,
    targetKgPerWeek:timeline.requiredKgPerWeek,
    selectedBodyweightPctPerWeek:timeline.selectedBodyweightPctPerWeek,
    horizonWeeks:timeline.horizonWeeks,
    goalFeasibility:timeline.feasibility,
    goalFeasibilityMessage:timeline.feasibilityMessage,
    calculationMethod:'mifflin_daily_activity_plus_training_goal_timeline_v2',
    confidence,
    sourceInputs:{profile:clone(p),activityFactor:factor,gainPacePreset:paceKey,timeline:clone(timeline),trainingEstimate:clone(training)},
    generatedAt:new Date().toISOString()
  };
}

function adjustNutritionTarget(currentTarget,{previousAverageWeightKg,currentAverageWeightKg,adherencePct=100}={},goal={}){
  if(!currentTarget||!finite(Number(currentTarget.caloriesKcal),500,12000))return {status:'blocked',reason:'missing_target'};
  if(!finite(Number(previousAverageWeightKg),30,300)||!finite(Number(currentAverageWeightKg),30,300))return {status:'maintain',deltaKcal:0,reason:'Deux moyennes de poids sont nécessaires.'};
  const actualPct=(Number(currentAverageWeightKg)/Number(previousAverageWeightKg)-1)*100;
  const targetPct=Number(goal.targetBodyweightPctPerWeek||currentTarget.targetBodyweightPctPerWeek||0.5);
  let delta=0,reason='Progression dans la zone cible.';
  if(Number(adherencePct)>=80){
    if(actualPct<targetPct-0.15){delta=150;reason='Prise de poids sous la cible avec une bonne adhérence.';}
    else if(actualPct>targetPct+0.20){delta=-150;reason='Prise de poids au-dessus de la cible.';}
  }else reason='Adhérence insuffisante pour modifier les calories avec confiance.';
  const next=clone(currentTarget);next.id=global.crypto?.randomUUID?.()||('nutrition-'+Date.now());next.effectiveFrom=new Date().toISOString().slice(0,10);next.caloriesKcal=roundTo(Number(currentTarget.caloriesKcal)+delta,25);next.carbsG=roundTo(Math.max(50,(next.caloriesKcal-Number(next.proteinG)*4-Number(next.fatG)*9)/4),5);next.generatedAt=new Date().toISOString();next.adjustment={deltaKcal:delta,actualBodyweightPctPerWeek:Number(actualPct.toFixed(3)),targetBodyweightPctPerWeek:targetPct,adherencePct:Number(adherencePct),reason};return {status:delta===0?'maintain':'adjusted',deltaKcal:delta,reason,nextTarget:next};
}

global.MuscuCoachProfile=Object.freeze({VERSION,ACTIVITY_FACTORS,GAIN_PACE_PCT,normalizeProfile,validateProfile,calculateBmr,calculateGoalTimeline,estimateTrainingCaloriesPerDay,calculateInitialNutritionTarget,adjustNutritionTarget});
})(typeof window!=='undefined'?window:globalThis);
