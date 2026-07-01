import { useState, useEffect, useCallback } from "react";

const tg = window?.Telegram?.WebApp || null;
const BOT_API = import.meta.env.VITE_BOT_API_URL || "";

function getTgChatId() {
  try { return tg?.initDataUnsafe?.user?.id?.toString() || null; } catch { return null; }
}
async function syncToBot(chatId, data) {
  if (!chatId || !BOT_API) return;
  try { await fetch(`${BOT_API}/sync/${chatId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); } catch {}
}
async function loadFromBot(chatId) {
  if (!chatId || !BOT_API) return null;
  try { const r = await fetch(`${BOT_API}/data/${chatId}`); if (r.ok) return await r.json(); } catch {}
  return null;
}

const STORAGE_KEY = "okr_v4";
const DEFAULT_DATA = {
  objectives: [
    {
      id: "q3_o1", title: "Запустить Surprise и набрать обороты", quarter: "Q3 2026",
      keyResults: [
        { id: "q3_o1_kr1", title: "Открытие состоялось 15 июля", current: 0, target: 1, unit: "факт" },
        { id: "q3_o1_kr2", title: "Выручка ₽/мес к сентябрю", current: 0, target: 5000000, unit: "₽" },
        { id: "q3_o1_kr3", title: "Рентабельность к сентябрю", current: 0, target: 18, unit: "%" },
      ]
    },
    {
      id: "q3_o2", title: "Ordery — первые продажи и внедрения", quarter: "Q3 2026",
      keyResults: [
        { id: "q3_o2_kr1", title: "Платящих ресторанов подключено", current: 0, target: 10, unit: "клиентов" },
        { id: "q3_o2_kr2", title: "MRR покрывает команду", current: 0, target: 500000, unit: "₽" },
        { id: "q3_o2_kr3", title: "Клиент прошёл полный цикл внедрения", current: 0, target: 1, unit: "факт" },
      ]
    },
    {
      id: "q3_o3", title: "Личная чистая прибыль 300 000 ₽/мес", quarter: "Q3 2026",
      keyResults: [
        { id: "q3_o3_kr1", title: "Чистая прибыль со всех проектов в сентябре", current: 0, target: 300000, unit: "₽" },
      ]
    },
    {
      id: "q4_o1", title: "Surprise — 8 млн выручки и старт второй точки", quarter: "Q4 2026",
      keyResults: [
        { id: "q4_o1_kr1", title: "Выручка к декабрю", current: 0, target: 8000000, unit: "₽" },
        { id: "q4_o1_kr2", title: "Рентабельность", current: 0, target: 20, unit: "%" },
        { id: "q4_o1_kr3", title: "Договор на вторую точку подписан", current: 0, target: 1, unit: "факт" },
      ]
    },
    {
      id: "q4_o2", title: "Ordery — масштабирование продаж", quarter: "Q4 2026",
      keyResults: [
        { id: "q4_o2_kr1", title: "Платящих клиентов", current: 0, target: 15, unit: "клиентов" },
        { id: "q4_o2_kr2", title: "MRR", current: 0, target: 450000, unit: "₽" },
        { id: "q4_o2_kr3", title: "Внедрений с подтверждённым ROI", current: 0, target: 3, unit: "штук" },
      ]
    },
    {
      id: "q4_o3", title: "Личная чистая прибыль 600 000 ₽/мес", quarter: "Q4 2026",
      keyResults: [
        { id: "q4_o3_kr1", title: "Чистая прибыль со всех проектов в декабре", current: 0, target: 600000, unit: "₽" },
        { id: "q4_o3_kr2", title: "Surprise чистыми", current: 0, target: 300000, unit: "₽" },
        { id: "q4_o3_kr3", title: "Ordery чистыми", current: 0, target: 200000, unit: "₽" },
      ]
    },
  ],
  todayTasks: [],
  routines: [
    { id: "r1", title: "Daily standup", frequency: "daily", lastDone: null, description: "5 мин: что сделал, что делаю, что блокирует" },
    { id: "r2", title: "OKR Weekly Review", frequency: "weekly", dayOfWeek: 1, lastDone: null, description: "Обновить KR, выбрать 3 задачи на неделю" },
    { id: "r3", title: "Monthly Check-in", frequency: "monthly", dayOfMonth: 1, lastDone: null, description: "Оценить траекторию, скорректировать подход" },
    { id: "r4", title: "Квартальное планирование", frequency: "quarterly", lastDone: null, description: "Ретро + новые цели на квартал" },
  ],
};

function loadLocal() {
  try { const r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch {}
  return DEFAULT_DATA;
}
function saveLocal(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} }
function todayStr() { return new Date().toISOString().split("T")[0]; }
function isRoutineDue(r) {
  if (!r || r.lastDone === todayStr()) return false;
  const now = new Date();
  if (r.frequency === "daily") return true;
  if (r.frequency === "weekly") return now.getDay() === (r.dayOfWeek ?? 1);
  if (r.frequency === "monthly") return now.getDate() === (r.dayOfMonth ?? 1);
  if (r.frequency === "quarterly") { const m = now.getMonth(); return now.getDate() === 1 && [0,3,6,9].includes(m); }
  return false;
}
function pct(current, target) { return !target ? 0 : Math.min(100, Math.round((current / target) * 100)); }
function objPct(obj) {
  const krs = obj.keyResults || [];
  if (!krs.length) return 0;
  return Math.round(krs.reduce((s, kr) => s + pct(kr.current, kr.target), 0) / krs.length);
}
function fmt(n) { return Number(n).toLocaleString("ru-RU"); }

// ── UI atoms ──────────────────────────────────────────────────────────────────
function Bar({ value, color = "#6366F1", h = 6 }) {
  const c = value >= 70 ? "#22D3EE" : value >= 40 ? "#6366F1" : "#F59E0B";
  return (
    <div style={{ background: "#ffffff0f", borderRadius: 99, height: h, overflow: "hidden" }}>
      <div style={{ width: `${value}%`, background: color || c, height: "100%", borderRadius: 99, transition: "width 0.4s ease" }} />
    </div>
  );
}

function Section({ title, children, action }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "#475569", textTransform: "uppercase" }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Screens ───────────────────────────────────────────────────────────────────
const SCREENS = ["dashboard", "goals", "routines", "guide"];

const GUIDE = [
  { id: "what", emoji: "01", title: "Что такое OKR", body: "OKR = Objectives + Key Results.\n\nObjective — куда идёшь. Амбициозно, вдохновляет.\nKey Result — как поймёшь что дошёл. Всегда число.\nЗадача дня — что делаешь сегодня чтобы сдвинуть KR.\n\nЦепочка: Задача → KR → Objective." },
  { id: "obj", emoji: "02", title: "Как писать Objective", body: "Отвечает на «чего хочу достичь», не «что сделать».\n\n✅ «Вывести Surprise IS на устойчивую выручку»\n✅ «Стать лидером динамического ценообразования в HoReCa»\n\n❌ «Сделать 10 звонков» — задача\n❌ «Увеличить продажи» — размыто\n\nПравило: цель должна немного пугать." },
  { id: "kr", emoji: "03", title: "Как писать Key Results", body: "KR — измеримое доказательство. Всегда число. 2–4 KR на цель.\n\n✅ «Подписано 5 ресторанов» (0→5)\n✅ «MRR достиг 250 000 ₽»\n\n❌ «Улучшить отношения» — не измеримо\n❌ «Провести 20 встреч» — активность, не результат\n\nПроверка: «Если KR 100% — цель точно выполнена?»" },
  { id: "tasks", emoji: "04", title: "Задачи и KR", body: "Каждая задача должна двигать KR. Если не двигает — зачем?\n\nПравило трёх: максимум 3 задачи в день которые реально сдвигают иглу.\n\nПеред добавлением: «Какой KR это продвигает?»" },
  { id: "rituals", emoji: "05", title: "Рутины OKR", body: "📅 Ежедневно (5 мин): что сделал, что делаю, что блокирует\n\n📋 Еженедельно пн (30 мин): обнови KR, выбери 3 задачи\n\n📊 1-го числа (1 час): оцени траекторию, скорректируй подход\n\n🎯 Раз в квартал (2-3 ч): ретро + новые цели" },
  { id: "change", emoji: "06", title: "Когда менять цели", body: "Objectives — раз в квартал, не чаще.\n\nKR можно скорректировать на monthly check-in если:\n• Цифра изначально нереальна\n• Изменились внешние условия\n• KR не тот — достигается, но цель не приближается\n\nОценка квартала: 0.7–1.0 отлично, 0.4–0.6 нормально, 0–0.3 разбери почему" },
  { id: "mistakes", emoji: "07", title: "Частые ошибки", body: "❌ Больше 3 целей — теряется фокус\n❌ KR = задача (не число, не результат)\n❌ Не обновлять прогресс раз в неделю\n❌ Только комфортные цели (норма попадания — 70%)\n❌ Задачи без привязки к KR" },
];

function GuideCard({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "#0F0F18", border: "1px solid #ffffff08", borderRadius: 14, marginBottom: 8, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", background: "none", border: "none", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6366F1", fontFamily: "monospace", minWidth: 20, textAlign: "center" }}>{item.emoji}</span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#E2E8F0" }}>{item.title}</span>
        <span style={{ color: "#475569", fontSize: 13, transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid #ffffff08" }}>
          {item.body.split("\n").map((line, i) => {
            if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
            const bold = ["✅","❌","📅","📋","📊","🎯","⚡"].some(e => line.startsWith(e));
            return <div key={i} style={{ fontSize: 13, lineHeight: 1.7, color: bold ? "#E2E8F0" : "#64748B", fontWeight: bold ? 600 : 400, marginTop: bold ? 4 : 0 }}>{line}</div>;
          })}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(() => loadLocal());
  const [screen, setScreen] = useState("dashboard");
  const [chatId] = useState(() => getTgChatId());
  const [syncing, setSyncing] = useState(false);

  // task input
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskKR, setNewTaskKR] = useState("");

  // KR inline edit
  const [editKR, setEditKR] = useState(null); // {objId, krId, val}

  // add objective
  const [addingObj, setAddingObj] = useState(false);
  const [newObjTitle, setNewObjTitle] = useState("");
  const [newObjQ, setNewObjQ] = useState("Q3 2026");

  // add KR
  const [addingKR, setAddingKR] = useState(null); // objId
  const [newKRTitle, setNewKRTitle] = useState("");
  const [newKRTarget, setNewKRTarget] = useState("");
  const [newKRUnit, setNewKRUnit] = useState("");

  useEffect(() => {
    if (tg) { try { tg.ready(); tg.expand(); tg.setHeaderColor?.("#07070F"); } catch {} }
  }, []);

  useEffect(() => {
    if (!chatId) return;
    setSyncing(true);
    loadFromBot(chatId).then(remote => {
      if (remote) {
        setData(prev => {
          const merged = {
            objectives: remote.objectives ?? prev.objectives ?? [],
            todayTasks: remote.todayTasks ?? prev.todayTasks ?? [],
            routines: remote.routines ?? prev.routines ?? DEFAULT_DATA.routines,
          };
          saveLocal(merged);
          return merged;
        });
      }
    }).catch(() => {}).finally(() => setSyncing(false));
  }, [chatId]);

  const upd = useCallback((fn) => {
    setData(prev => {
      const next = fn(JSON.parse(JSON.stringify(prev)));
      saveLocal(next);
      if (chatId) syncToBot(chatId, next);
      return next;
    });
  }, [chatId]);

  const allKRs = (data.objectives || []).flatMap(o => (o.keyResults || []).map(kr => ({ ...kr, _objTitle: o.title })));
  const todayTasks = (data.todayTasks || []).filter(t => t.date === todayStr());
  const doneTasks = todayTasks.filter(t => t.done);
  const dueRoutines = (data.routines || []).filter(isRoutineDue);

  const addTask = () => {
    if (!newTaskText.trim()) return;
    upd(d => { if (!d.todayTasks) d.todayTasks = []; d.todayTasks.push({ id: Date.now().toString(), text: newTaskText.trim(), krId: newTaskKR, done: false, date: todayStr() }); return d; });
    setNewTaskText(""); setNewTaskKR("");
  };
  const toggleTask = id => upd(d => { const t = (d.todayTasks||[]).find(x => x.id === id); if (t) t.done = !t.done; return d; });
  const delTask = id => upd(d => { d.todayTasks = (d.todayTasks||[]).filter(x => x.id !== id); return d; });
  const saveKR = () => {
    if (!editKR) return;
    upd(d => {
      const obj = (d.objectives||[]).find(o => o.id === editKR.objId);
      if (obj) { const kr = (obj.keyResults||[]).find(k => k.id === editKR.krId); if (kr) kr.current = parseFloat(editKR.val) || 0; }
      return d;
    });
    setEditKR(null);
  };
  const delKR = (objId, krId) => upd(d => {
    const obj = (d.objectives||[]).find(o => o.id === objId);
    if (obj) obj.keyResults = (obj.keyResults||[]).filter(k => k.id !== krId);
    return d;
  });
  const delObj = id => upd(d => { d.objectives = (d.objectives||[]).filter(o => o.id !== id); return d; });
  const addObj = () => {
    if (!newObjTitle.trim()) return;
    upd(d => { if (!d.objectives) d.objectives = []; d.objectives.push({ id: Date.now().toString(), title: newObjTitle.trim(), quarter: newObjQ, keyResults: [] }); return d; });
    setNewObjTitle(""); setAddingObj(false);
  };
  const addKR = () => {
    if (!newKRTitle.trim() || !newKRTarget) return;
    upd(d => {
      const obj = (d.objectives||[]).find(o => o.id === addingKR);
      if (obj) { if (!obj.keyResults) obj.keyResults = []; obj.keyResults.push({ id: Date.now().toString(), title: newKRTitle.trim(), current: 0, target: parseFloat(newKRTarget), unit: newKRUnit }); }
      return d;
    });
    setNewKRTitle(""); setNewKRTarget(""); setNewKRUnit(""); setAddingKR(null);
  };
  const doneRoutine = id => upd(d => { const r = (d.routines||[]).find(x => x.id === id); if (r) r.lastDone = todayStr(); return d; });

  const totalObjPct = (data.objectives||[]).length
    ? Math.round((data.objectives||[]).reduce((s, o) => s + objPct(o), 0) / (data.objectives||[]).length)
    : 0;

  const NAV = [
    { id: "dashboard", label: "Сегодня", svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
    { id: "goals", label: "Цели", svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="3" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="21"/><line x1="3" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="21" y2="12"/></svg> },
    { id: "routines", label: "Рутины", svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg> },
    { id: "guide", label: "Гайд", svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#07070F", color: "#E2E8F0", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, textarea { background: #0F0F18; border: 1px solid #1E1E30; color: #E2E8F0; border-radius: 10px; padding: 10px 14px; font-family: inherit; font-size: 14px; outline: none; width: 100%; }
        input:focus, select:focus { border-color: #6366F1; }
        button { cursor: pointer; border: none; background: none; font-family: inherit; color: inherit; }
        ::-webkit-scrollbar { width: 0; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "16px 20px 0", maxWidth: 600, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: -0.5, color: "#F8FAFC" }}>OKR Engine</div>
            <div style={{ fontSize: 11, color: "#334155", marginTop: 1 }}>{new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {syncing && <span style={{ fontSize: 10, color: "#6366F1" }}>синхр</span>}
            {(data.objectives||[]).length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0F0F18", border: "1px solid #1E1E30", borderRadius: 10, padding: "6px 12px" }}>
                <div style={{ width: 48, height: 4, background: "#1E1E30", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${totalObjPct}%`, height: "100%", background: "#6366F1", borderRadius: 99, transition: "width 0.4s" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#6366F1" }}>{totalObjPct}%</span>
              </div>
            )}
            {dueRoutines.length > 0 && (
              <div style={{ background: "#F59E0B18", border: "1px solid #F59E0B33", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "#F59E0B" }}>! {dueRoutines.length}</div>
            )}
          </div>
        </div>

        {/* Nav tabs */}
        <div style={{ display: "flex", background: "#0A0A14", borderRadius: 12, padding: 3, marginBottom: 24, gap: 2 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setScreen(n.id)} style={{ flex: 1, padding: "8px 4px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: screen === n.id ? "#1A1A2E" : "none", color: screen === n.id ? "#E2E8F0" : "#334155", transition: "all 0.15s", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              {n.svg}
              <span>{n.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 20px 100px" }}>

        {/* ── DASHBOARD ── */}
        {screen === "dashboard" && (
          <div>
            {/* OKR overview */}
            {(data.objectives||[]).length > 0 && (
              <Section title="Прогресс целей">
                {(data.objectives||[]).map(obj => (
                  <div key={obj.id} style={{ marginBottom: 10, background: "#0F0F18", border: "1px solid #1E1E30", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#CBD5E1", flex: 1, marginRight: 8, lineHeight: 1.3 }}>{obj.title}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: objPct(obj) >= 70 ? "#22D3EE" : objPct(obj) >= 40 ? "#6366F1" : "#F59E0B", lineHeight: 1 }}>{objPct(obj)}%</div>
                    </div>
                    <Bar value={objPct(obj)} />
                  </div>
                ))}
              </Section>
            )}

            {/* Tasks */}
            <Section title={`Задачи дня ${todayTasks.length ? `(${doneTasks.length}/${todayTasks.length})` : ""}`}>
              {/* Input */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input value={newTaskText} onChange={e => setNewTaskText(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} placeholder="Что делаю сегодня…" style={{ flex: 1 }} />
                <button onClick={addTask} style={{ background: "#6366F1", color: "#fff", borderRadius: 10, padding: "0 16px", fontSize: 18, fontWeight: 700, minWidth: 44 }}>+</button>
              </div>
              {allKRs.length > 0 && (
                <select value={newTaskKR} onChange={e => setNewTaskKR(e.target.value)} style={{ marginBottom: 10, fontSize: 12 }}>
                  <option value="">— KR не выбран</option>
                  {allKRs.map(kr => <option key={kr.id} value={kr.id}>{kr.title}</option>)}
                </select>
              )}

              {todayTasks.length === 0 && (
                <div style={{ color: "#1E293B", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Нет задач — добавь первую</div>
              )}

              {todayTasks.map(t => {
                const kr = allKRs.find(k => k.id === t.krId);
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: "1px solid #0F0F18" }}>
                    <button onClick={() => toggleTask(t.id)} style={{ width: 22, height: 22, minWidth: 22, borderRadius: 6, background: t.done ? "#6366F1" : "none", border: `2px solid ${t.done ? "#6366F1" : "#1E293B"}`, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                      {t.done && <span style={{ color: "#fff", fontSize: 11, lineHeight: 1 }}>✓</span>}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: t.done ? "#1E293B" : "#E2E8F0", textDecoration: t.done ? "line-through" : "none", lineHeight: 1.4 }}>{t.text}</div>
                      {kr && <div style={{ fontSize: 11, color: "#6366F1", marginTop: 2 }}>→ {kr.title}</div>}
                    </div>
                    <button onClick={() => delTask(t.id)} style={{ color: "#475569", fontSize: 16, padding: "4px 6px", lineHeight: 1, background: "#1A1A2E", borderRadius: 6 }}>×</button>
                  </div>
                );
              })}

              {todayTasks.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <Bar value={Math.round((doneTasks.length / todayTasks.length) * 100)} color="#22D3EE" />
                </div>
              )}
            </Section>

            {/* Due routines */}
            {dueRoutines.length > 0 && (
              <Section title="Рутины сегодня">
                {dueRoutines.map(r => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #0F0F18" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</div>
                      {r.description && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{r.description}</div>}
                    </div>
                    <button onClick={() => doneRoutine(r.id)} style={{ background: "#22D3EE12", color: "#22D3EE", border: "1px solid #22D3EE30", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>Готово</button>
                  </div>
                ))}
              </Section>
            )}
          </div>
        )}

        {/* ── GOALS ── */}
        {screen === "goals" && (
          <div>
            {(data.objectives||[]).map(obj => {
              const p = objPct(obj);
              return (
                <div key={obj.id} style={{ background: "#0F0F18", border: "1px solid #1E1E30", borderRadius: 16, padding: 18, marginBottom: 16 }}>
                  {/* Objective header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ flex: 1, marginRight: 12 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", background: "#F59E0B15", border: "1px solid #F59E0B30", borderRadius: 5, padding: "2px 7px", letterSpacing: 0.5 }}>{obj.quarter}</span>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, color: "#F8FAFC", marginTop: 6, lineHeight: 1.3 }}>{obj.title}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: p>=70?"#22D3EE":p>=40?"#6366F1":"#F59E0B", lineHeight: 1 }}>{p}%</div>
                      <button onClick={() => delObj(obj.id)} style={{ color: "#475569", fontSize: 16, lineHeight: 1, padding: "4px 6px", background: "#1A1A2E", borderRadius: 6 }}>×</button>
                    </div>
                  </div>
                  <Bar value={p} />

                  {/* Key Results */}
                  <div style={{ marginTop: 14 }}>
                    {(obj.keyResults||[]).map(kr => {
                      const k = pct(kr.current, kr.target);
                      const isEdit = editKR?.krId === kr.id;
                      return (
                        <div key={kr.id} style={{ padding: "12px 0", borderBottom: "1px solid #ffffff06" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
                            <div style={{ fontSize: 13, color: "#94A3B8", flex: 1, lineHeight: 1.3 }}>{kr.title}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {isEdit ? (
                                <>
                                  <input
                                    value={editKR.val}
                                    onChange={e => setEditKR(p => ({ ...p, val: e.target.value }))}
                                    onKeyDown={e => { if (e.key === "Enter") saveKR(); if (e.key === "Escape") setEditKR(null); }}
                                    style={{ width: 80, textAlign: "right", padding: "5px 8px", fontSize: 13 }}
                                    autoFocus
                                  />
                                  <button onClick={saveKR} style={{ background: "#6366F1", color: "#fff", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 600 }}>✓</button>
                                  <button onClick={() => setEditKR(null)} style={{ color: "#475569", fontSize: 16 }}>×</button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setEditKR({ objId: obj.id, krId: kr.id, val: String(kr.current) })}
                                  style={{ background: "#1A1A2E", border: "1px solid #1E1E30", color: "#CBD5E1", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}
                                >
                                  {fmt(kr.current)} / {fmt(kr.target)} {kr.unit}
                                </button>
                              )}
                              <span style={{ fontSize: 12, fontWeight: 700, color: k>=70?"#22D3EE":k>=40?"#6366F1":"#F59E0B", minWidth: 34, textAlign: "right" }}>{k}%</span>
                              <button onClick={() => delKR(obj.id, kr.id)} style={{ color: "#475569", fontSize: 14, padding: "4px 6px", lineHeight: 1, background: "#1A1A2E", borderRadius: 6 }}>×</button>
                            </div>
                          </div>
                          <Bar value={k} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Add KR */}
                  {addingKR === obj.id ? (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <input value={newKRTitle} onChange={e => setNewKRTitle(e.target.value)} placeholder="Key Result: что измеряем?" autoFocus />
                      <div style={{ display: "flex", gap: 8 }}>
                        <input value={newKRTarget} onChange={e => setNewKRTarget(e.target.value)} placeholder="Цель (число)" type="number" />
                        <input value={newKRUnit} onChange={e => setNewKRUnit(e.target.value)} placeholder="ед. (₽, шт…)" />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={addKR} style={{ flex: 1, background: "#6366F1", color: "#fff", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 600 }}>Добавить</button>
                        <button onClick={() => setAddingKR(null)} style={{ background: "#1A1A2E", color: "#475569", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>Отмена</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setAddingKR(obj.id)} style={{ marginTop: 12, width: "100%", background: "#1A1A2E", color: "#6366F1", border: "1px dashed #6366F130", borderRadius: 10, padding: "8px", fontSize: 13, fontWeight: 600 }}>+ Key Result</button>
                  )}
                </div>
              );
            })}

            {/* Add Objective */}
            {addingObj ? (
              <div style={{ background: "#0F0F18", border: "1px solid #1E1E30", borderRadius: 16, padding: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8", marginBottom: 10 }}>Новая цель (Objective)</div>
                <input value={newObjTitle} onChange={e => setNewObjTitle(e.target.value)} placeholder="Чего хочу достичь за квартал?" autoFocus style={{ marginBottom: 8 }} />
                <select value={newObjQ} onChange={e => setNewObjQ(e.target.value)} style={{ marginBottom: 12 }}>
                  {["Q3 2026","Q4 2026","Q1 2027","Q2 2027"].map(q => <option key={q}>{q}</option>)}
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addObj} style={{ flex: 1, background: "#6366F1", color: "#fff", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 600 }}>Создать</button>
                  <button onClick={() => setAddingObj(false)} style={{ background: "#1A1A2E", color: "#475569", borderRadius: 10, padding: "10px 14px" }}>Отмена</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingObj(true)} style={{ width: "100%", background: "#0F0F18", color: "#6366F1", border: "1px dashed #6366F130", borderRadius: 16, padding: "16px", fontSize: 14, fontWeight: 600 }}>+ Новая цель</button>
            )}
          </div>
        )}

        {/* ── ROUTINES ── */}
        {screen === "routines" && (
          <div>
            {["daily","weekly","monthly","quarterly"].map(freq => {
              const freqLabel = { daily: "Ежедневно", weekly: "Еженедельно", monthly: "Ежемесячно", quarterly: "Ежеквартально" };
              const freqColor = { daily: "#22D3EE", weekly: "#6366F1", monthly: "#A78BFA", quarterly: "#F59E0B" };
              const rr = (data.routines||[]).filter(r => r.frequency === freq);
              if (!rr.length) return null;
              return (
                <div key={freq} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "#334155", marginBottom: 10, textTransform: "uppercase" }}>{freqLabel[freq]}</div>
                  {rr.map(r => {
                    const due = isRoutineDue(r);
                    const done = r.lastDone === todayStr();
                    return (
                      <div key={r.id} style={{ background: "#0F0F18", border: `1px solid ${due && !done ? freqColor[freq]+"30" : "#1E1E30"}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: done ? "#22D3EE" : due ? freqColor[freq] : "#1E293B", minWidth: 8, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: done ? "#334155" : "#E2E8F0" }}>{r.title}</div>
                          {r.description && <div style={{ fontSize: 11, color: "#334155", marginTop: 2 }}>{r.description}</div>}
                          {r.lastDone && <div style={{ fontSize: 10, color: "#1E293B", marginTop: 3 }}>Последний раз: {r.lastDone}</div>}
                        </div>
                        {due && !done ? (
                          <button onClick={() => doneRoutine(r.id)} style={{ background: freqColor[freq]+"18", color: freqColor[freq], border: `1px solid ${freqColor[freq]}30`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>Готово</button>
                        ) : done ? (
                          <span style={{ fontSize: 11, color: "#22D3EE", fontWeight: 600 }}>✓</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* ── GUIDE ── */}
        {screen === "guide" && (
          <div>
            <div style={{ background: "#0F0F18", border: "1px solid #1E1E30", borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>OKR работает только как система. Здесь — всё что нужно знать чтобы она работала.</div>
            </div>
            {GUIDE.map((item, i) => <GuideCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </div>
  );
}
