(function(global){
'use strict';

const VERSION='1.0.0';
const ACTIVITY_FACTORS={
  low:{label:'Plutôt sédentaire',factor:1.35},
  moderate:{label:'Actif au quotidien',factor:1.50},
  high:{label:'Très actif',factor:1.65},
  very_high:{label:'Travail physique / très gros volume',factor:1.80}
};
const SEX_OFFSETS={male:5,female:-161,other:-78,prefer_not:-78};
const GAIN_PACE_PCT={controlled:0.25,normal:0.50,aggressive:0.75};
const roundTo=(value,step)=>Math.round(value/step)*step;
const finite=(v,min=-Infinity,max=Infinity)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const clone=v=>JSON.parse(JSON.stringify(v));

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

function calculateInitialNutritionTarget(profile,goal={}){
  const check=validateProfile(profile);
  if(!check.ok)return {status:'blocked',errors:check.errors};
  const p=check.value,paceKey=GAIN_PACE_PCT[goal.gainPacePreset]?goal.gainPacePreset:'normal';
  const pct=Number(goal.targetBodyweightPctPerWeek||GAIN_PACE_PCT[paceKey]);
  const bmr=calculateBmr(p),factor=ACTIVITY_FACTORS[p.activityLevel].factor;
  const tdee=bmr*factor;
  const kgPerWeek=p.currentWeightKg*pct/100;
  const surplus=Math.max(150,Math.min(650,kgPerWeek*7700/7));
  const calories=roundTo(tdee+surplus,25);
  const protein=roundTo(p.currentWeightKg*2.0,5);
  const fatFromCalories=calories*0.25/9;
  const fat=roundTo(Math.max(p.currentWeightKg*0.8,fatFromCalories),5);
  const carbs=roundTo(Math.max(50,(calories-protein*4-fat*9)/4),5);
  const confidence=(p.sex==='male'||p.sex==='female')?'estimated':'low';
  return {
    status:'calculated',
    id:global.crypto?.randomUUID?.()||('nutrition-'+Date.now()),
    effectiveFrom:new Date().toISOString().slice(0,10),
    goalType:'mass_gain',
    caloriesKcal:calories,
    proteinG:protein,
    carbsG:carbs,
    fatG:fat,
    estimatedBmrKcal:Math.round(bmr),
    estimatedTdeeKcal:Math.round(tdee),
    plannedSurplusKcal:Math.round(calories-tdee),
    targetBodyweightPctPerWeek:Number(pct.toFixed(3)),
    targetKgPerWeek:Number(kgPerWeek.toFixed(3)),
    calculationMethod:'mifflin_st_jeor_activity_surplus_v1',
    confidence,
    sourceInputs:{profile:clone(p),activityFactor:factor,gainPacePreset:paceKey},
    generatedAt:new Date().toISOString()
  };
}

function adjustNutritionTarget(currentTarget,{previousAverageWeightKg,currentAverageWeightKg,adherencePct=100}={},goal={}){
  if(!currentTarget||!finite(Number(currentTarget.caloriesKcal),500,10000))return {status:'blocked',reason:'missing_target'};
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

global.MuscuCoachProfile=Object.freeze({VERSION,ACTIVITY_FACTORS,GAIN_PACE_PCT,normalizeProfile,validateProfile,calculateBmr,calculateInitialNutritionTarget,adjustNutritionTarget});
})(typeof window!=='undefined'?window:globalThis);
