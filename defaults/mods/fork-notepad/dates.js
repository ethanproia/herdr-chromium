// Notion-style date mentions. Pure: no gpui or herdr imports, so node can test it.
// href: "date:YYYY-MM-DD" or "date:YYYY-MM-DDTHH:MM" (local time, no zone).
// text: what the link stores, "Nov 3, 2026" or "Nov 3, 2026 11:15 AM" (12-hour, Notion's default).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const p2 = (n) => String(n).padStart(2, "0");

const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayDiff = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86400000);   // a - b, DST-safe via rounding

export function monthName(m) { return MONTHS[m]; }

function time12(h, m) {
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${p2(m)} ${ap}`;
}

// Parse "date:..." into {date:"YYYY-MM-DD", time:"HH:MM"|null}, or null.
export function parseDateHref(href) {
  const m = /^date:(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(String(href || ""));
  if (!m) return null;
  return { date: m[1], time: m[2] != null ? `${m[2]}:${m[3]}` : null };
}

function toDate(date, time) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time ? time.split(":").map(Number) : [0, 0];
  return new Date(y, mo - 1, d, h, mi);
}

function textOf(d, withTime) {
  const t = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  return withTime ? `${t} ${time12(d.getHours(), d.getMinutes())}` : t;
}

export function dateText(href) {
  const p = parseDateHref(href);
  return p ? textOf(toDate(p.date, p.time), !!p.time) : "";
}

function makeItem(label, d, withTime, now) {
  const href = "date:" + ymd(d) + (withTime ? `T${p2(d.getHours())}:${p2(d.getMinutes())}` : "");
  const text = textOf(d, withTime);
  return { kind: "date", label: label ?? dateLabel(href, now), hint: text, href, text };
}

// The @ menu's date rows. Notion lists "Today" with its date as the hint; @now adds the time.
export function dateItems(now) {
  const day = (off) => addDays(now, off);
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
  return [
    makeItem("Today", day(0), false, now),
    makeItem("Now", n, true, now),
    makeItem("Tomorrow", day(1), false, now),
    makeItem("Yesterday", day(-1), false, now),
  ];
}

// ---- typed dates ----
const WD = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
const MON = {};
MONTH_FULL.forEach((m, i) => { MON[m] = i; MON[m.slice(0, 3)] = i; });
MON.sept = 8;

function parseTime(s) {
  s = s.trim().toLowerCase();
  if (s === "noon") return { h: 12, m: 0 };
  if (s === "midnight") return { h: 0, m: 0 };
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/.exec(s);
  if (!m) return null;
  let h = +m[1], mi = m[2] ? +m[2] : 0;
  const ap = m[3];
  if (mi > 59) return null;
  if (ap) { if (h < 1 || h > 12) return null; h = (h % 12) + (ap[0] === "p" ? 12 : 0); }
  else if (h > 23 || (!m[2] && h > 12)) return null;   // bare "15" is not a time; "15:30" is
  return { h, m: mi };
}

// Split a trailing time off the query: "tomorrow 3pm", "nov 12 at 15:30", "3pm".
function splitTime(q) {
  const m = /^(.*?)(?:\s+(?:at\s+)?|^)(noon|midnight|\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p)|\d{1,2}:\d{2})$/.exec(q);
  if (!m) return { rest: q, time: null };
  const time = parseTime(m[2]);
  return time ? { rest: m[1].trim(), time } : { rest: q, time: null };
}

function parseDay(s, now) {
  const today = startOfDay(now);
  let m;
  if (s === "" || s === "today") return today;
  if (s === "tomorrow" || s === "tmrw" || s === "tmr") return addDays(today, 1);
  if (s === "yesterday") return addDays(today, -1);
  if ((m = /^(next|last|this)?\s*(\w+)$/.exec(s)) && WD[m[2]] != null) {
    const target = WD[m[2]], cur = today.getDay();
    if (m[1] === "last") return addDays(today, -(((cur - target + 7) % 7) || 7));
    if (m[1] === "next") return addDays(today, ((target - cur + 7) % 7) || 7);
    return addDays(today, (target - cur + 7) % 7);   // bare "friday": the coming one, today if today
  }
  if (s === "next week") return addDays(today, 7);
  if (s === "last week") return addDays(today, -7);
  if (s === "next month") {   // same day next month, clamped (Jan 31 -> Feb 28/29)
    const last = new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate();
    return new Date(today.getFullYear(), today.getMonth() + 1, Math.min(today.getDate(), last));
  }
  if ((m = /^in\s+(\d+)\s*(day|days|d|week|weeks|w)$/.exec(s))) return addDays(today, +m[1] * (m[2][0] === "w" ? 7 : 1));
  if ((m = /^(\d+)\s*(day|days|d|week|weeks|w)\s+ago$/.exec(s))) return addDays(today, -m[1] * (m[2][0] === "w" ? 7 : 1));
  const mk = (y, mo, d) => {
    const r = new Date(y, mo, d);
    return r.getMonth() === mo && r.getDate() === d ? r : null;
  };
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) return mk(+m[1], +m[2] - 1, +m[3]);
  if ((m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(s))) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : today.getFullYear();
    return mk(y, +m[1] - 1, +m[2]);
  }
  if ((m = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/.exec(s)) && MON[m[1]] != null)
    return mk(m[3] ? +m[3] : today.getFullYear(), MON[m[1]], +m[2]);
  if ((m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?(?:,?\s+(\d{4}))?$/.exec(s)) && MON[m[2]] != null)
    return mk(m[3] ? +m[3] : today.getFullYear(), MON[m[2]], +m[1]);
  return null;
}

// A date typed after "@": "next friday", "nov 12", "tomorrow 3pm", "in 3 days". null when not a date.
export function parseTyped(query, now) {
  const q = String(query || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return null;
  if (q === "now") return makeItem("Now", new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()), true, now);
  const { rest, time } = splitTime(q);
  const day = parseDay(rest, now);
  if (!day) return null;
  if (time) day.setHours(time.h, time.m, 0, 0);
  return makeItem(null, day, !!time, now);
}

// Display like a Notion date mention: relative around today, weekday inside the coming week, else absolute.
export function dateLabel(href, now) {
  const p = parseDateHref(href);
  if (!p) return "";
  const d = toDate(p.date, p.time);
  const diff = dayDiff(d, now);
  let base;
  if (diff === 0) base = "Today";
  else if (diff === 1) base = "Tomorrow";
  else if (diff === -1) base = "Yesterday";
  else if (diff >= 2 && diff <= 6) base = DAYS[d.getDay()];
  else base = textOf(d, false);
  return p.time ? `${base} ${time12(d.getHours(), d.getMinutes())}` : base;
}

// Replace the date and/or time of a mention. date: "YYYY-MM-DD"; time: "HH:MM", or null to drop the time.
// A field left undefined is kept. Setting a time on a date-only href turns the time on.
export function setDate(href, { date, time } = {}) {
  const p = parseDateHref(href) ?? { date: ymd(new Date()), time: null };
  const nd = date !== undefined ? date : p.date;
  const nt = time !== undefined ? time : p.time;
  return "date:" + nd + (nt ? `T${nt}` : "");
}
