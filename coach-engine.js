(function(global){
'use strict';
const D=global.MuscuCoachDomain;if(!D)throw new Error('MuscuCoachDomain doit être chargé avant coach-engine.js');
const clone=v=>JSON.parse(JSON.stringify(v));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const addDays=(iso,days)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};

const MUSCLE_ALIASES={
  pecs:'pectoraux',pectoraux:'pectoraux',chest:'pectoraux',
  dos:'dos',back:'dos',
  epaules:'epaules','épaules':'epaules',deltoides:'epaules','deltoïdes':'epaules',
  biceps:'biceps',triceps:'triceps',bras:'bras',
  quadriceps:'quadriceps',quads:'quadriceps',
  ischios:'ischios','ischio jambiers':'ischios','ischio-jambiers':'ischios',hamstrings:'ischios',
  fessiers:'fessiers',glutes:'fessiers',
  mollets:'mollets',calves:'mollets'
};
function muscleKey(s){return MUSCLE_ALIASES[norm(s)]||norm(s).replace(/ /g,'_')}

const EXERCISE_META={
  'Développé couché':{muscles:['pectoraux','triceps','epaules'],tags:['horizontal_press','barbell','compound'],main:true},
  'Développé incliné haltères':{muscles:['pectoraux','epaules','triceps'],tags:['incline_press','dumbbell','compound'],main:true},
  'Chest press':{muscles:['pectoraux','triceps'],tags:['horizontal_press','machine'],main:false},
  'Écartés poulie':{muscles:['pectoraux'],tags:['chest_fly','cable','isolation']},
  'Écartés poulie basse':{muscles:['pectoraux'],tags:['chest_fly','cable','isolation']},
  'Développé militaire':{muscles:['epaules','triceps'],tags:['vertical_press','barbell','compound'],main:true},
  'Élévations latérales':{muscles:['epaules'],tags:['lateral_raise','isolation']},
  'Élévations latérales poulie':{muscles:['epaules'],tags:['lateral_raise','cable','isolation']},
  'Reverse pec-deck':{muscles:['epaules','dos'],tags:['rear_delt','machine','isolation']},
  'Tractions lestées':{muscles:['dos','biceps'],tags:['vertical_pull','bodyweight','compound'],main:true},
  'Tirage vertical neutre':{muscles:['dos','biceps'],tags:['vertical_pull','cable']},
  'Rowing poitrine appuyée':{muscles:['dos','biceps'],tags:['horizontal_pull','machine','compound'],main:true},
  'Rowing unilatéral poulie basse':{muscles:['dos','biceps'],tags:['horizontal_pull','cable']},
  'Pullover poulie':{muscles:['dos'],tags:['shoulder_extension','cable','isolation']},
  'Curl EZ':{muscles:['biceps'],tags:['elbow_flexion','isolation']},
  'Curl incliné':{muscles:['biceps'],tags:['elbow_flexion','isolation']},
  'Curl marteau':{muscles:['biceps'],tags:['elbow_flexion','isolation']},
  'Curl pupitre':{muscles:['biceps'],tags:['elbow_flexion','isolation']},
  'Extension triceps poulie':{muscles:['triceps'],tags:['elbow_extension','cable','isolation']},
  'Extension triceps au-dessus tête':{muscles:['triceps'],tags:['elbow_extension','cable','isolation']},
  'Pushdown corde':{muscles:['triceps'],tags:['elbow_extension','cable','isolation']},
  'Squat':{muscles:['quadriceps','fessiers'],tags:['squat','barbell','compound'],main:true},
  'Hack squat':{muscles:['quadriceps','fessiers'],tags:['squat','machine','compound'],main:true},
  'Presse à cuisses':{muscles:['quadriceps','fessiers'],tags:['leg_press','machine','compound']},
  'Presse pieds hauts':{muscles:['fessiers','ischios','quadriceps'],tags:['leg_press','machine','compound']},
  'Fentes bulgares':{muscles:['quadriceps','fessiers'],tags:['single_leg','compound']},
  'Leg extension':{muscles:['quadriceps'],tags:['knee_extension','machine','isolation']},
  'Leg curl':{muscles:['ischios'],tags:['knee_flexion','machine','isolation']},
  'Soulevé de terre roumain':{muscles:['ischios','fessiers'],tags:['hinge','barbell','compound'],main:true},
  'Hip thrust':{muscles:['fessiers'],tags:['hip_extension','barbell','compound']},
  'Mollets':{muscles:['mollets'],tags:['calf_raise','isolation']}
};

const SPLITS={
  3:[
    {name:'Full body A',focus:'Tension globale',ex:['Squat','Développé couché','Rowing poitrine appuyée','Soulevé de terre roumain','Élévations latérales','Curl EZ','Extension triceps poulie']},
    {name:'Full body B',focus:'Hypertrophie globale',ex:['Presse à cuisses','Développé incliné haltères','Tirage vertical neutre','Hip thrust','Leg curl','Écartés poulie','Mollets']},
    {name:'Full body C',focus:'Volume global',ex:['Hack squat','Chest press','Tractions lestées','Fentes bulgares','Reverse pec-deck','Curl incliné','Pushdown corde']}
  ],
  4:[
    {name:'Haut A',focus:'Tension',ex:['Développé couché','Rowing poitrine appuyée','Développé militaire','Tirage vertical neutre','Écartés poulie','Curl EZ','Extension triceps poulie']},
    {name:'Bas A',focus:'Quadriceps',ex:['Squat','Presse à cuisses','Fentes bulgares','Leg extension','Leg curl','Mollets']},
    {name:'Haut B',focus:'Volume',ex:['Développé incliné haltères','Tractions lestées','Chest press','Rowing unilatéral poulie basse','Élévations latérales','Curl incliné','Pushdown corde']},
    {name:'Bas B',focus:'Chaîne postérieure',ex:['Soulevé de terre roumain','Hack squat','Hip thrust','Presse pieds hauts','Leg curl','Leg extension','Mollets']}
  ],
  5:[
    {name:'Push',focus:'Pectoraux · épaules · triceps',ex:['Développé couché','Développé incliné haltères','Chest press','Écartés poulie','Développé militaire','Élévations latérales','Extension triceps poulie']},
    {name:'Pull',focus:'Dos · biceps',ex:['Tractions lestées','Rowing poitrine appuyée','Tirage vertical neutre','Rowing unilatéral poulie basse','Pullover poulie','Curl EZ','Curl incliné']},
    {name:'Jambes',focus:'Bas du corps',ex:['Squat','Soulevé de terre roumain','Presse à cuisses','Hip thrust','Leg extension','Leg curl','Mollets']},
    {name:'Haut',focus:'Volume haut',ex:['Développé incliné haltères','Chest press','Rowing poitrine appuyée','Tirage vertical neutre','Élévations latérales','Reverse pec-deck','Pushdown corde']},
    {name:'Bas',focus:'Volume bas',ex:['Hack squat','Presse pieds hauts','Fentes bulgares','Hip thrust','Leg curl','Leg extension','Mollets']}
  ],
  6:[
    {name:'Pectoraux + épaules A',focus:'Lourd / tension',ex:['Développé couché','Développé incliné haltères','Chest press','Écartés poulie','Développé militaire','Élévations latérales','Reverse pec-deck']},
    {name:'Jambes A',focus:'Quadriceps / tension',ex:['Squat','Presse à cuisses','Fentes bulgares','Leg extension','Leg curl','Mollets']},
    {name:'Dos + bras A',focus:'Lourd / tension',ex:['Tractions lestées','Rowing poitrine appuyée','Tirage vertical neutre','Rowing unilatéral poulie basse','Pullover poulie','Curl EZ','Extension triceps poulie','Curl incliné','Extension triceps au-dessus tête']},
    {name:'Pectoraux + épaules B',focus:'Volume',ex:['Développé incliné haltères','Chest press','Écartés poulie basse','Élévations latérales','Élévations latérales poulie','Reverse pec-deck','Pushdown corde']},
    {name:'Jambes B',focus:'Chaîne postérieure / volume',ex:['Soulevé de terre roumain','Hack squat','Hip thrust','Leg curl','Presse pieds hauts','Leg extension','Mollets']},
    {name:'Dos + bras B',focus:'Volume',ex:['Tirage vertical neutre','Rowing poitrine appuyée','Rowing unilatéral poulie basse','Pullover poulie','Reverse pec-deck','Curl pupitre','Pushdown corde','Curl marteau','Extension triceps au-dessus tête']}
  ]
};

function catalogIndex(catalog){const map=new Map();for(const item of catalog||[]){if(!item)continue;const name=item.name||item.nom;if(!name)continue;map.set(norm(name),{exerciseId:item.exerciseId||item.id||'exercise:'+norm(name).replace(/ /g,'_'),name,group:item.group||item.cat||'',equipment:item.equipment||item.type||''});}return map;}
function resolveExercise(name,catalogMap){return catalogMap.get(norm(name))||null}
function exerciseMeta(name){return EXERCISE_META[name]||{muscles:[],tags:[],main:false}}
function isExcluded(item,meta,input){if(input.constraints.excludedExerciseIds.includes(item.exerciseId))return true;return meta.tags.some(t=>input.constraints.excludedMovementTags.includes(t));}
function priorityBonus(meta,input){let bonus=0;for(const p of input.goal.musclePriorities){const key=muscleKey(p.muscle);if(meta.muscles.includes(key))bonus=Math.max(bonus,p.importance>=5?2:p.importance>=4?1:0);}return bonus;}
function phasePrescription(meta,block,weekInBlock,priority){
  let sets=meta.main?4:3,repRange=meta.main?{min:6,max:10}:{min:10,max:15},rir=2,restSeconds=meta.main?150:90,method='straight_sets';
  if(meta.tags.includes('isolation')){sets=3;repRange={min:12,max:20};restSeconds=75;}
  if(block.type==='calibration'){sets=meta.main?3:2;repRange=meta.main?{min:6,max:10}:{min:10,max:15};rir=3;restSeconds=meta.main?180:90;method='calibration';}
  if(block.type==='hypertrophy'){rir=clamp(3-(weekInBlock-1)*0.5,1.5,3);}
  if(block.type==='deload'){sets=Math.max(1,Math.ceil(sets*0.5));rir=4;restSeconds=Math.max(60,restSeconds-30);method='deload';}
  if(block.type==='strength_tension'){
    if(meta.main){sets=4;repRange={min:4,max:6};rir=2;restSeconds=210;method='strength_tension';}
    else{sets=Math.max(2,sets-1);repRange=meta.tags.includes('isolation')?{min:10,max:15}:{min:8,max:12};rir=2;restSeconds=meta.tags.includes('isolation')?75:120;}
  }
  if(block.type==='recalibration'){sets=meta.main?3:2;repRange=meta.main?{min:3,max:6}:{min:8,max:12};rir=2;restSeconds=meta.main?210:90;method=meta.main?'recalibration':'maintenance';}
  if(block.type==='hypertrophy_heavy'){if(meta.main){sets=4;repRange={min:6,max:8};rir=1.5;restSeconds=180;method='top_set_backoff';}else{rir=1.5;}}
  if(block.type==='volume'){sets=meta.main?3:3;repRange=meta.main?{min:8,max:12}:{min:12,max:20};rir=1.5;restSeconds=meta.main?120:60;method='volume';}
  if(priority>0&&block.type!=='deload'&&block.type!=='recalibration')sets=clamp(sets+priority,1,6);
  return {sets,repRange,rirTarget:rir,restSeconds,method};
}

function needsCalibration(input){if(!input.performanceReferences.length&&!input.trainingHistory.length)return true;const recent=input.performanceReferences.filter(r=>r.date&&Number.isFinite(Date.parse(r.date)));return recent.length<2;}
function buildBlocks(horizon,allowStrength,calibrationNeeded){const plan=[];let cursor=1,seq=0;const push=(type,weeks,label)=>{if(cursor>horizon||weeks<=0)return;const actual=Math.min(weeks,horizon-cursor+1);plan.push({id:`block_${++seq}_${type}`,type,label,startWeek:cursor,endWeek:cursor+actual-1,weeks:actual});cursor+=actual;};
  if(calibrationNeeded)push('calibration',1,'Calibration');
  push('hypertrophy',4,'Hypertrophie fondamentale');
  push('deload',1,'Deload');
  if(allowStrength)push('strength_tension',4,'Force / tension');
  push('recalibration',1,'Recalibration');
  push('hypertrophy_heavy',4,'Hypertrophie lourde');
  push('deload',1,'Deload');
  if(cursor<=horizon)push('volume',horizon-cursor+1,'Volume / congestion');
  return plan;
}
function blockForWeek(blocks,w){return blocks.find(b=>w>=b.startWeek&&w<=b.endWeek)}
function referenceFor(exerciseId,input){return [...input.performanceReferences].reverse().find(r=>r.exerciseId===exerciseId)||null}
function loadStrategy(item,meta,input,block){const ref=referenceFor(item.exerciseId,input);if(ref)return {mode:'reference',referenceId:ref.id||null,loadConvention:ref.loadConvention,sourceLoadKg:ref.loadKg,sourceReps:ref.reps,sourceRir:ref.rir};return {mode:block.type==='calibration'?'calibrate':'workload_or_calibrate',referenceId:null,loadConvention:null,sourceLoadKg:null};}
function dayAssignments(input){if(input.availability.weekdays.length===input.availability.daysPerWeek)return input.availability.weekdays;const defaults={3:[1,3,5],4:[1,2,4,5],5:[1,2,3,5,6],6:[1,2,3,4,5,6]};return defaults[input.availability.daysPerWeek];}

function generateMassGainProgram(raw,{catalog=[]}={}){
  const checked=D.validateMassGainGenerationInput(raw);if(!checked.ok)return {status:'blocked',schemaVersion:D.SCHEMA_VERSION,errors:checked.errors,warnings:checked.warnings};
  const input=checked.value,cMap=catalogIndex(catalog),warnings=[...checked.warnings],days=input.availability.daysPerWeek,split=SPLITS[days];
  if(!split)return {status:'blocked',schemaVersion:D.SCHEMA_VERSION,errors:[{path:'availability.daysPerWeek',code:'split_not_found',message:'Aucun split disponible pour cette fréquence.'}],warnings};
  if(!cMap.size)return {status:'blocked',schemaVersion:D.SCHEMA_VERSION,errors:[{path:'catalog',code:'catalog_required',message:'Le catalogue d’exercices courant doit être fourni au générateur.'}],warnings};
  const blocks=buildBlocks(input.planning.requestedHorizonWeeks,input.planning.allowStrengthBlocks,needsCalibration(input));
  const weekdays=dayAssignments(input),missing=new Set(),weeks=[];
  for(let weekNumber=1;weekNumber<=input.planning.requestedHorizonWeeks;weekNumber++){
    const block=blockForWeek(blocks,weekNumber),weekInBlock=weekNumber-block.startWeek+1;
    const sessions=split.map((tpl,idx)=>{
      const exercises=[];
      for(const name of tpl.ex){const item=resolveExercise(name,cMap);if(!item){missing.add(name);continue}const meta=exerciseMeta(name);if(isExcluded(item,meta,input))continue;const rx=phasePrescription(meta,block,weekInBlock,priorityBonus(meta,input));exercises.push({
        exerciseId:item.exerciseId,name:item.name,catalogSnapshot:{group:item.group,equipment:item.equipment},movementTags:[...meta.tags],primaryMuscles:[...meta.muscles],
        sets:rx.sets,repRange:rx.repRange,rirTarget:rx.rirTarget,restSeconds:rx.restSeconds,method:rx.method,
        loadStrategy:loadStrategy(item,meta,input,block),loadTransfer:{sameExerciseIdOnly:true,differentMachineOrVariant:'recalibrate'}
      });}
      return {id:`w${weekNumber}_s${idx+1}`,dayOfWeek:weekdays[idx],name:tpl.name,focus:tpl.focus,estimatedMinutes:Math.min(input.availability.maxSessionMinutes,Math.max(45,exercises.reduce((m,e)=>m+e.sets*(e.restSeconds/60+0.75),8))),exercises};
    });
    weeks.push({weekNumber,blockId:block.id,blockType:block.type,startDate:addDays(input.availability.startDate,(weekNumber-1)*7),sessions});
  }
  if(missing.size)warnings.push({path:'catalog',code:'missing_catalog_exercises',message:'Certains exercices du modèle ne sont pas présents dans la bibliothèque et ont été ignorés.',details:[...missing]});
  const fingerprint=hash(JSON.stringify({goal:input.goal,trainingProfile:input.trainingProfile,availability:input.availability,constraints:input.constraints,planning:input.planning,catalog:[...cMap.values()].map(x=>x.exerciseId)}));
  const program={
    schemaVersion:D.SCHEMA_VERSION,id:input.planning.existingProgramId||`program_${fingerprint}`,revision:1,status:'generated',generator:{name:'mass-gain-rules',version:'1.0.0',ai:false,rulesetVersion:'1.0.0'},
    generatedAt:new Date().toISOString(),inputSnapshot:clone(input),goalSnapshot:{type:'mass_gain',currentWeightKg:input.goal.currentWeightKg,targetWeightKg:input.goal.targetWeightKg,targetDate:input.goal.targetDate,gainPace:input.goal.gainPace,requiredBodyweightPctPerWeek:input.goal.requiredBodyweightPctPerWeek||null,requiredKgPerWeek:input.goal.requiredKgPerWeek||null,musclePriorities:input.goal.musclePriorities},
    assumptions:['Salle complète disponible.','Les charges ne sont transférées automatiquement qu’entre occurrences du même exerciseId.'],warnings,blocks,weeks,
    progressionPolicies:clone(D.progressionPolicies),calibrationPolicy:clone(D.calibrationPolicy),adaptationPolicy:{id:'weekly-adaptation-v1',version:'1.0.0',rules:['prefer_small_changes','protect_exercise_identity','respect_explicit_exclusions','deload_before_adding_fatigue']},
    nutritionContext:{goal:'mass_gain',targetBodyweightPctPerWeek:input.goal.requiredBodyweightPctPerWeek||input.goal.gainPace.targetBodyweightPctPerWeek,targetKgPerWeek:input.goal.requiredKgPerWeek||input.goal.gainPace.targetKgPerWeek,selectedBodyweightPctPerWeek:input.goal.gainPace.targetBodyweightPctPerWeek,caloriesManagedSeparately:true}
  };
  const valid=D.validateGeneratedProgram(program);if(!valid.ok)return {status:'blocked',schemaVersion:D.SCHEMA_VERSION,errors:valid.errors,warnings};
  return program;
}

global.MuscuCoachEngine=Object.freeze({version:'1.0.0',generateMassGainProgram});
})(typeof window!=='undefined'?window:globalThis);
