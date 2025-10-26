/* ------------------- DEMO DATA ------------------- */
const CATS = ["Beverages","Service","Food","QC"];
let employees, tasks, assignments, workerMeta, issues;

function seed(){
  employees = [
    {id:"EMP01", name:"Ana",  role:"Leader",   group:"A", load:0, recentCats:[], points:0, badges:[],               streak:0, achievements:["Outstanding Mentor"]},
    {id:"EMP02", name:"Luis", role:"Operator", group:"A", load:0, recentCats:[], points:0, badges:["All-Rounder"],  streak:1, achievements:["100% punctuality","Zero rework (week)"]},
    {id:"EMP03", name:"Sara", role:"Operator", group:"A", load:0, recentCats:[], points:0, badges:[],               streak:0, achievements:["Peak-time support"]},
    {id:"EMP04", name:"Diego",role:"Support",  group:"B", load:0, recentCats:[], points:0, badges:[],               streak:0, achievements:["Trained 2 new hires"]},
    {id:"EMP05", name:"María",role:"Support",  group:"B", load:0, recentCats:[], points:0, badges:["High Output"],  streak:2, achievements:["Top 3 productivity"]},
    {id:"EMP06", name:"Iván", role:"Operator", group:"B", load:0, recentCats:[], points:0, badges:[],               streak:0, achievements:["Layout optimization"]},
  ];
  tasks = [
    t("T001","Trolley LX721","Operator",5,2,"Service"),
    t("T002","Beverage restock EK088","Support",3,1,"Beverages"),
    t("T003","Final QC BA215","Leader",4,1,"QC"),
    t("T004","Cutlery AF178","Operator",2,1,"Service"),
    t("T005","Hot trays LH490","Operator",5,3,"Food"),
    t("T006","Bar inventory 1A","Support",3,1,"Beverages"),
  ];
  assignments = []; // {taskId, empId, status:'pending'|'done'|'blocked', category}
  workerMeta = {selected:"EMP02"};
  issues = []; // {id, taskId, empId, text, severity, needHelp, ts, status}
}
const t = (id,title,reqRole,priority,effort,cat)=>({id,title,reqRole,priority,effort,cat});
seed();

/* ------------------- UTIL ------------------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const badgeRole = r => `<span class="badge role-pill role-${r} text-white ms-1">${r}</span>`;
const catClass = c => `cat-${c.replace(/\s+/g,'')}`;
const pillCat = c => `<span class="badge cat-pill ${catClass(c)}">${c}</span>`;
const pillLoad = v => `<span class="badge text-bg-${v<3?'success':v<5?'warning':'danger'}">${v} pts</span>`;
function toast(msg,variant="primary"){
  const t = $("#toast");
  t.className = `toast align-items-center text-bg-${variant} border-0`;
  $("#toastMsg").textContent = msg;
  new bootstrap.Toast(t,{delay:2200}).show();
}

/* ------------------- LEADER ------------------- */
function renderEmployees(){
  const byGroup = employees.reduce((acc,e)=>((acc[e.group]??=[]).push(e),acc),{});
  $("#empList").innerHTML = Object.keys(byGroup).sort().map(g=>{
    const list = byGroup[g].sort((a,b)=>a.role.localeCompare(b.role)||a.name.localeCompare(b.name))
      .map(e=>`
        <li class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <strong>${e.name}</strong> ${badgeRole(e.role)}
            <div class="small text-muted">Tasks: ${countTasks(e.id)} · ${pillLoad(e.load)}</div>
            <div class="small">Recent variety: ${[...new Set(e.recentCats)].slice(-3).map(pillCat).join(" ")||'<span class="text-muted">--</span>'}</div>
          </div>
          <button class="btn btn-sm btn-outline-secondary" onclick="clearEmp('${e.id}')">Clear</button>
        </li>`).join("");
    return `<div class="mb-3"><h6 class="mb-2">Team <strong>${g}</strong></h6><ul class="list-group">${list}</ul></div>`;
  }).join("");
}
function renderTasks(){
  $("#taskList").innerHTML = tasks.map(t=>`
    <div class="list-group-item d-flex justify-content-between align-items-center">
      <div>
        <strong>${t.title}</strong> ${pillCat(t.cat)}
        <span class="badge text-bg-dark ms-2">${t.reqRole}</span>
        <span class="badge text-bg-warning ms-1">P${t.priority}</span>
        <span class="badge text-bg-info ms-1">E${t.effort}</span>
      </div>
      <div class="btn-group">
        <button class="btn btn-sm btn-outline-primary" onclick="openAssignModal('${t.id}')">Assign…</button>
        <button class="btn btn-sm btn-outline-danger" onclick="removeTask('${t.id}')">Remove</button>
      </div>
    </div>`).join("") || `<div class="list-group-item text-muted">Backlog is empty.</div>`;
}
function countTasks(empId){ return assignments.filter(a=>a.empId===empId && a.status!=="done").length; }

/* ---- Suggestion engine ---- */
function computeSuggestion(){
  if(!tasks.length) return null;
  const alpha = parseFloat($("#alpha").value);
  const maxTasks = parseInt($("#maxTasks").value,10);
  const varWindow = parseInt($("#varWindow").value,10);

  const maxPrio = Math.max(...tasks.map(x=>x.priority),1);
  const maxLoad = Math.max(...employees.map(x=>x.load),1);

  let best=null;
  for(const t of tasks){
    for(const e of employees){
      if(e.role!==t.reqRole) continue;
      if(countTasks(e.id)>=maxTasks) continue;

      const prio = t.priority / maxPrio;
      const load = maxLoad===0 ? 0 : (e.load/maxLoad);
      const recent = e.recentCats.slice(-varWindow);
      const diversityBonus = recent.includes(t.cat) ? 0 : 0.25;
      let score = alpha*prio + (1-alpha)*(1 - load) + diversityBonus;

      if(e.group==="A") score += 0.02; // tiny nudge to balance between teams (demo)
      if(!best || score>best.score) best = {task:t, emp:e, score};
    }
  }
  return best;
}
let lastS=null;
function showSuggestion(s){
  const box = $("#suggBox");
  if(!s){ box.innerHTML = `<div class="text-muted">No valid combination.</div>`; return; }
  box.innerHTML = `
    <div class="alert alert-primary">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <div><strong>Task:</strong> ${s.task.title} ${pillCat(s.task.cat)} <span class="badge text-bg-warning ms-1">P${s.task.priority}</span> <span class="badge text-bg-info ms-1">E${s.task.effort}</span></div>
          <div><strong>Suggested crew:</strong> ${s.emp.name} ${badgeRole(s.emp.role)} · Load ${pillLoad(s.emp.load)}</div>
        </div>
        <span class="badge text-bg-primary">Score ${s.score.toFixed(2)}</span>
      </div>
    </div>`;
}
function assignSuggestion(s){
  if(!s) return;
  assignments.push({taskId:s.task.id, empId:s.emp.id, status:"pending", category:s.task.cat});
  s.emp.load += s.task.effort;
  tasks = tasks.filter(x=>x.id!==s.task.id);
  cacheTask(s.task);
  renderTasks(); renderEmployees(); lastS=null; showSuggestion(null); refreshWorkerView();
}

/* ---- Assign modal: Team -> checklist ---- */
let currentAssignTask = null;

function uniqueTeams(){
  return [...new Set(employees.map(e=>e.group))].sort();
}

function openAssignModal(taskId){
  const t = tasks.find(x=>x.id===taskId);
  if(!t) return;
  currentAssignTask = t;
  $("#assignTaskId").value = t.id;
  $("#assignTaskTitle").textContent = t.title;
  $("#assignTaskMeta").textContent = `Required role: ${t.reqRole} - Priority P${t.priority} - Effort E${t.effort} - Category ${t.cat}`;

  // Populate team dropdown
  const teams = uniqueTeams();
  $("#assignTeam").innerHTML = teams.map(tm=>`<option value="${tm}">${tm}</option>`).join("");
  $("#assignSearch").value = "";
  buildAssignChecklist(); // build with first team selected

  new bootstrap.Modal($("#assignModal")).show();
}

function buildAssignChecklist(){
  const t = currentAssignTask;
  const team = $("#assignTeam").value;
  const q = $("#assignSearch").value.trim().toLowerCase();
  const pool = employees.filter(e=>e.role===t.reqRole && e.group===team && (!q || e.name.toLowerCase().includes(q)));
  const maxTasks = parseInt($("#maxTasks").value,10);

  const html = pool.map(e=>{
    const disabled = countTasks(e.id)>=maxTasks ? "disabled" : "";
    const title = countTasks(e.id)>=maxTasks ? " (max tasks reached)" : "";
    return `
      <label class="d-flex align-items-center gap-2 mb-1">
        <input type="checkbox" class="form-check-input assign-check" value="${e.id}" ${disabled}>
        <span>${e.name}${title} ${badgeRole(e.role)} <span class="small text-muted">· Team ${e.group} · ${pillLoad(e.load)}</span></span>
      </label>`;
  }).join("") || `<div class="text-muted">No eligible crew in this team.</div>`;

  $("#assignChecklist").innerHTML = html;
  updateAssignHint();
}

function selectedAssignIds(){
  return $$("#assignChecklist .assign-check:checked").map(i=>i.value);
}

function updateAssignHint(){
  $("#assignHint").textContent = `${selectedAssignIds().length} selected`;
}

$("#assignTeam").addEventListener("change", buildAssignChecklist);
$("#assignSearch").addEventListener("input", buildAssignChecklist);
$("#assignChecklist").addEventListener("change", updateAssignHint);
$("#assignSelectAll").addEventListener("click", ()=>{
  const checks = $$("#assignChecklist .assign-check:not(:disabled)");
  const allChecked = checks.length && checks.every(c=>c.checked);
  checks.forEach(c=>c.checked = !allChecked);
  updateAssignHint();
});

$("#assignForm").addEventListener("submit",(e)=>{
  e.preventDefault();
  if(!currentAssignTask) return;
  const selected = selectedAssignIds();
  if(!selected.length){ toast("Select at least one crew member","warning"); return; }

  selected.forEach(empId=>{
    assignments.push({taskId: currentAssignTask.id, empId, status:"pending", category: currentAssignTask.cat});
    const emp = employees.find(e=>e.id===empId);
    if(emp) emp.load += currentAssignTask.effort;
  });

  cacheTask(currentAssignTask);
  tasks = tasks.filter(x=>x.id!==currentAssignTask.id);
  currentAssignTask = null;

  bootstrap.Modal.getInstance($("#assignModal")).hide();
  renderTasks(); renderEmployees(); refreshWorkerView();
  toast("Task assigned", "success");
});

/* ---- Issues ---- */
function renderIssues(){
  const list = $("#issuesList");
  if(!issues.length){ list.innerHTML = `<div class="list-group-item text-muted">No issues yet.</div>`; return; }
  list.innerHTML = issues.slice().reverse().map(i=>{
    const emp = employees.find(e=>e.id===i.empId);
    const t = TASK_CACHE[i.taskId] || {title:i.taskId};
    return `<div class="list-group-item">
      <div class="d-flex justify-content-between">
        <div>
          <div><strong>${emp?.name||i.empId}</strong> reports: <em>${t.title}</em></div>
          <div class="small text-muted">${i.text}</div>
          <div class="small">Severity: <span class="badge text-bg-${i.severity==='high'?'danger':i.severity==='medium'?'warning':'secondary'}">${i.severity}</span> · ${i.needHelp==='yes'?'Needs leader support':''}</div>
        </div>
        <div class="text-end">
          <button class="btn btn-sm btn-outline-success" onclick="resolveIssue('${i.id}')">Resolve</button>
        </div>
      </div>
    </div>`;
  }).join("");
}
function resolveIssue(id){
  issues = issues.filter(x=>x.id!==id);
  renderIssues();
  toast("Issue resolved", "success");
}

/* ------------------- LEADER ACTIONS ------------------- */
function clearEmp(id){
  const emp = employees.find(e=>e.id===id);
  const back = assignments.filter(a=>a.empId===id && a.status!=="done").map(a=>a.taskId);
  tasks.push(...back.map(tid=>TASK_TPL[tid] ? {id:tid, ...TASK_TPL[tid]} : {id:tid,title:tid,reqRole:"Operator",priority:3,effort:1,cat:"Service"}));
  assignments = assignments.filter(a=>!(a.empId===id && a.status!=="done"));
  emp.load = 0;
  renderTasks(); renderEmployees(); refreshWorkerView();
}
function removeTask(id){ tasks = tasks.filter(t=>t.id!==id); renderTasks(); }
const TASK_TPL = {};
const TASK_CACHE = {};
function cacheTask(t){ TASK_CACHE[t.id] = {...t}; TASK_TPL[t.id] = {title:t.title, reqRole:t.reqRole, priority:t.priority, effort:t.effort, cat:t.cat}; }

/* ------------------- CREW ------------------- */
function updateProgressDisplay(){
  const bar = document.getElementById("operatorProgressBar");
  const counter = document.getElementById("operatorCompletedCounter");
  if(!bar || !counter) return;
  if(!operatorState.cart){
    bar.style.width = "0%";
    bar.textContent = "0%";
    counter.textContent = "0/0";
    return;
  }
  const total = operatorState.cart.products.length;
  const done = operatorState.completed.size;
  const pct = total ? Math.round((done/total)*100) : 0;
  bar.style.width = `${pct}%`;
  bar.textContent = `${pct}%`;
  counter.textContent = `${done}/${total}`;
}

function updateTimerLabel(){
  const timer = document.getElementById("operatorTimer");
  if(!timer) return;
  if(!operatorState.startTime){
    timer.textContent = "00:00";
    return;
  }
  timer.textContent = formatTimer(Date.now() - operatorState.startTime);
}

function stopOperatorTimer(){
  if(operatorState.timerId){
    clearInterval(operatorState.timerId);
    operatorState.timerId = null;
  }
}

function startOperatorTimer(){
  stopOperatorTimer();
  updateTimerLabel();
  operatorState.timerId = setInterval(updateTimerLabel, 1000);
}

function simulateCartScan(){
  const template = OPERATOR_DEMOS[operatorDemoIndex % OPERATOR_DEMOS.length];
  operatorDemoIndex = (operatorDemoIndex + 1) % OPERATOR_DEMOS.length;
  const cart = {
    id: template.id,
    flight: template.flight,
    operator: template.operator,
    goalMinutes: template.goalMinutes,
    products: template.products.map(item=>({
      ...item,
      bottle: item.bottle ? { ...item.bottle } : null
    }))
  };
  startCartSession(cart);
}

function startCartSession(cart){
  resetOperatorState();
  operatorState.cart = cart;
  operatorState.startTime = Date.now();
  operatorState.lastTimestamp = operatorState.startTime;
  operatorState.expectedOrder = 1;
  operatorState.events = [];
  operatorState.errors = [];
  operatorState.durations = [];
  operatorState.bottleActivated = false;
  operatorCompletionLog = operatorCompletionLog.filter(entry=>entry.cartId!==cart.id);
  const cartLog = ensureCartLogEntry(cart);
  if(cartLog){
    cartLog.startedAt = operatorState.startTime;
    cartLog.finishedAt = null;
    cartLog.totalItems = Array.isArray(cart.products) ? cart.products.length : 0;
    cartLog.items = [];
    cartLog.errors = 0;
    persistOperatorCompletionLog();
    renderOperatorCompletions();
  }
  renderJournal();
  renderCartMeta(cart);
  renderProductChecklist();
  updateStatusBadge("text-bg-primary", `Cart ${cart.id} active`);
  const startBadge = document.getElementById("operatorStartTimeBadge");
  if(startBadge){
    startBadge.hidden = false;
    startBadge.className = "badge text-bg-success";
    startBadge.textContent = `Start ${formatClock(operatorState.startTime)}`;
  }
  registerEvent("inicio", `Cart ${cart.id} scanned`, { flight: cart.flight, owner: cart.operator });
  setOperatorAlert(`Cart ${cart.id} ready for Pick & Pack`, "info");
  updateProgressDisplay();
  toggleSummary(false);
  startOperatorTimer();
  evaluateBottleModule();
  const timer = document.getElementById("operatorTimer");
  if(timer) timer.textContent = "00:00";
  toast(`Cart ${cart.id} loaded`, "primary");
}

function handleProductCompletion(productId){
  if(!operatorState.cart){
    toast("Scan a cart before beginning","warning");
    return;
  }
  const product = operatorState.cart.products.find(item=>item.id===productId);
  if(!product) return;
  if(operatorState.completed.has(product.id)){
    toast("This product has already been marked","info");
    return;
  }
  if(product.expectedOrder !== operatorState.expectedOrder){
    registerError(product, "incorrect order");
    flashProductError(product.id);
    return;
  }
  const now = Date.now();
  const taskDuration = operatorState.lastTimestamp ? (now - operatorState.lastTimestamp) : 0;
  operatorState.lastTimestamp = now;
  if(taskDuration > 0){
    operatorState.durations.push(taskDuration);
  }
  operatorState.completed.add(product.id);
  operatorState.expectedOrder += 1;
  registerEvent("producto", `Item ${product.expectedOrder}: ${product.name} completed`, { product: product.id });
  recordOperatorCompletion(product);
  setOperatorAlert(`Product ${product.name} marked as completed`, "success");
  renderProductChecklist();
  updateProgressDisplay();
  if(operatorState.completed.size === operatorState.cart.products.length){
    finalizeOperatorSession();
  }
}

function flashProductError(productId){
  operatorState.lastErrorProduct = productId;
  renderProductChecklist();
  setTimeout(()=>{
    if(operatorState.lastErrorProduct === productId){
      operatorState.lastErrorProduct = null;
      renderProductChecklist();
    }
  }, 2000);
}

function registerError(product, reason){
  const timestamp = Date.now();
  operatorState.errors.push({ productId: product.id, reason, timestamp });
  registerEvent("error", `Incorrect order at ${product.name}`, { product: product.id });
  setOperatorAlert("Incorrect order. Please check the sequence.", "danger");
  toast("Incorrect order","danger");
  pushErrorHistory({
    cartId: operatorState.cart ? operatorState.cart.id : "N/A",
    product: product.name,
    reason,
    timestamp
  });
  if(operatorState.cart){
    const entry = operatorCompletionLog.find(e=>e.cartId===operatorState.cart.id);
    if(entry){
      entry.errors = operatorState.errors.length;
      persistOperatorCompletionLog();
      renderOperatorCompletions();
    }
  }
}

function pushErrorHistory(entry){
  operatorStorage.errors.unshift(entry);
  operatorStorage.errors = operatorStorage.errors.slice(0, 12);
  localStorage.setItem(OPERATOR_KEYS.errors, JSON.stringify(operatorStorage.errors));
  refreshStoragePanel();
}

function evaluateBottleModule(){
  const hasCart = !!operatorState.cart;
  const bottleProducts = hasCart ? operatorState.cart.products.filter(item=>item.type==="bottle") : [];
  if(!bottleProducts.length){
    renderBottleModule([]);
    return;
  }
  if(!operatorState.bottleActivated){
    operatorState.bottleActivated = true;
    registerEvent("bottle", `Bottle control active (${bottleProducts.length})`, {});
  }
  renderBottleModule(bottleProducts);
}

function applyBottleRule(bottle){
  const seal = (bottle.seal || "").toLowerCase();
  const level = (bottle.level || "").toLowerCase();
  const airline = (bottle.airline || "").toLowerCase();
  if(seal === "open" && airline === "emirates"){
    return { decision: "Discard", variant: "danger", note: "Open seal detected for Emirates. Regulation requires discard." };
  }
  if(seal === "open"){
    return { decision: "Manual review", variant: "warning", note: "Open seal requires manual inspection." };
  }
  if(level === "high" && seal === "sealed"){
    return { decision: "Reuse", variant: "success", note: "Level high and seal intact meet standard." };
  }
  if(level === "middle" && seal === "sealed"){
    return { decision: "Manual review", variant: "warning", note: "Level medium. Confirm remaining with supervisor." };
  }
  if(level === "low"){
    return { decision: "Discard", variant: "danger", note: "Level low out of specification." };
  }
  return { decision: "Manual review", variant: "warning", note: "Incomplete data. Validate on site." };
}

function renderBottleModule(products){
  const card = document.getElementById("bottleModuleCard");
  const list = document.getElementById("bottleList");
  const summaryBox = document.getElementById("bottleSummary");
  if(!card || !list || !summaryBox) return;
  if(!products.length){
    card.hidden = true;
    list.innerHTML = "";
    summaryBox.textContent = "Scan a cart with bottles to unlock analysis.";
    return;
  }
  card.hidden = false;
  const totals = { success: 0, warning: 0, danger: 0 };
  list.innerHTML = products.map(product=>{
    const data = product.bottle || {};
    const rule = applyBottleRule({ level: data.level, seal: data.seal, airline: data.airline });
    totals[rule.variant] = (totals[rule.variant] || 0) + 1;
    return `<div class="col-12">
      <div class="border rounded-3 p-3 bg-white">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="fw-semibold">${product.name}</div>
            <div class="small text-muted">Level: ${data.level || "n/a"} | Seal: ${data.seal || "n/a"} | Airline: ${data.airline || "n/a"}</div>
          </div>
          <span class="badge text-bg-${rule.variant}">${rule.decision}</span>
        </div>
        <div class="small mt-2 text-muted">${rule.note}</div>
      </div>
    </div>`;
  }).join("");
  summaryBox.textContent = `${totals.success || 0} reuse | ${totals.warning || 0} review | ${totals.danger || 0} discard`;
}

function toggleWeight(show){
  const card = document.getElementById("entryWeightCard");
  if(!card) return;
  card.hidden = !show;
}

function toggleSummary(show){
  const card = document.getElementById("operatorSummaryCard");
  
  if(!card) return;
  card.hidden = !show;
  if(!show){
    const total = document.getElementById("summaryTotalTime");
    const errors = document.getElementById("summaryErrors");
    const tasks = document.getElementById("summaryTasks");
    const eff = document.getElementById("summaryEfficiency");
    if(total) total.textContent = "--";
    if(errors) errors.textContent = "0";
    if(tasks) tasks.textContent = "0/0";
    if(eff) eff.textContent = "0%";
  }
}

function finalizeOperatorSession(){
  if(!operatorState.cart) return;
  const finish = Date.now();
  stopOperatorTimer();
  const totalMs = finish - operatorState.startTime;
  const totalProducts = operatorState.cart.products.length;
  const completed = operatorState.completed.size;
  registerEvent("cierre", `Cart ${operatorState.cart.id} finished`, { totalMs, errors: operatorState.errors.length });
  setOperatorAlert("Cart closed. Check final summary.", operatorState.errors.length ? "warning" : "success");
  updateStatusBadge(operatorState.errors.length ? "text-bg-warning" : "text-bg-success", operatorState.errors.length ? "Closure with alerts" : "Successful closure");
  const startBadge = document.getElementById("operatorStartTimeBadge");
  if(startBadge){
    startBadge.hidden = false;
    startBadge.className = "badge text-bg-secondary";
    startBadge.textContent = `Closure ${formatClock(finish)}`;
  }
  const timer = document.getElementById("operatorTimer");
  if(timer) timer.textContent = formatTimer(totalMs);
  const totalEl = document.getElementById("summaryTotalTime");
  const errorsEl = document.getElementById("summaryErrors");
  const tasksEl = document.getElementById("summaryTasks");
  const effEl = document.getElementById("summaryEfficiency");
  if(totalEl) totalEl.textContent = formatDuration(totalMs);
  if(errorsEl) errorsEl.textContent = operatorState.errors.length.toString();
  if(tasksEl) tasksEl.textContent = `${completed}/${totalProducts}`;
  if(effEl) effEl.textContent = `${calculateEfficiency(totalMs)}%`;
  if(operatorState.cart){
    const entry = operatorCompletionLog.find(e=>e.cartId===operatorState.cart.id);
    if(entry){
      entry.finishedAt = finish;
      entry.errors = operatorState.errors.length;
      entry.totalItems = Array.isArray(operatorState.cart.products) ? operatorState.cart.products.length : entry.totalItems;
      persistOperatorCompletionLog();
      renderOperatorCompletions();
    }
  }
  persistOperatorSession(totalMs, finish);
}

function calculateEfficiency(totalMs){
  if(!operatorState.cart) return 0;
  const goalMs = (operatorState.cart.goalMinutes || 10) * 60000;
  const timeRatio = goalMs ? Math.min(1, goalMs / Math.max(totalMs, 1)) : 1;
  const base = Math.round(timeRatio * 100);
  const penalty = operatorState.errors.length * 5;
  return Math.max(0, Math.min(100, base - penalty));
}

function persistOperatorSession(totalMs, finishTs){
  if(!operatorState.cart) return;
  operatorStorage.lastCart = {
    id: operatorState.cart.id,
    flight: operatorState.cart.flight,
    operator: operatorState.cart.operator,
    durationMs: totalMs,
    finishedAt: finishTs,
    errors: operatorState.errors.length
  };
  localStorage.setItem(OPERATOR_KEYS.lastCart, JSON.stringify(operatorStorage.lastCart));
  const taskCount = operatorState.durations.length || operatorState.cart.products.length;
  const sessionAvg = operatorState.durations.length
    ? operatorState.durations.reduce((acc,val)=>acc+val,0) / operatorState.durations.length
    : (totalMs / Math.max(taskCount, 1));
  const prev = operatorStorage.stats || { avgMs: 0, samples: 0 };
  const newSamples = (prev.samples || 0) + 1;
  const newAvg = ((prev.avgMs || 0) * (prev.samples || 0) + sessionAvg) / newSamples;
  operatorStorage.stats = { avgMs: newAvg, samples: newSamples };
  localStorage.setItem(OPERATOR_KEYS.stats, JSON.stringify(operatorStorage.stats));
  refreshStoragePanel();
}

function clearOperatorStorage(){
  Object.values(OPERATOR_KEYS).forEach(key=>localStorage.removeItem(key));
  operatorStorage.lastCart = null;
  operatorStorage.stats = { avgMs: 0, samples: 0 };
  operatorStorage.errors = [];
  operatorStorage.completions = [];
  operatorStorage.incidents = [];
  operatorCompletionLog = [];
  operatorIncidentLog = [];
  refreshStoragePanel();
  renderOperatorCompletions();
  renderOperatorIncidents();
}

function handleIncidentSubmit(event){
  event.preventDefault();
  const textArea = document.getElementById("operatorIncidentText");
  const typeSelect = document.getElementById("operatorIncidentType");
  if(!textArea || !typeSelect) return;
  const detail = textArea.value.trim();
  if(!detail){
    toast("Write a quick description","warning");
    return;
  }
  const incidentType = typeSelect.value;
  const timestamp = Date.now();
  registerEvent("incidente", `Incident ${incidentType}: ${detail}`, {});
  setOperatorAlert("Incident registered for follow-up", "warning");
  pushErrorHistory({
    cartId: operatorState.cart ? operatorState.cart.id : "N/A",
    product: incidentType,
    reason: detail,
    timestamp
  });
  const incidentEntry = {
    id: "OPINC"+Math.random().toString(36).slice(2,7).toUpperCase(),
    cartId: operatorState.cart ? operatorState.cart.id : "N/A",
    flight: operatorState.cart ? operatorState.cart.flight : "--",
    operator: operatorState.cart ? operatorState.cart.operator : "Without operator",
    type: incidentType,
    typeLabel: INCIDENT_TYPE_LABEL[incidentType] || incidentType,
    description: detail,
    ts: timestamp,
    status: "open"
  };
  operatorIncidentLog.unshift(incidentEntry);
  if(operatorIncidentLog.length > 20){
    operatorIncidentLog.length = 20;
  }
  persistOperatorIncidents();
  renderOperatorIncidents();
  textArea.value = "";
  typeSelect.value = "abastecimiento";
  const modal = bootstrap.Modal.getInstance(document.getElementById("operatorIncidentModal"));
  if(modal) modal.hide();
  toast("Incident registered","warning");
}

function initOperatorMode(){
  loadOperatorStorage();
  renderCartMeta(null);
  renderProductChecklist();
  evaluateBottleModule();
  updateProgressDisplay();
  updateTimerLabel();
  const checklist = document.getElementById("productChecklist");
  if(checklist){
    checklist.addEventListener("click", event=>{
      const btn = event.target.closest(".operator-complete-btn");
      if(btn){
        handleProductCompletion(btn.getAttribute("data-product-id"));
      }
    });
  }
  const scanBtn = document.getElementById("scanCartBtn");
  if(scanBtn){
    scanBtn.addEventListener("click", simulateCartScan);
  }
  const newCartBtn = document.getElementById("newCartBtn");
  if(newCartBtn){
    newCartBtn.addEventListener("click", simulateCartScan);
  }
  const viewJournalBtn = document.getElementById("viewJournalBtn");
  if(viewJournalBtn){
    viewJournalBtn.addEventListener("click", ()=>{
      const journal = document.getElementById("operatorJournal");
      if(journal){
        journal.scrollIntoView({behavior: "smooth"});
      }
    });
  }
  const resetBtn = document.getElementById("resetOperatorDataBtn");
  if(resetBtn){
    resetBtn.addEventListener("click", ()=>{
      clearOperatorStorage();
      setOperatorAlert("Local data reset","warning");
      updateStatusBadge("text-bg-light text-primary", "No active cart");
      const startBadge = document.getElementById("operatorStartTimeBadge");
      if(startBadge){
        startBadge.hidden = true;
      }
      resetOperatorState();
      renderCartMeta(null);
      renderProductChecklist();
      renderJournal();
      evaluateBottleModule();
      updateProgressDisplay();
      updateTimerLabel();
      toggleWeight(false);
      toggleSummary(false);
      toast("Data reset","warning");
    });
  }
  const reportBtn = document.getElementById("reportIssueBtn");
  if(reportBtn){
    reportBtn.addEventListener("click", ()=>{
      const modal = new bootstrap.Modal(document.getElementById("operatorIncidentModal"));
      modal.show();
    });
  }
  const incidentForm = document.getElementById("operatorIncidentForm");
  if(incidentForm){
    incidentForm.addEventListener("submit", handleIncidentSubmit);
  }
}

/* ------------------- INIT ------------------- */

function renderWorkerSelector(){
  $("#workerSelect").innerHTML = employees
    .filter(e=>e.role!=="Leader")
    .map(e=>`<option value="${e.id}" ${workerMeta.selected===e.id?'selected':''}>${e.name} -- ${e.role} (Team ${e.group})</option>`).join("");
}
function tasksOf(empId){
  const ids = assignments.filter(a=>a.empId===empId && a.status!=="done").map(a=>a.taskId);
  return ids.map(id=> TASK_CACHE[id] || tasks.find(t=>t.id===id) || {id, title:"Task", reqRole:"Operator", priority:3, effort:1, cat:"Service"} );
}
function renderMyTasks(){
  const me = employees.find(e=>e.id===workerMeta.selected);
  const list = assignments.filter(a=>a.empId===me.id && a.status!=="done")
    .map(a=>({a, t: TASK_CACHE[a.taskId] || tasks.find(x=>x.id===a.taskId) || {id:a.taskId,title:"Task",reqRole:me.role,priority:3,effort:1,cat:a.category}}));

  $("#myTasks").innerHTML = list.map(({a,t})=>`
    <div class="task-card mb-3">
      <div class="d-flex justify-content-between">
        <div class="title">${t.title} ${pillCat(t.cat)}</div>
        <div>
          <span class="badge text-bg-warning">P${t.priority}</span>
          <span class="badge text-bg-info ms-1">E${t.effort}</span>
        </div>
      </div>
      <div class="small text-muted mt-1">Role: ${t.reqRole} · Status: <strong>${a.status.toUpperCase()}</strong></div>
      <div class="d-flex justify-content-between gap-2 mt-2">
        <button class="btn btn-sm btn-success" onclick="toggleDone('${t.id}')">Mark done</button>
        <button class="btn btn-sm btn-outline-danger" onclick="openIssue('${t.id}')"> I have a problem</button>
      </div>
    </div>`).join("") || `<div class="text-muted">No tasks assigned for now.</div>`;

  const cats = [...new Set(list.map(x=>x.t.cat))];
  $("#diversityCats").innerHTML = cats.map(pillCat).join(" ") || `<span class="text-muted">--</span>`;
  $("#varietyHint").textContent = `Variety: ${cats.length} different category(ies) in your current tasks.`;
  
  $("#pointsBadge").textContent = `${me.points} pts`;
  $("#badgesBox").innerHTML = me.badges.map(b=>`<span class="badge text-bg-warning">${b}</span>`).join(" ") || `<span class="text-muted">No badges yet</span>`;
  $("#achievementsBox").innerHTML = me.achievements?.length ? me.achievements.map(a=>`<span class="badge text-bg-secondary me-1">${a}</span>`).join(" ") : "--";

  updateStreak(me);
}
function toggleDone(taskId){
  const me = employees.find(e=>e.id===workerMeta.selected);
  const idx = assignments.findIndex(a=>a.taskId===taskId && a.empId===me.id && a.status!=="done");
  if(idx<0) return;
  assignments[idx].status = "done";
  me.load = Math.max(0, me.load - (TASK_CACHE[taskId]?.effort || 1));
  const cat = assignments[idx].category;
  me.recentCats.push(cat);
  me.points += 10 + (["Beverages","Food","Service","QC"].indexOf(cat)+1);
  grantBadges(me);
  renderEmployees(); renderMyTasks();
  toast("Task completed","success");
}
function openIssue(taskId){
  $("#issueTaskId").value = taskId;
  $("#issueText").value = "";
  $("#issueSeverity").value = "medium";
  $("#issueNeedHelp").value = "yes";
  new bootstrap.Modal($("#issueModal")).show();
}
$("#issueForm").addEventListener("submit",(e)=>{
  e.preventDefault();
  const me = employees.find(x=>x.id===workerMeta.selected);
  const id = "ISS"+Math.random().toString(36).slice(2,7).toUpperCase();
  const obj = { id, taskId: $("#issueTaskId").value, empId: me.id, text: $("#issueText").value.trim(),
                severity: $("#issueSeverity").value, needHelp: $("#issueNeedHelp").value, ts: Date.now(), status:"open" };
  issues.push(obj);
  assignments = assignments.map(a=> a.taskId===obj.taskId && a.empId===me.id ? {...a, status:"blocked"} : a);
  renderIssues(); renderMyTasks();
  bootstrap.Modal.getInstance($("#issueModal")).hide();
  toast("Issue sent to leader","danger");
});

/* ---- Gamification ---- */
function grantBadges(me){
  const diversity = new Set(me.recentCats.slice(-6)).size;
  if(diversity>=3 && !me.badges.includes("All-Rounder")) me.badges.push("All-Rounder");
  const doneToday = assignments.filter(a=>a.empId===me.id && a.status==="done").length;
  if(doneToday>=5 && !me.badges.includes("High Output")) me.badges.push("High Output");
}
function updateStreak(me){
  const doneToday = assignments.filter(a=>a.empId===me.id && a.status==="done").length;
  if(doneToday>=3) me.streak = Math.min(5, me.streak+1);
  const pct = (me.streak/5)*100;
  $("#streakBar").style.width = pct+"%";
  $("#streakBar").textContent = `${me.streak}/5`;
}

/* ------------------- ADD TASK FORM ------------------- */
$("#addTaskForm").addEventListener("submit",(e)=>{
  e.preventDefault();
  const obj = {
    id: "T"+Math.random().toString(36).slice(2,7).toUpperCase(),
    title: $("#fTitle").value.trim() || "Task",
    reqRole: $("#fRole").value,
    priority: Math.min(5,Math.max(1, parseInt($("#fPriority").value,10)||3)),
    effort: Math.min(3,Math.max(1, parseInt($("#fEffort").value,10)||1)),
    cat: CATS.includes($("#fCategory").value) ? $("#fCategory").value : "Service",
    notes: $("#fNotes").value.trim()
  };
  tasks.push(obj); cacheTask(obj);
  renderTasks();
  bootstrap.Modal.getInstance($("#addTaskModal")).hide();
  $("#addTaskForm").reset();
  toast("Task added to backlog","primary");
});

/* ------------------- GENERAL HANDLERS ------------------- */
$("#btnSuggest").addEventListener("click", ()=>{ lastS = computeSuggestion(); showSuggestion(lastS); });
$("#btnAssign").addEventListener("click", ()=>assignSuggestion(lastS));
let autoTimer=null;
$("#btnAuto").addEventListener("click", ()=>{
  if(autoTimer){ clearInterval(autoTimer); autoTimer=null; $("#btnAuto").textContent="Auto-assign (demo)"; return; }
  $("#btnAuto").textContent="Stop auto";
  autoTimer = setInterval(()=>{ const s = computeSuggestion(); if(s) assignSuggestion(s); }, 3000);
});
$("#btnClearDone").addEventListener("click", ()=>{ assignments = assignments.filter(a=>a.status!=="done"); renderMyTasks(); renderEmployees(); });
$("#workerSelect").addEventListener("change",(e)=>{ workerMeta.selected=e.target.value; renderMyTasks(); });
$("#btnSeed").addEventListener("click", ()=>{ seed(); init(); toast("Demo data reset","secondary"); });

/* ------------------- OPERATOR MODE ------------------- */
/* Bloque: Datos simulados y estado base para Operator Mode */
const OPERATOR_KEYS = {
  lastCart: "crewHubOperator:lastCart",
  stats: "crewHubOperator:avgTaskTime",
  errors: "crewHubOperator:errorHistory",
  completionLog: "crewHubOperator:completionLog",
  incidents: "crewHubOperator:incidents"
};
const OPERATOR_DEMOS = [
  {
    id: "CRT-104",
    flight: "EK088",
    operator: "Laura Mena",
    goalMinutes: 9,
    products: [
      { id: "P-01", name: "Water bottle 500ml", type: "bottle", expectedOrder: 1, quantity: 24, location: "Rack A - Nivel 1", bottle: { level: "high", seal: "sealed", airline: "Emirates" } },
      { id: "P-02", name: "Snacks", type: "standard", expectedOrder: 2, quantity: 18, location: "Rack A - Nivel 2" },
      { id: "P-03", name: "Cola", type: "standard", expectedOrder: 3, quantity: 20, location: "Rack B - Nivel 1" },
      { id: "P-04", name: "Champagne", type: "bottle", expectedOrder: 4, quantity: 4, location: "Rack B - Nivel 2", bottle: { level: "middle", seal: "open", airline: "Emirates" } },
      { id: "P-05", name: "Premium Cutlery", type: "standard", expectedOrder: 5, quantity: 32, location: "Kit utensilios" }
    ]
  },
  {
    id: "CRT-205",
    flight: "AMX812",
    operator: "Hector Silva",
    goalMinutes: 8,
    products: [
      { id: "P-11", name: "Red wine bottles", type: "bottle", expectedOrder: 1, quantity: 6, location: "Bar lateral", bottle: { level: "high", seal: "sealed", airline: "Aeromexico" } },
      { id: "P-12", name: "Individual juices", type: "standard", expectedOrder: 2, quantity: 12, location: "Refrigerador frontal" },
      { id: "P-13", name: "Coffee filters", type: "standard", expectedOrder: 3, quantity: 20, location: "Modulo cafe" },
      { id: "P-14", name: "Bakery set", type: "standard", expectedOrder: 4, quantity: 16, location: "Caja pan" },
      { id: "P-15", name: "Reposado tequila bottles", type: "bottle", expectedOrder: 5, quantity: 3, location: "Bar lateral", bottle: { level: "low", seal: "sealed", airline: "Aeromexico" } }
    ]
  },
  {
    id: "CRT-412",
    flight: "IB640",
    operator: "Marta Leon",
    goalMinutes: 10,
    products: [
      { id: "P-21", name: "Mineral water", type: "bottle", expectedOrder: 1, quantity: 10, location: "Rack C - Nivel 1", bottle: { level: "high", seal: "sealed", airline: "Iberia" } },
      { id: "P-22", name: "Healthy snacks", type: "standard", expectedOrder: 2, quantity: 25, location: "Rack C - Nivel 2" },
      { id: "P-23", name: "Individual desserts", type: "standard", expectedOrder: 3, quantity: 15, location: "Refrigerador trasero" },
      { id: "P-24", name: "Whiskey reserve bottles", type: "bottle", expectedOrder: 4, quantity: 5, location: "Modulo bebidas", bottle: { level: "middle", seal: "sealed", airline: "Iberia" } },
      { id: "P-25", name: "Sanitary mats", type: "standard", expectedOrder: 5, quantity: 12, location: "Compartimento limpieza" }
    ]
  }
];
const TROLLEY_DEMOS = [
  {
    id: "QR-CRT-01",
    flight: "EK088",
    operator: "Laura Mena",
    goalMinutes: 7,
    products: [
      { id: "TS-P01", name: "500ml water bottles", type: "bottle", expectedOrder: 1, quantity: 24, location: "Rack A - Nivel 1", bottle: { level: "high", seal: "sealed", airline: "Emirates" } },
      { id: "TS-P02", name: "Savory snacks", type: "standard", expectedOrder: 2, quantity: 18, location: "Rack A - Nivel 2" },
      { id: "TS-P03", name: "Cola can soft drinks", type: "standard", expectedOrder: 3, quantity: 20, location: "Rack B - Nivel 1" },
      { id: "TS-P04", name: "Business champagne", type: "bottle", expectedOrder: 4, quantity: 4, location: "Rack B - Nivel 2", bottle: { level: "middle", seal: "open", airline: "Emirates" } }
    ]
  },
  {
    id: "QR-CRT-02",
    flight: "AMX812",
    operator: "Hector Silva",
    goalMinutes: 8,
    products: [
      { id: "TS-P11", name: "Red wine bottles", type: "bottle", expectedOrder: 1, quantity: 6, location: "Bar lateral", bottle: { level: "high", seal: "sealed", airline: "Aeromexico" } },
      { id: "TS-P12", name: "Individual juices", type: "standard", expectedOrder: 2, quantity: 12, location: "Refrigerador frontal" },
      { id: "TS-P13", name: "Coffee filters", type: "standard", expectedOrder: 3, quantity: 20, location: "Modulo cafe" },
      { id: "TS-P14", name: "Bakery set", type: "standard", expectedOrder: 4, quantity: 16, location: "Caja pan" }
    ]
  }
];
const TROLLEY_EVENT_LABEL = {
  inicio: "start",
  producto: "Product",
  error: "Error",
  cierre: "Closure",
  incidente: "Incident"
};
const TROLLEY_EVENT_VARIANT = {
  inicio: "primary",
  producto: "success",
  error: "danger",
  cierre: "success",
  incidente: "warning"
};
const INCIDENT_TYPE_LABEL = {
  abastecimiento: "Restocking",
  equipo: "Items",
  calidad: "Quality",
  operativo: "Operative"
};
const INCIDENT_ROLE_MAP = {
  abastecimiento: "Support",
  equipo: "Support",
  calidad: "Leader",
  operativo: "Operator"
};
const INCIDENT_CATEGORY_MAP = {
  abastecimiento: "Service",
  equipo: "Service",
  calidad: "QC",
  operativo: "Service"
};
const OPERATOR_EVENT_LABEL = {
  inicio: "start",
  producto: "Product",
  error: "Error",
  cierre: "Closure",
  incidente: "Incident",
  botella: "Bottles"
};
const OPERATOR_EVENT_VARIANT = {
  inicio: "primary",
  producto: "success",
  error: "danger",
  cierre: "success",
  incidente: "warning",
  botella: "info"
};
let trolleyDemoIndex = 0;
let operatorDemoIndex = 0;
const operatorStorage = { lastCart: null, stats: { avgMs: 0, samples: 0 }, errors: [], completions: [], incidents: [] };
let operatorState = createEmptyOperatorState();
let operatorCompletionLog = [];
let operatorIncidentLog = [];
let trolleyState = createEmptyTrolleyState();

/* Funcion: createEmptyTrolleyState
   Descripcion: Construye el estado base para el modulo Trolley Set.
   Parametros: Ninguno.
   Resultado: Estado inicial without cart activo.
   Futuro: Integrar sincronizacion con backend. */
function createEmptyTrolleyState(){
  return {
    cart: null,
    startTime: null,
    lastTimestamp: null,
    timerId: null,
    expectedOrder: 1,
    completed: new Set(),
    durations: [],
    events: [],
    errors: 0,
    lastErrorProduct: null,
    terminated: false,
    alertedBottleIds: new Set()
  };
}

/* Funcion: resetTrolleyState
   Descripcion: Limpia el estado interno y detiene el temporizador activo.
   Parametros: Ninguno.
   Resultado: Estado listo para un nuevo escaneo.
   Futuro: Extender para limpiar caches remotas. */
function resetTrolleyState(){
  stopTrolleyTimer();
  trolleyState = createEmptyTrolleyState();
}

/* Funcion: simulateCartScanTrolley
   Descripcion: Carga el siguiente cart demo y arranca la sesion de armado.
   Parametros: Ninguno.
   Resultado: Cart activo en la vista Trolley Set.
   Futuro: Reemplazar con lector QR real. */
function simulateCartScanTrolley(){
  if(!TROLLEY_DEMOS.length){
    toast("There's no demo carts configured","warning");
    return;
  }
  const template = TROLLEY_DEMOS[trolleyDemoIndex % TROLLEY_DEMOS.length];
  trolleyDemoIndex = (trolleyDemoIndex + 1) % TROLLEY_DEMOS.length;
  const cart = {
    id: template.id,
    flight: template.flight,
    operator: template.operator,
    goalMinutes: template.goalMinutes,
    products: template.products.map(item=>(
      {
        ...item,
        bottle: item.bottle ? { ...item.bottle } : null
      }
    ))
  };
  startCartTrolleySession(cart);
}

/* Funcion: startCartTrolleySession
   Descripcion: Inicia la sesion de armado con un cart simulado.
   Parametros: cart (objeto con meta y products).
   Resultado: UI del modulo actualizada con el nuevo cart.
   Futuro: Registrar quien disparo el escaneo. */
function startCartTrolleySession(cart){
  resetTrolleyState();
  trolleyState.cart = cart;
  trolleyState.startTime = Date.now();
  trolleyState.lastTimestamp = trolleyState.startTime;
  trolleyRegisterEvent("inicio", `Cart ${cart.id} escaneado`);
  renderTrolleyMeta(cart);
  renderTrolleyChecklist();
  updateTrolleyProgress();
  renderTrolleyBottleModule(cart.products.filter(item=>item.type==="bottle"));
  startTrolleyTimer();
  updateTrolleyStatusBadge("text-bg-primary", `Cart ${cart.id} activo`);
  const startBadge = document.getElementById("trolleyStartBadge");
  if(startBadge){
    startBadge.hidden = false;
    startBadge.className = "badge text-bg-success";
    startBadge.textContent = `Inicio ${formatClock(trolleyState.startTime)}`;
  }
  setTrolleyAlert(`Cart ${cart.id} listo para Pick & Pack`, "info");
  const summaryCard = document.getElementById("trolleySummaryCard");
  const entryWeight = document.getElementById("entryWeightCard");
  if(summaryCard){
    summaryCard.hidden = true;
  }
  if(entryWeight){
    entryWeight.hidden = true;
  }
  const timerLabel = document.getElementById("trolleyTimer");
  if(timerLabel){
    timerLabel.textContent = "00:00";
  }
  toast(`Cart ${cart.id} cargado`, "primary");
}

/* Funcion: startTrolleyTimer
   Descripcion: Arranca o reinicia el cronometro del modulo.
   Parametros: Ninguno.
   Resultado: Etiqueta de tiempo actualizada cada segundo.
   Futuro: Integrar con workers en segundo plano. */
function startTrolleyTimer(){
  stopTrolleyTimer();
  updateTrolleyTimer();
  trolleyState.timerId = setInterval(updateTrolleyTimer, 1000);
}

/* Funcion: stopTrolleyTimer
   Descripcion: Detiene el cronometro activo si existe.
   Parametros: Ninguno.
   Resultado: Intervalo limpiado.
   Futuro: Persistir tiempos parciales. */
function stopTrolleyTimer(){
  if(trolleyState.timerId){
    clearInterval(trolleyState.timerId);
    trolleyState.timerId = null;
  }
}

/* Funcion: updateTrolleyTimer
   Descripcion: Refresca la etiqueta mm:ss del cart activo.
   Parametros: Ninguno.
   Resultado: Texto actualizado o reseteado a 00:00.
   Futuro: Mostrar horas cuando aplique. */
function updateTrolleyTimer(){
  const label = document.getElementById("trolleyTimer");
  if(!label) return;
  if(!trolleyState.startTime){
    label.textContent = "00:00";
    return;
  }
  label.textContent = formatTimer(Date.now() - trolleyState.startTime);
}

/* Funcion: renderTrolleyMeta
   Descripcion: Pinta los datos generales del cart activo.
   Parametros: cart (objeto) o null.
   Resultado: Tabla descriptiva con flight, operator y conteo.
   Futuro: Agregar puerta o destino. */
function renderTrolleyMeta(cart){
  const wrap = document.getElementById("trolleyCartMeta");
  if(!wrap) return;
  if(!cart){
    wrap.innerHTML = `
      <dt class="col-5 col-md-3">Cart</dt><dd class="col-7 col-md-3 text-muted">--</dd>
      <dt class="col-5 col-md-3">Flight</dt><dd class="col-7 col-md-3 text-muted">--</dd>
      <dt class="col-5 col-md-3">Operator</dt><dd class="col-7 col-md-3 text-muted">--</dd>
      <dt class="col-5 col-md-3">Products</dt><dd class="col-7 col-md-3 text-muted">--</dd>
    `;
    return;
  }
  wrap.innerHTML = `
    <dt class="col-5 col-md-3">Cart</dt><dd class="col-7 col-md-3 text-muted">${cart.id}</dd>
    <dt class="col-5 col-md-3">Flight</dt><dd class="col-7 col-md-3 text-muted">${cart.flight}</dd>
    <dt class="col-5 col-md-3">Operator</dt><dd class="col-7 col-md-3 text-muted">${cart.operator}</dd>
    <dt class="col-5 col-md-3">Products</dt><dd class="col-7 col-md-3 text-muted">${cart.products.length}</dd>
  `;
}

/* Funcion: renderTrolleyChecklist
   Descripcion: Genera las tarjetas de products del cart.
   Parametros: Ninguno.
   Resultado: Lista interactiva lista para marcar.
   Futuro: Integrar codigos de barra reales. */
function renderTrolleyChecklist(){
  const container = document.getElementById("trolleyCurrentBox");
  if(!container) return;
  if(!trolleyState.cart){
    container.innerHTML = `<div class="alert alert-info" role="alert">Scan a cart to begin.</div>`;
    return;
  }
  if(trolleyState.terminated){
    container.innerHTML = `<div class="alert alert-warning" role="alert">Flow stopped due to incident. Check the summary.</div>`;
    return;
  }
  const current = trolleyState.cart.products.find(p=>p.expectedOrder === trolleyState.expectedOrder);
  if(!current){
    container.innerHTML = `<div class="alert alert-success" role="alert">Cart completed. Check the summary.</div>`;
    return;
  }
  container.innerHTML = renderTrolleyCurrentCard(current);
  // Bind large action buttons
  const markBtn = container.querySelector('#trolleyMarkBtn');
  const probBtn = container.querySelector('#trolleyProblemBtn');
  if(markBtn){ markBtn.addEventListener('click', ()=>handleTrolleyProductCompletion(current.id)); }
  if(probBtn){ probBtn.addEventListener('click', ()=>openTrolleyIncidentFor(current)); }
  // Show bottle alert once per product if applicable
  maybeShowBottleAlert(current);
}

/* Funcion: renderTrolleyProductCard
   Descripcion: Devuelve el HTML de un producto del cart.
   Parametros: product (objeto con meta).
   Resultado: Tarjeta con boton de marcado y estado.
   Futuro: Mostrar imagen de referencia. */
function renderTrolleyProductCard(product){
  const completed = trolleyState.completed.has(product.id);
  const isNext = product.expectedOrder === trolleyState.expectedOrder;
  const hasError = trolleyState.lastErrorProduct === product.id;
  const statusText = completed ? "Completed" : isNext ? "Next in line" : "Pending";
  const statusClass = completed ? "text-success" : isNext ? "text-primary" : "text-muted";
  const bottleInfo = product.type === "bottle" ? (product.bottle || {}) : null;
  const bottleLine = bottleInfo
    ? `<div class="small text-muted">Bottle: level ${bottleInfo.level || "n/a"} | seal ${bottleInfo.seal || "n/a"} | airline ${bottleInfo.airline || "n/a"}</div>`
    : "";
  return `
    <div class="trolley-product ${completed ? "completed" : ""} ${hasError ? "error" : ""}" data-product-id="${product.id}">
      <div class="d-flex justify-content-between align-items-start gap-3">
        <div class="d-flex align-items-start gap-3">
          <span class="trolley-order-pill">${product.expectedOrder}</span>
          <div>
            <div class="fw-semibold">${product.name}</div>
            <div class="small text-muted">Quantity: ${product.quantity} | Location: ${product.location}</div>
            ${bottleLine}
          </div>
        </div>
        <div class="text-end">
          <button class="btn btn-sm ${completed ? "btn-success" : "btn-outline-success"} trolley-complete-btn" data-product-id="${product.id}" ${completed ? "disabled" : ""}>${completed ? "Ready" : "Check"}</button>
          <div class="small mt-2 ${statusClass}">${statusText}</div>
        </div>
      </div>
    </div>`;
}

// Single-item view card with big actions
function renderTrolleyCurrentCard(product){
  const hasError = trolleyState.lastErrorProduct === product.id;
  const bottleInfo = product.type === 'bottle' ? (product.bottle || {}) : null;
  const bottleLine = bottleInfo
    ? `<div class="small text-muted">Bottle: level ${bottleInfo.level || 'n/a'} | seal ${bottleInfo.seal || 'n/a'} | airline ${bottleInfo.airline || 'n/a'}</div>`
    : '';
  return `
    <div class="trolley-product ${hasError ? 'error' : ''}">
      <div class="d-flex align-items-start gap-3 mb-3">
        <span class="trolley-order-pill">${product.expectedOrder}</span>
        <div>
          <div class="fw-semibold fs-5">${product.name}</div>
          <div class="small text-muted">Quantity: ${product.quantity} | Location: ${product.location}</div>
          ${bottleLine}
        </div>
      </div>
      <div class="row g-2 big-actions">
        <div class="col-12 col-md-7">
          <button class="btn btn-success w-100" id="trolleyMarkBtn">Mark as done</button>
        </div>
        <div class="col-12 col-md-5">
          <button class="btn btn-warning w-100" id="trolleyProblemBtn">Report problem</button>
        </div>
      </div>
      <div class="small mt-2 text-primary">Next in line</div>
    </div>`;
}

/* Funcion: handleTrolleyProductCompletion
   Descripcion: Marca un producto como completado respetando el orden sugerido.
   Parametros: productId (string).
   Resultado: Estado actualizado y progreso recalculado.
   Futuro: Registrar evidencia fotografica. */
function handleTrolleyProductCompletion(productId){
  if(!trolleyState.cart){
    toast("Scan a cart before marking items","warning");
    return;
  }
  const product = trolleyState.cart.products.find(item=>item.id===productId);
  if(!product) return;
  if(trolleyState.completed.has(product.id)){
    toast("Este producto ya fue marcado","info");
    return;
  }
  if(product.expectedOrder !== trolleyState.expectedOrder){
    markTrolleyOutOfSequence(product);
    return;
  }
  const now = Date.now();
  if(trolleyState.lastTimestamp){
    trolleyState.durations.push(now - trolleyState.lastTimestamp);
  }
  trolleyState.lastTimestamp = now;
  trolleyState.completed.add(product.id);
  trolleyState.expectedOrder += 1;
  trolleyState.lastErrorProduct = null;
  const orderLabel = product.expectedOrder;
  trolleyRegisterEvent("producto", `Item ${orderLabel}: ${product.name} completado`);
  setTrolleyAlert(`Product ${product.name} marcado como completado`, "success");
  renderTrolleyChecklist();
  updateTrolleyProgress();
  if(trolleyState.completed.size === trolleyState.cart.products.length){
    finalizeTrolleySession();
  }
}

/* Funcion: markTrolleyOutOfSequence
   Descripcion: Maneja intentos fuera de orden y muestra feedback visual.
   Parametros: product (objeto).
   Resultado: Error registrado y tarjeta resaltada temporalmente.
   Futuro: Ajustar penalizaciones segun politica. */
function markTrolleyOutOfSequence(product){
  trolleyState.errors += 1;
  trolleyState.lastErrorProduct = product.id;
  trolleyRegisterEvent("error", `Orden incorrecto en ${product.name}`);
  setTrolleyAlert("Orden incorrecta. Sigue la secuencia sugerida.", "danger");
  toast("Orden incorrecta","danger");
  renderTrolleyChecklist();
  setTimeout(()=>{
    if(trolleyState.lastErrorProduct === product.id){
      trolleyState.lastErrorProduct = null;
      renderTrolleyChecklist();
    }
  }, 2000);
}

/* Funcion: updateTrolleyProgress
   Descripcion: Refresca barra de avance y contador de completados.
   Parametros: Ninguno.
   Resultado: UI consistente con el estado actual.
   Futuro: Mostrar tiempo estimado restante. */
function updateTrolleyProgress(){
  const bar = document.getElementById("trolleyProgressBar");
  const counter = document.getElementById("trolleyCompletedCounter");
  if(!bar || !counter) return;
  if(!trolleyState.cart){
    bar.style.width = "0%";
    bar.textContent = "0%";
    counter.textContent = "0/0";
    return;
  }
  const total = trolleyState.cart.products.length;
  const done = trolleyState.completed.size;
  const pct = total ? Math.round((done/total)*100) : 0;
  bar.style.width = `${pct}%`;
  bar.textContent = `${pct}%`;
  counter.textContent = `${done}/${total}`;
}

/* Funcion: finalizeTrolleySession
   Descripcion: Cierra la sesion, muestra resumen y actualiza alertas.
   Parametros: Ninguno.
   Resultado: Estado marcado como finalizado y resumen visible.
   Futuro: Generar reporte para supervisor. */
function finalizeTrolleySession(){
  if(!trolleyState.cart) return;
  const finish = Date.now();
  stopTrolleyTimer();
  const totalMs = finish - trolleyState.startTime;
  trolleyRegisterEvent("cierre", `Cart ${trolleyState.cart.id} finalizado`);
  const badge = document.getElementById("trolleyStartBadge");
  if(badge){
    badge.hidden = false;
    badge.className = "badge text-bg-secondary";
    badge.textContent = `Cierre ${formatClock(finish)}`;
  }
  const summaryCard = document.getElementById("trolleySummaryCard");
  const entryWeight = document.getElementById("entryWeightCard");
  const totalEl = document.getElementById("trolleySummaryTotalTime");
  const errorsEl = document.getElementById("trolleySummaryErrors");
  const tasksEl = document.getElementById("trolleySummaryTasks");
  const effEl = document.getElementById("trolleySummaryEfficiency");
  if(totalEl) totalEl.textContent = formatDuration(totalMs);
  if(errorsEl) errorsEl.textContent = String(trolleyState.errors);
  if(tasksEl) tasksEl.textContent = `${trolleyState.completed.size}/${trolleyState.cart.products.length}`;
  if(effEl) effEl.textContent = `${calculateTrolleyEfficiency(totalMs)}%`;
  updateTrolleyStatusBadge(trolleyState.errors ? "text-bg-warning" : "text-bg-success", trolleyState.errors ? "Cierre con alertas" : "Cierre exitoso");
  setTrolleyAlert("Cart cerrado. Revisa el resumen final.", trolleyState.errors ? "warning" : "success");
  renderTrolleyChecklist();
  toast(`Cart ${trolleyState.cart.id} finalizado`, trolleyState.errors ? "warning" : "success");
}

/* Funcion: calculateTrolleyEfficiency
   Descripcion: Evalua la eficiencia considerando objetivo de tiempo y errores.
   Parametros: totalMs (numero de milisegundos).
   Resultado: Porcentaje entero 0-100.
   Futuro: Ajustar segun KPIs de calidad. */
function calculateTrolleyEfficiency(totalMs){
  if(!trolleyState.cart) return 0;
  const goalMs = (trolleyState.cart.goalMinutes || 8) * 60000;
  const ratio = goalMs ? Math.min(1, goalMs / Math.max(totalMs, 1)) : 1;
  const penalty = trolleyState.errors * 5;
  const base = Math.round(ratio * 100) - penalty;
  return Math.max(0, Math.min(100, base));
}

/* Funcion: setTrolleyAlert
   Descripcion: Cambia el mensaje principal del modulo.
   Parametros: message (string), variant (clase Bootstrap).
   Resultado: Alert actualizada.
   Futuro: Integrar vibracion en dispositivos moviles. */
function setTrolleyAlert(message, variant){
  const box = document.getElementById("trolleyAlert");
  if(!box) return;
  box.textContent = message;
  box.className = `alert alert-${variant}`;
}

/* Funcion: updateTrolleyStatusBadge
   Descripcion: Ajusta el badge con el estado del cart.
   Parametros: variant (clases), label (string).
   Resultado: Badge visible con estado actualizado.
   Futuro: Agregar iconos por estado. */
function updateTrolleyStatusBadge(variant, label){
  const badge = document.getElementById("trolleyStatusBadge");
  if(!badge) return;
  badge.className = `badge ${variant}`;
  badge.textContent = label;
}

/* Funcion: renderTrolleyJournal
   Descripcion: Muestra la cronologia de eventos del modulo.
   Parametros: Ninguno.
   Resultado: Lista ordenada por eventos recientes.
   Futuro: Permitir filtros por tipo. */
function renderTrolleyJournal(){
  const list = document.getElementById("trolleyJournal");
  if(!list) return;
  if(!trolleyState.events.length){
    list.innerHTML = `<li class="list-group-item text-muted">La bitacora se completara en tiempo real.</li>`;
    return;
  }
  list.innerHTML = trolleyState.events.slice().reverse().map(ev=>{
    const badgeVariant = TROLLEY_EVENT_VARIANT[ev.type] || "secondary";
    const label = TROLLEY_EVENT_LABEL[ev.type] || ev.type;
    return `<li class="list-group-item d-flex justify-content-between align-items-start gap-3">
      <div>
        <div class="fw-semibold">${label}</div>
        <div class="small text-muted">${ev.description}</div>
      </div>
      <span class="badge text-bg-${badgeVariant}">${formatClock(ev.timestamp)}</span>
    </li>`;
  }).join("");
}

/* Funcion: trolleyRegisterEvent
   Descripcion: Agrega un evento a la bitacora de Trolley Set.
   Parametros: type (string), description (string).
   Resultado: Evento almacenado y render actualizado.
   Futuro: Sincronizar con panel central. */
function trolleyRegisterEvent(type, description){
  trolleyState.events.push({ type, description, timestamp: Date.now() });
  if(trolleyState.events.length > 50){
    trolleyState.events.shift();
  }
  renderTrolleyJournal();
}

/* Funcion: renderTrolleyBottleModule
   Descripcion: Analiza products tipo botella y aplica reglas.
   Parametros: products (array).
   Resultado: Panel de botellas actualizado o escondido.
   Futuro: Agregar justificacion por airline. */
function renderTrolleyBottleModule(products){
  const card = document.getElementById("trolleyBottleModuleCard");
  const list = document.getElementById("trolleyBottleList");
  const summary = document.getElementById("trolleyBottleSummary");
  if(!card || !list || !summary) return;
  if(!products || !products.length){
    card.hidden = true;
    list.innerHTML = "";
    summary.textContent = "Scan a cart with bottles to unlock analysis.";
    return;
  }
  card.hidden = false;
  const totals = { success: 0, warning: 0, danger: 0 };
  list.innerHTML = products.map(product=>{
    const info = product.bottle || {};
    const rule = applyBottleRule(info);
    totals[rule.variant] = (totals[rule.variant] || 0) + 1;
    return `<div class="col-12">
      <div class="border rounded-3 p-3 bg-white">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="fw-semibold">${product.name}</div>
            <div class="small text-muted">Nivel: ${info.level || "n/a"} | Sello: ${info.seal || "n/a"} | airline: ${info.airline || "n/a"}</div>
          </div>
          <span class="badge text-bg-${rule.variant}">${rule.decision}</span>
        </div>
        <div class="small mt-2 text-muted">${rule.note}</div>
      </div>
    </div>`;
  }).join("");
  summary.textContent = `${totals.success || 0} reutilizar | ${totals.warning || 0} revisar | ${totals.danger || 0} descartar`;
}

/* Funcion: resetTrolleyModule
   Descripcion: Restablece la UI a su estado inicial.
   Parametros: Ninguno.
   Resultado: Vista limpia without cart activo.
   Futuro: Mostrar historial reciente de carts. */
function resetTrolleyModule(){
  resetTrolleyState();
  renderTrolleyMeta(null);
  renderTrolleyChecklist();
  updateTrolleyProgress();
  renderTrolleyJournal();
  renderTrolleyBottleModule([]);
  setTrolleyAlert("Without activity. Scan a cart to begin.", "secondary");
  updateTrolleyStatusBadge("text-bg-light text-primary", "Without cart activo");
  const badge = document.getElementById("trolleyStartBadge");
  if(badge){
    badge.hidden = true;
  }
  const timerLabel = document.getElementById("trolleyTimer");
  if(timerLabel){
    timerLabel.textContent = "00:00";
  }
  const totalEl = document.getElementById("trolleySummaryTotalTime");
  const errorsEl = document.getElementById("trolleySummaryErrors");
  const tasksEl = document.getElementById("trolleySummaryTasks");
  const effEl = document.getElementById("trolleySummaryEfficiency");
  if(totalEl) totalEl.textContent = "--";
  if(errorsEl) errorsEl.textContent = "0";
  if(tasksEl) tasksEl.textContent = "0/0";
  if(effEl) effEl.textContent = "0%";
  const summaryCard = document.getElementById("trolleySummaryCard");
  const entryWeight = document.getElementById("entryWeightCard");
  if(summaryCard){
    summaryCard.hidden = true;
  }
  if(entryWeight){
    entryWeight.hidden = true;
  }
}

/* Funcion: initTrolleyModule
   Descripcion: Conecta eventos y deja listo el modulo para uso.
   Parametros: Ninguno.
   Resultado: Botones y lista responden a la simulacion.
   Futuro: Integrar permisos de usuario. */
function initTrolleyModule(){
  resetTrolleyModule();
  const scanBtn = document.getElementById("trolleyScanBtn");
  if(scanBtn){
    scanBtn.addEventListener("click", simulateCartScanTrolley);
  }
  const newScanBtn = document.getElementById("trolleyNewScanBtn");
  if(newScanBtn){
    newScanBtn.addEventListener("click", simulateCartScanTrolley);
  }
  const resetBtn = document.getElementById("trolleyResetBtn");
  if(resetBtn){
    resetBtn.addEventListener("click", resetTrolleyModule);
  }
  const viewJournalBtn = document.getElementById("trolleyViewJournalBtn");
  if(viewJournalBtn){
    viewJournalBtn.addEventListener("click", ()=>{
      const journal = document.getElementById("trolleyJournal");
      if(journal){
        journal.scrollIntoView({ behavior: "smooth" });
      }
    });
  }
  const checklist = document.getElementById("trolleyProductChecklist");
  // No checklist listener in one-by-one mode
  const incidentBtn = document.getElementById("trolleyIncidentBtn");
  if(incidentBtn){
    incidentBtn.addEventListener("click", ()=>{
      const modalEl = document.getElementById("operatorIncidentModal");
      if(!modalEl){
        toast("No se encontro el modal de incidencias","warning");
        return;
      }
      modalEl.dataset.origin = "trolley";
      modalEl.dataset.cartId = trolleyState.cart ? trolleyState.cart.id : "";
      modalEl.dataset.productId = "";
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    });
  }
}

// Helper to open incident modal for current item
function openTrolleyIncidentFor(product){
  const modalEl = document.getElementById('operatorIncidentModal');
  if(!modalEl){
    toast('No se encontro el modal de incidencias','warning');
    return;
  }
  modalEl.dataset.origin = 'trolley';
  modalEl.dataset.cartId = trolleyState.cart ? trolleyState.cart.id : '';
  modalEl.dataset.productId = product?.id || '';
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
  // Abort the flow immediately, as requested
  abortTrolleySession('Incidencia en producto');
}

// Bottle alert modal trigger
function maybeShowBottleAlert(product){
  if(!product || product.type !== 'bottle') return;
  if(!trolleyState.alertedBottleIds) trolleyState.alertedBottleIds = new Set();
  if(trolleyState.alertedBottleIds.has(product.id)) return;
  trolleyState.alertedBottleIds.add(product.id);
  const airline = product?.bottle?.airline || '—';
  const msgEl = document.getElementById('trolleyBottleMessage');
  if(msgEl){
    msgEl.textContent = `Debido a que estamos trabajando con airline ${airline}, esta botella se tendrá que desechar independientemente del sobrante.`;
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('trolleyBottleModal'));
    modal.show();
  }
}

// Abort/stop the Trolley flow due to discrepancy
function abortTrolleySession(reason){
  if(!trolleyState.cart || trolleyState.terminated) return;
  trolleyState.terminated = true;
  stopTrolleyTimer();
  trolleyRegisterEvent('error', reason || 'Flujo detenido por incidencia');
  setTrolleyAlert('Flujo detenido por incidencia', 'warning');
  updateTrolleyStatusBadge('text-bg-warning', 'Flujo detenido');
  // Show summary with current partials
  const finish = Date.now();
  const totalMs = finish - (trolleyState.startTime || finish);
  const summaryCard = document.getElementById('trolleySummaryCard');
  const entryWeight = document.getElementById('entryWeightCard');
  if(entryWeight){
    entryWeight.hidden = false;
  }
  if(summaryCard){ summaryCard.hidden = false; }
  const totalEl = document.getElementById('trolleySummaryTotalTime');
  const errorsEl = document.getElementById('trolleySummaryErrors');
  const tasksEl = document.getElementById('trolleySummaryTasks');
  const effEl = document.getElementById('trolleySummaryEfficiency');
  if(totalEl) totalEl.textContent = formatDuration(totalMs);
  if(errorsEl) errorsEl.textContent = String(trolleyState.errors + 1);
  const done = trolleyState.completed.size;
  const total = trolleyState.cart.products.length;
  if(tasksEl) tasksEl.textContent = `${done}/${total}`;
  if(effEl) effEl.textContent = '0%';
  renderTrolleyChecklist();
}

/* Funcion: createEmptyOperatorState
   Descripcion: Crea un objeto base para seguir el flujo del operator.
   Parametros: Ninguno.
   Resultado: Objeto inicial de estado.
   Futuro: Agregar nuevos campos cuando se integren fuentes en tiempo real. */
function createEmptyOperatorState(){
  return {
    cart: null,
    startTime: null,
    lastTimestamp: null,
    timerId: null,
    expectedOrder: 1,
    completed: new Set(),
    events: [],
    errors: [],
    durations: [],
    lastErrorProduct: null,
    bottleActivated: false
  };
}

/* Funcion: resetOperatorState
   Descripcion: Restablece el estado operativo y detiene el temporizador activo.
   Parametros: Ninguno.
   Resultado: Estado vacio listo para una nueva sesion.
   Futuro: Llamar APIs de limpieza de sesion cuando exista backend. */
function resetOperatorState(){
  stopOperatorTimer();
  operatorState = createEmptyOperatorState();
}

/* Funcion: safeParse
   Descripcion: Intenta convertir un string JSON y retorna un fallback si falla.
   Parametros: str (cadena JSON), fallback (valor por defecto).
   Resultado: Objeto parseado o fallback seguro.
   Futuro: Sustituir por validaciones de esquema. */
function safeParse(str, fallback){
  try{
    return str ? JSON.parse(str) : fallback;
  }catch(err){
    return fallback;
  }
}

/* Funcion: loadOperatorStorage
   Descripcion: Carga los datos persistidos en localStorage para el modulo operator.
   Parametros: Ninguno.
   Resultado: Actualiza la cache local operatorStorage y la UI relacionada.
   Futuro: Persistir en endpoint remoto. */
function loadOperatorStorage(){
  operatorStorage.lastCart = safeParse(localStorage.getItem(OPERATOR_KEYS.lastCart), null);
  operatorStorage.stats = safeParse(localStorage.getItem(OPERATOR_KEYS.stats), { avgMs: 0, samples: 0 });
  operatorStorage.errors = safeParse(localStorage.getItem(OPERATOR_KEYS.errors), []);
  operatorStorage.completions = safeParse(localStorage.getItem(OPERATOR_KEYS.completionLog), []);
  let rawCompletions = Array.isArray(operatorStorage.completions) ? operatorStorage.completions : [];

  // Migracion de formatos antiguos (lista plana) a la estructura por cart.
  if(rawCompletions.length && !Array.isArray(rawCompletions[0]?.items)){
    const grouped = rawCompletions.reduce((acc,item)=>{
      const cartId = item.cartId || "N/A";
      if(!acc[cartId]){
        acc[cartId] = {
          cartId,
          flight: item.flight || "--",
          operator: item.operator || "Without operator",
          startedAt: item.completedAt || Date.now(),
          finishedAt: null,
          totalItems: 0,
          items: [],
          errors: 0
        };
      }
      acc[cartId].items.push({
        productId: item.productId || item.id || `ITEM${acc[cartId].items.length+1}`,
        name: item.productName || item.name || "Product",
        completedAt: item.completedAt || Date.now(),
        order: item.order || acc[cartId].items.length+1
      });
      acc[cartId].totalItems = Math.max(acc[cartId].totalItems, acc[cartId].items.length);
      acc[cartId].finishedAt = (acc[cartId].finishedAt||0) < (item.completedAt||0) ? item.completedAt : acc[cartId].finishedAt;
      return acc;
    }, {});
    rawCompletions = Object.values(grouped).map(entry=>{
      entry.finishedAt = entry.finishedAt || null;
      return entry;
    });
  }

  operatorCompletionLog = rawCompletions
    .map(entry=>{
      const normalized = {
        cartId: entry.cartId,
        flight: entry.flight || "--",
        operator: entry.operator || "Without operator",
        startedAt: entry.startedAt || Date.now(),
        finishedAt: entry.finishedAt || null,
        totalItems: entry.totalItems || (Array.isArray(entry.items) ? entry.items.length : 0),
        items: Array.isArray(entry.items) ? entry.items.map(it=>({
          productId: it.productId || it.id || `ITEM${Math.random().toString(36).slice(2,6)}`,
          name: it.name || "Product",
          completedAt: it.completedAt || Date.now(),
          order: it.order || 999
        })).sort((a,b)=>(a.order||0)-(b.order||0)) : [],
        errors: entry.errors || 0
      };
      return normalized;
    })
    .sort((a,b)=>(b.startedAt||0)-(a.startedAt||0))
    .slice(0, 15);
  operatorStorage.completions = operatorCompletionLog;
  persistOperatorCompletionLog();

  operatorStorage.incidents = safeParse(localStorage.getItem(OPERATOR_KEYS.incidents), []);
  operatorIncidentLog = Array.isArray(operatorStorage.incidents) ? operatorStorage.incidents : [];
  operatorIncidentLog = operatorIncidentLog.map(incident=>({
    id: incident.id || "OPINC"+Math.random().toString(36).slice(2,7).toUpperCase(),
    cartId: incident.cartId || "N/A",
    flight: incident.flight || "--",
    operator: incident.operator || "Without operator",
    type: incident.type || "operativo",
    typeLabel: incident.typeLabel || INCIDENT_TYPE_LABEL[incident.type] || incident.type || "Incidente",
    description: incident.description || "Without descripcion",
    ts: incident.ts || Date.now(),
    status: incident.status || "open"
  })).slice(0, 20);
  operatorStorage.incidents = operatorIncidentLog;
  persistOperatorIncidents();

  refreshStoragePanel();
  renderOperatorCompletions();
  renderOperatorIncidents();
}

/* Funcion: refreshStoragePanel
   Descripcion: Muestra en pantalla los datos persistidos (ultimo cart, promiddle y errores).
   Parametros: Ninguno.
   Resultado: Actualiza los elementos del panel "Datos guardados".
   Futuro: Agregar indicadores graficos. */
function refreshStoragePanel(){
  const lastEl = document.getElementById("storageLastCart");
  const avgEl = document.getElementById("storageAvgTask");
  const errEl = document.getElementById("storageErrors");
  if(!lastEl || !avgEl || !errEl) return;
  if(operatorStorage.lastCart){
    const info = operatorStorage.lastCart;
    lastEl.textContent = `${info.id} / ${info.flight} (${formatDuration(info.durationMs)})`;
  }else{
    lastEl.textContent = "--";
  }
  if(operatorStorage.stats && operatorStorage.stats.samples){
    avgEl.textContent = `${formatDuration(operatorStorage.stats.avgMs)} (n=${operatorStorage.stats.samples})`;
  }else{
    avgEl.textContent = "--";
  }
  errEl.textContent = operatorStorage.errors.length ? `${operatorStorage.errors.length} eventos` : "--";
}

/* Funcion: formatClock
   Descripcion: Formatea una marca de tiempo en formato HH:MM.
   Parametros: ts (numero en milisegundos).
  Resultado: Cadena con hora legible.
   Futuro: Adaptar a formato regional segun usuario. */
function formatClock(ts){
  const d = new Date(ts);
  const hours = d.getHours().toString().padStart(2,"0");
  const mins = d.getMinutes().toString().padStart(2,"0");
  return `${hours}:${mins}`;
}

/* Funcion: formatTimer
   Descripcion: Convierte milisegundos a formato mm:ss para el cronometro.
   Parametros: ms (numero en milisegundos).
   Resultado: Texto mm:ss.
   Futuro: Mostrar horas si la operacion supera 60 minutos. */
function formatTimer(ms){
  const total = Math.max(0, Math.floor(ms/1000));
  const minutes = Math.floor(total/60);
  const seconds = total % 60;
  return `${minutes.toString().padStart(2,"0")}:${seconds.toString().padStart(2,"0")}`;
}

/* Funcion: formatDuration
   Descripcion: Resume una duracion en minutos y segundos para reportes.
   Parametros: ms (numero en milisegundos).
   Resultado: Texto compacto como "4m 32s".
   Futuro: Aceptar horas y dias. */
function formatDuration(ms){
  const total = Math.max(0, Math.floor(ms/1000));
  const minutes = Math.floor(total/60);
  const seconds = total % 60;
  if(minutes > 0){
    return `${minutes}m ${seconds.toString().padStart(2,"0")}s`;
  }
  return `${seconds}s`;
}

/* Funcion: formatDateTime
   Descripcion: Convierte un timestamp en texto YYYY-MM-DD HH:MM.
   Parametros: ts (numero en milisegundos).
   Resultado: Cadena con fecha y hora legible.
   Futuro: Ajustar a formatos regionales segun el perfil del usuario. */
function formatDateTime(ts){
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = (d.getMonth()+1).toString().padStart(2,"0");
  const day = d.getDate().toString().padStart(2,"0");
  const hours = d.getHours().toString().padStart(2,"0");
  const mins = d.getMinutes().toString().padStart(2,"0");
  return `${year}-${month}-${day} ${hours}:${mins}`;
}

/* Funcion: setOperatorAlert
   Descripcion: Cambia el mensaje principal de alertas operativas.
   Parametros: message (texto a mostrar), variant (tipo Bootstrap).
   Resultado: Actualiza el componente de alerta en pantalla.
   Futuro: Sincronizar con alertas sonoras opcionales. */
function setOperatorAlert(message, variant){
  const box = document.getElementById("operatorAlert");
  if(!box) return;
  box.textContent = message;
  box.className = `alert alert-${variant}`;
}

/* Funcion: updateStatusBadge
   Descripcion: Ajusta el badge principal con el estado de la sesion.
   Parametros: variant (clases), label (texto).
   Resultado: Badge actualizado junto al encabezado.
   Futuro: Incluir iconos para cada estado. */
function updateStatusBadge(variant, label){
  const badge = document.getElementById("operatorStatusBadge");
  if(!badge) return;
  badge.className = `badge ${variant}`;
  badge.textContent = label;
}

/* Funcion: renderCartMeta
   Descripcion: Rellena el detalle del cart activo.
   Parametros: cart (objeto con id, flight y operator) o null.
   Resultado: Metadatos visibles para el operator.
   Futuro: Mostrar KPI adicionales (peso, puertas). */
function renderCartMeta(cart){
  const wrap = document.getElementById("cartMeta");
  if(!wrap) return;
  if(!cart){
    wrap.innerHTML = `
      <dt class="col-5 col-md-3">Cart</dt><dd class="col-7 col-md-3 text-muted">-</dd>
      <dt class="col-5 col-md-3">Flight</dt><dd class="col-7 col-md-3 text-muted">-</dd>
      <dt class="col-5 col-md-3">Operator</dt><dd class="col-7 col-md-3 text-muted">-</dd>
      <dt class="col-5 col-md-3">Products</dt><dd class="col-7 col-md-3 text-muted">-</dd>
    `;
    return;
  }
  wrap.innerHTML = `
    <dt class="col-5 col-md-3">Cart</dt><dd class="col-7 col-md-3 text-muted">${cart.id}</dd>
    <dt class="col-5 col-md-3">Flight</dt><dd class="col-7 col-md-3 text-muted">${cart.flight}</dd>
    <dt class="col-5 col-md-3">Operator</dt><dd class="col-7 col-md-3 text-muted">${cart.operator}</dd>
    <dt class="col-5 col-md-3">Products</dt><dd class="col-7 col-md-3 text-muted">${cart.products.length}</dd>
  `;
}

/* Funcion: renderProductChecklist
   Descripcion: Dibuja la lista de products del cart activo.
   Parametros: Ninguno.
   Resultado: Cards interactivas para cada producto.
   Futuro: Integrar fotografias o codigos de barra reales. */
function renderProductChecklist(){
  const container = document.getElementById("productChecklist");
  if(!container) return;
  if(!operatorState.cart){
    container.innerHTML = `<div class="alert alert-info small mb-0" role="alert">Scan a cart to begin.</div>`;
    return;
  }
  container.innerHTML = operatorState.cart.products.map(renderProductCard).join("");
}

/* Funcion: renderProductCard
   Descripcion: Construye la tarjeta HTML de un producto.
   Parametros: product (objeto del cart).
   Resultado: HTML con estado, boton y metadatos.
   Futuro: Mostrar indicadores de calidad especificos. */
function renderProductCard(product){
  const completed = operatorState.completed.has(product.id);
  const isNext = operatorState.expectedOrder === product.expectedOrder;
  const hasError = operatorState.lastErrorProduct === product.id;
  const bottleInfo = product.bottle || {};
  const bottleBlock = product.type === "bottle"
    ? `<div class="small text-muted">Bottle: level ${bottleInfo.level || "n/a"} | seal ${bottleInfo.seal || "n/a"} | airline ${bottleInfo.airline || "n/a"}</div>`
    : "";
  const statusText = completed ? "Completed" : (isNext ? "Next in line" : "Pending");
  const statusClass = completed ? "text-success" : (isNext ? "text-primary" : "text-muted");
  return `
    <div class="operator-product ${completed ? "completed" : ""} ${hasError ? "error" : ""}" data-product-id="${product.id}">
      <div class="d-flex justify-content-between align-items-start gap-3">
        <div class="d-flex align-items-start gap-3">
          <span class="order-pill">${product.expectedOrder}</span>
          <div>
            <div class="fw-semibold">${product.name}</div>
            <div class="small text-muted">Quantity: ${product.quantity} | Location: ${product.location}</div>
            ${bottleBlock}
          </div>
        </div>
        <div class="text-end">
          <button class="btn btn-sm ${completed ? "btn-success" : "btn-outline-success"} operator-complete-btn" data-product-id="${product.id}" ${completed ? "disabled" : ""}>${completed ? "Ready" : "Check"}</button>
          <div class="small mt-2 ${statusClass}">${statusText}</div>
        </div>
      </div>
    </div>`;
}

/* Funcion: registerEvent
   Descripcion: Registra un evento cronologico en la bitacora.
   Parametros: type (clave), description (texto), meta (datos extra).
   Resultado: Evento almacenado y bitacora actualizada.
   Futuro: Enviar eventos a un sistema de monitoreo. */
function registerEvent(type, description, meta){
  operatorState.events.push({ type, description, meta: meta || {}, timestamp: Date.now() });
  if(operatorState.events.length > 60){
    operatorState.events.shift();
  }
  renderJournal();
}

/* Funcion: renderJournal
   Descripcion: Muestra la bitacora ordenada con los eventos mas recientes.
   Parametros: Ninguno.
   Resultado: Lista HTML con etiquetas y horarios.
   Futuro: Paginacion cuando existan mas eventos. */
function renderJournal(){
  const list = document.getElementById("operatorJournal");
  if(!list) return;
  if(!operatorState.events.length){
    list.innerHTML = `<li class="list-group-item text-muted">La bitacora se completara en tiempo real.</li>`;
    return;
  }
  list.innerHTML = operatorState.events.slice().reverse().map(ev=>{
    const badgeVariant = OPERATOR_EVENT_VARIANT[ev.type] || "secondary";
    const label = OPERATOR_EVENT_LABEL[ev.type] || ev.type;
    return `<li class="list-group-item d-flex justify-content-between align-items-start gap-3">
      <div>
        <div class="fw-semibold">${label}</div>
        <div class="small text-muted">${ev.description}</div>
      </div>
      <span class="badge text-bg-${badgeVariant}">${formatClock(ev.timestamp)}</span>
    </li>`;
  }).join("");
}

/* Funcion: persistOperatorCompletionLog
   Descripcion: Guarda el historial de carts en almacenamiento local.
   Parametros: Ninguno.
   Resultado: Persistencia actualizada para consultas futuras.
   Futuro: Sincronizar con sistemas centrales de KPI. */
function persistOperatorCompletionLog(){
  operatorStorage.completions = operatorCompletionLog;
  localStorage.setItem(OPERATOR_KEYS.completionLog, JSON.stringify(operatorCompletionLog));
}

/* Funcion: ensureCartLogEntry
   Descripcion: Garantiza la existencia de un registro de cart en la bitacora.
   Parametros: cart (objeto del cart activo).
   Resultado: Devuelve el registro listo para uso o null si no aplica.
   Futuro: Enriquecer con datos de flight adicionales. */
function ensureCartLogEntry(cart){
  if(!cart) return null;
  operatorCompletionLog = operatorCompletionLog.filter(entry=>entry && entry.cartId);
  let entry = operatorCompletionLog.find(e=>e.cartId===cart.id);
  if(!entry){
    entry = {
      cartId: cart.id,
      flight: cart.flight || "--",
      operator: cart.operator || "Without operator",
      startedAt: operatorState.startTime || Date.now(),
      finishedAt: null,
      totalItems: Array.isArray(cart.products) ? cart.products.length : 0,
      items: [],
      errors: 0
    };
    operatorCompletionLog.unshift(entry);
    if(operatorCompletionLog.length > 15){
      operatorCompletionLog.length = 15;
    }
  }else{
    entry.flight = cart.flight || entry.flight;
    entry.operator = cart.operator || entry.operator;
    entry.totalItems = Array.isArray(cart.products) ? cart.products.length : entry.totalItems;
    entry.startedAt = entry.startedAt || operatorState.startTime || Date.now();
  }
  return entry;
}

/* Funcion: recordOperatorCompletion
   Descripcion: Registra una mini tarea marcada por el operator.
   Parametros: product (objeto del producto actual).
   Resultado: Bitacora agrupada por cart actualizada.
   Futuro: Validar contra caducidades de products. */
function recordOperatorCompletion(product){
  if(!operatorState.cart || !product) return;
  const entry = ensureCartLogEntry(operatorState.cart);
  if(!entry) return;
  if(entry.items.some(item=>item.productId===product.id)) return;
  entry.items.push({
    productId: product.id,
    name: product.name,
    completedAt: Date.now(),
    order: product.expectedOrder || entry.items.length+1
  });
  entry.items.sort((a,b)=>(a.order||0)-(b.order||0));
  entry.totalItems = Math.max(entry.totalItems, entry.items.length);
  persistOperatorCompletionLog();
  renderOperatorCompletions();
}

/* Funcion: renderOperatorCompletions
   Descripcion: Muestra el consolidado de carts para el lider.
   Parametros: Ninguno.
   Resultado: Lista agrupada por cart con detalle expandible.
   Futuro: Agregar filtros por estado o flight. */
function renderOperatorCompletions(){
  const container = document.getElementById("operatorCompletionList");
  if(!container) return;
  if(!operatorCompletionLog.length){
    container.innerHTML = `<div class="list-group-item text-muted">Without carts registrados todavia.</div>`;
    return;
  }
  container.innerHTML = operatorCompletionLog.map(entry=>{
    const finished = !!entry.finishedAt;
    const badgeClass = finished ? "text-bg-success" : "text-bg-warning";
    const badgeLabel = finished ? "Completado" : "En curso";
    const errorsBadge = entry.errors ? `<span class="badge text-bg-danger ms-2">Errores ${entry.errors}</span>` : "";
    const startedText = formatDateTime(entry.startedAt || Date.now());
    const finishedText = finished ? ` - Cierre ${formatDateTime(entry.finishedAt)}` : "";
    const totalSummary = `${entry.items.length}/${entry.totalItems || entry.items.length}`;
    const itemsHtml = entry.items.length
      ? entry.items.map(item=>`<li><strong>${item.productId}</strong> - ${item.name} <span class="text-muted">(${formatDateTime(item.completedAt)})</span></li>`).join("")
      : `<li class="text-muted">Without items completados todavia.</li>`;
    const openAttr = finished ? "" : " open";
    return `<div class="list-group-item">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <div class="fw-semibold">Cart ${entry.cartId}</div>
          <div class="small text-muted">${entry.operator} - Flight ${entry.flight || "--"}</div>
          <div class="small text-muted">Inicio ${startedText}${finishedText}</div>
        </div>
        <div>
          <span class="badge ${badgeClass}">${badgeLabel}</span>${errorsBadge}
        </div>
      </div>
      <details class="mt-2 small"${openAttr}>
        <summary class="text-primary">Ver items (${totalSummary})</summary>
        <ul class="mt-2 mb-0 ps-3">
          ${itemsHtml}
        </ul>
      </details>
    </div>`;
  }).join("");
}

/* Funcion: persistOperatorIncidents
   Descripcion: Sincroniza las incidencias de Operator Mode con el almacenamiento local.
   Parametros: Ninguno.
   Resultado: Persistencia de incidencias lista para el lider.
   Futuro: Integrar con sistema de tickets. */
function persistOperatorIncidents(){
  operatorStorage.incidents = operatorIncidentLog;
  localStorage.setItem(OPERATOR_KEYS.incidents, JSON.stringify(operatorIncidentLog));
}

/* Funcion: renderOperatorIncidents
   Descripcion: Actualiza la vista de incidencias en Leader View.
   Parametros: Ninguno.
   Resultado: Lista amigable para accion rapida del lider.
   Futuro: Incluir filtros por estado o tipo. */
function renderOperatorIncidents(){
  const list = document.getElementById("operatorIncidentList");
  if(!list) return;
  if(!operatorIncidentLog.length){
    list.innerHTML = `<div class="list-group-item text-muted">Without incidencias registradas.</div>`;
    return;
  }
  list.innerHTML = operatorIncidentLog.map(incident=>{
    const statusClass = incident.status === "resolved" ? "text-bg-secondary" : incident.status === "converted" ? "text-bg-info" : "text-bg-warning";
    const statusLabel = incident.status === "resolved" ? "Resuelto" : incident.status === "converted" ? "Convertido" : "Pendiente";
    const target = incident.typeLabel || incident.type;
    const cartLine = incident.cartId ? `Cart ${incident.cartId}` : "Cart without especificar";
    const operatorLine = incident.operator ? ` - Operator ${incident.operator}` : "";
    const flightLine = incident.flight && incident.flight !== "--" ? ` - Flight ${incident.flight}` : "";
    const buttons = [];
    if(incident.status === "open"){
      buttons.push(`<button class="btn btn-sm btn-primary" onclick="createTaskFromIncident('${incident.id}')">Create task</button>`);
    }
    if(incident.status !== "resolved"){
      buttons.push(`<button class="btn btn-sm btn-outline-success" onclick="resolveOperatorIncident('${incident.id}')">Check resolved</button>`);
    }
    return `<div class="list-group-item">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <div class="fw-semibold">${target}</div>
          <div class="small text-muted">${cartLine}${operatorLine}${flightLine}</div>
          <div class="small text-muted">${formatDateTime(incident.ts)}</div>
          <div class="small mt-2">${incident.description}</div>
        </div>
        <span class="badge ${statusClass}">${statusLabel}</span>
      </div>
      <div class="d-flex flex-wrap gap-2 mt-3">
        ${buttons.join("") || `<span class="text-muted small">No hay acciones pendientes.</span>`}
      </div>
    </div>`;
  }).join("");
}

/* Funcion: createTaskFromIncident
   Descripcion: Convierte una incidencia en tarea del backlog.
   Parametros: incidentId (string).
   Resultado: Nueva tarea creada y lista para ser asignada.
   Futuro: Permitir asignacion automatica segun area. */
function createTaskFromIncident(incidentId){
  const incident = operatorIncidentLog.find(i=>i.id===incidentId);
  if(!incident) return;
  if(incident.status !== "open"){
    toast("Esta incidencia ya fue gestionada","info");
    return;
  }
  const role = INCIDENT_ROLE_MAP[incident.type] || "Support";
  const category = INCIDENT_CATEGORY_MAP[incident.type] || "Service";
  const taskId = "INC"+Math.random().toString(36).slice(2,7).toUpperCase();
  const newTask = {
    id: taskId,
    title: `Incidente ${incident.cartId || ""} (${incident.typeLabel || incident.type})`.trim(),
    reqRole: role,
    priority: 4,
    effort: 1,
    cat: category,
    notes: `[Operator incident] ${incident.description} - Reportado por ${incident.operator || "Operator"} el ${formatDateTime(incident.ts)}.`
  };
  tasks.push(newTask);
  cacheTask(newTask);
  renderTasks();
  incident.status = "converted";
  persistOperatorIncidents();
  renderOperatorIncidents();
  toast("Incidencia convertida en tarea de backlog","primary");
  if(typeof openAssignModal === "function"){
    openAssignModal(taskId);
  }
}

/* Funcion: resolveOperatorIncident
   Descripcion: Marca una incidencia como resuelta para seguimiento del lider.
   Parametros: incidentId (string).
   Resultado: Incidencia actualizada y guardada.
   Futuro: Registrar quien resolvio la incidencia. */
function resolveOperatorIncident(incidentId){
  const incident = operatorIncidentLog.find(i=>i.id===incidentId);
  if(!incident) return;
  if(incident.status === "resolved"){
    toast("La incidencia ya fue resuelta","info");
    return;
  }
  incident.status = "resolved";
  persistOperatorIncidents();
  renderOperatorIncidents();
  toast("Incidencia marcada como resuelta","success");
}

function renderWorkerSelector(){
  $("#workerSelect").innerHTML = employees
    .filter(e=>e.role!=="Leader")
    .map(e=>`<option value="${e.id}" ${workerMeta.selected===e.id?'selected':''}>${e.name} -- ${e.role} (Team ${e.group})</option>`).join("");
}
function init(){
  tasks.forEach(cacheTask);
  renderEmployees();
  renderTasks();
  renderWorkerSelector();
  renderMyTasks();
  renderIssues();
}
init();
initOperatorMode();
initTrolleyModule();

// === Trolley Set: flujo por pantallas (without romper la lógica existente) ===
(function(){
  // 0 = idle, 2 = checklist, 3 = botella, 4 = resumen
  let trolleyFlowStep = 0;

  function setTrolleyFlowStep(step){
    trolleyFlowStep = step;
    const qrCard = document.getElementById('trolleyQRStepCard');
    const checklistCard = document.getElementById('trolleyChecklistCard');
    const bottleCalcCard = document.getElementById('trolleyBottleCalcCard');
    const summaryCard = document.getElementById('trolleySummaryCard');
    const entryWeight = document.getElementById('entryWeightCard');
    const discardBottle = document.getElementById('discardBottleCard');
    const entryWeightReqText = document.getElementById('entryWeightRequirement');
    const alertsCard = document.getElementById('trolleyAlert')?.closest('.card');
    const bottleOldCard = document.getElementById('trolleyBottleModuleCard');

    if(qrCard) qrCard.hidden = true;
    if(checklistCard) checklistCard.hidden = true;
    if(bottleCalcCard) bottleCalcCard.hidden = true;
    if(bottleOldCard) bottleOldCard.hidden = true;
    if(discardBottle) discardBottle.hidden = true;
    if(summaryCard) summaryCard.hidden = true;
    if(entryWeight) entryWeight.hidden = true;
    if(alertsCard) alertsCard.hidden = (step===1);

    if(step===2){
      if(checklistCard) checklistCard.hidden = false;
      const hasBottles = Array.isArray(window.trolleyState?.cart?.products) && window.trolleyState.cart.products.some(p=>p.type==='bottle');
      const wrap = document.getElementById('goBottleCalcWrap');
      if(wrap) wrap.hidden = !hasBottles;
    }else if(step === 3){
      // LÓGICA ALEATORIA AÑADIDA
      const rand = Math.random();

      if (rand < 0.5) { 
        // CASO 1: Desechar Bottle (Política de Aerolínea)
        if (discardBottle) discardBottle.hidden = false;

      } else { 
        // CASO 2: Necesita Complemento (con atributo de peso aleatorio)
        const minWeight = 300 + Math.floor(Math.random() * 200); // Peso aleatorio entre 300g y 499g

        // Este es el "atributo oculto" que pediste, se genera y aplica dinámicamente
        if (entryWeightReqText) {
          entryWeightReqText.textContent = `Find a bottle at least of ${minWeight} grams`;
        }
        if (entryWeight) entryWeight.hidden = false;
      }

    }else if(step===4){
      if(summaryCard) summaryCard.hidden = false;
    }else{
      // idle => muestra checklist vacío (mensaje informativo) para mantener UX conocida
      if(checklistCard) checklistCard.hidden = false;
    }
  }

  // Al tocar "Escanear Cart QR": no abrir cámara, solo avanzar a checklist.
  const scanBtn = document.getElementById('trolleyScanBtn');
  if(scanBtn){
    scanBtn.addEventListener('click', function(){
      // initTrolleyModule ya simula el cart (listener existente); aquí solo conmutamos la vista
      setTimeout(function(){
        setTrolleyFlowStep(2);
        ensureCSVLoaded();
        updateBottleCalcAirline();
      }, 0);
    });
  }

  // Botón para pasar al cálculo de botellas
  document.getElementById('goBottleCalcBtn')?.addEventListener('click', function(){
    setTrolleyFlowStep(3);
  });


  // ====== Calculo de botella (CSV -> referencias -> decision) ======
  let BC_ROWS = [];
  let BC_REF = new Map(); // key: Brand|Bottle_Size -> { empty, full }

  function parsePercent(str){
    const m = String(str||'').match(/\d+(?:\.\d+)?/);
    const v = m ? parseFloat(m[0]) : NaN;
    return isFinite(v) ? v/100 : NaN;
  }

  function buildBottleReferences(rows){
    const groups = new Map();
    rows.forEach(r=>{
      const brand = (r.Brand||'').trim();
      const size = String(r.Bottle_Size||'').trim();
      const y = parseFloat(r.full_weight_g);
      const p = parsePercent(r.Fill_Level);
      if(!brand || !size || !isFinite(y) || !isFinite(p)) return;
      const key = brand+'|'+size;
      (groups.get(key) || groups.set(key, []).get(key)).push({p,y});
    });
    BC_REF = new Map();
    groups.forEach((arr, key)=>{
      // usar dos puntos distintos si existen
      const uniq = [];
      arr.forEach(it=>{ if(!uniq.some(u=>Math.abs(u.p - it.p) < 1e-6)) uniq.push(it); });
      let empty=null, full=null;
      if(uniq.length>=2){
        const p1 = uniq[0].p, y1 = uniq[0].y;
        const p2 = uniq[1].p, y2 = uniq[1].y;
        const det = (p2 - p1);
        if(Math.abs(det) > 1e-6){
          empty = (y1*p2 - y2*p1) / det;
          full  = (y2*(1-p1) - y1*(1-p2)) / det;
        }
      }
      if(!isFinite(empty) || !isFinite(full)){
        const ys = arr.map(it=>it.y);
        empty = Math.min(...ys);
        full  = Math.max(...ys);
      }
      BC_REF.set(key, { empty, full });
    });
  }

  function populateBottleSelectors(){
    const brandSel = document.getElementById('bcBrand');
    const sizeSel = document.getElementById('bcSize');
    if(!brandSel || !sizeSel) return;
    const brands = [...new Set(BC_ROWS.map(r=>String(r.Brand||'').trim()).filter(Boolean))].sort();
    brandSel.innerHTML = brands.map(b=>`<option value="${b}">${b}</option>`).join('');
    function refreshSizes(){
      const brand = brandSel.value;
      const sizes = [...new Set(BC_ROWS.filter(r=>String(r.Brand||'').trim()===brand).map(r=>String(r.Bottle_Size||'').trim()).filter(Boolean))].sort((a,b)=>parseFloat(a)-parseFloat(b));
      sizeSel.innerHTML = sizes.map(s=>`<option value="${s}">${s}</option>`).join('');
    }
    brandSel.onchange = refreshSizes;
    refreshSizes();
  }

  async function ensureCSVLoaded(){
    if(BC_ROWS.length) return;
    const hint = document.getElementById('csvLoadHint');
    try{
      const resp = await fetch('datos_alchol.csv', { cache: 'no-store' });
      if(!resp.ok) throw new Error('HTTP '+resp.status);
      const text = await resp.text();
      const parsed = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true });
      BC_ROWS = parsed?.data || [];
      buildBottleReferences(BC_ROWS);
      populateBottleSelectors();
      if(hint){ hint.className='alert alert-success small'; hint.textContent='Datos cargados desde datos_alchol.csv'; }
    }catch(err){
      if(hint){ hint.className='alert alert-warning small'; hint.textContent='No se pudo cargar automaticamente. Sube el CSV manualmente abajo.'; }
    }
  }

  document.getElementById('bcCsvFile')?.addEventListener('change', function(e){
    const file = e.target.files?.[0];
    if(!file) return;
    Papa.parse(file, { header: true, dynamicTyping: true, skipEmptyLines: true, complete: (res)=>{
      BC_ROWS = res?.data || [];
      buildBottleReferences(BC_ROWS);
      populateBottleSelectors();
      const hint = document.getElementById('csvLoadHint');
      if(hint){ hint.className='alert alert-success small'; hint.textContent='CSV cargado manualmente.'; }
    }});
  });

  function getCartAirlineCode(){
    const flight = window.trolleyState?.cart?.flight || '';
    const m = String(flight).match(/^[A-Z]{2,3}/i);
    return m ? m[0].toUpperCase() : '';
  }
  function updateBottleCalcAirline(){
    const code = getCartAirlineCode();
    const el = document.getElementById('bcAirline');
    if(el) el.textContent = code || '--';
  }

  const AIRLINE_THRESHOLDS = {
    EK: { discardBelow: 0.30, refillBelow: 0.80 },
    AMX: { discardBelow: 0.25, refillBelow: 0.80 },
    BA: { discardBelow: 0.20, refillBelow: 0.85 },
    QR: { discardBelow: 0.25, refillBelow: 0.85 },
    EY: { discardBelow: 0.20, refillBelow: 0.80 },
    AF: { discardBelow: 0.20, refillBelow: 0.80 },
    LH: { discardBelow: 0.20, refillBelow: 0.80 },
    CX: { discardBelow: 0.25, refillBelow: 0.85 },
    SQ: { discardBelow: 0.20, refillBelow: 0.85 },
    LX: { discardBelow: 0.20, refillBelow: 0.80 },
    TK: { discardBelow: 0.25, refillBelow: 0.80 },
    DEFAULT: { discardBelow: 0.25, refillBelow: 0.80 }
  };

  function decideBottleAction(fillFrac, airlineCode){
    const pol = AIRLINE_THRESHOLDS[airlineCode] || AIRLINE_THRESHOLDS.DEFAULT;
    if(fillFrac <= pol.discardBelow) return { label: 'Desechar', cls: 'text-bg-danger' };
    if(fillFrac < pol.refillBelow) return { label: 'Rellenar', cls: 'text-bg-warning' };
    return { label: 'Buena (dejar)', cls: 'text-bg-success' };
  }

  document.getElementById('bcCalcBtn')?.addEventListener('click', function(){
    const brand = document.getElementById('bcBrand')?.value;
    const size = document.getElementById('bcSize')?.value;
    const weight = parseFloat(document.getElementById('bcWeight')?.value);
    if(!brand || !size || !isFinite(weight)){
      toast('Selecciona marca, tamaño e ingresa el peso','warning');
      return;
    }
    const ref = BC_REF.get(brand+'|'+size);
    if(!ref || !isFinite(ref.empty) || !isFinite(ref.full) || ref.full<=ref.empty){
      toast('No hay referencia valida para esa marca/tamaño','danger');
      return;
    }
    const frac = Math.max(0, Math.min(1, (weight - ref.empty) / (ref.full - ref.empty)));
    const pct = Math.round(frac*100);
    const code = getCartAirlineCode();
    const decision = decideBottleAction(frac, code);
    const resBox = document.getElementById('bcResult');
    const pctEl = document.getElementById('bcPercent');
    const refEl = document.getElementById('bcRefInfo');
    const decBadge = document.getElementById('bcDecisionBadge');
    if(resBox) resBox.hidden = false;
    if(pctEl) pctEl.textContent = `${pct}%`;
    if(refEl) refEl.textContent = `Ref: vacia ~ ${ref.empty.toFixed(1)} g | llena ~ ${ref.full.toFixed(1)} g`;
    if(decBadge){ decBadge.className = `badge ${decision.cls}`; decBadge.textContent = decision.label; }
  });

  // Estado inicial en checklist vacío
  setTrolleyFlowStep(0);
  window.setTrolleyFlowStep = setTrolleyFlowStep;
})();

(function(){
  document.addEventListener('DOMContentLoaded', function(){
    const navUl = document.querySelector('ul.nav.nav-tabs');
    const tabContent = document.querySelector('.tab-content');
    if(!navUl || !tabContent) return;

    // Create Builder Tab pane
    const pane = document.createElement('div');
    pane.className = 'tab-pane fade';
    pane.id = 'builder';
    pane.setAttribute('role','tabpanel');
    pane.innerHTML = `
      <div class="row g-3">
        <div class="col-12">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <div>
                <h5 class="mb-0">Armado de Trolley</h5>
                <small class="text-muted">Secuencia guiada: producto → cantidad → ubicación</small>
              </div>
              <div class="d-flex gap-2">
                <select id="builderDemoSelect" class="form-select form-select-sm">
                  <option value="">Seleccionar cart (demo)</option>
                </select>
                <button id="builderStartBtn" class="btn btn-primary btn-sm">Iniciar</button>
              </div>
            </div>
            <div class="card-body">
              <div id="builderIdle" class="text-center py-5">
                <div class="text-muted">Elige un cart demo y presiona <b>Iniciar</b> para comenzar.</div>
              </div>

              <div id="builderWorking" class="d-none">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <div><span class="badge bg-primary" id="builderCartBadge"></span></div>
                  <div class="flex-grow-1 mx-3">
                    <div class="progress" role="progressbar" aria-label="Avance">
                      <div class="progress-bar" id="builderProgress" style="width:0%"></div>
                    </div>
                    <small class="text-muted"><span id="builderStep">0</span>/<span id="builderTotal">0</span> completados</small>
                  </div>
                  <button class="btn btn-outline-danger btn-sm" id="builderIssueBtn">Problema</button>
                </div>

                <div class="card mb-3">
                  <div class="card-body">
                    <div class="display-6 mb-2" id="builderProdName">—</div>
                    <div class="fs-5"><b>Quantity:</b> <span id="builderQty">—</span></div>
                    <div class="fs-5"><b>Ubicación:</b> <span id="builderLoc">—</span></div>
                    <div class="form-check form-switch my-3">
                      <input class="form-check-input" type="checkbox" role="switch" id="builderPlaced">
                      <label class="form-check-label fw-semibold" for="builderPlaced">Ya coloqué este producto</label>
                    </div>
                    <div class="d-grid gap-2">
                      <button id="builderNext" class="btn btn-primary btn-lg py-3 fw-bold" disabled>Siguiente producto</button>
                    </div>
                  </div>
                </div>

                <div class="alert alert-warning small">
                  Consejo: solo podrás avanzar si confirmas que el producto fue colocado.
                </div>
              </div>

              <div id="builderDone" class="d-none text-center py-5">
                <h5 class="mb-1">¡Trolley completo!</h5>
                <div class="text-muted">Has colocado todos los products en orden.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    tabContent.appendChild(pane);

    // Styles for bigger touch targets
    const style = document.createElement('style');
    style.textContent = `
      #builder .btn-lg{ font-size:1.25rem; border-radius:1rem; }
      #builder .form-check-input{ width:3rem; height:1.5rem; }
      #builder .display-6{ line-height:1.2; }
    `;
    document.head.appendChild(style);

    // State
    const state = {
      cart: null, items: [], idx: 0,
      context(){ return { cartId: this.cart?.id || '', product: this.items[this.idx] || null }; }
    };

    // Populate demo carts from OPERATOR_DEMOS if available
    const demoSelect = document.getElementById('builderDemoSelect');
    if(Array.isArray(window.OPERATOR_DEMOS)){
      window.OPERATOR_DEMOS.forEach((d, i)=>{
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = `${d.id} — Flight ${d.flight}`;
        demoSelect.appendChild(opt);
      });
    }

    // Elements
    const startBtn = document.getElementById('builderStartBtn');
    const idle = document.getElementById('builderIdle');
    const working = document.getElementById('builderWorking');
    const done = document.getElementById('builderDone');
    const cartBadge = document.getElementById('builderCartBadge');
    const prog = document.getElementById('builderProgress');
    const step = document.getElementById('builderStep');
    const total = document.getElementById('builderTotal');
    const prodName = document.getElementById('builderProdName');
    const qty = document.getElementById('builderQty');
    const loc = document.getElementById('builderLoc');
    const placed = document.getElementById('builderPlaced');
    const nextBtn = document.getElementById('builderNext');
    const issueBtn = document.getElementById('builderIssueBtn');

    function render(){
      if(!state.cart){ idle.classList.remove('d-none'); working.classList.add('d-none'); done.classList.add('d-none'); return; }
      idle.classList.add('d-none');
      const totalItems = state.items.length;
      total.textContent = totalItems;
      step.textContent = Math.min(state.idx, totalItems);
      prog.style.width = (totalItems? (state.idx/totalItems*100):0) + '%';
      cartBadge.textContent = state.cart.id;

      if(state.idx >= totalItems){
        working.classList.add('d-none');
        done.classList.remove('d-none');
        return;
      }
      done.classList.add('d-none');
      working.classList.remove('d-none');

      const item = state.items[state.idx];
      prodName.textContent = item.name;
      qty.textContent = item.quantity ?? '—';
      loc.textContent = item.location ?? '—';
      placed.checked = false;
      nextBtn.disabled = true;
      nextBtn.textContent = (state.idx === totalItems-1) ? 'Finalizar' : 'Siguiente producto';
    }

    placed.addEventListener('change', ()=>{
      nextBtn.disabled = !placed.checked;
    });

    nextBtn.addEventListener('click', ()=>{
      if(!placed.checked) return;
      state.idx += 1;
      render();
    });

    // Issue reporting: reuse operatorIncidentModal
    issueBtn.addEventListener('click', ()=>{
      const ctx = state.context();
      const modalEl = document.getElementById('operatorIncidentModal');
      if(!modalEl){ alert('No se encontró el modal de incidencias.'); return; }
      modalEl.dataset.origin = 'builder';
      modalEl.dataset.cartId = ctx.cartId || '';
      modalEl.dataset.productId = ctx.product?.id || '';
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    });

    // Ensure we have a handler for form submit (append, not replace existing)
    const form = document.getElementById('operatorIncidentForm');
    if(form){
      form.addEventListener('submit', function(e){
        // Let any pre-existing handlers run too (do not prevent default unless needed)
        // We will append a line into operatorIncidentList with origin details
        setTimeout(()=>{
          try{
            const modalEl = document.getElementById('operatorIncidentModal');
            const list = document.getElementById('operatorIncidentList');
            const text = document.getElementById('operatorIncidentText')?.value?.trim() || '';
            const type = document.getElementById('operatorIncidentType')?.value || '';
            const origin = modalEl?.dataset?.origin || 'operator';
            const cartId = modalEl?.dataset?.cartId || '';
            const productId = modalEl?.dataset?.productId || '';

            if(list && text){
              // Remove placeholder if present
              const first = list.querySelector('.list-group-item.text-muted');
              if(first) first.remove();
              const item = document.createElement('div');
              item.className = 'list-group-item';
              const when = new Date().toLocaleString();
              item.innerHTML = `<div class="d-flex justify-content-between">
                  <div><b>${type}</b> — ${text} <small class="text-muted">(${origin}${cartId? ' · '+cartId:''}${productId? ' · '+productId:''})</small></div>
                  <small class="text-muted">${when}</small>
                </div>`;
              list.prepend(item);
            }
          }catch(err){ console.warn('Builder issue hook error', err); }
        }, 0);
      }, { passive: true });
    }

    // Start button
    startBtn.addEventListener('click', ()=>{
      const idx = demoSelect.value;
      if(idx === ''){ alert('Selecciona un cart demo.'); return; }
      const demo = window.OPERATOR_DEMOS?.[Number(idx)];
      if(!demo){ alert('Cart demo inválido'); return; }
      state.cart = demo;
      // Only essential info: product, quantity, location; respect expectedOrder if present
      const items = Array.from(demo.products || [])
        .map(p => ({ id:p.id, name:p.name, quantity:p.quantity, location:p.location, expectedOrder:p.expectedOrder ?? 9999 }))
        .sort((a,b)=> (a.expectedOrder||9999) - (b.expectedOrder||9999));
      state.items = items;
      state.idx = 0;
      render();
      // Auto switch to the pane if the tab isn't active yet
      const triggerBtn = li.querySelector('button.nav-link');
      if(triggerBtn){ triggerBtn.click(); }
    });

    // Initial render
    render();
  });
})();