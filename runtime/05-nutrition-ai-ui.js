/**
 * GLP-1 Companion v5 Phase 3 compatibility module
 * Meal scanner UI, bilingual AI result handling and manual meal entry.
 *
 * Loaded as an ordered classic script on purpose: this preserves the existing
 * shared global lexical environment and inline-handler contract while the v5
 * architecture is modularized without behavior changes.
 */
    /* ==========================================================================
       AI SCANNER (FIREBASE AI LOGIC • GEMINI 3.5 FLASH • SIN API KEY MANUAL)
       ========================================================================== */
    function resetScannerState() {
      selectedImageBase64 = null;
      pendingAiBilingualResult = null;
      const fileInput = document.getElementById('scanner-file-input');
      const previewImg = document.getElementById('scanner-preview-img');
      const placeholder = document.getElementById('scanner-placeholder-content');
      const textInput = document.getElementById('scanner-text-input');
      if (fileInput) fileInput.value = "";
      if (previewImg) {
        previewImg.src = "";
        previewImg.classList.add('hidden');
      }
      if (placeholder) placeholder.classList.remove('hidden');
      if (textInput) textInput.value = "";
    }

    function openScannerModal() {
      resetScannerState();
      document.getElementById('modal-scanner').classList.remove('hidden');
      document.getElementById('modal-scanner').classList.add('flex');
      document.getElementById('ai-results-container').classList.add('hidden');
      document.getElementById('btn-run-analysis').disabled = false;
      document.getElementById('btn-run-analysis-text').innerText = uiText('Analizar nutrientes y tolerancia gástrica','Analyze nutrition and tolerance');
      lucide.createIcons();
    }

    function closeScannerModal() {
      resetScannerState();
      document.getElementById('modal-scanner').classList.add('hidden');
      document.getElementById('modal-scanner').classList.remove('flex');
    }

    function handleImageSelected(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        const rawBase64 = evt.target.result;
        const img = new Image();
        img.onload = function() {
          const maxDimension = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxDimension || h > maxDimension) {
            if (w > h) {
              h = Math.round((h * maxDimension) / w);
              w = maxDimension;
            } else {
              w = Math.round((w * maxDimension) / h);
              h = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          selectedImageBase64 = canvas.toDataURL('image/jpeg', 0.85);
          const imgEl = document.getElementById('scanner-preview-img');
          imgEl.src = selectedImageBase64;
          imgEl.classList.remove('hidden');
          document.getElementById('scanner-placeholder-content').classList.add('hidden');
        };
        img.src = rawBase64;
      };
      reader.readAsDataURL(file);
    }

    function classifyAiFailure(error) {
      const message=String(error?.message||error||'').toLowerCase();
      const code=String(error?.code||error?.status||'').toLowerCase();
      const combined=`${code} ${message}`;
      if(typeof navigator!=='undefined' && navigator.onLine===false) return {recoverable:false,reason:'offline'};
      const nonRecoverable=[
        'app-check','appcheck','recaptcha','permission-denied','permission_denied','unauthenticated','unauthorized',
        'forbidden','invalid-api-key','api key not valid','auth/','authentication','401','403'
      ];
      if(nonRecoverable.some(x=>combined.includes(x))) return {recoverable:false,reason:'security'};
      const recoverable=[
        'resource-exhausted','resource_exhausted','too many requests','429','unavailable','service unavailable',
        'deadline-exceeded','deadline_exceeded','timeout','timed out','internal','500','502','503','504',
        'temporar','overload','capacity','empty firebase ai logic response','unexpected token','json'
      ];
      if(error instanceof SyntaxError || recoverable.some(x=>combined.includes(x))) return {recoverable:true,reason:'temporary_or_invalid_response'};
      // Unknown provider/model errors are allowed one fallback attempt unless they are clearly connectivity/security failures.
      return {recoverable:true,reason:'unknown_provider_error'};
    }

    async function runMealAnalysis() {
      const textQuery = document.getElementById('scanner-text-input').value.trim();
      if (!selectedImageBase64 && !textQuery) {
        showToast(uiText("Adjunta una foto o escribe una descripción del plato.", "Attach a photo or enter a meal description."));
        return;
      }
      if (typeof window.firebaseAiAnalyzeMeal !== 'function' || window.firebaseAiLogicReady === false) {
        document.getElementById('ai-results-container').classList.add('hidden');
        showToast(uiText("Firebase AI Logic aún no está disponible. Puedes usar la entrada manual.", "Firebase AI Logic is not available yet. You can use manual entry."));
        openManualMealModal();
        return;
      }

      const medLabel = getMedicationLabel(getMedicationProfile(), true);
      const btn = document.getElementById('btn-run-analysis');
      const btnText = document.getElementById('btn-run-analysis-text');
      btn.disabled = true;
      btnText.innerText = uiText("Analizando con IA principal...", "Analyzing with primary AI...");
      const systemPrompt = `You are a nutrition-analysis assistant for a GLP-1 tracking app.
Medication logged: ${medLabel}.
Analyze only the food shown in the image and/or described by the user. Estimate calories and macronutrients from the actual meal details; never reuse fixed example values. Return the meal name naturally in BOTH Spanish (foodNameEs) and English (foodNameEn), plus a concise neutral GLP-1 tolerance-tracking note in BOTH Spanish (tipEs) and English (tipEn). The numeric calories/protein/carbs/fat values are shared across languages. Do not diagnose, do not recommend medication changes, and do not invent unsupported ingredients. If portion size is uncertain, use a reasonable small-to-medium homemade portion estimate and mention that uncertainty briefly in both tolerance notes.`;
      const prompt = textQuery
        ? `User meal details (may be written in Spanish or English): ${textQuery}. Analyze the same meal and return both language text fields.`
        : `Analyze the foods visible in this image for ${medLabel}. Return both Spanish and English meal names/tolerance notes plus one shared set of nutrition estimates.`;
      let imageData=null,mimeType=null;
      if(selectedImageBase64){const pieces=selectedImageBase64.split(',');imageData=pieces[1]||null;mimeType=(pieces[0]||'').split(';')[0].replace('data:','')||'image/jpeg';}

      let telemetryChanged=false;
      try {
        const t0=performance.now();
        try {
          const parsed=await window.firebaseAiAnalyzeMeal({systemPrompt,prompt,imageBase64:imageData,mimeType,modelName:AI_PRIMARY_MODEL});
          recordAiAttempt('primary',true,performance.now()-t0); telemetryChanged=true;
          populateAiResults(parsed,"Firebase AI Logic • Gemini 3.5 Flash");
          persistState({userMutation:true}); renderAiStatus();
          return;
        } catch(primaryError) {
          const classification=classifyAiFailure(primaryError);
          if(!classification.recoverable) {
            // Connectivity/App Check/auth failures are infrastructure blocks, not model failures;
            // do not distort the model reliability counters or waste a fallback request.
            console.warn('Primary AI blocked by a non-model error; fallback skipped:',primaryError);
            document.getElementById('ai-results-container').classList.add('hidden');
            const offline=classification.reason==='offline';
            showToast(offline?uiText('Sin conexión. No se intentó el respaldo; se abrió la captura manual.','Offline. Fallback was not attempted; manual entry was opened.'):uiText('La IA no pudo usarse por App Check, autenticación o permisos. No se intentó el respaldo; se abrió la captura manual.','AI could not be used because of App Check, authentication, or permissions. Fallback was not attempted; manual entry was opened.'),5000);
            openManualMealModal();
            return;
          }
          recordAiAttempt('primary',false,performance.now()-t0); recordAiFailover(); telemetryChanged=true;
          console.warn('Primary AI failed with a recoverable error; trying fallback:',primaryError);
          btnText.innerText=uiText("Error temporal; usando respaldo...","Temporary error; using fallback...");
        }

        const t1=performance.now();
        try {
          const parsed=await window.firebaseAiAnalyzeMeal({systemPrompt,prompt,imageBase64:imageData,mimeType,modelName:AI_FALLBACK_MODEL});
          recordAiAttempt('fallback',true,performance.now()-t1); telemetryChanged=true;
          populateAiResults(parsed,uiText("Firebase AI Logic • Gemini 3.5 Flash Lite (respaldo)","Firebase AI Logic • Gemini 3.5 Flash Lite (fallback)"));
          persistState({userMutation:true}); renderAiStatus();
          showToast(uiText('La IA principal falló; el respaldo completó el análisis.','Primary AI failed; fallback completed the analysis.'));
          return;
        } catch(fallbackError) {
          recordAiAttempt('fallback',false,performance.now()-t1); telemetryChanged=true;
          console.warn('Fallback AI also failed:',fallbackError);
          document.getElementById('ai-results-container').classList.add('hidden');
          persistState({userMutation:true}); renderAiStatus();
          showToast(uiText('Ambas IA fallaron. No se inventaron valores; se abrió la captura manual guiada.','Both AI models failed. No values were invented; guided manual entry was opened.'),5000);
          openManualMealModal();
        }
      } finally {
        if(telemetryChanged) renderAiStatus();
        btn.disabled=false;
        btnText.innerText=uiText("Analizar nutrientes y tolerancia gástrica","Analyze nutrition and tolerance");
      }
    }

    function populateAiResults(data, sourceLabel) {
      const safeNumber = (value) => {
        const n = Number(value);
        return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : '';
      };
      const foodNameEs=String(data?.foodNameEs || data?.foodName || 'Plato analizado').trim();
      const foodNameEn=String(data?.foodNameEn || data?.foodName || 'Analyzed meal').trim();
      const tipEs=String(data?.tipEs || data?.mounjaroTip || 'Estimación de IA disponible para revisión manual.').trim();
      const tipEn=String(data?.tipEn || data?.mounjaroTip || 'AI estimate available for manual review.').trim();
      pendingAiBilingualResult={foodNameEs,foodNameEn,tipEs,tipEn,sourceLabel:String(sourceLabel||'')};
      document.getElementById('res-food-name').value = isEnglish()?foodNameEn:foodNameEs;
      document.getElementById('res-cal').value = safeNumber(data?.calories);
      document.getElementById('res-protein').value = safeNumber(data?.protein);
      document.getElementById('res-carbs').value = safeNumber(data?.carbs);
      document.getElementById('res-fat').value = safeNumber(data?.fat);
      document.getElementById('res-glp1-tip').innerText = isEnglish()?tipEn:tipEs;

      const badgeText = document.getElementById('ai-source-text');
      if (badgeText) badgeText.innerText = sourceLabel || uiText('Análisis listo (Ajustable)', 'Analysis ready (Editable)');
      document.getElementById('ai-results-container').classList.remove('hidden');
      lucide.createIcons();
    }

    function commitScannedMeal() {
      const visibleName = document.getElementById('res-food-name').value.trim() || uiText('Plato escaneado', 'Scanned meal');
      const calories = Math.max(0, Number(document.getElementById('res-cal').value) || 0);
      const protein = Math.max(0, Number(document.getElementById('res-protein').value) || 0);
      const carbs = Math.max(0, Number(document.getElementById('res-carbs').value) || 0);
      const fat = Math.max(0, Number(document.getElementById('res-fat').value) || 0);
      const visibleTip = document.getElementById('res-glp1-tip').innerText.trim();
      const slot = document.getElementById('scanner-meal-slot').value;
      const pair=pendingAiBilingualResult||{foodNameEs:visibleName,foodNameEn:visibleName,tipEs:visibleTip,tipEn:visibleTip,sourceLabel:''};
      if(isEnglish()) pair.foodNameEn=visibleName; else pair.foodNameEs=visibleName;
      if(isEnglish()) pair.tipEn=visibleTip; else pair.tipEs=visibleTip;
      const name=isEnglish()?pair.foodNameEn:pair.foodNameEs;
      const tip=isEnglish()?pair.tipEn:pair.tipEs;

      const day = getSelectedDay();
      const mealId = 'meal_' + Date.now();
      if (state.deletedRecords && state.deletedRecords.meals) delete state.deletedRecords.meals[mealId];
      day.meals.push({
        id: mealId,
        name,
        nameEs: pair.foodNameEs || name,
        nameEn: pair.foodNameEn || name,
        calories, protein, carbs, fat,
        tip,
        tipEs: pair.tipEs || tip,
        tipEn: pair.tipEn || tip,
        aiGenerated:true,
        analysisLanguage:'bilingual',
        analysisSource:pair.sourceLabel||'',
        slot,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        updatedAt: mutationNow()
      });

      persistState({ userMutation: true });
      closeScannerModal();
      updateDashboardView();
      checkFoodSymptomCorrelation();
      showToast(uiText('¡Comida guardada en español e inglés!', 'Meal saved in English and Spanish!'));
    }

    async function translateSavedMeal(idx) {
      const day=getSelectedDay(), meal=Array.isArray(day.meals)?day.meals[Number(idx)]:null;if(!meal)return;
      if(meal.nameEs&&meal.nameEn&&meal.tipEs&&meal.tipEn){renderMealsList();return;}
      if(typeof navigator!=='undefined'&&navigator.onLine===false){showToast(uiText('Conéctate a internet para crear la versión bilingüe una sola vez.','Connect to the internet to create the bilingual version once.'));return;}
      if(typeof window.firebaseAiTranslateMeal!=='function'||window.firebaseAiLogicReady===false){showToast(uiText('Firebase AI Logic no está disponible para traducir ahora.','Firebase AI Logic is not available for translation right now.'));return;}
      const sourceName=String(meal.name||meal.nameEs||meal.nameEn||uiText('Comida','Meal'));
      const sourceTip=String(meal.tip||meal.tipEs||meal.tipEn||'');
      if(!sourceTip){showToast(uiText('Este registro no tiene análisis de IA para convertir.','This record has no AI analysis to convert.'));return;}
      showToast(uiText('Creando versión bilingüe del análisis…','Creating bilingual version of the analysis…'),5000);
      let translated=null;
      const run=async(model,role)=>{const t0=performance.now();try{const out=await window.firebaseAiTranslateMeal({foodName:sourceName,tip:sourceTip,modelName:model});recordAiAttempt(role,true,performance.now()-t0);return out;}catch(err){const c=classifyAiFailure(err);if(c.recoverable)recordAiAttempt(role,false,performance.now()-t0);throw Object.assign(err,{_classification:c});}};
      try{
        try{translated=await run(AI_PRIMARY_MODEL,'primary');}
        catch(err){const c=err._classification||classifyAiFailure(err);if(!c.recoverable)throw err;recordAiFailover();translated=await run(AI_FALLBACK_MODEL,'fallback');}
        meal.nameEs=String(translated?.foodNameEs||sourceName).trim();meal.nameEn=String(translated?.foodNameEn||sourceName).trim();meal.tipEs=String(translated?.tipEs||sourceTip).trim();meal.tipEn=String(translated?.tipEn||sourceTip).trim();
        meal.aiGenerated=true;meal.analysisLanguage='bilingual';meal.updatedAt=mutationNow();recordAiTranslation();persistState({userMutation:true});renderMealsList();renderAiStatus();showToast(uiText('Versión bilingüe guardada. No será necesario volver a generarla.','Bilingual version saved. It will not need to be generated again.'));
      }catch(err){console.warn('Saved meal bilingual conversion failed',err);persistState({userMutation:true});renderAiStatus();showToast(uiText('No se pudo crear la versión bilingüe ahora.','The bilingual version could not be created right now.'),5000);}
    }

    function openManualMealModal() {
      document.getElementById('modal-manual-meal').classList.remove('hidden');
      document.getElementById('modal-manual-meal').classList.add('flex');
    }

    function closeManualMealModal() {
      document.getElementById('modal-manual-meal').classList.add('hidden');
      document.getElementById('modal-manual-meal').classList.remove('flex');
    }

    function saveManualMeal() {
      const name = document.getElementById('manual-name').value.trim() || uiText("Comida", "Meal");
      const slot = document.getElementById('manual-slot').value;
      const calories = Math.max(0, Number(document.getElementById('manual-cal').value) || 0);
      const protein = Math.max(0, Number(document.getElementById('manual-protein').value) || 0);
      const carbs = Math.max(0, Number(document.getElementById('manual-carbs').value) || 0);
      const fat = Math.max(0, Number(document.getElementById('manual-fat').value) || 0);

      const day = getSelectedDay();
      const mealId = "meal_" + Date.now();
      if (state.deletedRecords && state.deletedRecords.meals) {
        delete state.deletedRecords.meals[mealId];
      }
      day.meals.push({
        id: mealId,
        name,
        calories,
        protein,
        carbs,
        fat,
        slot,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        updatedAt: mutationNow()
      });

      persistState({ userMutation: true });
      closeManualMealModal();
      updateDashboardView();
      checkFoodSymptomCorrelation();
      showToast(uiText("Comida registrada manualmente.", "Meal added manually."));
    }

