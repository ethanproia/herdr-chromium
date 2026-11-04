// The Excalidraw packages read a few browser globals while loading. Herdr runs mods in
// QuickJS with no DOM, and its sandbox refuses `Function("return this")()`, which
// lodash falls back to when `self` is missing.
globalThis.self ??= globalThis;
globalThis.navigator ??= { platform: "MacIntel", userAgent: "Mozilla/5.0 (Macintosh)" };
globalThis.document ??= { createElement: () => ({ src: "" }) };
// Free-draw shapes come back as Path2D over an SVG path string; keep the string.
globalThis.Path2D ??= class Path2D { constructor(d) { this.d = d; } };
// Herdr has no setTimeout (mods use cx.timer); Scene throttles its update callbacks with
// lodash, which needs one. Queue them here; the editor drains due ones from its own timer.
{
  const timers = new Map();
  let next = 0;
  globalThis.setTimeout = (fn, ms = 0, ...args) => { timers.set(++next, { fn, at: Date.now() + ms, args }); return next; };
  globalThis.clearTimeout = (id) => { timers.delete(id); };
  globalThis.__runDueTimers = () => {
    const now = Date.now();
    for (const [id, t] of [...timers]) {
      if (t.at > now) continue;
      timers.delete(id);
      t.fn(...t.args);
    }
  };
}


// src/main.js
import { View, div as div2, PathBuilder as PathBuilder2, image, svg } from "gpui-kit";
import { TextareaState, Textarea } from "gpui-base";
import { props, settings, theme, readTextFile, writeTextFile as writeTextFile2, watchFolder, notify, home as home2, appHome, run, focused, panes, closeOverlay, exec } from "herdr";
import { Buffer } from "buffer";
import * as fs2 from "fs/promises";

// node_modules/@excalidraw/math/dist/prod/index.js
var y = 1e-4;
var ft = (t2, n2, o2) => Math.min(Math.max(t2, n2), o2);
var C = (t2) => t2 < 0 ? t2 % (2 * Math.PI) + 2 * Math.PI : t2 % (2 * Math.PI);
function K(t2) {
  return t2 * Math.PI / 180;
}
function Vt(t2, n2, o2) {
  return t2 = C(t2), n2 = C(n2), o2 = C(o2), n2 < o2 ? t2 >= n2 && t2 <= o2 : t2 >= n2 || t2 <= o2;
}
function Ct(t2, n2) {
  t2 = C(t2), n2 = C(n2);
  let o2 = t2 - n2;
  return o2 < -Math.PI ? o2 = o2 + 2 * Math.PI : o2 > Math.PI && (o2 = o2 - 2 * Math.PI), Math.abs(o2);
}
function L(t2, n2, o2 = 0, e5 = 0) {
  return [t2 - o2, n2 - e5];
}
function h(t2, n2 = [0, 0], o2, e5 = [0, 1]) {
  let r2 = L(t2[0] - n2[0], t2[1] - n2[1]);
  return o2 && U(r2) < o2 * o2 ? e5 : r2;
}
function N(t2, n2) {
  return t2[0] * n2[1] - n2[0] * t2[1];
}
function E(t2, n2) {
  return t2[0] * n2[0] + t2[1] * n2[1];
}
function F(t2, n2) {
  return [t2[0] + n2[0], t2[1] + n2[1]];
}
function M(t2, n2) {
  return L(t2[0] * n2, t2[1] * n2);
}
function U(t2) {
  return t2[0] * t2[0] + t2[1] * t2[1];
}
function ct(t2) {
  return Math.sqrt(U(t2));
}
var T = (t2) => {
  let n2 = ct(t2);
  return n2 === 0 ? L(0, 0) : L(t2[0] / n2, t2[1] / n2);
};
var O = (t2) => L(t2[1], -t2[0]);
function p(t2, n2) {
  return [t2, n2];
}
function Tt(t2) {
  return t2.length === 2 ? p(t2[0], t2[1]) : void 0;
}
function Ot(t2) {
  return t2;
}
function I(t2, n2 = p(0, 0)) {
  return p(n2[0] + t2[0], n2[1] + t2[1]);
}
function A(t2, n2, o2 = 1e-4) {
  let e5 = Math.abs;
  return e5(t2[0] - n2[0]) < o2 && e5(t2[1] - n2[1]) < o2;
}
function w([t2, n2], [o2, e5], r2) {
  return p((t2 - o2) * Math.cos(r2) - (n2 - e5) * Math.sin(r2) + o2, (t2 - o2) * Math.sin(r2) + (n2 - e5) * Math.cos(r2) + e5);
}
function lt(t2, n2 = [0, 0]) {
  return p(t2[0] + n2[0], t2[1] + n2[1]);
}
function z(t2, n2) {
  return p((t2[0] + n2[0]) / 2, (t2[1] + n2[1]) / 2);
}
function _(t2, n2) {
  return Math.hypot(n2[0] - t2[0], n2[1] - t2[1]);
}
function Xt(t2, n2) {
  let o2 = n2[0] - t2[0], e5 = n2[1] - t2[1];
  return o2 * o2 + e5 * e5;
}
var Yt = (t2, n2, o2) => lt(n2, M(h(t2, n2), o2));
var jt = (t2, n2, o2) => n2[0] <= Math.max(t2[0], o2[0]) && n2[0] >= Math.min(t2[0], o2[0]) && n2[1] <= Math.max(t2[1], o2[1]) && n2[1] >= Math.min(t2[1], o2[1]);
var X = [-0.06405689286260563, 0.06405689286260563, -0.1911188674736163, 0.1911188674736163, -0.3150426796961634, 0.3150426796961634, -0.4337935076260451, 0.4337935076260451, -0.5454214713888396, 0.5454214713888396, -0.6480936519369755, 0.6480936519369755, -0.7401241915785544, 0.7401241915785544, -0.820001985973903, 0.820001985973903, -0.8864155270044011, 0.8864155270044011, -0.9382745520027328, 0.9382745520027328, -0.9747285559713095, 0.9747285559713095, -0.9951872199970213, 0.9951872199970213];
var Y = [0.12793819534675216, 0.12793819534675216, 0.1258374563468283, 0.1258374563468283, 0.12167047292780339, 0.12167047292780339, 0.1155056680537256, 0.1155056680537256, 0.10744427011596563, 0.10744427011596563, 0.09761865210411388, 0.09761865210411388, 0.08619016153195327, 0.08619016153195327, 0.0733464814110803, 0.0733464814110803, 0.05929858491543678, 0.05929858491543678, 0.04427743881741981, 0.04427743881741981, 0.028531388628933663, 0.028531388628933663, 0.0123412297999872, 0.0123412297999872];
function tt(t2, n2, o2, e5) {
  return [t2, n2, o2, e5];
}
function $(t2, n2, o2, e5 = 1e-6) {
  return [(t2(n2 + e5, o2) - t2(n2 - e5, o2)) / (2 * e5), (t2(n2, o2 + e5) - t2(n2, o2 - e5)) / (2 * e5)];
}
function st(t2, n2, o2, e5 = 1e-3, r2 = 10) {
  let i2 = 1 / 0, a2 = 0;
  for (; i2 >= e5; ) {
    if (a2 >= r2) return null;
    let c3 = t2(n2, o2), l2 = [$((f3, d2) => t2(f3, d2)[0], n2, o2), $((f3, d2) => t2(f3, d2)[1], n2, o2)], P3 = [[-c3[0]], [-c3[1]]], s2 = l2[0][0] * l2[1][1] - l2[0][1] * l2[1][0];
    if (s2 === 0) return null;
    let u3 = [[l2[1][1] / s2, -l2[0][1] / s2], [-l2[1][0] / s2, l2[0][0] / s2]], m2 = [[u3[0][0] * P3[0][0] + u3[0][1] * P3[1][0]], [u3[1][0] * P3[0][0] + u3[1][1] * P3[1][0]]];
    n2 = n2 + m2[0][0], o2 = o2 + m2[1][0];
    let [x3, b2] = t2(n2, o2);
    i2 = Math.max(Math.abs(x3), Math.abs(b2)), a2 += 1;
  }
  return [n2, o2];
}
var R = (t2, n2) => p((1 - n2) ** 3 * t2[0][0] + 3 * (1 - n2) ** 2 * n2 * t2[1][0] + 3 * (1 - n2) * n2 ** 2 * t2[2][0] + n2 ** 3 * t2[3][0], (1 - n2) ** 3 * t2[0][1] + 3 * (1 - n2) ** 2 * n2 * t2[1][1] + 3 * (1 - n2) * n2 ** 2 * t2[2][1] + n2 ** 3 * t2[3][1]);
function Kt(t2, n2) {
  let o2 = (a2) => p(n2[0][0] + a2 * (n2[1][0] - n2[0][0]), n2[0][1] + a2 * (n2[1][1] - n2[0][1])), e5 = [[0.5, 0], [0.2, 0], [0.8, 0]], r2 = ([a2, c3]) => {
    let l2 = st((u3, m2) => {
      let x3 = R(t2, u3), b2 = o2(m2);
      return [x3[0] - b2[0], x3[1] - b2[1]];
    }, a2, c3);
    if (!l2) return null;
    let [P3, s2] = l2;
    return P3 < 0 || P3 > 1 || s2 < 0 || s2 > 1 ? null : R(t2, P3);
  }, i2 = r2(e5[0]);
  return i2 ? [i2] : (i2 = r2(e5[1]), i2 ? [i2] : (i2 = r2(e5[2]), i2 ? [i2] : []));
}
function Pt(t2, n2, o2 = 1e-3) {
  let e5 = (P3, s2, u3, m2 = o2) => {
    let x3 = P3, b2 = s2, f3;
    for (; b2 - x3 > m2; ) f3 = (b2 + x3) / 2, u3(f3 - m2) < u3(f3 + m2) ? b2 = f3 : x3 = f3;
    return f3;
  }, i2 = 0;
  for (let P3 = 1 / 0, s2 = 0; s2 < 30; s2++) {
    let u3 = _(n2, R(t2, s2 / 30));
    u3 < P3 && (P3 = u3, i2 = s2);
  }
  let a2 = Math.max((i2 - 1) / 30, 0), c3 = Math.min((i2 + 1) / 30, 1), l2 = e5(a2, c3, (P3) => _(n2, R(t2, P3)));
  return l2 ? R(t2, l2) : null;
}
function Ut(t2, n2) {
  let o2 = Pt(t2, n2);
  return o2 ? _(n2, o2) : 0;
}
function j([t2, n2, o2, e5], r2) {
  return L(-3 * (1 - r2) * (1 - r2) * t2[0] + 3 * (1 - r2) * (1 - r2) * n2[0] - 6 * r2 * (1 - r2) * n2[0] - 3 * r2 * r2 * o2[0] + 6 * r2 * (1 - r2) * o2[0] + 3 * r2 * r2 * e5[0], -3 * (1 - r2) * (1 - r2) * t2[1] + 3 * (1 - r2) * (1 - r2) * n2[1] - 6 * r2 * (1 - r2) * n2[1] - 3 * r2 * r2 * o2[1] + 6 * r2 * (1 - r2) * o2[1] + 3 * r2 * r2 * e5[1]);
}
function nn(t2, n2 = 0.5) {
  if (t2.length < 2) return;
  let o2 = [];
  for (let e5 = 0; e5 < t2.length - 1; e5++) {
    let r2 = t2[e5 - 1 < 0 ? 0 : e5 - 1], i2 = t2[e5], a2 = t2[e5 + 1 >= t2.length ? t2.length - 1 : e5 + 1], c3 = t2[e5 + 2 >= t2.length ? t2.length - 1 : e5 + 2], l2 = [(a2[0] - r2[0]) * n2, (a2[1] - r2[1]) * n2], P3 = [(c3[0] - i2[0]) * n2, (c3[1] - i2[1]) * n2], s2 = i2[0] + l2[0] / 3, u3 = i2[1] + l2[1] / 3, m2 = a2[0] - P3[0] / 3, x3 = a2[1] - P3[1] / 3;
    o2.push(tt(p(i2[0], i2[1]), p(s2, u3), p(m2, x3), p(a2[0], a2[1])));
  }
  return o2;
}
function on([t2, n2, o2, e5], r2, i2 = 50) {
  let a2 = [];
  for (let c3 = 0; c3 <= i2; c3++) {
    let l2 = c3 / i2, P3 = tt(t2, n2, o2, e5), s2 = R(P3, l2), u3 = T(j(P3, l2)), m2 = O(u3);
    a2.push(I(M(m2, r2), s2));
  }
  return a2;
}
function nt(t2) {
  let o2 = 0;
  for (let e5 = 0; e5 < 24; e5++) {
    let r2 = 0.5 * X[e5] + 0.5, i2 = j(t2, r2), a2 = Math.sqrt(i2[0] * i2[0] + i2[1] * i2[1]);
    o2 += Y[e5] * a2;
  }
  return 0.5 * o2;
}
function ut(t2, n2) {
  if (n2 <= 0) return 0;
  if (n2 >= 1) return nt(t2);
  let o2 = n2 / 2, e5 = n2 / 2, r2 = 0;
  for (let i2 = 0; i2 < 24; i2++) {
    let a2 = o2 * X[i2] + e5, c3 = j(t2, a2), l2 = Math.sqrt(c3[0] * c3[0] + c3[1] * c3[1]);
    r2 += Y[i2] * l2;
  }
  return o2 * r2;
}
function rn(t2, n2) {
  if (n2 <= 0) return R(t2, 0);
  if (n2 >= 1) return R(t2, 1);
  let o2 = nt(t2), e5 = o2 * n2, r2 = 0, i2 = 1, a2 = n2, c3 = 0, l2 = o2 * 1e-4, P3 = 20;
  for (let s2 = 0; s2 < P3 && (c3 = ut(t2, a2), !(Math.abs(c3 - e5) < l2)); s2++) c3 < e5 ? r2 = a2 : i2 = a2, a2 = (r2 + i2) / 2;
  return R(t2, a2);
}
function un(t2, n2, o2) {
  return { center: t2, halfWidth: n2, halfHeight: o2 };
}
var mt = (t2, n2) => {
  let { halfWidth: o2, halfHeight: e5, center: r2 } = n2, i2 = o2, a2 = e5, c3 = F(h(t2), M(h(r2), -1)), l2 = Math.abs(c3[0]), P3 = Math.abs(c3[1]), s2 = 0.707, u3 = 0.707;
  for (let b2 = 0; b2 < 3; b2++) {
    let f3 = i2 * s2, d2 = a2 * u3, G2 = (i2 * i2 - a2 * a2) * s2 ** 3 / i2, V3 = (a2 * a2 - i2 * i2) * u3 ** 3 / a2, it = f3 - G2, at = d2 - V3, W = l2 - G2, H2 = P3 - V3, Q3 = Math.hypot(at, it), J3 = Math.hypot(H2, W);
    s2 = Math.min(1, Math.max(0, (W * Q3 / J3 + G2) / i2)), u3 = Math.min(1, Math.max(0, (H2 * Q3 / J3 + V3) / a2));
    let Z3 = Math.hypot(u3, s2);
    s2 /= Z3, u3 /= Z3;
  }
  let [m2, x3] = [i2 * s2 * Math.sign(c3[0]), a2 * u3 * Math.sign(c3[1])];
  return _(I(c3), p(m2, x3));
};
function xn(t2, n2) {
  let o2 = t2.halfWidth, e5 = t2.halfHeight, r2 = h(n2[1], n2[0]), i2 = L(n2[0][0] - t2.center[0], n2[0][1] - t2.center[1]), a2 = L(r2[0] / (o2 * o2), r2[1] / (e5 * e5)), c3 = L(i2[0] / (o2 * o2), i2[1] / (e5 * e5)), l2 = E(r2, a2), P3 = E(r2, c3), s2 = E(i2, c3) - 1, u3 = P3 * P3 - l2 * s2, m2 = [];
  if (u3 > 0) {
    let x3 = (-P3 - Math.sqrt(u3)) / l2, b2 = (-P3 + Math.sqrt(u3)) / l2;
    0 <= x3 && x3 <= 1 && m2.push(p(n2[0][0] + (n2[1][0] - n2[0][0]) * x3, n2[0][1] + (n2[1][1] - n2[0][1]) * x3)), 0 <= b2 && b2 <= 1 && m2.push(p(n2[0][0] + (n2[1][0] - n2[0][0]) * b2, n2[0][1] + (n2[1][1] - n2[0][1]) * b2));
  } else if (u3 === 0) {
    let x3 = -P3 / l2;
    0 <= x3 && x3 <= 1 && m2.push(p(n2[0][0] + (n2[1][0] - n2[0][0]) * x3, n2[0][1] + (n2[1][1] - n2[0][1]) * x3));
  }
  return m2;
}
function k(t2, n2) {
  return [t2, n2];
}
function ot(t2, n2) {
  let o2 = t2[1][1] - t2[0][1], e5 = t2[0][0] - t2[1][0], r2 = n2[1][1] - n2[0][1], i2 = n2[0][0] - n2[1][0], a2 = o2 * i2 - r2 * e5;
  if (a2 !== 0) {
    let c3 = o2 * t2[0][0] + e5 * t2[0][1], l2 = r2 * n2[0][0] + i2 * n2[0][1];
    return p((c3 * i2 - l2 * e5) / a2, (o2 * l2 - r2 * c3) / a2);
  }
  return null;
}
function v(t2, n2) {
  return [t2, n2];
}
var q = (t2, n2, o2 = 1e-4) => {
  let e5 = pt(t2, n2);
  return e5 === 0 ? true : e5 < o2;
};
var pt = (t2, n2) => {
  let [o2, e5] = t2, [[r2, i2], [a2, c3]] = n2, l2 = o2 - r2, P3 = e5 - i2, s2 = a2 - r2, u3 = c3 - i2, m2 = l2 * s2 + P3 * u3, x3 = s2 * s2 + u3 * u3, b2 = -1;
  x3 !== 0 && (b2 = m2 / x3);
  let f3, d2;
  b2 < 0 ? (f3 = r2, d2 = i2) : b2 > 1 ? (f3 = a2, d2 = c3) : (f3 = r2 + b2 * s2, d2 = i2 + b2 * u3);
  let G2 = o2 - f3, V3 = e5 - d2;
  return Math.sqrt(G2 * G2 + V3 * V3);
};
function et(t2, n2, o2) {
  let e5 = ot(k(t2[0], t2[1]), k(n2[0], n2[1]));
  return !e5 || !q(e5, n2, o2) || !q(e5, t2, o2) ? null : e5;
}
function bt(t2, n2) {
  return [t2, n2];
}
function no([t2, n2, o2], e5) {
  let r2 = (s2, u3, m2) => (s2[0] - m2[0]) * (u3[1] - m2[1]) - (u3[0] - m2[0]) * (s2[1] - m2[1]), i2 = r2(e5, t2, n2), a2 = r2(e5, n2, o2), c3 = r2(e5, o2, t2), l2 = i2 < 0 || a2 < 0 || c3 < 0, P3 = i2 > 0 || a2 > 0 || c3 > 0;
  return !(l2 && P3);
}

// node_modules/@excalidraw/common/dist/prod/index.js
var he = Object.create;
var Y2 = Object.defineProperty;
var ye = Object.getOwnPropertyDescriptor;
var ge = Object.getOwnPropertyNames;
var Le = Object.getPrototypeOf;
var Se = Object.prototype.hasOwnProperty;
var Oe = (e5, t2) => () => (e5 && (t2 = e5(e5 = 0)), t2);
var V = (e5, t2) => () => (t2 || e5((t2 = { exports: {} }).exports, t2), t2.exports);
var Re = (e5, t2, n2, r2) => {
  if (t2 && typeof t2 == "object" || typeof t2 == "function") for (let s2 of ge(t2)) !Se.call(e5, s2) && s2 !== n2 && Y2(e5, s2, { get: () => t2[s2], enumerable: !(r2 = ye(t2, s2)) || r2.enumerable });
  return e5;
};
var X2 = (e5, t2, n2) => (n2 = e5 != null ? he(Le(e5)) : {}, Re(t2 || !e5 || !e5.__esModule ? Y2(n2, "default", { value: e5, enumerable: true }) : n2, e5));
var f;
var c = Oe(() => {
  f = { PROD: true };
});
var le = V((G2, ae) => {
  c();
  (function(e5, t2) {
    typeof define == "function" && define.amd ? define([], t2) : typeof G2 == "object" ? ae.exports = t2() : (e5.PromisePool = t2(), e5.promisePool = e5.PromisePool);
  })(G2, function() {
    "use strict";
    var e5 = function() {
      this._listeners = {};
    };
    e5.prototype.addEventListener = function(o2, a2) {
      this._listeners[o2] = this._listeners[o2] || [], this._listeners[o2].indexOf(a2) < 0 && this._listeners[o2].push(a2);
    }, e5.prototype.removeEventListener = function(o2, a2) {
      if (this._listeners[o2]) {
        var p3 = this._listeners[o2].indexOf(a2);
        p3 >= 0 && this._listeners[o2].splice(p3, 1);
      }
    }, e5.prototype.dispatchEvent = function(o2) {
      if (this._listeners[o2.type] && this._listeners[o2.type].length) for (var a2 = this._listeners[o2.type].slice(), p3 = 0, m2 = a2.length; p3 < m2; ++p3) a2[p3].call(this, o2);
    };
    var t2 = function(o2) {
      return typeof o2.constructor == "function" && o2.constructor.name === "GeneratorFunction";
    }, n2 = function(o2) {
      return { next: function() {
        var a2 = o2();
        return a2 ? { value: a2 } : { done: true };
      } };
    }, r2 = function(o2) {
      var a2 = false;
      return { next: function() {
        return a2 ? { done: true } : (a2 = true, { value: o2 });
      } };
    }, s2 = function(o2, a2) {
      var p3 = typeof o2;
      if (p3 === "object") {
        if (typeof o2.next == "function") return o2;
        if (typeof o2.then == "function") return r2(o2);
      }
      return p3 === "function" ? t2(o2) ? o2() : n2(o2) : r2(a2.resolve(o2));
    }, l2 = function(o2, a2, p3) {
      this.target = o2, this.type = a2, this.data = p3;
    }, i2 = function(o2, a2, p3) {
      if (e5.call(this), typeof a2 != "number" || Math.floor(a2) !== a2 || a2 < 1) throw new Error("Invalid concurrency");
      this._concurrency = a2, this._options = p3 || {}, this._options.promise = this._options.promise || Promise, this._iterator = s2(o2, this._options.promise), this._done = false, this._size = 0, this._promise = null, this._callbacks = null;
    };
    return i2.prototype = new e5(), i2.prototype.constructor = i2, i2.prototype.concurrency = function(o2) {
      return typeof o2 < "u" && (this._concurrency = o2, this.active() && this._proceed()), this._concurrency;
    }, i2.prototype.size = function() {
      return this._size;
    }, i2.prototype.active = function() {
      return !!this._promise;
    }, i2.prototype.promise = function() {
      return this._promise;
    }, i2.prototype.start = function() {
      var o2 = this, a2 = this._options.promise;
      return this._promise = new a2(function(p3, m2) {
        o2._callbacks = { reject: m2, resolve: p3 }, o2._proceed();
      }), this._promise;
    }, i2.prototype._fireEvent = function(o2, a2) {
      this.dispatchEvent(new l2(this, o2, a2));
    }, i2.prototype._settle = function(o2) {
      o2 ? this._callbacks.reject(o2) : this._callbacks.resolve(), this._promise = null, this._callbacks = null;
    }, i2.prototype._onPooledPromiseFulfilled = function(o2, a2) {
      this._size--, this.active() && (this._fireEvent("fulfilled", { promise: o2, result: a2 }), this._proceed());
    }, i2.prototype._onPooledPromiseRejected = function(o2, a2) {
      this._size--, this.active() && (this._fireEvent("rejected", { promise: o2, error: a2 }), this._settle(a2 || new Error("Unknown error")));
    }, i2.prototype._trackPromise = function(o2) {
      var a2 = this;
      o2.then(function(p3) {
        a2._onPooledPromiseFulfilled(o2, p3);
      }, function(p3) {
        a2._onPooledPromiseRejected(o2, p3);
      }).catch(function(p3) {
        a2._settle(new Error("Promise processing failed: " + p3));
      });
    }, i2.prototype._proceed = function() {
      if (!this._done) {
        for (var o2 = { done: false }; this._size < this._concurrency && !(o2 = this._iterator.next()).done; ) this._size++, this._trackPromise(o2.value);
        this._done = o2 === null || !!o2.done;
      }
      this._done && this._size === 0 && this._settle();
    }, i2.PromisePoolEvent = l2, i2.PromisePool = i2, i2;
  });
});
var be = V((U3) => {
  "use strict";
  c();
  Object.defineProperty(U3, "__esModule", { value: true });
  U3.sanitizeUrl = void 0;
  var tt3 = /^([^\w]*)(javascript|data|vbscript)/im, nt3 = /&#(\w+)(^\w|;)?/g, rt2 = /&(newline|tab);/gi, ot2 = /[\u0000-\u001F\u007F-\u009F\u2000-\u200D\uFEFF]/gim, st3 = /^.+(:|&colon;)/gim, it = [".", "/"];
  function at(e5) {
    return it.indexOf(e5[0]) > -1;
  }
  function lt2(e5) {
    return e5.replace(nt3, function(t2, n2) {
      return String.fromCharCode(n2);
    });
  }
  function ct3(e5) {
    var t2 = lt2(e5 || "").replace(rt2, "").replace(ot2, "").trim();
    if (!t2) return "about:blank";
    if (at(t2)) return t2;
    var n2 = t2.match(st3);
    if (!n2) return t2;
    var r2 = n2[0];
    return tt3.test(r2) ? "about:blank" : t2;
  }
  U3.sanitizeUrl = ct3;
});
c();
c();
var $2 = class {
  constructor(t2) {
    this.scoreFunction = t2;
  }
  content = [];
  sinkDown(t2) {
    let n2 = this.content[t2];
    for (; t2 > 0; ) {
      let r2 = (t2 + 1 >> 1) - 1, s2 = this.content[r2];
      if (this.scoreFunction(n2) < this.scoreFunction(s2)) this.content[r2] = n2, this.content[t2] = s2, t2 = r2;
      else break;
    }
  }
  bubbleUp(t2) {
    let n2 = this.content.length, r2 = this.content[t2], s2 = this.scoreFunction(r2);
    for (; ; ) {
      let l2 = t2 + 1 << 1, i2 = l2 - 1, o2 = null, a2 = 0;
      if (i2 < n2) {
        let p3 = this.content[i2];
        a2 = this.scoreFunction(p3), a2 < s2 && (o2 = i2);
      }
      if (l2 < n2) {
        let p3 = this.content[l2];
        this.scoreFunction(p3) < (o2 === null ? s2 : a2) && (o2 = l2);
      }
      if (o2 !== null) this.content[t2] = this.content[o2], this.content[o2] = r2, t2 = o2;
      else break;
    }
  }
  push(t2) {
    this.content.push(t2), this.sinkDown(this.content.length - 1);
  }
  pop() {
    if (this.content.length === 0) return null;
    let t2 = this.content[0], n2 = this.content.pop();
    return this.content.length > 0 && (this.content[0] = n2, this.bubbleUp(0)), t2;
  }
  remove(t2) {
    if (this.content.length === 0) return;
    let n2 = this.content.indexOf(t2), r2 = this.content.pop();
    n2 < this.content.length && (this.content[n2] = r2, this.scoreFunction(r2) < this.scoreFunction(t2) ? this.sinkDown(n2) : this.bubbleUp(n2));
  }
  size() {
    return this.content.length;
  }
  rescoreElement(t2) {
    this.sinkDown(this.content.indexOf(t2));
  }
};
c();
var z2 = { white: "#ffffff", black: "#000000", gray: ["#f8f9fa", "#f1f3f5", "#e9ecef", "#dee2e6", "#ced4da", "#adb5bd", "#868e96", "#495057", "#343a40", "#212529"], red: ["#fff5f5", "#ffe3e3", "#ffc9c9", "#ffa8a8", "#ff8787", "#ff6b6b", "#fa5252", "#f03e3e", "#e03131", "#c92a2a"], pink: ["#fff0f6", "#ffdeeb", "#fcc2d7", "#faa2c1", "#f783ac", "#f06595", "#e64980", "#d6336c", "#c2255c", "#a61e4d"], grape: ["#f8f0fc", "#f3d9fa", "#eebefa", "#e599f7", "#da77f2", "#cc5de8", "#be4bdb", "#ae3ec9", "#9c36b5", "#862e9c"], violet: ["#f3f0ff", "#e5dbff", "#d0bfff", "#b197fc", "#9775fa", "#845ef7", "#7950f2", "#7048e8", "#6741d9", "#5f3dc4"], indigo: ["#edf2ff", "#dbe4ff", "#bac8ff", "#91a7ff", "#748ffc", "#5c7cfa", "#4c6ef5", "#4263eb", "#3b5bdb", "#364fc7"], blue: ["#e7f5ff", "#d0ebff", "#a5d8ff", "#74c0fc", "#4dabf7", "#339af0", "#228be6", "#1c7ed6", "#1971c2", "#1864ab"], cyan: ["#e3fafc", "#c5f6fa", "#99e9f2", "#66d9e8", "#3bc9db", "#22b8cf", "#15aabf", "#1098ad", "#0c8599", "#0b7285"], teal: ["#e6fcf5", "#c3fae8", "#96f2d7", "#63e6be", "#38d9a9", "#20c997", "#12b886", "#0ca678", "#099268", "#087f5b"], green: ["#ebfbee", "#d3f9d8", "#b2f2bb", "#8ce99a", "#69db7c", "#51cf66", "#40c057", "#37b24d", "#2f9e44", "#2b8a3e"], lime: ["#f4fce3", "#e9fac8", "#d8f5a2", "#c0eb75", "#a9e34b", "#94d82d", "#82c91e", "#74b816", "#66a80f", "#5c940d"], yellow: ["#fff9db", "#fff3bf", "#ffec99", "#ffe066", "#ffd43b", "#fcc419", "#fab005", "#f59f00", "#f08c00", "#e67700"], orange: ["#fff4e6", "#ffe8cc", "#ffd8a8", "#ffc078", "#ffa94d", "#ff922b", "#fd7e14", "#f76707", "#e8590c", "#d9480f"] };
var Fe = (e5, t2) => t2.reduce((n2, r2) => (r2 in e5 && (n2[r2] = e5[r2]), n2), {});
var C2 = 4;
var F2 = 1;
var E2 = [0, 2, 4, 6, 8];
var x = (e5, t2) => t2.map((n2) => z2[e5][n2]);
var u = { transparent: "transparent", black: "#1e1e1e", white: "#ffffff", gray: x("gray", E2), red: x("red", E2), pink: x("pink", E2), grape: x("grape", E2), violet: x("violet", E2), blue: x("blue", E2), cyan: x("cyan", E2), teal: x("teal", E2), green: x("green", E2), yellow: x("yellow", E2), orange: x("orange", E2), bronze: ["#f8f1ee", "#eaddd7", "#d2bab0", "#a18072", "#846358"] };
var j2 = Fe(u, ["cyan", "blue", "violet", "grape", "pink", "green", "teal", "yellow", "orange", "red"]);
var yt = [u.black, u.red[C2], u.green[C2], u.blue[C2], u.yellow[C2]];
var gt = [u.transparent, u.red[F2], u.green[F2], u.blue[F2], u.yellow[F2]];
var Lt = [u.white, "#f8f9fa", "#f5faff", "#fffce8", "#fdf8f6"];
var St = { transparent: u.transparent, white: u.white, gray: u.gray, black: u.black, bronze: u.bronze, ...j2 };
var Ot2 = { transparent: u.transparent, white: u.white, gray: u.gray, black: u.black, bronze: u.bronze, ...j2 };
c();
var w2 = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
var It = /^Win/.test(navigator.platform);
var Mt = /\b(android)\b/i.test(navigator.userAgent);
var Pt2 = typeof window < "u" && "netscape" in window && navigator.userAgent.indexOf("rv:") > 1 && navigator.userAgent.indexOf("Gecko") > 1;
var we = navigator.userAgent.indexOf("Chrome") !== -1;
var Dt = !we && navigator.userAgent.indexOf("Safari") !== -1;
var Ut2 = /iPad|iPhone/.test(navigator.platform) || navigator.userAgent.includes("Mac") && "ontouchend" in document;
var kt = typeof window < "u" && "ResizeObserver" in window;
var Bt = 10;
var Gt = 8;
var Xt2 = Math.PI / 12;
var Ie = ((d2) => (d2.COPY = "copy", d2.PASTE = "paste", d2.CUT = "cut", d2.KEYDOWN = "keydown", d2.KEYUP = "keyup", d2.MOUSE_MOVE = "mousemove", d2.RESIZE = "resize", d2.UNLOAD = "unload", d2.FOCUS = "focus", d2.BLUR = "blur", d2.DRAG_OVER = "dragover", d2.DROP = "drop", d2.GESTURE_END = "gestureend", d2.BEFORE_UNLOAD = "beforeunload", d2.GESTURE_START = "gesturestart", d2.GESTURE_CHANGE = "gesturechange", d2.POINTER_MOVE = "pointermove", d2.POINTER_DOWN = "pointerdown", d2.POINTER_UP = "pointerup", d2.STATE_CHANGE = "statechange", d2.WHEEL = "wheel", d2.TOUCH_START = "touchstart", d2.TOUCH_END = "touchend", d2.HASHCHANGE = "hashchange", d2.VISIBILITY_CHANGE = "visibilitychange", d2.SCROLL = "scroll", d2.EXCALIDRAW_LINK = "excalidraw-link", d2.MENU_ITEM_SELECT = "menu.itemSelect", d2.MESSAGE = "message", d2.FULLSCREENCHANGE = "fullscreenchange", d2))(Ie || {});
var I2 = { TEST: "test", DEVELOPMENT: "development", PRODUCTION: "production" };
var q2 = "Xiaolai";
var L2 = "Segoe UI Emoji";
var T2 = { Virgil: 1, Helvetica: 2, Cascadia: 3, Excalifont: 5, Nunito: 6, "Lilita One": 7, "Comic Shanns": 8, "Liberation Sans": 9, Assistant: 10 };
var Q = "sans-serif";
var J = "monospace";
var Me = { [Q]: 998, [J]: 999 };
var B = { [q2]: 100, ...Me, [L2]: 1e3 };
function Pe(e5) {
  switch (e5) {
    case T2.Cascadia:
    case T2["Comic Shanns"]:
      return J;
    default:
      return Q;
  }
}
var ee = (e5) => {
  let t2 = Pe(e5);
  switch (e5) {
    case T2.Excalifont:
      return [q2, t2, L2];
    default:
      return [t2, L2];
  }
};
var nn2 = 20;
var rn2 = T2.Excalifont;
var on2 = "left";
var sn = "top";
var De = 2;
var Ue = 2 * De;
var Ne = 1e-5;
var an = 2 * Ue - Ne;
var ne = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", ico: "image/x-icon", avif: "image/avif", jfif: "image/jfif" };
var Z = { text: "text/plain", html: "text/html", json: "application/json", excalidraw: "application/vnd.excalidraw+json", excalidrawlib: "application/vnd.excalidrawlib+json", "excalidraw.svg": "image/svg+xml", "excalidraw.png": "image/png", binary: "application/octet-stream", ...ne };
var Tn = [Z.text, Z.html, ...Object.values(ne)];
var Gn = 4 * 1024 * 1024;
var $n = 5;
var zn = 0.7;
var jn = 11;
var Zn = { TOP: "top", MIDDLE: "middle", BOTTOM: "bottom" };
var qn = { LEFT: "left", CENTER: "center", RIGHT: "right" };
var Jn = 0.25;
var er = 32;
var tr = { LEGACY: 1, PROPORTIONAL_RADIUS: 2, ADAPTIVE_RADIUS: 3 };
var ke = { architect: 0, artist: 1, cartoonist: 2 };
var rr = { strokeColor: u.black, backgroundColor: u.transparent, fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid", roughness: ke.artist, opacity: 100, locked: false };
var Ke = ((r2) => (r2.ACTIVE = "active", r2.AWAY = "away", r2.IDLE = "idle", r2))(Ke || {});
var Er = 20;
c();
var M2 = { [T2.Excalifont]: { metrics: { unitsPerEm: 1e3, ascender: 886, descender: -374, lineHeight: 1.25 } }, [T2.Nunito]: { metrics: { unitsPerEm: 1e3, ascender: 1011, descender: -353, lineHeight: 1.25 } }, [T2["Lilita One"]]: { metrics: { unitsPerEm: 1e3, ascender: 923, descender: -220, lineHeight: 1.15 } }, [T2["Comic Shanns"]]: { metrics: { unitsPerEm: 1e3, ascender: 750, descender: -250, lineHeight: 1.25 } }, [T2.Virgil]: { metrics: { unitsPerEm: 1e3, ascender: 886, descender: -374, lineHeight: 1.25 }, deprecated: true }, [T2.Helvetica]: { metrics: { unitsPerEm: 2048, ascender: 1577, descender: -471, lineHeight: 1.15 }, deprecated: true, local: true }, [T2.Cascadia]: { metrics: { unitsPerEm: 2048, ascender: 1900, descender: -480, lineHeight: 1.2 }, deprecated: true }, [T2["Liberation Sans"]]: { metrics: { unitsPerEm: 2048, ascender: 1854, descender: -434, lineHeight: 1.15 }, private: true }, [T2.Assistant]: { metrics: { unitsPerEm: 2048, ascender: 1021, descender: -287, lineHeight: 1.25 }, private: true }, [B.Xiaolai]: { metrics: { unitsPerEm: 1e3, ascender: 880, descender: -144, lineHeight: 1.25 }, fallback: true }, [B["Segoe UI Emoji"]]: { metrics: { unitsPerEm: 1e3, ascender: 886, descender: -374, lineHeight: 1.25 }, local: true, fallback: true } };
var gr = (e5) => {
  let { lineHeight: t2 } = M2[e5]?.metrics || M2[T2.Excalifont].metrics;
  return t2;
};
c();
c();
var ie = { EQUAL: "Equal", MINUS: "Minus", NUM_ADD: "NumpadAdd", NUM_SUBTRACT: "NumpadSubtract", NUM_ZERO: "Numpad0", BRACKET_RIGHT: "BracketRight", BRACKET_LEFT: "BracketLeft", ONE: "Digit1", TWO: "Digit2", THREE: "Digit3", NINE: "Digit9", QUOTE: "Quote", ZERO: "Digit0", SLASH: "Slash", C: "KeyC", D: "KeyD", H: "KeyH", V: "KeyV", Z: "KeyZ", Y: "KeyY", R: "KeyR", S: "KeyS" };
var y2 = { ARROW_DOWN: "ArrowDown", ARROW_LEFT: "ArrowLeft", ARROW_RIGHT: "ArrowRight", ARROW_UP: "ArrowUp", PAGE_UP: "PageUp", PAGE_DOWN: "PageDown", BACKSPACE: "Backspace", ALT: "Alt", CTRL_OR_CMD: w2 ? "metaKey" : "ctrlKey", DELETE: "Delete", ENTER: "Enter", ESCAPE: "Escape", QUESTION_MARK: "?", SPACE: " ", TAB: "Tab", CHEVRON_LEFT: "<", CHEVRON_RIGHT: ">", PERIOD: ".", COMMA: ",", SUBTRACT: "-", SLASH: "/", A: "a", C: "c", D: "d", E: "e", F: "f", G: "g", H: "h", I: "i", L: "l", O: "o", P: "p", Q: "q", R: "r", S: "s", T: "t", V: "v", X: "x", Y: "y", Z: "z", K: "k", W: "w", 0: "0", 1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9" };
var Be = /* @__PURE__ */ new Map([[y2.Z, ie.Z], [y2.Y, ie.Y]]);
var Pr = (e5) => e5.shiftKey;
c();
var kr = (e5) => {
  let t2 = e5.map((r2) => r2[0]), n2 = e5.map((r2) => r2[1]);
  return { width: Math.max(...t2) - Math.min(...t2), height: Math.max(...n2) - Math.min(...n2) };
};
var Hr = (e5, t2, n2, r2) => {
  let s2 = n2.map((b2) => b2[e5]), l2 = Math.max(...s2), i2 = Math.min(...s2), o2 = l2 - i2, a2 = o2 === 0 ? 1 : t2 / o2, p3 = 1 / 0, m2 = n2.map((b2) => {
    let _4 = b2[e5] * a2, A4 = [...b2];
    return A4[e5] = _4, _4 < p3 && (p3 = _4), A4;
  });
  if (!r2 || m2.length === 2) return m2;
  let O4 = i2 - p3;
  return m2.map((b2) => Ot(b2.map((_4, A4) => A4 === e5 ? _4 + O4 : _4)));
};
var Kr = (e5, t2, n2) => n2 ? [Math.round(e5 / n2) * n2, Math.round(t2 / n2) * n2] : [e5, t2];
c();
var ue = X2(le(), 1);
c();
c();
c();
var pe = (e5 = 21) => crypto.getRandomValues(new Uint8Array(e5)).reduce((t2, n2) => (n2 &= 63, n2 < 36 ? t2 += n2.toString(36) : n2 < 62 ? t2 += (n2 - 26).toString(36).toUpperCase() : n2 > 62 ? t2 += "-" : t2 += "_", t2), "");
c();
var S = class {
  constructor(t2) {
    this.seed = t2;
  }
  next() {
    return this.seed ? (2 ** 31 - 1 & (this.seed = Math.imul(48271, this.seed))) / 2 ** 31 : Math.random();
  }
};
c();
var Ve = ({ fontFamily: e5 }) => {
  for (let [t2, n2] of Object.entries(T2)) if (n2 === e5) return `${t2}${ee(n2).map((r2) => `, ${r2}`).join("")}`;
  return L2;
};
var co = ({ fontSize: e5, fontFamily: t2 }) => `${e5}px ${Ve({ fontFamily: t2 })}`;
var go = ({ clientX: e5, clientY: t2 }, { zoom: n2, offsetLeft: r2, offsetTop: s2, scrollX: l2, scrollY: i2 }) => {
  let o2 = (e5 - r2) / n2.value - l2, a2 = (t2 - s2) / n2.value - i2;
  return { x: o2, y: a2 };
};
var Xe = "A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\u02B8\u0300-\u0590\u0800-\u1FFF\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF";
var $e = "\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC";
var ze = new RegExp(`^[^${Xe}]*[${$e}]`);
var Ro = (e5) => {
  let [t2, n2] = e5;
  return { x: t2, y: n2 };
};
var je = (e5) => {
  let t2 = e5.length === 5 && e5.substr(4, 1) === "0", n2 = e5.length === 9 && e5.substr(7, 2) === "00";
  return t2 || n2 || e5 === u.transparent;
};
var Io = (e5) => e5.fillStyle !== "solid" || je(e5.backgroundColor);
var Ko = () => D() ? 1 : Date.now();
var Bo = (e5) => e5 instanceof Map ? e5 : e5.reduce((t2, n2) => (t2.set(typeof n2 == "string" ? n2 : n2.id, n2), t2), /* @__PURE__ */ new Map());
var Ze = (e5) => Array.isArray(e5) ? e5 : e5.values();
var Vo = (e5) => Array.isArray(e5) ? e5 : Array.from(Ze(e5));
var D = () => f.MODE === I2.TEST;
var Xo = () => f.MODE === I2.DEVELOPMENT;
var $o = () => f.MODE === I2.PRODUCTION;
var fe = (e5, t2) => Array.isArray(e5) && Array.isArray(t2) && e5.length === 0 && t2.length === 0 ? true : e5 === t2;
var Qe = (e5, t2, n2, r2 = false) => {
  let s2 = Object.keys(e5), l2 = Object.keys(t2);
  if (s2.length !== l2.length) return r2 && console.warn("%cisShallowEqual: objects don't have same properties ->", "color: #8B4000", e5, t2), false;
  if (n2 && Array.isArray(n2)) {
    for (let i2 of n2) if (!(e5[i2] === t2[i2] || fe(e5[i2], t2[i2]))) return r2 && console.warn(`%cisShallowEqual: ${i2} not equal ->`, "color: #8B4000", e5[i2], t2[i2]), false;
    return true;
  }
  return s2.every((i2) => {
    let o2 = n2?.[i2], a2 = o2 ? o2(e5[i2], t2[i2]) : e5[i2] === t2[i2] || fe(e5[i2], t2[i2]);
    return !a2 && r2 && console.warn(`%cisShallowEqual: ${i2} not equal ->`, "color: #8B4000", e5[i2], t2[i2]), a2;
  });
};
var ns = (e5, t2, n2) => {
  if (!t2) return e5;
  if (n2) return console.error(t2), e5;
  throw new Error(t2);
};
function rs(e5, t2) {
  if (!e5) throw new Error(t2);
}
var us = (e5) => e5.replace(/\r?\n|\r/g, `
`);
var ps = (e5) => e5;
var ds = (...e5) => Math.max(...e5.map((t2) => t2 ? 1 : 0)) > 0;
var Ee = new S(Date.now());
var xe = 0;
var hs = () => Math.floor(Ee.next() * 2 ** 31);
var gs = () => D() ? `id${xe++}` : pe();
c();
var _e = X2(be(), 1);
c();

// node_modules/@excalidraw/element/dist/prod/index.js
var cd = Object.create;
var bs = Object.defineProperty;
var dd = Object.getOwnPropertyDescriptor;
var ud = Object.getOwnPropertyNames;
var pd = Object.getPrototypeOf;
var md = Object.prototype.hasOwnProperty;
var fd = (e5, t2) => () => (e5 && (t2 = e5(e5 = 0)), t2);
var hd = (e5, t2) => () => (t2 || e5((t2 = { exports: {} }).exports, t2), t2.exports);
var Ed = (e5, t2, n2, i2) => {
  if (t2 && typeof t2 == "object" || typeof t2 == "function") for (let o2 of ud(t2)) !md.call(e5, o2) && o2 !== n2 && bs(e5, o2, { get: () => t2[o2], enumerable: !(i2 = dd(t2, o2)) || i2.enumerable });
  return e5;
};
var gd = (e5, t2, n2) => (n2 = e5 != null ? cd(pd(e5)) : {}, Ed(t2 || !e5 || !e5.__esModule ? bs(n2, "default", { value: e5, enumerable: true }) : n2, e5));
var A2;
var P = fd(() => {
  A2 = { PROD: true };
});
var xc = hd((A1, gc) => {
  P();
  var Ec = "Expected a function", fc = NaN, Rf = "[object Symbol]", Ff = /^\s+|\s+$/g, Nf = /^[-+]0x[0-9a-f]+$/i, zf = /^0b[01]+$/i, Hf = /^0o[0-7]+$/i, _f = parseInt, Yf = typeof global == "object" && global && global.Object === Object && global, Xf = typeof self == "object" && self && self.Object === Object && self, Uf = Yf || Xf || Function("return this")(), Wf = Object.prototype, jf = Wf.toString, Vf = Math.max, $f = Math.min, ts = function() {
    return Uf.Date.now();
  };
  function Zf(e5, t2, n2) {
    var i2, o2, r2, s2, a2, l2, c3 = 0, d2 = false, u3 = false, p3 = true;
    if (typeof e5 != "function") throw new TypeError(Ec);
    t2 = hc(t2) || 0, Po(n2) && (d2 = !!n2.leading, u3 = "maxWait" in n2, r2 = u3 ? Vf(hc(n2.maxWait) || 0, t2) : r2, p3 = "trailing" in n2 ? !!n2.trailing : p3);
    function m2(I4) {
      var M4 = i2, v3 = o2;
      return i2 = o2 = void 0, c3 = I4, s2 = e5.apply(v3, M4), s2;
    }
    function f3(I4) {
      return c3 = I4, a2 = setTimeout(g2, t2), d2 ? m2(I4) : s2;
    }
    function E4(I4) {
      var M4 = I4 - l2, v3 = I4 - c3, T4 = t2 - M4;
      return u3 ? $f(T4, r2 - v3) : T4;
    }
    function h3(I4) {
      var M4 = I4 - l2, v3 = I4 - c3;
      return l2 === void 0 || M4 >= t2 || M4 < 0 || u3 && v3 >= r2;
    }
    function g2() {
      var I4 = ts();
      if (h3(I4)) return x3(I4);
      a2 = setTimeout(g2, E4(I4));
    }
    function x3(I4) {
      return a2 = void 0, p3 && i2 ? m2(I4) : (i2 = o2 = void 0, s2);
    }
    function y4() {
      a2 !== void 0 && clearTimeout(a2), c3 = 0, i2 = l2 = o2 = a2 = void 0;
    }
    function b2() {
      return a2 === void 0 ? s2 : x3(ts());
    }
    function w4() {
      var I4 = ts(), M4 = h3(I4);
      if (i2 = arguments, o2 = this, l2 = I4, M4) {
        if (a2 === void 0) return f3(l2);
        if (u3) return a2 = setTimeout(g2, t2), m2(l2);
      }
      return a2 === void 0 && (a2 = setTimeout(g2, t2)), s2;
    }
    return w4.cancel = y4, w4.flush = b2, w4;
  }
  function qf(e5, t2, n2) {
    var i2 = true, o2 = true;
    if (typeof e5 != "function") throw new TypeError(Ec);
    return Po(n2) && (i2 = "leading" in n2 ? !!n2.leading : i2, o2 = "trailing" in n2 ? !!n2.trailing : o2), Zf(e5, t2, { leading: i2, maxWait: t2, trailing: o2 });
  }
  function Po(e5) {
    var t2 = typeof e5;
    return !!e5 && (t2 == "object" || t2 == "function");
  }
  function Kf(e5) {
    return !!e5 && typeof e5 == "object";
  }
  function Qf(e5) {
    return typeof e5 == "symbol" || Kf(e5) && jf.call(e5) == Rf;
  }
  function hc(e5) {
    if (typeof e5 == "number") return e5;
    if (Qf(e5)) return fc;
    if (Po(e5)) {
      var t2 = typeof e5.valueOf == "function" ? e5.valueOf() : e5;
      e5 = Po(t2) ? t2 + "" : t2;
    }
    if (typeof e5 != "string") return e5 === 0 ? e5 : +e5;
    e5 = e5.replace(Ff, "");
    var n2 = zf.test(e5);
    return n2 || Hf.test(e5) ? _f(e5.slice(2), n2 ? 2 : 8) : Nf.test(e5) ? fc : +e5;
  }
  gc.exports = qf;
});
P();
P();
P();
P();
P();
P();
P();
P();
P();
P();
P();
function ko(e5, t2, n2) {
  if (e5 && e5.length) {
    let [i2, o2] = t2, r2 = Math.PI / 180 * n2, s2 = Math.cos(r2), a2 = Math.sin(r2);
    for (let l2 of e5) {
      let [c3, d2] = l2;
      l2[0] = (c3 - i2) * s2 - (d2 - o2) * a2 + i2, l2[1] = (c3 - i2) * a2 + (d2 - o2) * s2 + o2;
    }
  }
}
function wd(e5, t2, n2) {
  let i2 = [];
  e5.forEach((o2) => i2.push(...o2)), ko(i2, t2, n2);
}
function yd(e5, t2) {
  return e5[0] === t2[0] && e5[1] === t2[1];
}
function Ps(e5, t2, n2, i2 = 1) {
  let o2 = n2, r2 = Math.max(t2, 0.1), s2 = e5[0] && e5[0][0] && typeof e5[0][0] == "number" ? [e5] : e5, a2 = [0, 0];
  if (o2) for (let c3 of s2) ko(c3, a2, o2);
  let l2 = bd(s2, r2, i2);
  if (o2) {
    for (let c3 of s2) ko(c3, a2, -o2);
    wd(l2, a2, -o2);
  }
  return l2;
}
function bd(e5, t2, n2) {
  let i2 = [];
  for (let c3 of e5) {
    let d2 = [...c3];
    yd(d2[0], d2[d2.length - 1]) || d2.push([d2[0][0], d2[0][1]]), d2.length > 2 && i2.push(d2);
  }
  let o2 = [];
  t2 = Math.max(t2, 0.1);
  let r2 = [];
  for (let c3 of i2) for (let d2 = 0; d2 < c3.length - 1; d2++) {
    let u3 = c3[d2], p3 = c3[d2 + 1];
    if (u3[1] !== p3[1]) {
      let m2 = Math.min(u3[1], p3[1]);
      r2.push({ ymin: m2, ymax: Math.max(u3[1], p3[1]), x: m2 === u3[1] ? u3[0] : p3[0], islope: (p3[0] - u3[0]) / (p3[1] - u3[1]) });
    }
  }
  if (r2.sort((c3, d2) => c3.ymin < d2.ymin ? -1 : c3.ymin > d2.ymin ? 1 : c3.x < d2.x ? -1 : c3.x > d2.x ? 1 : c3.ymax === d2.ymax ? 0 : (c3.ymax - d2.ymax) / Math.abs(c3.ymax - d2.ymax)), !r2.length) return o2;
  let s2 = [], a2 = r2[0].ymin, l2 = 0;
  for (; s2.length || r2.length; ) {
    if (r2.length) {
      let c3 = -1;
      for (let u3 = 0; u3 < r2.length && !(r2[u3].ymin > a2); u3++) c3 = u3;
      r2.splice(0, c3 + 1).forEach((u3) => {
        s2.push({ s: a2, edge: u3 });
      });
    }
    if (s2 = s2.filter((c3) => !(c3.edge.ymax <= a2)), s2.sort((c3, d2) => c3.edge.x === d2.edge.x ? 0 : (c3.edge.x - d2.edge.x) / Math.abs(c3.edge.x - d2.edge.x)), (n2 !== 1 || l2 % t2 === 0) && s2.length > 1) for (let c3 = 0; c3 < s2.length; c3 = c3 + 2) {
      let d2 = c3 + 1;
      if (d2 >= s2.length) break;
      let u3 = s2[c3].edge, p3 = s2[d2].edge;
      o2.push([[Math.round(u3.x), a2], [Math.round(p3.x), a2]]);
    }
    a2 += n2, s2.forEach((c3) => {
      c3.edge.x = c3.edge.x + n2 * c3.edge.islope;
    }), l2++;
  }
  return o2;
}
function rt(e5, t2) {
  var n2;
  let i2 = t2.hachureAngle + 90, o2 = t2.hachureGap;
  o2 < 0 && (o2 = t2.strokeWidth * 4), o2 = Math.max(o2, 0.1);
  let r2 = 1;
  return t2.roughness >= 1 && (((n2 = t2.randomizer) === null || n2 === void 0 ? void 0 : n2.next()) || Math.random()) > 0.7 && (r2 = o2), Ps(e5, o2, i2, r2 || 1);
}
var kt2 = class {
  constructor(t2) {
    this.helper = t2;
  }
  fillPolygons(t2, n2) {
    return this._fillPolygons(t2, n2);
  }
  _fillPolygons(t2, n2) {
    let i2 = rt(t2, n2);
    return { type: "fillSketch", ops: this.renderLines(i2, n2) };
  }
  renderLines(t2, n2) {
    let i2 = [];
    for (let o2 of t2) i2.push(...this.helper.doubleLineOps(o2[0][0], o2[0][1], o2[1][0], o2[1][1], n2));
    return i2;
  }
};
P();
P();
function Rt(e5) {
  let t2 = e5[0], n2 = e5[1];
  return Math.sqrt(Math.pow(t2[0] - n2[0], 2) + Math.pow(t2[1] - n2[1], 2));
}
var fi = class extends kt2 {
  fillPolygons(t2, n2) {
    let i2 = n2.hachureGap;
    i2 < 0 && (i2 = n2.strokeWidth * 4), i2 = Math.max(i2, 0.1);
    let o2 = Object.assign({}, n2, { hachureGap: i2 }), r2 = rt(t2, o2), s2 = Math.PI / 180 * n2.hachureAngle, a2 = [], l2 = i2 * 0.5 * Math.cos(s2), c3 = i2 * 0.5 * Math.sin(s2);
    for (let [u3, p3] of r2) Rt([u3, p3]) && a2.push([[u3[0] - l2, u3[1] + c3], [...p3]], [[u3[0] + l2, u3[1] - c3], [...p3]]);
    return { type: "fillSketch", ops: this.renderLines(a2, n2) };
  }
};
P();
var hi = class extends kt2 {
  fillPolygons(t2, n2) {
    let i2 = this._fillPolygons(t2, n2), o2 = Object.assign({}, n2, { hachureAngle: n2.hachureAngle + 90 }), r2 = this._fillPolygons(t2, o2);
    return i2.ops = i2.ops.concat(r2.ops), i2;
  }
};
P();
var Ei = class {
  constructor(t2) {
    this.helper = t2;
  }
  fillPolygons(t2, n2) {
    n2 = Object.assign({}, n2, { hachureAngle: 0 });
    let i2 = rt(t2, n2);
    return this.dotsOnLines(i2, n2);
  }
  dotsOnLines(t2, n2) {
    let i2 = [], o2 = n2.hachureGap;
    o2 < 0 && (o2 = n2.strokeWidth * 4), o2 = Math.max(o2, 0.1);
    let r2 = n2.fillWeight;
    r2 < 0 && (r2 = n2.strokeWidth / 2);
    let s2 = o2 / 4;
    for (let a2 of t2) {
      let l2 = Rt(a2), c3 = l2 / o2, d2 = Math.ceil(c3) - 1, u3 = l2 - d2 * o2, p3 = (a2[0][0] + a2[1][0]) / 2 - o2 / 4, m2 = Math.min(a2[0][1], a2[1][1]);
      for (let f3 = 0; f3 < d2; f3++) {
        let E4 = m2 + u3 + f3 * o2, h3 = p3 - s2 + Math.random() * 2 * s2, g2 = E4 - s2 + Math.random() * 2 * s2, x3 = this.helper.ellipse(h3, g2, r2, r2, n2);
        i2.push(...x3.ops);
      }
    }
    return { type: "fillSketch", ops: i2 };
  }
};
P();
var gi = class {
  constructor(t2) {
    this.helper = t2;
  }
  fillPolygons(t2, n2) {
    let i2 = rt(t2, n2);
    return { type: "fillSketch", ops: this.dashedLine(i2, n2) };
  }
  dashedLine(t2, n2) {
    let i2 = n2.dashOffset < 0 ? n2.hachureGap < 0 ? n2.strokeWidth * 4 : n2.hachureGap : n2.dashOffset, o2 = n2.dashGap < 0 ? n2.hachureGap < 0 ? n2.strokeWidth * 4 : n2.hachureGap : n2.dashGap, r2 = [];
    return t2.forEach((s2) => {
      let a2 = Rt(s2), l2 = Math.floor(a2 / (i2 + o2)), c3 = (a2 + o2 - l2 * (i2 + o2)) / 2, d2 = s2[0], u3 = s2[1];
      d2[0] > u3[0] && (d2 = s2[1], u3 = s2[0]);
      let p3 = Math.atan((u3[1] - d2[1]) / (u3[0] - d2[0]));
      for (let m2 = 0; m2 < l2; m2++) {
        let f3 = m2 * (i2 + o2), E4 = f3 + i2, h3 = [d2[0] + f3 * Math.cos(p3) + c3 * Math.cos(p3), d2[1] + f3 * Math.sin(p3) + c3 * Math.sin(p3)], g2 = [d2[0] + E4 * Math.cos(p3) + c3 * Math.cos(p3), d2[1] + E4 * Math.sin(p3) + c3 * Math.sin(p3)];
        r2.push(...this.helper.doubleLineOps(h3[0], h3[1], g2[0], g2[1], n2));
      }
    }), r2;
  }
};
P();
var xi = class {
  constructor(t2) {
    this.helper = t2;
  }
  fillPolygons(t2, n2) {
    let i2 = n2.hachureGap < 0 ? n2.strokeWidth * 4 : n2.hachureGap, o2 = n2.zigzagOffset < 0 ? i2 : n2.zigzagOffset;
    n2 = Object.assign({}, n2, { hachureGap: i2 + o2 });
    let r2 = rt(t2, n2);
    return { type: "fillSketch", ops: this.zigzagLines(r2, o2, n2) };
  }
  zigzagLines(t2, n2, i2) {
    let o2 = [];
    return t2.forEach((r2) => {
      let s2 = Rt(r2), a2 = Math.round(s2 / (2 * n2)), l2 = r2[0], c3 = r2[1];
      l2[0] > c3[0] && (l2 = r2[1], c3 = r2[0]);
      let d2 = Math.atan((c3[1] - l2[1]) / (c3[0] - l2[0]));
      for (let u3 = 0; u3 < a2; u3++) {
        let p3 = u3 * 2 * n2, m2 = (u3 + 1) * 2 * n2, f3 = Math.sqrt(2 * Math.pow(n2, 2)), E4 = [l2[0] + p3 * Math.cos(d2), l2[1] + p3 * Math.sin(d2)], h3 = [l2[0] + m2 * Math.cos(d2), l2[1] + m2 * Math.sin(d2)], g2 = [E4[0] + f3 * Math.cos(d2 + Math.PI / 4), E4[1] + f3 * Math.sin(d2 + Math.PI / 4)];
        o2.push(...this.helper.doubleLineOps(E4[0], E4[1], g2[0], g2[1], i2), ...this.helper.doubleLineOps(g2[0], g2[1], h3[0], h3[1], i2));
      }
    }), o2;
  }
};
var De2 = {};
function Is(e5, t2) {
  let n2 = e5.fillStyle || "hachure";
  if (!De2[n2]) switch (n2) {
    case "zigzag":
      De2[n2] || (De2[n2] = new fi(t2));
      break;
    case "cross-hatch":
      De2[n2] || (De2[n2] = new hi(t2));
      break;
    case "dots":
      De2[n2] || (De2[n2] = new Ei(t2));
      break;
    case "dashed":
      De2[n2] || (De2[n2] = new gi(t2));
      break;
    case "zigzag-line":
      De2[n2] || (De2[n2] = new xi(t2));
      break;
    case "hachure":
    default:
      n2 = "hachure", De2[n2] || (De2[n2] = new kt2(t2));
      break;
  }
  return De2[n2];
}
P();
function Ss() {
  return Math.floor(Math.random() * 2 ** 31);
}
var wi = class {
  constructor(t2) {
    this.seed = t2;
  }
  next() {
    return this.seed ? (2 ** 31 - 1 & (this.seed = Math.imul(48271, this.seed))) / 2 ** 31 : Math.random();
  }
};
P();
P();
var yi = { A: 7, a: 7, C: 6, c: 6, H: 1, h: 1, L: 2, l: 2, M: 2, m: 2, Q: 4, q: 4, S: 4, s: 4, T: 2, t: 2, V: 1, v: 1, Z: 0, z: 0 };
function Pd(d2) {
  const t2 = [];
  const ws = /^[ \t\r\n,]+/, cmd = /^[aAcChHlLmMqQsStTvVzZ]/, num = /^(?:[-+]?[0-9]+(?:\.[0-9]*)?|[-+]?\.[0-9]+)(?:[eE][-+]?[0-9]+)?/;
  while (d2 !== "") {
    let m2;
    if (m2 = ws.exec(d2)) d2 = d2.slice(m2[0].length);
    else if (m2 = cmd.exec(d2)) {
      t2.push({ type: 0, text: m2[0] });
      d2 = d2.slice(m2[0].length);
    } else if (m2 = num.exec(d2)) {
      t2.push({ type: 1, text: `${parseFloat(m2[0])}` });
      d2 = d2.slice(m2[0].length);
    } else return [];
  }
  t2.push({ type: 2, text: "" });
  return t2;
}
function Ro2(e5, t2) {
  return e5.type === t2;
}
function xn2(e5) {
  let t2 = [], n2 = Pd(e5), i2 = "BOD", o2 = 0, r2 = n2[o2];
  for (; !Ro2(r2, 2); ) {
    let s2 = 0, a2 = [];
    if (i2 === "BOD") if (r2.text === "M" || r2.text === "m") o2++, s2 = yi[r2.text], i2 = r2.text;
    else return xn2("M0,0" + e5);
    else Ro2(r2, 1) ? s2 = yi[i2] : (o2++, s2 = yi[r2.text], i2 = r2.text);
    if (o2 + s2 < n2.length) {
      for (let l2 = o2; l2 < o2 + s2; l2++) {
        let c3 = n2[l2];
        if (Ro2(c3, 1)) a2[a2.length] = +c3.text;
        else throw new Error("Param not a number: " + i2 + "," + c3.text);
      }
      if (typeof yi[i2] == "number") {
        let l2 = { key: i2, data: a2 };
        t2.push(l2), o2 += s2, r2 = n2[o2], i2 === "M" && (i2 = "L"), i2 === "m" && (i2 = "l");
      } else throw new Error("Bad segment: " + i2);
    } else throw new Error("Path data ended short");
  }
  return t2;
}
P();
function Hn(e5) {
  let t2 = 0, n2 = 0, i2 = 0, o2 = 0, r2 = [];
  for (let { key: s2, data: a2 } of e5) switch (s2) {
    case "M":
      r2.push({ key: "M", data: [...a2] }), [t2, n2] = a2, [i2, o2] = a2;
      break;
    case "m":
      t2 += a2[0], n2 += a2[1], r2.push({ key: "M", data: [t2, n2] }), i2 = t2, o2 = n2;
      break;
    case "L":
      r2.push({ key: "L", data: [...a2] }), [t2, n2] = a2;
      break;
    case "l":
      t2 += a2[0], n2 += a2[1], r2.push({ key: "L", data: [t2, n2] });
      break;
    case "C":
      r2.push({ key: "C", data: [...a2] }), t2 = a2[4], n2 = a2[5];
      break;
    case "c": {
      let l2 = a2.map((c3, d2) => d2 % 2 ? c3 + n2 : c3 + t2);
      r2.push({ key: "C", data: l2 }), t2 = l2[4], n2 = l2[5];
      break;
    }
    case "Q":
      r2.push({ key: "Q", data: [...a2] }), t2 = a2[2], n2 = a2[3];
      break;
    case "q": {
      let l2 = a2.map((c3, d2) => d2 % 2 ? c3 + n2 : c3 + t2);
      r2.push({ key: "Q", data: l2 }), t2 = l2[2], n2 = l2[3];
      break;
    }
    case "A":
      r2.push({ key: "A", data: [...a2] }), t2 = a2[5], n2 = a2[6];
      break;
    case "a":
      t2 += a2[5], n2 += a2[6], r2.push({ key: "A", data: [a2[0], a2[1], a2[2], a2[3], a2[4], t2, n2] });
      break;
    case "H":
      r2.push({ key: "H", data: [...a2] }), t2 = a2[0];
      break;
    case "h":
      t2 += a2[0], r2.push({ key: "H", data: [t2] });
      break;
    case "V":
      r2.push({ key: "V", data: [...a2] }), n2 = a2[0];
      break;
    case "v":
      n2 += a2[0], r2.push({ key: "V", data: [n2] });
      break;
    case "S":
      r2.push({ key: "S", data: [...a2] }), t2 = a2[2], n2 = a2[3];
      break;
    case "s": {
      let l2 = a2.map((c3, d2) => d2 % 2 ? c3 + n2 : c3 + t2);
      r2.push({ key: "S", data: l2 }), t2 = l2[2], n2 = l2[3];
      break;
    }
    case "T":
      r2.push({ key: "T", data: [...a2] }), t2 = a2[0], n2 = a2[1];
      break;
    case "t":
      t2 += a2[0], n2 += a2[1], r2.push({ key: "T", data: [t2, n2] });
      break;
    case "Z":
    case "z":
      r2.push({ key: "Z", data: [] }), t2 = i2, n2 = o2;
      break;
  }
  return r2;
}
P();
function Yn(e5) {
  let t2 = [], n2 = "", i2 = 0, o2 = 0, r2 = 0, s2 = 0, a2 = 0, l2 = 0;
  for (let { key: c3, data: d2 } of e5) {
    switch (c3) {
      case "M":
        t2.push({ key: "M", data: [...d2] }), [i2, o2] = d2, [r2, s2] = d2;
        break;
      case "C":
        t2.push({ key: "C", data: [...d2] }), i2 = d2[4], o2 = d2[5], a2 = d2[2], l2 = d2[3];
        break;
      case "L":
        t2.push({ key: "L", data: [...d2] }), [i2, o2] = d2;
        break;
      case "H":
        i2 = d2[0], t2.push({ key: "L", data: [i2, o2] });
        break;
      case "V":
        o2 = d2[0], t2.push({ key: "L", data: [i2, o2] });
        break;
      case "S": {
        let u3 = 0, p3 = 0;
        n2 === "C" || n2 === "S" ? (u3 = i2 + (i2 - a2), p3 = o2 + (o2 - l2)) : (u3 = i2, p3 = o2), t2.push({ key: "C", data: [u3, p3, ...d2] }), a2 = d2[0], l2 = d2[1], i2 = d2[2], o2 = d2[3];
        break;
      }
      case "T": {
        let [u3, p3] = d2, m2 = 0, f3 = 0;
        n2 === "Q" || n2 === "T" ? (m2 = i2 + (i2 - a2), f3 = o2 + (o2 - l2)) : (m2 = i2, f3 = o2);
        let E4 = i2 + 2 * (m2 - i2) / 3, h3 = o2 + 2 * (f3 - o2) / 3, g2 = u3 + 2 * (m2 - u3) / 3, x3 = p3 + 2 * (f3 - p3) / 3;
        t2.push({ key: "C", data: [E4, h3, g2, x3, u3, p3] }), a2 = m2, l2 = f3, i2 = u3, o2 = p3;
        break;
      }
      case "Q": {
        let [u3, p3, m2, f3] = d2, E4 = i2 + 2 * (u3 - i2) / 3, h3 = o2 + 2 * (p3 - o2) / 3, g2 = m2 + 2 * (u3 - m2) / 3, x3 = f3 + 2 * (p3 - f3) / 3;
        t2.push({ key: "C", data: [E4, h3, g2, x3, m2, f3] }), a2 = u3, l2 = p3, i2 = m2, o2 = f3;
        break;
      }
      case "A": {
        let u3 = Math.abs(d2[0]), p3 = Math.abs(d2[1]), m2 = d2[2], f3 = d2[3], E4 = d2[4], h3 = d2[5], g2 = d2[6];
        u3 === 0 || p3 === 0 ? (t2.push({ key: "C", data: [i2, o2, h3, g2, h3, g2] }), i2 = h3, o2 = g2) : (i2 !== h3 || o2 !== g2) && (Ms(i2, o2, h3, g2, u3, p3, m2, f3, E4).forEach(function(y4) {
          t2.push({ key: "C", data: y4 });
        }), i2 = h3, o2 = g2);
        break;
      }
      case "Z":
        t2.push({ key: "Z", data: [] }), i2 = r2, o2 = s2;
        break;
    }
    n2 = c3;
  }
  return t2;
}
function Id(e5) {
  return Math.PI * e5 / 180;
}
function _n(e5, t2, n2) {
  let i2 = e5 * Math.cos(n2) - t2 * Math.sin(n2), o2 = e5 * Math.sin(n2) + t2 * Math.cos(n2);
  return [i2, o2];
}
function Ms(e5, t2, n2, i2, o2, r2, s2, a2, l2, c3) {
  let d2 = Id(s2), u3 = [], p3 = 0, m2 = 0, f3 = 0, E4 = 0;
  if (c3) [p3, m2, f3, E4] = c3;
  else {
    [e5, t2] = _n(e5, t2, -d2), [n2, i2] = _n(n2, i2, -d2);
    let R2 = (e5 - n2) / 2, L4 = (t2 - i2) / 2, W = R2 * R2 / (o2 * o2) + L4 * L4 / (r2 * r2);
    W > 1 && (W = Math.sqrt(W), o2 = W * o2, r2 = W * r2);
    let N3 = a2 === l2 ? -1 : 1, ee3 = o2 * o2, S3 = r2 * r2, K2 = ee3 * S3 - ee3 * L4 * L4 - S3 * R2 * R2, j4 = ee3 * L4 * L4 + S3 * R2 * R2, te2 = N3 * Math.sqrt(Math.abs(K2 / j4));
    f3 = te2 * o2 * L4 / r2 + (e5 + n2) / 2, E4 = te2 * -r2 * R2 / o2 + (t2 + i2) / 2, p3 = Math.asin(parseFloat(((t2 - E4) / r2).toFixed(9))), m2 = Math.asin(parseFloat(((i2 - E4) / r2).toFixed(9))), e5 < f3 && (p3 = Math.PI - p3), n2 < f3 && (m2 = Math.PI - m2), p3 < 0 && (p3 = Math.PI * 2 + p3), m2 < 0 && (m2 = Math.PI * 2 + m2), l2 && p3 > m2 && (p3 = p3 - Math.PI * 2), !l2 && m2 > p3 && (m2 = m2 - Math.PI * 2);
  }
  let h3 = m2 - p3;
  if (Math.abs(h3) > Math.PI * 120 / 180) {
    let R2 = m2, L4 = n2, W = i2;
    l2 && m2 > p3 ? m2 = p3 + Math.PI * 120 / 180 * 1 : m2 = p3 + Math.PI * 120 / 180 * -1, n2 = f3 + o2 * Math.cos(m2), i2 = E4 + r2 * Math.sin(m2), u3 = Ms(n2, i2, L4, W, o2, r2, s2, 0, l2, [m2, R2, f3, E4]);
  }
  h3 = m2 - p3;
  let g2 = Math.cos(p3), x3 = Math.sin(p3), y4 = Math.cos(m2), b2 = Math.sin(m2), w4 = Math.tan(h3 / 4), I4 = 4 / 3 * o2 * w4, M4 = 4 / 3 * r2 * w4, v3 = [e5, t2], T4 = [e5 + I4 * x3, t2 - M4 * g2], F4 = [n2 + I4 * b2, i2 - M4 * y4], C4 = [n2, i2];
  if (T4[0] = 2 * v3[0] - T4[0], T4[1] = 2 * v3[1] - T4[1], c3) return [T4, F4, C4].concat(u3);
  {
    u3 = [T4, F4, C4].concat(u3);
    let R2 = [];
    for (let L4 = 0; L4 < u3.length; L4 += 3) {
      let W = _n(u3[L4][0], u3[L4][1], d2), N3 = _n(u3[L4 + 1][0], u3[L4 + 1][1], d2), ee3 = _n(u3[L4 + 2][0], u3[L4 + 2][1], d2);
      R2.push([W[0], W[1], N3[0], N3[1], ee3[0], ee3[1]]);
    }
    return R2;
  }
}
var Sd = { randOffset: Ad, randOffsetWithRange: vd, ellipse: Td, doubleLineOps: Dd };
function Fo2(e5, t2, n2, i2, o2) {
  return { type: "path", ops: ht2(e5, t2, n2, i2, o2) };
}
function Xn2(e5, t2, n2) {
  let i2 = (e5 || []).length;
  if (i2 > 2) {
    let o2 = [];
    for (let r2 = 0; r2 < i2 - 1; r2++) o2.push(...ht2(e5[r2][0], e5[r2][1], e5[r2 + 1][0], e5[r2 + 1][1], n2));
    return t2 && o2.push(...ht2(e5[i2 - 1][0], e5[i2 - 1][1], e5[0][0], e5[0][1], n2)), { type: "path", ops: o2 };
  } else if (i2 === 2) return Fo2(e5[0][0], e5[0][1], e5[1][0], e5[1][1], n2);
  return { type: "path", ops: [] };
}
function Md(e5, t2) {
  return Xn2(e5, true, t2);
}
function Ls(e5, t2, n2, i2, o2) {
  let r2 = [[e5, t2], [e5 + n2, t2], [e5 + n2, t2 + i2], [e5, t2 + i2]];
  return Md(r2, o2);
}
function No(e5, t2) {
  let n2 = As(e5, 1 * (1 + t2.roughness * 0.2), t2);
  if (!t2.disableMultiStroke) {
    let i2 = As(e5, 1.5 * (1 + t2.roughness * 0.22), Ld(t2));
    n2 = n2.concat(i2);
  }
  return { type: "path", ops: n2 };
}
function Td(e5, t2, n2, i2, o2) {
  let r2 = zo(n2, i2, o2);
  return Ii(e5, t2, o2, r2).opset;
}
function zo(e5, t2, n2) {
  let i2 = Math.sqrt(Math.PI * 2 * Math.sqrt((Math.pow(e5 / 2, 2) + Math.pow(t2 / 2, 2)) / 2)), o2 = Math.ceil(Math.max(n2.curveStepCount, n2.curveStepCount / Math.sqrt(200) * i2)), r2 = Math.PI * 2 / o2, s2 = Math.abs(e5 / 2), a2 = Math.abs(t2 / 2), l2 = 1 - n2.curveFitting;
  return s2 += O2(s2 * l2, n2), a2 += O2(a2 * l2, n2), { increment: r2, rx: s2, ry: a2 };
}
function Ii(e5, t2, n2, i2) {
  let [o2, r2] = vs(i2.increment, e5, t2, i2.rx, i2.ry, 1, i2.increment * bi(0.1, bi(0.4, 1, n2), n2), n2), s2 = Pi(o2, null, n2);
  if (!n2.disableMultiStroke && n2.roughness !== 0) {
    let [a2] = vs(i2.increment, e5, t2, i2.rx, i2.ry, 1.5, 0, n2), l2 = Pi(a2, null, n2);
    s2 = s2.concat(l2);
  }
  return { estimatedPoints: r2, opset: { type: "path", ops: s2 } };
}
function Ho(e5, t2, n2, i2, o2, r2, s2, a2, l2) {
  let c3 = e5, d2 = t2, u3 = Math.abs(n2 / 2), p3 = Math.abs(i2 / 2);
  u3 += O2(u3 * 0.01, l2), p3 += O2(p3 * 0.01, l2);
  let m2 = o2, f3 = r2;
  for (; m2 < 0; ) m2 += Math.PI * 2, f3 += Math.PI * 2;
  f3 - m2 > Math.PI * 2 && (m2 = 0, f3 = Math.PI * 2);
  let E4 = Math.PI * 2 / l2.curveStepCount, h3 = Math.min(E4 / 2, (f3 - m2) / 2), g2 = Ds(h3, c3, d2, u3, p3, m2, f3, 1, l2);
  if (!l2.disableMultiStroke) {
    let x3 = Ds(h3, c3, d2, u3, p3, m2, f3, 1.5, l2);
    g2.push(...x3);
  }
  return s2 && (a2 ? g2.push(...ht2(c3, d2, c3 + u3 * Math.cos(m2), d2 + p3 * Math.sin(m2), l2), ...ht2(c3, d2, c3 + u3 * Math.cos(f3), d2 + p3 * Math.sin(f3), l2)) : g2.push({ op: "lineTo", data: [c3, d2] }, { op: "lineTo", data: [c3 + u3 * Math.cos(m2), d2 + p3 * Math.sin(m2)] })), { type: "path", ops: g2 };
}
function _o(e5, t2) {
  let n2 = Yn(Hn(xn2(e5))), i2 = [], o2 = [0, 0], r2 = [0, 0];
  for (let { key: s2, data: a2 } of n2) switch (s2) {
    case "M": {
      r2 = [a2[0], a2[1]], o2 = [a2[0], a2[1]];
      break;
    }
    case "L":
      i2.push(...ht2(r2[0], r2[1], a2[0], a2[1], t2)), r2 = [a2[0], a2[1]];
      break;
    case "C": {
      let [l2, c3, d2, u3, p3, m2] = a2;
      i2.push(...Cd(l2, c3, d2, u3, p3, m2, r2, t2)), r2 = [p3, m2];
      break;
    }
    case "Z":
      i2.push(...ht2(r2[0], r2[1], o2[0], o2[1], t2)), r2 = [o2[0], o2[1]];
      break;
  }
  return { type: "path", ops: i2 };
}
function Si(e5, t2) {
  let n2 = [];
  for (let i2 of e5) if (i2.length) {
    let o2 = t2.maxRandomnessOffset || 0, r2 = i2.length;
    if (r2 > 2) {
      n2.push({ op: "move", data: [i2[0][0] + O2(o2, t2), i2[0][1] + O2(o2, t2)] });
      for (let s2 = 1; s2 < r2; s2++) n2.push({ op: "lineTo", data: [i2[s2][0] + O2(o2, t2), i2[s2][1] + O2(o2, t2)] });
    }
  }
  return { type: "fillPath", ops: n2 };
}
function on3(e5, t2) {
  return Is(t2, Sd).fillPolygons(e5, t2);
}
function Cs(e5, t2, n2, i2, o2, r2, s2) {
  let a2 = e5, l2 = t2, c3 = Math.abs(n2 / 2), d2 = Math.abs(i2 / 2);
  c3 += O2(c3 * 0.01, s2), d2 += O2(d2 * 0.01, s2);
  let u3 = o2, p3 = r2;
  for (; u3 < 0; ) u3 += Math.PI * 2, p3 += Math.PI * 2;
  p3 - u3 > Math.PI * 2 && (u3 = 0, p3 = Math.PI * 2);
  let m2 = (p3 - u3) / s2.curveStepCount, f3 = [];
  for (let E4 = u3; E4 <= p3; E4 = E4 + m2) f3.push([a2 + c3 * Math.cos(E4), l2 + d2 * Math.sin(E4)]);
  return f3.push([a2 + c3 * Math.cos(p3), l2 + d2 * Math.sin(p3)]), f3.push([a2, l2]), on3([f3], s2);
}
function Ad(e5, t2) {
  return O2(e5, t2);
}
function vd(e5, t2, n2) {
  return bi(e5, t2, n2);
}
function Dd(e5, t2, n2, i2, o2) {
  return ht2(e5, t2, n2, i2, o2, true);
}
function Ld(e5) {
  let t2 = Object.assign({}, e5);
  return t2.randomizer = void 0, e5.seed && (t2.seed = e5.seed + 1), t2;
}
function Bs(e5) {
  return e5.randomizer || (e5.randomizer = new wi(e5.seed || 0)), e5.randomizer.next();
}
function bi(e5, t2, n2, i2 = 1) {
  return n2.roughness * i2 * (Bs(n2) * (t2 - e5) + e5);
}
function O2(e5, t2, n2 = 1) {
  return bi(-e5, e5, t2, n2);
}
function ht2(e5, t2, n2, i2, o2, r2 = false) {
  let s2 = r2 ? o2.disableMultiStrokeFill : o2.disableMultiStroke, a2 = Ts2(e5, t2, n2, i2, o2, true, false);
  if (s2) return a2;
  let l2 = Ts2(e5, t2, n2, i2, o2, true, true);
  return a2.concat(l2);
}
function Ts2(e5, t2, n2, i2, o2, r2, s2) {
  let a2 = Math.pow(e5 - n2, 2) + Math.pow(t2 - i2, 2), l2 = Math.sqrt(a2), c3 = 1;
  l2 < 200 ? c3 = 1 : l2 > 500 ? c3 = 0.4 : c3 = -16668e-7 * l2 + 1.233334;
  let d2 = o2.maxRandomnessOffset || 0;
  d2 * d2 * 100 > a2 && (d2 = l2 / 10);
  let u3 = d2 / 2, p3 = 0.2 + Bs(o2) * 0.2, m2 = o2.bowing * o2.maxRandomnessOffset * (i2 - t2) / 200, f3 = o2.bowing * o2.maxRandomnessOffset * (e5 - n2) / 200;
  m2 = O2(m2, o2, c3), f3 = O2(f3, o2, c3);
  let E4 = [], h3 = () => O2(u3, o2, c3), g2 = () => O2(d2, o2, c3), x3 = o2.preserveVertices;
  return r2 && (s2 ? E4.push({ op: "move", data: [e5 + (x3 ? 0 : h3()), t2 + (x3 ? 0 : h3())] }) : E4.push({ op: "move", data: [e5 + (x3 ? 0 : O2(d2, o2, c3)), t2 + (x3 ? 0 : O2(d2, o2, c3))] })), s2 ? E4.push({ op: "bcurveTo", data: [m2 + e5 + (n2 - e5) * p3 + h3(), f3 + t2 + (i2 - t2) * p3 + h3(), m2 + e5 + 2 * (n2 - e5) * p3 + h3(), f3 + t2 + 2 * (i2 - t2) * p3 + h3(), n2 + (x3 ? 0 : h3()), i2 + (x3 ? 0 : h3())] }) : E4.push({ op: "bcurveTo", data: [m2 + e5 + (n2 - e5) * p3 + g2(), f3 + t2 + (i2 - t2) * p3 + g2(), m2 + e5 + 2 * (n2 - e5) * p3 + g2(), f3 + t2 + 2 * (i2 - t2) * p3 + g2(), n2 + (x3 ? 0 : g2()), i2 + (x3 ? 0 : g2())] }), E4;
}
function As(e5, t2, n2) {
  let i2 = [];
  i2.push([e5[0][0] + O2(t2, n2), e5[0][1] + O2(t2, n2)]), i2.push([e5[0][0] + O2(t2, n2), e5[0][1] + O2(t2, n2)]);
  for (let o2 = 1; o2 < e5.length; o2++) i2.push([e5[o2][0] + O2(t2, n2), e5[o2][1] + O2(t2, n2)]), o2 === e5.length - 1 && i2.push([e5[o2][0] + O2(t2, n2), e5[o2][1] + O2(t2, n2)]);
  return Pi(i2, null, n2);
}
function Pi(e5, t2, n2) {
  let i2 = e5.length, o2 = [];
  if (i2 > 3) {
    let r2 = [], s2 = 1 - n2.curveTightness;
    o2.push({ op: "move", data: [e5[1][0], e5[1][1]] });
    for (let a2 = 1; a2 + 2 < i2; a2++) {
      let l2 = e5[a2];
      r2[0] = [l2[0], l2[1]], r2[1] = [l2[0] + (s2 * e5[a2 + 1][0] - s2 * e5[a2 - 1][0]) / 6, l2[1] + (s2 * e5[a2 + 1][1] - s2 * e5[a2 - 1][1]) / 6], r2[2] = [e5[a2 + 1][0] + (s2 * e5[a2][0] - s2 * e5[a2 + 2][0]) / 6, e5[a2 + 1][1] + (s2 * e5[a2][1] - s2 * e5[a2 + 2][1]) / 6], r2[3] = [e5[a2 + 1][0], e5[a2 + 1][1]], o2.push({ op: "bcurveTo", data: [r2[1][0], r2[1][1], r2[2][0], r2[2][1], r2[3][0], r2[3][1]] });
    }
    if (t2 && t2.length === 2) {
      let a2 = n2.maxRandomnessOffset;
      o2.push({ op: "lineTo", data: [t2[0] + O2(a2, n2), t2[1] + O2(a2, n2)] });
    }
  } else i2 === 3 ? (o2.push({ op: "move", data: [e5[1][0], e5[1][1]] }), o2.push({ op: "bcurveTo", data: [e5[1][0], e5[1][1], e5[2][0], e5[2][1], e5[2][0], e5[2][1]] })) : i2 === 2 && o2.push(...ht2(e5[0][0], e5[0][1], e5[1][0], e5[1][1], n2));
  return o2;
}
function vs(e5, t2, n2, i2, o2, r2, s2, a2) {
  let l2 = a2.roughness === 0, c3 = [], d2 = [];
  if (l2) {
    e5 = e5 / 4, d2.push([t2 + i2 * Math.cos(-e5), n2 + o2 * Math.sin(-e5)]);
    for (let u3 = 0; u3 <= Math.PI * 2; u3 = u3 + e5) {
      let p3 = [t2 + i2 * Math.cos(u3), n2 + o2 * Math.sin(u3)];
      c3.push(p3), d2.push(p3);
    }
    d2.push([t2 + i2 * Math.cos(0), n2 + o2 * Math.sin(0)]), d2.push([t2 + i2 * Math.cos(e5), n2 + o2 * Math.sin(e5)]);
  } else {
    let u3 = O2(0.5, a2) - Math.PI / 2;
    d2.push([O2(r2, a2) + t2 + 0.9 * i2 * Math.cos(u3 - e5), O2(r2, a2) + n2 + 0.9 * o2 * Math.sin(u3 - e5)]);
    let p3 = Math.PI * 2 + u3 - 0.01;
    for (let m2 = u3; m2 < p3; m2 = m2 + e5) {
      let f3 = [O2(r2, a2) + t2 + i2 * Math.cos(m2), O2(r2, a2) + n2 + o2 * Math.sin(m2)];
      c3.push(f3), d2.push(f3);
    }
    d2.push([O2(r2, a2) + t2 + i2 * Math.cos(u3 + Math.PI * 2 + s2 * 0.5), O2(r2, a2) + n2 + o2 * Math.sin(u3 + Math.PI * 2 + s2 * 0.5)]), d2.push([O2(r2, a2) + t2 + 0.98 * i2 * Math.cos(u3 + s2), O2(r2, a2) + n2 + 0.98 * o2 * Math.sin(u3 + s2)]), d2.push([O2(r2, a2) + t2 + 0.9 * i2 * Math.cos(u3 + s2 * 0.5), O2(r2, a2) + n2 + 0.9 * o2 * Math.sin(u3 + s2 * 0.5)]);
  }
  return [d2, c3];
}
function Ds(e5, t2, n2, i2, o2, r2, s2, a2, l2) {
  let c3 = r2 + O2(0.1, l2), d2 = [];
  d2.push([O2(a2, l2) + t2 + 0.9 * i2 * Math.cos(c3 - e5), O2(a2, l2) + n2 + 0.9 * o2 * Math.sin(c3 - e5)]);
  for (let u3 = c3; u3 <= s2; u3 = u3 + e5) d2.push([O2(a2, l2) + t2 + i2 * Math.cos(u3), O2(a2, l2) + n2 + o2 * Math.sin(u3)]);
  return d2.push([t2 + i2 * Math.cos(s2), n2 + o2 * Math.sin(s2)]), d2.push([t2 + i2 * Math.cos(s2), n2 + o2 * Math.sin(s2)]), Pi(d2, null, l2);
}
function Cd(e5, t2, n2, i2, o2, r2, s2, a2) {
  let l2 = [], c3 = [a2.maxRandomnessOffset || 1, (a2.maxRandomnessOffset || 1) + 0.3], d2 = [0, 0], u3 = a2.disableMultiStroke ? 1 : 2, p3 = a2.preserveVertices;
  for (let m2 = 0; m2 < u3; m2++) m2 === 0 ? l2.push({ op: "move", data: [s2[0], s2[1]] }) : l2.push({ op: "move", data: [s2[0] + (p3 ? 0 : O2(c3[0], a2)), s2[1] + (p3 ? 0 : O2(c3[0], a2))] }), d2 = p3 ? [o2, r2] : [o2 + O2(c3[m2], a2), r2 + O2(c3[m2], a2)], l2.push({ op: "bcurveTo", data: [e5 + O2(c3[m2], a2), t2 + O2(c3[m2], a2), n2 + O2(c3[m2], a2), i2 + O2(c3[m2], a2), d2[0], d2[1]] });
  return l2;
}
P();
function Un(e5) {
  return [...e5];
}
function Gs(e5, t2 = 0) {
  let n2 = e5.length;
  if (n2 < 3) throw new Error("A curve must have at least three points.");
  let i2 = [];
  if (n2 === 3) i2.push(Un(e5[0]), Un(e5[1]), Un(e5[2]), Un(e5[2]));
  else {
    let o2 = [];
    o2.push(e5[0], e5[0]);
    for (let a2 = 1; a2 < e5.length; a2++) o2.push(e5[a2]), a2 === e5.length - 1 && o2.push(e5[a2]);
    let r2 = [], s2 = 1 - t2;
    i2.push(Un(o2[0]));
    for (let a2 = 1; a2 + 2 < o2.length; a2++) {
      let l2 = o2[a2];
      r2[0] = [l2[0], l2[1]], r2[1] = [l2[0] + (s2 * o2[a2 + 1][0] - s2 * o2[a2 - 1][0]) / 6, l2[1] + (s2 * o2[a2 + 1][1] - s2 * o2[a2 - 1][1]) / 6], r2[2] = [o2[a2 + 1][0] + (s2 * o2[a2][0] - s2 * o2[a2 + 2][0]) / 6, o2[a2 + 1][1] + (s2 * o2[a2][1] - s2 * o2[a2 + 2][1]) / 6], r2[3] = [o2[a2 + 1][0], o2[a2 + 1][1]], i2.push(r2[1], r2[2], r2[3]);
    }
  }
  return i2;
}
P();
function Bd(e5, t2) {
  return Math.sqrt(Mi(e5, t2));
}
function Mi(e5, t2) {
  return Math.pow(e5[0] - t2[0], 2) + Math.pow(e5[1] - t2[1], 2);
}
function Gd(e5, t2, n2) {
  let i2 = Mi(t2, n2);
  if (i2 === 0) return Mi(e5, t2);
  let o2 = ((e5[0] - t2[0]) * (n2[0] - t2[0]) + (e5[1] - t2[1]) * (n2[1] - t2[1])) / i2;
  return o2 = Math.max(0, Math.min(1, o2)), Mi(e5, rn3(t2, n2, o2));
}
function rn3(e5, t2, n2) {
  return [e5[0] + (t2[0] - e5[0]) * n2, e5[1] + (t2[1] - e5[1]) * n2];
}
function Od(e5, t2) {
  let n2 = e5[t2 + 0], i2 = e5[t2 + 1], o2 = e5[t2 + 2], r2 = e5[t2 + 3], s2 = 3 * i2[0] - 2 * n2[0] - r2[0];
  s2 *= s2;
  let a2 = 3 * i2[1] - 2 * n2[1] - r2[1];
  a2 *= a2;
  let l2 = 3 * o2[0] - 2 * r2[0] - n2[0];
  l2 *= l2;
  let c3 = 3 * o2[1] - 2 * r2[1] - n2[1];
  return c3 *= c3, s2 < l2 && (s2 = l2), a2 < c3 && (a2 = c3), s2 + a2;
}
function Yo(e5, t2, n2, i2) {
  let o2 = i2 || [];
  if (Od(e5, t2) < n2) {
    let r2 = e5[t2 + 0];
    o2.length ? Bd(o2[o2.length - 1], r2) > 1 && o2.push(r2) : o2.push(r2), o2.push(e5[t2 + 3]);
  } else {
    let s2 = e5[t2 + 0], a2 = e5[t2 + 1], l2 = e5[t2 + 2], c3 = e5[t2 + 3], d2 = rn3(s2, a2, 0.5), u3 = rn3(a2, l2, 0.5), p3 = rn3(l2, c3, 0.5), m2 = rn3(d2, u3, 0.5), f3 = rn3(u3, p3, 0.5), E4 = rn3(m2, f3, 0.5);
    Yo([s2, d2, m2, E4], 0, n2, o2), Yo([E4, f3, p3, c3], 0, n2, o2);
  }
  return o2;
}
function Wn2(e5, t2) {
  return Ti(e5, 0, e5.length, t2);
}
function Ti(e5, t2, n2, i2, o2) {
  let r2 = o2 || [], s2 = e5[t2], a2 = e5[n2 - 1], l2 = 0, c3 = 1;
  for (let d2 = t2 + 1; d2 < n2 - 1; ++d2) {
    let u3 = Gd(e5[d2], s2, a2);
    u3 > l2 && (l2 = u3, c3 = d2);
  }
  return Math.sqrt(l2) > i2 ? (Ti(e5, t2, c3 + 1, i2, r2), Ti(e5, c3, n2, i2, r2)) : (r2.length || r2.push(s2), r2.push(a2)), r2;
}
function Et(e5, t2 = 0.15, n2) {
  let i2 = [], o2 = (e5.length - 1) / 3;
  for (let r2 = 0; r2 < o2; r2++) {
    let s2 = r2 * 3;
    Yo(e5, s2, t2, i2);
  }
  return n2 && n2 > 0 ? Ti(i2, 0, i2.length, n2) : i2;
}
P();
function Os(e5, t2, n2) {
  let i2 = xn2(e5), o2 = Yn(Hn(i2)), r2 = [], s2 = [], a2 = [0, 0], l2 = [], c3 = () => {
    l2.length >= 4 && s2.push(...Et(l2, t2)), l2 = [];
  }, d2 = () => {
    c3(), s2.length && (r2.push(s2), s2 = []);
  };
  for (let { key: p3, data: m2 } of o2) switch (p3) {
    case "M":
      d2(), a2 = [m2[0], m2[1]], s2.push(a2);
      break;
    case "L":
      c3(), s2.push([m2[0], m2[1]]);
      break;
    case "C":
      if (!l2.length) {
        let f3 = s2.length ? s2[s2.length - 1] : a2;
        l2.push([f3[0], f3[1]]);
      }
      l2.push([m2[0], m2[1]]), l2.push([m2[2], m2[3]]), l2.push([m2[4], m2[5]]);
      break;
    case "Z":
      c3(), s2.push([a2[0], a2[1]]);
      break;
  }
  if (d2(), !n2) return r2;
  let u3 = [];
  for (let p3 of r2) {
    let m2 = Wn2(p3, n2);
    m2.length && u3.push(m2);
  }
  return u3;
}
var Ne2 = "none";
var Ue2 = class {
  constructor(t2) {
    this.defaultOptions = { maxRandomnessOffset: 2, roughness: 1, bowing: 1, stroke: "#000", strokeWidth: 1, curveTightness: 0, curveFitting: 0.95, curveStepCount: 9, fillStyle: "hachure", fillWeight: -1, hachureAngle: -41, hachureGap: -1, dashOffset: -1, dashGap: -1, zigzagOffset: -1, seed: 0, disableMultiStroke: false, disableMultiStrokeFill: false, preserveVertices: false, fillShapeRoughnessGain: 0.8 }, this.config = t2 || {}, this.config.options && (this.defaultOptions = this._o(this.config.options));
  }
  static newSeed() {
    return Ss();
  }
  _o(t2) {
    return t2 ? Object.assign({}, this.defaultOptions, t2) : this.defaultOptions;
  }
  _d(t2, n2, i2) {
    return { shape: t2, sets: n2 || [], options: i2 || this.defaultOptions };
  }
  line(t2, n2, i2, o2, r2) {
    let s2 = this._o(r2);
    return this._d("line", [Fo2(t2, n2, i2, o2, s2)], s2);
  }
  rectangle(t2, n2, i2, o2, r2) {
    let s2 = this._o(r2), a2 = [], l2 = Ls(t2, n2, i2, o2, s2);
    if (s2.fill) {
      let c3 = [[t2, n2], [t2 + i2, n2], [t2 + i2, n2 + o2], [t2, n2 + o2]];
      s2.fillStyle === "solid" ? a2.push(Si([c3], s2)) : a2.push(on3([c3], s2));
    }
    return s2.stroke !== Ne2 && a2.push(l2), this._d("rectangle", a2, s2);
  }
  ellipse(t2, n2, i2, o2, r2) {
    let s2 = this._o(r2), a2 = [], l2 = zo(i2, o2, s2), c3 = Ii(t2, n2, s2, l2);
    if (s2.fill) if (s2.fillStyle === "solid") {
      let d2 = Ii(t2, n2, s2, l2).opset;
      d2.type = "fillPath", a2.push(d2);
    } else a2.push(on3([c3.estimatedPoints], s2));
    return s2.stroke !== Ne2 && a2.push(c3.opset), this._d("ellipse", a2, s2);
  }
  circle(t2, n2, i2, o2) {
    let r2 = this.ellipse(t2, n2, i2, i2, o2);
    return r2.shape = "circle", r2;
  }
  linearPath(t2, n2) {
    let i2 = this._o(n2);
    return this._d("linearPath", [Xn2(t2, false, i2)], i2);
  }
  arc(t2, n2, i2, o2, r2, s2, a2 = false, l2) {
    let c3 = this._o(l2), d2 = [], u3 = Ho(t2, n2, i2, o2, r2, s2, a2, true, c3);
    if (a2 && c3.fill) if (c3.fillStyle === "solid") {
      let p3 = Object.assign({}, c3);
      p3.disableMultiStroke = true;
      let m2 = Ho(t2, n2, i2, o2, r2, s2, true, false, p3);
      m2.type = "fillPath", d2.push(m2);
    } else d2.push(Cs(t2, n2, i2, o2, r2, s2, c3));
    return c3.stroke !== Ne2 && d2.push(u3), this._d("arc", d2, c3);
  }
  curve(t2, n2) {
    let i2 = this._o(n2), o2 = [], r2 = No(t2, i2);
    if (i2.fill && i2.fill !== Ne2 && t2.length >= 3) if (i2.fillStyle === "solid") {
      let s2 = No(t2, Object.assign(Object.assign({}, i2), { disableMultiStroke: true, roughness: i2.roughness ? i2.roughness + i2.fillShapeRoughnessGain : 0 }));
      o2.push({ type: "fillPath", ops: this._mergedShape(s2.ops) });
    } else {
      let s2 = Gs(t2), a2 = Et(s2, 10, (1 + i2.roughness) / 2);
      o2.push(on3([a2], i2));
    }
    return i2.stroke !== Ne2 && o2.push(r2), this._d("curve", o2, i2);
  }
  polygon(t2, n2) {
    let i2 = this._o(n2), o2 = [], r2 = Xn2(t2, true, i2);
    return i2.fill && (i2.fillStyle === "solid" ? o2.push(Si([t2], i2)) : o2.push(on3([t2], i2))), i2.stroke !== Ne2 && o2.push(r2), this._d("polygon", o2, i2);
  }
  path(t2, n2) {
    let i2 = this._o(n2), o2 = [];
    if (!t2) return this._d("path", o2, i2);
    t2 = (t2 || "").replace(/\n/g, " ").replace(/(-\s)/g, "-").replace("/(ss)/g", " ");
    let r2 = i2.fill && i2.fill !== "transparent" && i2.fill !== Ne2, s2 = i2.stroke !== Ne2, a2 = !!(i2.simplification && i2.simplification < 1), l2 = a2 ? 4 - 4 * (i2.simplification || 1) : (1 + i2.roughness) / 2, c3 = Os(t2, 1, l2), d2 = _o(t2, i2);
    if (r2) if (i2.fillStyle === "solid") if (c3.length === 1) {
      let u3 = _o(t2, Object.assign(Object.assign({}, i2), { disableMultiStroke: true, roughness: i2.roughness ? i2.roughness + i2.fillShapeRoughnessGain : 0 }));
      o2.push({ type: "fillPath", ops: this._mergedShape(u3.ops) });
    } else o2.push(Si(c3, i2));
    else o2.push(on3(c3, i2));
    return s2 && (a2 ? c3.forEach((u3) => {
      o2.push(Xn2(u3, false, i2));
    }) : o2.push(d2)), this._d("path", o2, i2);
  }
  opsToPath(t2, n2) {
    let i2 = "";
    for (let o2 of t2.ops) {
      let r2 = typeof n2 == "number" && n2 >= 0 ? o2.data.map((s2) => +s2.toFixed(n2)) : o2.data;
      switch (o2.op) {
        case "move":
          i2 += `M${r2[0]} ${r2[1]} `;
          break;
        case "bcurveTo":
          i2 += `C${r2[0]} ${r2[1]}, ${r2[2]} ${r2[3]}, ${r2[4]} ${r2[5]} `;
          break;
        case "lineTo":
          i2 += `L${r2[0]} ${r2[1]} `;
          break;
      }
    }
    return i2.trim();
  }
  toPaths(t2) {
    let n2 = t2.sets || [], i2 = t2.options || this.defaultOptions, o2 = [];
    for (let r2 of n2) {
      let s2 = null;
      switch (r2.type) {
        case "path":
          s2 = { d: this.opsToPath(r2), stroke: i2.stroke, strokeWidth: i2.strokeWidth, fill: Ne2 };
          break;
        case "fillPath":
          s2 = { d: this.opsToPath(r2), stroke: Ne2, strokeWidth: 0, fill: i2.fill || Ne2 };
          break;
        case "fillSketch":
          s2 = this.fillSketch(r2, i2);
          break;
      }
      s2 && o2.push(s2);
    }
    return o2;
  }
  fillSketch(t2, n2) {
    let i2 = n2.fillWeight;
    return i2 < 0 && (i2 = n2.strokeWidth / 2), { d: this.opsToPath(t2), stroke: n2.fill || Ne2, strokeWidth: i2, fill: Ne2 };
  }
  _mergedShape(t2) {
    return t2.filter((n2, i2) => i2 === 0 ? true : n2.op !== "move");
  }
};
var Ai = class {
  constructor(t2, n2) {
    this.canvas = t2, this.ctx = this.canvas.getContext("2d"), this.gen = new Ue2(n2);
  }
  draw(t2) {
    let n2 = t2.sets || [], i2 = t2.options || this.getDefaultOptions(), o2 = this.ctx, r2 = t2.options.fixedDecimalPlaceDigits;
    for (let s2 of n2) switch (s2.type) {
      case "path":
        o2.save(), o2.strokeStyle = i2.stroke === "none" ? "transparent" : i2.stroke, o2.lineWidth = i2.strokeWidth, i2.strokeLineDash && o2.setLineDash(i2.strokeLineDash), i2.strokeLineDashOffset && (o2.lineDashOffset = i2.strokeLineDashOffset), this._drawToContext(o2, s2, r2), o2.restore();
        break;
      case "fillPath": {
        o2.save(), o2.fillStyle = i2.fill || "";
        let a2 = t2.shape === "curve" || t2.shape === "polygon" || t2.shape === "path" ? "evenodd" : "nonzero";
        this._drawToContext(o2, s2, r2, a2), o2.restore();
        break;
      }
      case "fillSketch":
        this.fillSketch(o2, s2, i2);
        break;
    }
  }
  fillSketch(t2, n2, i2) {
    let o2 = i2.fillWeight;
    o2 < 0 && (o2 = i2.strokeWidth / 2), t2.save(), i2.fillLineDash && t2.setLineDash(i2.fillLineDash), i2.fillLineDashOffset && (t2.lineDashOffset = i2.fillLineDashOffset), t2.strokeStyle = i2.fill || "", t2.lineWidth = o2, this._drawToContext(t2, n2, i2.fixedDecimalPlaceDigits), t2.restore();
  }
  _drawToContext(t2, n2, i2, o2 = "nonzero") {
    t2.beginPath();
    for (let r2 of n2.ops) {
      let s2 = typeof i2 == "number" && i2 >= 0 ? r2.data.map((a2) => +a2.toFixed(i2)) : r2.data;
      switch (r2.op) {
        case "move":
          t2.moveTo(s2[0], s2[1]);
          break;
        case "bcurveTo":
          t2.bezierCurveTo(s2[0], s2[1], s2[2], s2[3], s2[4], s2[5]);
          break;
        case "lineTo":
          t2.lineTo(s2[0], s2[1]);
          break;
      }
    }
    n2.type === "fillPath" ? t2.fill(o2) : t2.stroke();
  }
  get generator() {
    return this.gen;
  }
  getDefaultOptions() {
    return this.gen.defaultOptions;
  }
  line(t2, n2, i2, o2, r2) {
    let s2 = this.gen.line(t2, n2, i2, o2, r2);
    return this.draw(s2), s2;
  }
  rectangle(t2, n2, i2, o2, r2) {
    let s2 = this.gen.rectangle(t2, n2, i2, o2, r2);
    return this.draw(s2), s2;
  }
  ellipse(t2, n2, i2, o2, r2) {
    let s2 = this.gen.ellipse(t2, n2, i2, o2, r2);
    return this.draw(s2), s2;
  }
  circle(t2, n2, i2, o2) {
    let r2 = this.gen.circle(t2, n2, i2, o2);
    return this.draw(r2), r2;
  }
  linearPath(t2, n2) {
    let i2 = this.gen.linearPath(t2, n2);
    return this.draw(i2), i2;
  }
  polygon(t2, n2) {
    let i2 = this.gen.polygon(t2, n2);
    return this.draw(i2), i2;
  }
  arc(t2, n2, i2, o2, r2, s2, a2 = false, l2) {
    let c3 = this.gen.arc(t2, n2, i2, o2, r2, s2, a2, l2);
    return this.draw(c3), c3;
  }
  curve(t2, n2) {
    let i2 = this.gen.curve(t2, n2);
    return this.draw(i2), i2;
  }
  path(t2, n2) {
    let i2 = this.gen.path(t2, n2);
    return this.draw(i2), i2;
  }
};
P();
P();
var jn2 = "http://www.w3.org/2000/svg";
var vi = class {
  constructor(t2, n2) {
    this.svg = t2, this.gen = new Ue2(n2);
  }
  draw(t2) {
    let n2 = t2.sets || [], i2 = t2.options || this.getDefaultOptions(), o2 = this.svg.ownerDocument || window.document, r2 = o2.createElementNS(jn2, "g"), s2 = t2.options.fixedDecimalPlaceDigits;
    for (let a2 of n2) {
      let l2 = null;
      switch (a2.type) {
        case "path": {
          l2 = o2.createElementNS(jn2, "path"), l2.setAttribute("d", this.opsToPath(a2, s2)), l2.setAttribute("stroke", i2.stroke), l2.setAttribute("stroke-width", i2.strokeWidth + ""), l2.setAttribute("fill", "none"), i2.strokeLineDash && l2.setAttribute("stroke-dasharray", i2.strokeLineDash.join(" ").trim()), i2.strokeLineDashOffset && l2.setAttribute("stroke-dashoffset", `${i2.strokeLineDashOffset}`);
          break;
        }
        case "fillPath": {
          l2 = o2.createElementNS(jn2, "path"), l2.setAttribute("d", this.opsToPath(a2, s2)), l2.setAttribute("stroke", "none"), l2.setAttribute("stroke-width", "0"), l2.setAttribute("fill", i2.fill || ""), (t2.shape === "curve" || t2.shape === "polygon") && l2.setAttribute("fill-rule", "evenodd");
          break;
        }
        case "fillSketch": {
          l2 = this.fillSketch(o2, a2, i2);
          break;
        }
      }
      l2 && r2.appendChild(l2);
    }
    return r2;
  }
  fillSketch(t2, n2, i2) {
    let o2 = i2.fillWeight;
    o2 < 0 && (o2 = i2.strokeWidth / 2);
    let r2 = t2.createElementNS(jn2, "path");
    return r2.setAttribute("d", this.opsToPath(n2, i2.fixedDecimalPlaceDigits)), r2.setAttribute("stroke", i2.fill || ""), r2.setAttribute("stroke-width", o2 + ""), r2.setAttribute("fill", "none"), i2.fillLineDash && r2.setAttribute("stroke-dasharray", i2.fillLineDash.join(" ").trim()), i2.fillLineDashOffset && r2.setAttribute("stroke-dashoffset", `${i2.fillLineDashOffset}`), r2;
  }
  get generator() {
    return this.gen;
  }
  getDefaultOptions() {
    return this.gen.defaultOptions;
  }
  opsToPath(t2, n2) {
    return this.gen.opsToPath(t2, n2);
  }
  line(t2, n2, i2, o2, r2) {
    let s2 = this.gen.line(t2, n2, i2, o2, r2);
    return this.draw(s2);
  }
  rectangle(t2, n2, i2, o2, r2) {
    let s2 = this.gen.rectangle(t2, n2, i2, o2, r2);
    return this.draw(s2);
  }
  ellipse(t2, n2, i2, o2, r2) {
    let s2 = this.gen.ellipse(t2, n2, i2, o2, r2);
    return this.draw(s2);
  }
  circle(t2, n2, i2, o2) {
    let r2 = this.gen.circle(t2, n2, i2, o2);
    return this.draw(r2);
  }
  linearPath(t2, n2) {
    let i2 = this.gen.linearPath(t2, n2);
    return this.draw(i2);
  }
  polygon(t2, n2) {
    let i2 = this.gen.polygon(t2, n2);
    return this.draw(i2);
  }
  arc(t2, n2, i2, o2, r2, s2, a2 = false, l2) {
    let c3 = this.gen.arc(t2, n2, i2, o2, r2, s2, a2, l2);
    return this.draw(c3);
  }
  curve(t2, n2) {
    let i2 = this.gen.curve(t2, n2);
    return this.draw(i2);
  }
  path(t2, n2) {
    let i2 = this.gen.path(t2, n2);
    return this.draw(i2);
  }
};
var sn2 = { canvas(e5, t2) {
  return new Ai(e5, t2);
}, svg(e5, t2) {
  return new vi(e5, t2);
}, generator(e5) {
  return new Ue2(e5);
}, newSeed() {
  return Ue2.newSeed();
} };
P();
var gt2 = (e5) => {
  if (!e5) return [];
  for (let t2 of e5.sets) if (t2.type === "path") return t2.ops;
  return e5.sets[0].ops;
};
P();
P();
P();
function _s(e5, t2, n2, i2 = (o2) => o2) {
  return e5 * i2(0.5 - t2 * (0.5 - n2));
}
function Ud(e5) {
  return [-e5[0], -e5[1]];
}
function Ke2(e5, t2) {
  return [e5[0] + t2[0], e5[1] + t2[1]];
}
function We(e5, t2) {
  return [e5[0] - t2[0], e5[1] - t2[1]];
}
function qe(e5, t2) {
  return [e5[0] * t2, e5[1] * t2];
}
function Wd(e5, t2) {
  return [e5[0] / t2, e5[1] / t2];
}
function Vn(e5) {
  return [e5[1], -e5[0]];
}
function Ys(e5, t2) {
  return e5[0] * t2[0] + e5[1] * t2[1];
}
function jd(e5, t2) {
  return e5[0] === t2[0] && e5[1] === t2[1];
}
function Vd(e5) {
  return Math.hypot(e5[0], e5[1]);
}
function $d(e5) {
  return e5[0] * e5[0] + e5[1] * e5[1];
}
function Xs(e5, t2) {
  return $d(We(e5, t2));
}
function js(e5) {
  return Wd(e5, Vd(e5));
}
function Zd(e5, t2) {
  return Math.hypot(e5[1] - t2[1], e5[0] - t2[0]);
}
function $n2(e5, t2, n2) {
  let i2 = Math.sin(n2), o2 = Math.cos(n2), r2 = e5[0] - t2[0], s2 = e5[1] - t2[1], a2 = r2 * o2 - s2 * i2, l2 = r2 * i2 + s2 * o2;
  return [a2 + t2[0], l2 + t2[1]];
}
function Uo(e5, t2, n2) {
  return Ke2(e5, qe(We(t2, e5), n2));
}
function Us(e5, t2, n2) {
  return Ke2(e5, qe(t2, n2));
}
var { min: wn, PI: qd } = Math;
var Ws = 0.275;
var Zn2 = qd + 1e-4;
function Kd(e5, t2 = {}) {
  let { size: n2 = 16, smoothing: i2 = 0.5, thinning: o2 = 0.5, simulatePressure: r2 = true, easing: s2 = (S3) => S3, start: a2 = {}, end: l2 = {}, last: c3 = false } = t2, { cap: d2 = true, easing: u3 = (S3) => S3 * (2 - S3) } = a2, { cap: p3 = true, easing: m2 = (S3) => --S3 * S3 * S3 + 1 } = l2;
  if (e5.length === 0 || n2 <= 0) return [];
  let f3 = e5[e5.length - 1].runningLength, E4 = a2.taper === false ? 0 : a2.taper === true ? Math.max(n2, f3) : a2.taper, h3 = l2.taper === false ? 0 : l2.taper === true ? Math.max(n2, f3) : l2.taper, g2 = Math.pow(n2 * i2, 2), x3 = [], y4 = [], b2 = e5.slice(0, 10).reduce((S3, K2) => {
    let j4 = K2.pressure;
    if (r2) {
      let te2 = wn(1, K2.distance / n2), en2 = wn(1, 1 - te2);
      j4 = wn(1, S3 + (en2 - S3) * (te2 * Ws));
    }
    return (S3 + j4) / 2;
  }, e5[0].pressure), w4 = _s(n2, o2, e5[e5.length - 1].pressure, s2), I4, M4 = e5[0].vector, v3 = e5[0].point, T4 = v3, F4 = v3, C4 = T4, R2 = false;
  for (let S3 = 0; S3 < e5.length; S3++) {
    let { pressure: K2 } = e5[S3], { point: j4, vector: te2, distance: en2, runningLength: ot2 } = e5[S3];
    if (S3 < e5.length - 1 && f3 - ot2 < 3) continue;
    if (o2) {
      if (r2) {
        let ge2 = wn(1, en2 / n2), nn3 = wn(1, 1 - ge2);
        K2 = wn(1, b2 + (nn3 - b2) * (ge2 * Ws));
      }
      w4 = _s(n2, o2, K2, s2);
    } else w4 = n2 / 2;
    I4 === void 0 && (I4 = w4);
    let gn = ot2 < E4 ? u3(ot2 / E4) : 1, Go2 = f3 - ot2 < h3 ? m2((f3 - ot2) / h3) : 1;
    w4 = Math.max(0.01, w4 * Math.min(gn, Go2));
    let pi = (S3 < e5.length - 1 ? e5[S3 + 1] : e5[S3]).vector, zn2 = S3 < e5.length - 1 ? Ys(te2, pi) : 1, Oo2 = Ys(te2, M4) < 0 && !R2, mi = zn2 !== null && zn2 < 0;
    if (Oo2 || mi) {
      let ge2 = qe(Vn(M4), w4);
      for (let nn3 = 1 / 13, ve = 0; ve <= 1; ve += nn3) F4 = $n2(We(j4, ge2), j4, Zn2 * ve), x3.push(F4), C4 = $n2(Ke2(j4, ge2), j4, Zn2 * -ve), y4.push(C4);
      v3 = F4, T4 = C4, mi && (R2 = true);
      continue;
    }
    if (R2 = false, S3 === e5.length - 1) {
      let ge2 = qe(Vn(te2), w4);
      x3.push(We(j4, ge2)), y4.push(Ke2(j4, ge2));
      continue;
    }
    let tn2 = qe(Vn(Uo(pi, te2, zn2)), w4);
    F4 = We(j4, tn2), (S3 <= 1 || Xs(v3, F4) > g2) && (x3.push(F4), v3 = F4), C4 = Ke2(j4, tn2), (S3 <= 1 || Xs(T4, C4) > g2) && (y4.push(C4), T4 = C4), b2 = K2, M4 = te2;
  }
  let L4 = e5[0].point.slice(0, 2), W = e5.length > 1 ? e5[e5.length - 1].point.slice(0, 2) : Ke2(e5[0].point, [1, 1]), N3 = [], ee3 = [];
  if (e5.length === 1) {
    if (!(E4 || h3) || c3) {
      let S3 = Us(L4, js(Vn(We(L4, W))), -(I4 || w4)), K2 = [];
      for (let j4 = 1 / 13, te2 = j4; te2 <= 1; te2 += j4) K2.push($n2(S3, L4, Zn2 * 2 * te2));
      return K2;
    }
  } else {
    if (!(E4 || h3 && e5.length === 1)) if (d2) for (let K2 = 1 / 13, j4 = K2; j4 <= 1; j4 += K2) {
      let te2 = $n2(y4[0], L4, Zn2 * j4);
      N3.push(te2);
    }
    else {
      let K2 = We(x3[0], y4[0]), j4 = qe(K2, 0.5), te2 = qe(K2, 0.51);
      N3.push(We(L4, j4), We(L4, te2), Ke2(L4, te2), Ke2(L4, j4));
    }
    let S3 = Vn(Ud(e5[e5.length - 1].vector));
    if (h3 || E4 && e5.length === 1) ee3.push(W);
    else if (p3) {
      let K2 = Us(W, S3, w4);
      for (let j4 = 1 / 29, te2 = j4; te2 < 1; te2 += j4) ee3.push($n2(K2, W, Zn2 * 3 * te2));
    } else ee3.push(Ke2(W, qe(S3, w4)), Ke2(W, qe(S3, w4 * 0.99)), We(W, qe(S3, w4 * 0.99)), We(W, qe(S3, w4)));
  }
  return x3.concat(ee3, y4.reverse(), N3);
}
function Qd(e5, t2 = {}) {
  var n2;
  let { streamline: i2 = 0.5, size: o2 = 16, last: r2 = false } = t2;
  if (e5.length === 0) return [];
  let s2 = 0.15 + (1 - i2) * 0.85, a2 = Array.isArray(e5[0]) ? e5 : e5.map(({ x: m2, y: f3, pressure: E4 = 0.5 }) => [m2, f3, E4]);
  if (a2.length === 2) {
    let m2 = a2[1];
    a2 = a2.slice(0, -1);
    for (let f3 = 1; f3 < 5; f3++) a2.push(Uo(a2[0], m2, f3 / 4));
  }
  a2.length === 1 && (a2 = [...a2, [...Ke2(a2[0], [1, 1]), ...a2[0].slice(2)]]);
  let l2 = [{ point: [a2[0][0], a2[0][1]], pressure: a2[0][2] >= 0 ? a2[0][2] : 0.25, vector: [1, 1], distance: 0, runningLength: 0 }], c3 = false, d2 = 0, u3 = l2[0], p3 = a2.length - 1;
  for (let m2 = 1; m2 < a2.length; m2++) {
    let f3 = r2 && m2 === p3 ? a2[m2].slice(0, 2) : Uo(u3.point, a2[m2], s2);
    if (jd(u3.point, f3)) continue;
    let E4 = Zd(f3, u3.point);
    if (d2 += E4, m2 < p3 && !c3) {
      if (d2 < o2) continue;
      c3 = true;
    }
    u3 = { point: f3, pressure: a2[m2][2] >= 0 ? a2[m2][2] : 0.5, vector: js(We(u3.point, f3)), distance: E4, runningLength: d2 }, l2.push(u3);
  }
  return l2[0].vector = ((n2 = l2[1]) == null ? void 0 : n2.vector) || [0, 0], l2;
}
function Vs(e5, t2 = {}) {
  return Kd(Qd(e5, t2), t2);
}
P();
P();
P();
P();
P();
var qn2 = /* @__PURE__ */ new WeakMap();
var Zo = (e5, t2) => {
  let n2 = qn2.get(e5);
  if (!n2) return;
  let { version: i2, shapes: o2 } = n2;
  if (i2 !== e5.version) {
    qn2.delete(e5);
    return;
  }
  return o2.get(t2);
};
var qo = (e5, t2, n2) => {
  let i2 = qn2.get(e5);
  if (!i2) {
    qn2.set(e5, { version: e5.version, shapes: /* @__PURE__ */ new Map([[n2, t2]]) });
    return;
  }
  let { version: o2, shapes: r2 } = i2;
  if (o2 !== e5.version) {
    qn2.set(e5, { version: e5.version, shapes: /* @__PURE__ */ new Map([[n2, t2]]) });
    return;
  }
  r2.set(n2, t2);
};
function Ci(e5) {
  let t2 = Zo(e5, 0);
  if (t2) return t2;
  let n2 = ta(e5), i2 = [], o2 = [];
  for (let s2 = 0; s2 < n2.length; s2 += 1) {
    let a2 = n2[s2], l2 = n2[s2 - 1] && Tt(n2[s2 - 1].data.slice(-2));
    switch (a2.op) {
      case "move":
        continue;
      case "lineTo":
        if (!l2) throw new Error("prevPoint is undefined");
        i2.push(v(p(e5.x + l2[0], e5.y + l2[1]), p(e5.x + a2.data[0], e5.y + a2.data[1])));
        continue;
      case "bcurveTo":
        if (!l2) throw new Error("prevPoint is undefined");
        o2.push(tt(p(e5.x + l2[0], e5.y + l2[1]), p(e5.x + a2.data[0], e5.y + a2.data[1]), p(e5.x + a2.data[2], e5.y + a2.data[3]), p(e5.x + a2.data[4], e5.y + a2.data[5])));
        continue;
      default:
        console.error("Unknown op type", a2.op);
    }
  }
  let r2 = [i2, o2];
  return qo(e5, r2, 0), r2;
}
function yn(e5, t2 = 0) {
  let n2 = Zo(e5, t2);
  if (n2) return n2;
  let i2 = yt3(Math.min(e5.width, e5.height), e5);
  i2 === 0 && (i2 = 0.01);
  let o2 = bt(p(e5.x, e5.y), p(e5.x + e5.width, e5.y + e5.height)), r2 = v(p(o2[0][0] + i2, o2[0][1]), p(o2[1][0] - i2, o2[0][1])), s2 = v(p(o2[1][0], o2[0][1] + i2), p(o2[1][0], o2[1][1] - i2)), a2 = v(p(o2[0][0] + i2, o2[1][1]), p(o2[1][0] - i2, o2[1][1])), l2 = v(p(o2[0][0], o2[1][1] - i2), p(o2[0][0], o2[0][1] + i2)), c3 = [tt(l2[1], p(l2[1][0] + 2 / 3 * (o2[0][0] - l2[1][0]), l2[1][1] + 2 / 3 * (o2[0][1] - l2[1][1])), p(r2[0][0] + 2 / 3 * (o2[0][0] - r2[0][0]), r2[0][1] + 2 / 3 * (o2[0][1] - r2[0][1])), r2[0]), tt(r2[1], p(r2[1][0] + 2 / 3 * (o2[1][0] - r2[1][0]), r2[1][1] + 2 / 3 * (o2[0][1] - r2[1][1])), p(s2[0][0] + 2 / 3 * (o2[1][0] - s2[0][0]), s2[0][1] + 2 / 3 * (o2[0][1] - s2[0][1])), s2[0]), tt(s2[1], p(s2[1][0] + 2 / 3 * (o2[1][0] - s2[1][0]), s2[1][1] + 2 / 3 * (o2[1][1] - s2[1][1])), p(a2[1][0] + 2 / 3 * (o2[1][0] - a2[1][0]), a2[1][1] + 2 / 3 * (o2[1][1] - a2[1][1])), a2[1]), tt(a2[0], p(a2[0][0] + 2 / 3 * (o2[0][0] - a2[0][0]), a2[0][1] + 2 / 3 * (o2[1][1] - a2[0][1])), p(l2[0][0] + 2 / 3 * (o2[0][0] - l2[0][0]), l2[0][1] + 2 / 3 * (o2[1][1] - l2[0][1])), l2[0])], d2 = t2 > 0 ? c3.map((m2) => nn(on(m2, t2))) : [[c3[0]], [c3[1]], [c3[2]], [c3[3]]], p3 = [[v(d2[0][d2[0].length - 1][3], d2[1][0][0]), v(d2[1][d2[1].length - 1][3], d2[2][0][0]), v(d2[2][d2[2].length - 1][3], d2[3][0][0]), v(d2[3][d2[3].length - 1][3], d2[0][0][0])], d2.flat()];
  return qo(e5, p3, t2), p3;
}
function bn(e5, t2 = 0) {
  let n2 = Zo(e5, t2);
  if (n2) return n2;
  let [i2, o2, r2, s2, a2, l2, c3, d2] = Bi(e5), u3 = e5.roundness ? yt3(Math.abs(i2 - c3), e5) : (i2 - c3) * 0.01, p3 = e5.roundness ? yt3(Math.abs(s2 - o2), e5) : (s2 - o2) * 0.01, [m2, f3, E4, h3] = [p(e5.x + i2, e5.y + o2), p(e5.x + r2, e5.y + s2), p(e5.x + a2, e5.y + l2), p(e5.x + c3, e5.y + d2)], g2 = [tt(p(f3[0] - u3, f3[1] - p3), f3, f3, p(f3[0] - u3, f3[1] + p3)), tt(p(E4[0] + u3, E4[1] - p3), E4, E4, p(E4[0] - u3, E4[1] - p3)), tt(p(h3[0] + u3, h3[1] + p3), h3, h3, p(h3[0] + u3, h3[1] - p3)), tt(p(m2[0] - u3, m2[1] + p3), m2, m2, p(m2[0] + u3, m2[1] + p3))], x3 = t2 > 0 ? g2.map((w4) => nn(on(w4, t2))) : [[g2[0]], [g2[1]], [g2[2]], [g2[3]]], b2 = [[v(x3[0][x3[0].length - 1][3], x3[1][0][0]), v(x3[1][x3[1].length - 1][3], x3[2][0][0]), v(x3[2][x3[2].length - 1][3], x3[3][0][0]), v(x3[3][x3[3].length - 1][3], x3[0][0][0])], x3.flat()];
  return qo(e5, b2, t2), b2;
}
var an2 = (e5, t2 = 1) => {
  if (e5.length >= 3) {
    let [n2, i2] = [e5[0], e5[e5.length - 1]];
    return _(n2, i2) <= Gt / t2;
  }
  return false;
};
var yt3 = (e5, t2) => {
  if (t2.roundness?.type === tr.PROPORTIONAL_RADIUS || t2.roundness?.type === tr.LEGACY) return e5 * Jn;
  if (t2.roundness?.type === tr.ADAPTIVE_RADIUS) {
    let n2 = t2.roundness?.value ?? er, i2 = n2 / Jn;
    return e5 <= i2 ? e5 * Jn : n2;
  }
  return 0;
};
P();
var xe2 = (e5) => !!e5 && e5.type === "image";
var ia = (e5) => !!e5 && e5.type === "embeddable";
var Gi = (e5) => !!e5 && e5.type === "iframe";
var Oi = (e5) => !!e5 && (e5.type === "iframe" || e5.type === "embeddable");
var ne2 = (e5) => e5 != null && e5.type === "text";
var V2 = (e5) => e5 != null && (e5.type === "frame" || e5.type === "magicframe");
var Se2 = (e5) => e5 != null && lu(e5.type);
var lu = (e5) => e5 === "freedraw";
var U2 = (e5) => e5 != null && Ko2(e5.type);
var ln = (e5) => e5 != null && e5.type === "line";
var _2 = (e5) => e5 != null && e5.type === "arrow";
var G = (e5) => _2(e5) && e5.elbowed;
var Ko2 = (e5) => e5 === "arrow" || e5 === "line";
var Qo = (e5, t2 = true) => e5 != null && (!e5.locked || t2 === true) && uu(e5.type);
var uu = (e5) => e5 === "arrow";
var Le2 = (e5, t2 = true) => e5 != null && (!e5.locked || t2 === true) && (e5.type === "rectangle" || e5.type === "diamond" || e5.type === "ellipse" || e5.type === "image" || e5.type === "iframe" || e5.type === "embeddable" || e5.type === "frame" || e5.type === "magicframe" || e5.type === "text" && !e5.containerId);
var ra = (e5) => e5 != null && (e5.type === "rectangle" || e5.type === "diamond" || e5.type === "image" || e5.type === "iframe" || e5.type === "embeddable" || e5.type === "frame" || e5.type === "magicframe" || e5.type === "text" && !e5.containerId);
var pu = (e5, t2 = true) => e5 != null && (!e5.locked || t2 === true) && (e5.type === "rectangle" || e5.type === "diamond" || e5.type === "ellipse" || _2(e5));
var st2 = (e5) => pu(e5) && !!e5.boundElements?.some(({ type: t2 }) => t2 === "text");
var fe2 = (e5) => e5 !== null && "containerId" in e5 && e5.containerId !== null && ne2(e5);
var Qn2 = (e5) => Object.hasOwn(e5, "fixedPoint") && e5.fixedPoint != null;
var la = (e5) => e5.length > 3 || e5.length === 3 && !A(e5[0], e5[e5.length - 1]);
P();
P();
var Jn2 = {};
var ca = (e5, t2) => {
  let n2 = Jn2[e5] || (Jn2[e5] = { height: t2 });
  return n2.height = t2, n2;
};
var da = (e5) => {
  Jn2[e5] && delete Jn2[e5];
};
P();
var Qe2 = (e5, t2, n2) => {
  let i2 = e5.split(`
`).map((a2) => a2 || " ").join(`
`), o2 = parseFloat(t2), r2 = xu(i2, o2, n2);
  return { width: fa(i2, t2), height: r2 };
};
var ua = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toLocaleUpperCase();
var tr2 = (e5) => us(e5).replace(/\t/g, "        ");
var nr = (e5) => tr2(e5).split(`
`);
var zi = (e5, t2) => e5 * t2;
var Ri;
var Rx = (e5) => {
  Ri = e5;
};
var er2 = class {
  canvas;
  constructor() {
    this.canvas = document.createElement("canvas");
  }
  getLineWidth(t2, n2) {
    let i2 = this.canvas.getContext("2d");
    i2.font = n2;
    let r2 = i2.measureText(t2).width;
    return D() ? r2 * 10 : r2;
  }
};
var Ht = (e5, t2) => (Ri || (Ri = new er2()), Ri.getLineWidth(e5, t2));
var fa = (e5, t2) => {
  let n2 = nr(e5), i2 = 0;
  return n2.forEach((o2) => {
    i2 = Math.max(i2, Ht(o2, t2));
  }), i2;
};
var xu = (e5, t2, n2) => {
  let i2 = nr(e5).length;
  return zi(t2, n2) * i2;
};
var Pn = /* @__PURE__ */ (() => {
  let e5 = {};
  return { calculate: (o2, r2) => {
    let s2 = o2.charCodeAt(0);
    if (e5[r2] || (e5[r2] = []), !e5[r2][s2]) {
      let a2 = Ht(o2, r2);
      e5[r2][s2] = a2;
    }
    return e5[r2][s2];
  }, getCache: (o2) => e5[o2], clearCache: (o2) => {
    e5[o2] = [];
  } };
})();
P();
var Hi;
var or;
var Pu = () => {
  if (!Hi) try {
    Hi = Su();
  } catch {
    Hi = Iu();
  }
  return Hi;
};
var rr2 = () => (or || (or = Mu()), or);
var je2 = { WHITESPACE: /\s/u, HYPHEN: /-/u, OPENING: /<\(\[\{/u, CLOSING: />\)\]\}.,:;!\?…\//u };
var bt2 = { CHAR: /\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}｀＇＾〃〰〆＃＆＊＋－ー／＼＝｜￤〒￢￣/u, OPENING: /（［｛〈《｟｢「『【〖〔〘〚＜〝/u, CLOSING: /）］｝〉》｠｣」』】〗〕〙〛＞。．，、〟‥？！：；・〜〞/u, CURRENCY: /￥￦￡￠＄/u };
var cn = { FLAG: /\p{RI}\p{RI}/u, JOINER: /(?:\p{Emoji_Modifier}|\uFE0F\u20E3?|[\u{E0020}-\u{E007E}]+\u{E007F})?/u, ZWJ: /\u200D/u, ANY: /[\p{Emoji}]/u, MOST: /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u };
var Iu = () => Q2.or(rr2(), de.On(je2.HYPHEN, je2.WHITESPACE, bt2.CHAR));
var Su = () => Q2.or(rr2(), de.Before(je2.WHITESPACE).Build(), de.After(je2.WHITESPACE, je2.HYPHEN).Build(), de.Before(bt2.CHAR, bt2.CURRENCY).NotPrecededBy(je2.OPENING, bt2.OPENING).Build(), de.After(bt2.CHAR).NotFollowedBy(je2.HYPHEN, je2.CLOSING, bt2.CLOSING).Build(), de.BeforeMany(bt2.OPENING).NotPrecededBy(je2.OPENING).Build(), de.AfterMany(bt2.CLOSING).NotFollowedBy(je2.CLOSING).Build(), de.AfterMany(je2.CLOSING).FollowedBy(je2.OPENING).Build());
var Mu = () => Q2.group(Q2.or(cn.FLAG, Q2.and(cn.MOST, cn.JOINER, Q2.build(`(?:${cn.ZWJ.source}(?:${cn.FLAG.source}|${cn.ANY.source}${cn.JOINER.source}))*`))));
var Q2 = { build: (e5) => new RegExp(e5, "u"), join: (...e5) => e5.map((t2) => t2.source).join(""), and: (...e5) => Q2.build(Q2.join(...e5)), or: (...e5) => Q2.build(e5.map((t2) => t2.source).join("|")), group: (...e5) => Q2.build(`(${Q2.join(...e5)})`), class: (...e5) => Q2.build(`[${Q2.join(...e5)}]`) };
var de = { On: (...e5) => {
  let t2 = Q2.join(...e5);
  return Q2.build(`([${t2}])`);
}, Before: (...e5) => {
  let t2 = Q2.join(...e5), n2 = () => Q2.build(`(?=[${t2}])`);
  return de.Chain(n2);
}, After: (...e5) => {
  let t2 = Q2.join(...e5), n2 = () => Q2.build(`(?<=[${t2}])`);
  return de.Chain(n2);
}, BeforeMany: (...e5) => {
  let t2 = Q2.join(...e5), n2 = () => Q2.build(`(?<![${t2}])(?=[${t2}])`);
  return de.Chain(n2);
}, AfterMany: (...e5) => {
  let t2 = Q2.join(...e5), n2 = () => Q2.build(`(?<=[${t2}])(?![${t2}])`);
  return de.Chain(n2);
}, NotBefore: (...e5) => {
  let t2 = Q2.join(...e5), n2 = () => Q2.build(`(?![${t2}])`);
  return de.Chain(n2);
}, NotAfter: (...e5) => {
  let t2 = Q2.join(...e5), n2 = () => Q2.build(`(?<![${t2}])`);
  return de.Chain(n2);
}, Chain: (e5) => ({ Build: e5, PreceededBy: (...t2) => {
  let n2 = e5(), i2 = de.After(...t2).Build(), o2 = () => Q2.and(i2, n2);
  return de.Chain(o2);
}, FollowedBy: (...t2) => {
  let n2 = e5(), i2 = de.Before(...t2).Build(), o2 = () => Q2.and(n2, i2);
  return de.Chain(o2);
}, NotPrecededBy: (...t2) => {
  let n2 = e5(), i2 = de.NotAfter(...t2).Build(), o2 = () => Q2.and(i2, n2);
  return de.Chain(o2);
}, NotFollowedBy: (...t2) => {
  let n2 = e5(), i2 = de.NotBefore(...t2).Build(), o2 = () => Q2.and(n2, i2);
  return de.Chain(o2);
} }) };
var Tu = (e5) => {
  let t2 = Pu();
  return e5.normalize("NFC").split(t2).filter(Boolean);
};
var Pt3 = (e5, t2, n2) => {
  if (!Number.isFinite(n2) || n2 < 0) return e5;
  let i2 = [], o2 = e5.split(`
`);
  for (let r2 of o2) {
    if (Ht(r2, t2) <= n2) {
      i2.push(r2);
      continue;
    }
    let a2 = Au(r2, t2, n2);
    i2.push(...a2);
  }
  return i2.join(`
`);
};
var Au = (e5, t2, n2) => {
  let i2 = [], r2 = Tu(e5)[Symbol.iterator](), s2 = "", a2 = 0, l2 = r2.next();
  for (; !l2.done; ) {
    let c3 = l2.value, d2 = s2 + c3, u3 = Lu(c3) ? a2 + Pn.calculate(c3, t2) : Ht(d2, t2);
    if (/\s/.test(c3) || u3 <= n2) {
      s2 = d2, a2 = u3, l2 = r2.next();
      continue;
    }
    if (s2) i2.push(s2.trimEnd()), s2 = "", a2 = 0;
    else {
      let p3 = vu(c3, t2, n2), m2 = p3[p3.length - 1] ?? "", f3 = p3.slice(0, -1);
      i2.push(...f3), s2 = m2, a2 = Ht(m2, t2), l2 = r2.next();
    }
  }
  if (s2) {
    let c3 = Du(s2, t2, n2);
    i2.push(c3);
  }
  return i2;
};
var vu = (e5, t2, n2) => {
  if (rr2().test(e5)) return [e5];
  Cu(e5);
  let i2 = [], o2 = Array.from(e5), r2 = "", s2 = 0;
  for (let a2 of o2) {
    let l2 = Pn.calculate(a2, t2), c3 = s2 + l2;
    if (c3 <= n2) {
      r2 = r2 + a2, s2 = c3;
      continue;
    }
    r2 && i2.push(r2), r2 = a2, s2 = l2;
  }
  return r2 && i2.push(r2), i2;
};
var Du = (e5, t2, n2) => {
  if (!(Ht(e5, t2) > n2)) return e5;
  let [, o2, r2] = e5.match(/^(.+?)(\s+)$/) ?? [e5, e5.trimEnd(), ""], s2 = Ht(o2, t2);
  for (let a2 of Array.from(r2)) {
    let l2 = Pn.calculate(a2, t2), c3 = s2 + l2;
    if (c3 > n2) break;
    o2 = o2 + a2, s2 = c3;
  }
  return o2;
};
var Lu = (e5) => e5.codePointAt(0) !== void 0 && e5.codePointAt(1) === void 0;
var Cu = (e5) => {
  if ((D() || Xo()) && /\s/.test(e5)) throw new Error("Word should not contain any whitespaces!");
};
var ga = (e5, t2, n2) => {
  let i2 = n2.getNonDeletedElementsMap(), o2;
  $o() || rs(!t2 || !_2(t2) || e5.angle === 0, "text element angle must be 0 if bound to arrow container");
  let r2 = { x: e5.x, y: e5.y, text: e5.text, width: e5.width, height: e5.height, angle: t2 ? _2(t2) ? 0 : t2.angle : e5.angle };
  r2.text = e5.text, (t2 || !e5.autoResize) && (o2 = t2 ? Je(t2, e5) : e5.width, r2.text = Pt3(e5.originalText, co(e5), o2));
  let s2 = Qe2(r2.text, co(e5), e5.lineHeight);
  if (e5.autoResize && (r2.width = s2.width), r2.height = s2.height, t2) {
    let a2 = ei(t2, e5), l2 = Je(t2, e5);
    if (!_2(t2) && s2.height > a2) {
      let p3 = sr(s2.height, t2.type);
      n2.mutateElement(t2, { height: p3 }), ca(t2.id, p3);
    }
    if (s2.width > l2) {
      let p3 = sr(s2.width, t2.type);
      n2.mutateElement(t2, { width: p3 });
    }
    let c3 = { ...e5, ...r2 }, { x: d2, y: u3 } = xa(t2, c3, i2);
    r2.x = d2, r2.y = u3;
  }
  n2.mutateElement(e5, r2);
};
var dn = (e5, t2, n2, i2 = false) => {
  let o2 = t2.getNonDeletedElementsMap();
  if (!It3(e5)) return;
  da(e5.id);
  let s2 = Z2(e5, o2);
  if (s2 && s2.text) {
    if (!e5) return;
    let a2 = s2.text, l2 = s2.height, c3 = s2.width, d2 = Je(e5, s2), u3 = ei(e5, s2), p3 = e5.height;
    if (i2 || n2 !== "n" && n2 !== "s") {
      a2 && (a2 = Pt3(s2.originalText, co(s2), d2));
      let m2 = Qe2(a2, co(s2), s2.lineHeight);
      l2 = m2.height, c3 = m2.width;
    }
    if (l2 > u3) {
      p3 = sr(l2, e5.type);
      let m2 = p3 - e5.height, f3 = !_2(e5) && (n2 === "ne" || n2 === "nw" || n2 === "n") ? e5.y - m2 : e5.y;
      t2.mutateElement(e5, { height: p3, y: f3 });
    }
    t2.mutateElement(s2, { text: a2, width: c3, height: l2 }), _2(e5) || t2.mutateElement(s2, xa(e5, s2, o2));
  }
};
var xa = (e5, t2, n2) => {
  if (_2(e5)) return Y3.getBoundTextElementPosition(e5, t2, n2);
  let i2 = ar(e5), o2 = ei(e5, t2), r2 = Je(e5, t2), s2, a2;
  return t2.verticalAlign === Zn.TOP ? a2 = i2.y : t2.verticalAlign === Zn.BOTTOM ? a2 = i2.y + (o2 - t2.height) : a2 = i2.y + (o2 / 2 - t2.height / 2), t2.textAlign === qn.LEFT ? s2 = i2.x : t2.textAlign === qn.RIGHT ? s2 = i2.x + (r2 - t2.width) : s2 = i2.x + (r2 / 2 - t2.width / 2), { x: s2, y: a2 };
};
var It3 = (e5) => e5?.boundElements?.length && e5?.boundElements?.find((t2) => t2.type === "text")?.id || null;
var Z2 = (e5, t2) => {
  if (!e5) return null;
  let n2 = It3(e5);
  return n2 && t2.get(n2) || null;
};
var Ce = (e5, t2) => e5 && e5.containerId && t2.get(e5.containerId) || null;
var ar = (e5) => {
  let t2 = $n, n2 = $n;
  return e5.type === "ellipse" && (t2 += e5.width / 2 * (1 - Math.sqrt(2) / 2), n2 += e5.height / 2 * (1 - Math.sqrt(2) / 2)), e5.type === "diamond" && (t2 += e5.width / 4, n2 += e5.height / 4), { x: e5.x + t2, y: e5.y + n2 };
};
var sr = (e5, t2) => {
  e5 = Math.ceil(e5);
  let n2 = $n * 2;
  return t2 === "ellipse" ? Math.round((e5 + n2) / Math.sqrt(2) * 2) : t2 === "arrow" ? e5 + n2 * 8 : t2 === "diamond" ? 2 * (e5 + n2) : e5 + n2;
};
var Je = (e5, t2) => {
  let { width: n2 } = e5;
  if (_2(e5)) {
    let i2 = (t2?.fontSize ?? nn2) * jn;
    return Math.max(zn * n2, i2);
  }
  return e5.type === "ellipse" ? Math.round(n2 / 2 * Math.sqrt(2)) - $n * 2 : e5.type === "diamond" ? Math.round(n2 / 2) - $n * 2 : n2 - $n * 2;
};
var ei = (e5, t2) => {
  let { height: n2 } = e5;
  return _2(e5) ? n2 - $n * 8 * 2 <= 0 ? t2.height : n2 : e5.type === "ellipse" ? Math.round(n2 / 2 * Math.sqrt(2)) - $n * 2 : e5.type === "diamond" ? Math.round(n2 / 2) - $n * 2 : n2 - $n * 2;
};
P();
var _t = (e5, t2, n2) => {
  switch (e5.type) {
    case "selection":
    case "rectangle":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      return Hu(e5, t2, n2);
    case "diamond":
      return _u(e5, t2, n2);
    case "ellipse":
      return Yu(e5, t2, n2);
    case "line":
    case "arrow":
    case "freedraw":
      return Xu(e5, n2);
  }
};
var Hu = (e5, t2, n2) => {
  let i2 = me2(e5, t2), o2 = w(n2, i2, -e5.angle), [r2, s2] = yn(e5);
  return Math.min(...r2.map((a2) => pt(o2, a2)), ...s2.map((a2) => Ut(a2, o2)).filter((a2) => a2 !== null));
};
var _u = (e5, t2, n2) => {
  let i2 = me2(e5, t2), o2 = w(n2, i2, -e5.angle), [r2, s2] = bn(e5);
  return Math.min(...r2.map((a2) => pt(o2, a2)), ...s2.map((a2) => Ut(a2, o2)).filter((a2) => a2 !== null));
};
var Yu = (e5, t2, n2) => {
  let i2 = me2(e5, t2);
  return mt(w(n2, i2, -e5.angle), un(i2, e5.width / 2, e5.height / 2));
};
var Xu = (e5, t2) => {
  let [n2, i2] = Ci(e5);
  return Math.min(...n2.map((o2) => pt(t2, o2)), ...i2.map((o2) => Ut(o2, t2)));
};
var Ui = (e5) => {
  if (e5.type === "arrow") return false;
  let t2 = !je(e5.backgroundColor) || st2(e5) || Oi(e5) || ne2(e5);
  return e5.type === "line" ? t2 && an2(e5.points) : e5.type === "freedraw" ? t2 && an2(e5.points) : t2 || xe2(e5);
};
var Qu = ({ point: e5, element: t2, threshold: n2, elementsMap: i2, frameNameBound: o2 = null }) => {
  let r2 = o2 ? jt(p(o2.x - n2, o2.y - n2), e5, p(o2.x + o2.width + n2, o2.y + o2.height + n2)) : false, s2 = he2(t2, i2, true);
  return !jt(p(s2[0] - n2, s2[1] - n2), w(e5, ct2(s2), -t2.angle), p(s2[2] + n2, s2[3] + n2)) && !r2 ? false : Ui(t2) && Sa(e5, t2, i2) || wa(e5, t2, i2, n2) || r2;
};
var Ju = (e5, t2, n2, i2 = 0) => {
  let [o2, r2, s2, a2] = he2(t2, n2);
  return o2 -= i2, r2 -= i2, s2 += i2, a2 += i2, jt(p(o2, r2), e5, p(s2, a2));
};
var In2 = (e5, t2, n2, i2 = 0, o2 = false) => {
  let r2 = [Math.min(n2[0][0] - i2, n2[1][0] - i2), Math.min(n2[0][1] - i2, n2[1][1] - i2), Math.max(n2[0][0] + i2, n2[1][0] + i2), Math.max(n2[0][1] + i2, n2[1][1] + i2)], s2 = he2(e5, t2);
  if (!un2(r2, s2)) return [];
  switch (e5.type) {
    case "rectangle":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "selection":
    case "magicframe":
      return np(e5, t2, n2, i2, o2);
    case "diamond":
      return ip(e5, t2, n2, i2, o2);
    case "ellipse":
      return op(e5, t2, n2, i2);
    case "line":
    case "freedraw":
    case "arrow":
      return tp(e5, n2, o2);
  }
};
var Pa = (e5, t2, n2, i2, o2, r2 = false) => {
  for (let s2 of e5) {
    let a2 = Wi(s2[0], s2[1], s2[2], s2[3]), l2 = [Math.min(t2[0][0], t2[1][0]), Math.min(t2[0][1], t2[1][1]), Math.max(t2[0][0], t2[1][0]), Math.max(t2[0][1], t2[1][1])];
    if (!un2(a2, l2)) continue;
    let c3 = Kt(s2, t2);
    if (c3.length > 0) {
      for (let d2 of c3) n2.push(w(d2, i2, o2));
      if (r2) return n2;
    }
  }
  return n2;
};
var Ia = (e5, t2, n2, i2, o2, r2 = false) => {
  for (let s2 of e5) {
    let a2 = et(s2, t2);
    if (a2 && (n2.push(w(a2, i2, o2)), r2)) return n2;
  }
  return n2;
};
var tp = (e5, t2, n2 = false) => {
  let [i2, o2] = Ci(e5), r2 = [];
  for (let s2 of i2) {
    let a2 = et(s2, t2);
    if (a2 && (r2.push(a2), n2)) return r2;
  }
  for (let s2 of o2) {
    let a2 = Wi(s2[0], s2[1], s2[2], s2[3]), l2 = [Math.min(t2[0][0], t2[1][0]), Math.min(t2[0][1], t2[1][1]), Math.max(t2[0][0], t2[1][0]), Math.max(t2[0][1], t2[1][1])];
    if (!un2(a2, l2)) continue;
    let c3 = Kt(s2, t2);
    if (c3.length > 0 && (r2.push(...c3), n2)) return r2;
  }
  return r2;
};
var np = (e5, t2, n2, i2 = 0, o2 = false) => {
  let r2 = me2(e5, t2), s2 = w(n2[0], r2, -e5.angle), a2 = w(n2[1], r2, -e5.angle), l2 = v(s2, a2), [c3, d2] = yn(e5, i2), u3 = [];
  return Ia(c3, l2, u3, r2, e5.angle, o2), o2 && u3.length > 0 || Pa(d2, l2, u3, r2, e5.angle, o2), u3;
};
var ip = (e5, t2, n2, i2 = 0, o2 = false) => {
  let r2 = me2(e5, t2), s2 = w(n2[0], r2, -e5.angle), a2 = w(n2[1], r2, -e5.angle), l2 = v(s2, a2), [c3, d2] = bn(e5, i2), u3 = [];
  return Ia(c3, l2, u3, r2, e5.angle, o2), o2 && u3.length > 0 || Pa(d2, l2, u3, r2, e5.angle, o2), u3;
};
var op = (e5, t2, n2, i2 = 0) => {
  let o2 = me2(e5, t2), r2 = w(n2[0], o2, -e5.angle), s2 = w(n2[1], o2, -e5.angle);
  return xn(un(o2, e5.width / 2 + i2, e5.height / 2 + i2), v(r2, s2)).map((a2) => w(a2, o2, e5.angle));
};
var wa = (e5, t2, n2, i2 = 1) => _t(t2, n2, e5) <= i2;
var Sa = (e5, t2, n2) => {
  if ((U2(t2) || Se2(t2)) && !an2(t2.points)) return false;
  let [i2, o2, r2, s2] = he2(t2, n2);
  if (!jt(p(i2, o2), e5, p(r2, s2))) return false;
  let a2 = p((i2 + r2) / 2, (o2 + s2) / 2), l2 = I(M(T(h(e5, a2, 0.1)), Math.max(t2.width, t2.height) * 2), a2), c3 = v(e5, l2);
  return In2(t2, n2, c3).filter((u3, p3, m2) => m2.findIndex((f3) => A(f3, u3)) === p3).length % 2 === 1;
};
P();
var pe2 = [1, 0];
var we2 = [0, 1];
var Oe2 = [-1, 0];
var He = [0, -1];
var Mt2 = (e5) => {
  let [t2, n2] = e5, i2 = Math.abs(t2), o2 = Math.abs(n2);
  return t2 > o2 ? pe2 : t2 <= -o2 ? Oe2 : n2 > i2 ? we2 : He;
};
var Ge = (e5, t2) => Mt2(h(e5, t2));
var et3 = (e5, t2) => ke2(Ge(e5, t2));
var ue2 = (e5, t2) => e5[0] === t2[0] && e5[1] === t2[1];
var ke2 = (e5) => ue2(e5, pe2) || ue2(e5, Oe2);
var lp = (e5, t2, n2) => {
  let i2 = ct2(t2);
  (Xo() || D()) && (rs(e5.width > 0 && e5.height > 0, "Diamond element has no width or height"), rs(!A(i2, n2), "The point is too close to the element mid point to determine heading"));
  let o2 = 0.95, r2 = I(M(h(w(p(e5.x + e5.width / 2, e5.y), i2, e5.angle), i2), o2), i2), s2 = I(M(h(w(p(e5.x + e5.width, e5.y + e5.height / 2), i2, e5.angle), i2), o2), i2), a2 = I(M(h(w(p(e5.x + e5.width / 2, e5.y + e5.height), i2, e5.angle), i2), o2), i2), l2 = I(M(h(w(p(e5.x, e5.y + e5.height / 2), i2, e5.angle), i2), o2), i2);
  if (N(h(n2, r2), h(r2, s2)) <= 0 && N(h(n2, r2), h(r2, l2)) > 0) return Ge(r2, i2);
  if (N(h(n2, s2), h(s2, a2)) <= 0 && N(h(n2, s2), h(s2, r2)) > 0) return Ge(s2, i2);
  if (N(h(n2, a2), h(a2, l2)) <= 0 && N(h(n2, a2), h(a2, s2)) > 0) return Ge(a2, i2);
  if (N(h(n2, l2), h(l2, r2)) <= 0 && N(h(n2, l2), h(l2, a2)) > 0) return Ge(l2, i2);
  if (N(h(n2, i2), h(r2, i2)) <= 0 && N(h(n2, i2), h(s2, i2)) > 0) {
    let d2 = e5.width > e5.height ? r2 : s2;
    return Ge(d2, i2);
  } else if (N(h(n2, i2), h(s2, i2)) <= 0 && N(h(n2, i2), h(a2, i2)) > 0) {
    let d2 = e5.width > e5.height ? a2 : s2;
    return Ge(d2, i2);
  } else if (N(h(n2, i2), h(a2, i2)) <= 0 && N(h(n2, i2), h(l2, i2)) > 0) {
    let d2 = e5.width > e5.height ? a2 : l2;
    return Ge(d2, i2);
  }
  let c3 = e5.width > e5.height ? r2 : l2;
  return Ge(c3, i2);
};
var ti = (e5, t2, n2) => {
  let o2 = ct2(t2);
  if (e5.type === "diamond") return lp(e5, t2, n2);
  let r2 = Yt(p(t2[0], t2[1]), o2, 2), s2 = Yt(p(t2[2], t2[1]), o2, 2), a2 = Yt(p(t2[0], t2[3]), o2, 2), l2 = Yt(p(t2[2], t2[3]), o2, 2);
  return no([r2, s2, o2], n2) ? He : no([s2, l2, o2], n2) ? pe2 : no([l2, a2, o2], n2) ? we2 : Oe2;
};
var pr = (e5) => [e5[0] === 0 ? 0 : e5[0] > 0 ? -1 : 1, e5[1] === 0 ? 0 : e5[1] > 0 ? -1 : 1];
P();
P();
var gr2 = 1;
var J2 = 40;
var Ep = (e5, t2) => {
  let n2 = e5.fixedSegments ? e5.fixedSegments.slice() : null;
  if (n2) {
    let i2 = [];
    e5.points.map((s2) => p(e5.x + s2[0], e5.y + s2[1])).forEach((s2, a2, l2) => {
      if (a2 < 2) return i2.push(s2);
      let c3 = Ge(s2, l2[a2 - 1]), d2 = Ge(l2[a2 - 1], l2[a2 - 2]);
      if (ue2(c3, d2)) {
        let u3 = n2?.findIndex((m2) => m2.index === a2 - 1) ?? -1, p3 = n2?.findIndex((m2) => m2.index === a2) ?? -1;
        p3 !== -1 && (n2[p3].start = p(l2[a2 - 2][0] - e5.x, l2[a2 - 2][1] - e5.y)), u3 !== -1 && n2.splice(u3, 1), i2.splice(-1, 1), n2.forEach((m2) => {
          m2.index > a2 - 1 && (m2.index -= 1);
        });
      }
      return i2.push(s2);
    });
    let o2 = [];
    i2.forEach((s2, a2, l2) => {
      if (a2 < 3) return o2.push(s2);
      if (_(l2[a2 - 2], l2[a2 - 1]) < gr2) {
        let c3 = n2?.findIndex((p3) => p3.index === a2 - 2) ?? -1, d2 = n2?.findIndex((p3) => p3.index === a2 - 1) ?? -1;
        d2 !== -1 && n2.splice(d2, 1), c3 !== -1 && n2.splice(c3, 1), o2.splice(-2, 2), n2.forEach((p3) => {
          p3.index > a2 - 2 && (p3.index -= 2);
        });
        let u3 = et3(s2, l2[a2 - 1]);
        return o2.push(p(u3 ? s2[0] : l2[a2 - 2][0], u3 ? l2[a2 - 2][1] : s2[1]));
      }
      o2.push(s2);
    });
    let r2 = n2.filter((s2) => s2.index !== 1 && s2.index !== o2.length - 1);
    return r2.length === 0 ? Tt2(yr2(br(wr(e5, xr(e5, t2, o2.map((s2) => p(s2[0] - e5.x, s2[1] - e5.y)))) ?? [])), r2, null, null) : (Xo() && rs(Ga(o2), "Invalid elbow points with fixed segments"), Tt2(o2, r2, e5.startIsSpecial, e5.endIsSpecial));
  }
  return { x: e5.x, y: e5.y, points: e5.points, fixedSegments: e5.fixedSegments, startIsSpecial: e5.startIsSpecial, endIsSpecial: e5.endIsSpecial };
};
var gp = (e5, t2, n2) => {
  let i2 = t2.map((T4) => T4.index), r2 = (e5.fixedSegments?.map((T4) => T4.index) ?? []).findIndex((T4) => !i2.includes(T4));
  if (r2 === -1 || !e5.fixedSegments?.[r2]) return { points: e5.points };
  let s2 = e5.fixedSegments[r2].index, a2 = e5.fixedSegments[r2 - 1], l2 = e5.fixedSegments[r2 + 1], c3 = e5.x + (a2 ? a2.end[0] : 0), d2 = e5.y + (a2 ? a2.end[1] : 0), u3 = a2 ? null : e5.startBinding, p3 = l2 ? null : e5.endBinding, { startHeading: m2, endHeading: f3, startGlobalPoint: E4, endGlobalPoint: h3, hoveredStartElement: g2, hoveredEndElement: x3, ...y4 } = xr({ x: c3, y: d2, startBinding: u3, endBinding: p3, startArrowhead: null, endArrowhead: null, points: e5.points }, n2, [p(0, 0), p(e5.x + (l2?.start[0] ?? e5.points[e5.points.length - 1][0]) - c3, e5.y + (l2?.start[1] ?? e5.points[e5.points.length - 1][1]) - d2)], { isDragging: false }), { points: b2 } = Tt2(yr2(br(wr(e5, { startHeading: m2, endHeading: f3, startGlobalPoint: E4, endGlobalPoint: h3, hoveredStartElement: g2, hoveredEndElement: x3, ...y4 }) ?? [])), t2, null, null), w4 = [];
  if (a2) for (let T4 = 0; T4 < a2.index; T4++) w4.push(p(e5.x + e5.points[T4][0], e5.y + e5.points[T4][1]));
  if (b2.forEach((T4) => {
    w4.push(p(e5.x + (a2 ? a2.end[0] : 0) + T4[0], e5.y + (a2 ? a2.end[1] : 0) + T4[1]));
  }), l2) for (let T4 = l2.index; T4 < e5.points.length; T4++) w4.push(p(e5.x + e5.points[T4][0], e5.y + e5.points[T4][1]));
  let I4 = (l2?.index ?? e5.points.length) - (a2?.index ?? 0) - 1, M4 = t2.map((T4) => T4.index > s2 ? { ...T4, index: T4.index - I4 + (b2.length - 1) } : T4), v3 = w4.flatMap((T4, F4) => {
    let C4 = w4[F4 - 1], R2 = w4[F4 + 1];
    if (C4 && R2) {
      let L4 = Ge(T4, C4), W = Ge(R2, T4);
      if (ue2(L4, W)) return M4.forEach((N3) => {
        N3.index > F4 && (N3.index -= 1);
      }), [];
      if (ue2(L4, pr(W))) return M4.forEach((N3) => {
        N3.index > F4 && (N3.index += 1);
      }), [T4, T4];
    }
    return [T4];
  });
  return Tt2(v3, M4, false, false);
};
var xp = (e5, t2, n2, i2, o2, r2) => {
  let s2 = t2.map((w4, I4) => e5.fixedSegments == null || e5.fixedSegments[I4] === void 0 || e5.fixedSegments[I4].index !== w4.index || (w4.start[0] !== e5.fixedSegments[I4].start[0] && w4.end[0] !== e5.fixedSegments[I4].end[0]) != (w4.start[1] !== e5.fixedSegments[I4].start[1] && w4.end[1] !== e5.fixedSegments[I4].end[1]) ? I4 : null).filter((w4) => w4 !== null).shift();
  if (s2 == null) return { points: e5.points };
  let a2 = e5.fixedSegments?.findIndex((w4) => w4.index === 1) ?? -1, l2 = e5.fixedSegments?.findIndex((w4) => w4.index === e5.points.length - 1) ?? -1, c3 = _(t2[s2].start, t2[s2].end), d2 = c3 < J2 + 5;
  if (a2 === -1 && t2[s2].index === 1 && o2) {
    let w4 = ke2(n2), M4 = (w4 ? ue2(n2, pe2) : ue2(n2, we2)) ? d2 ? c3 / 2 : J2 : d2 ? -c3 / 2 : -J2;
    t2[s2].start = p(t2[s2].start[0] + (w4 ? M4 : 0), t2[s2].start[1] + (w4 ? 0 : M4));
  }
  if (l2 === -1 && t2[s2].index === e5.points.length - 1 && r2) {
    let w4 = ke2(i2), M4 = (w4 ? ue2(i2, pe2) : ue2(i2, we2)) ? d2 ? c3 / 2 : J2 : d2 ? -c3 / 2 : -J2;
    t2[s2].end = p(t2[s2].end[0] + (w4 ? M4 : 0), t2[s2].end[1] + (w4 ? 0 : M4));
  }
  let u3 = t2.map((w4) => ({ ...w4, start: p(e5.x + w4.start[0], e5.y + w4.start[1]), end: p(e5.x + w4.end[0], e5.y + w4.end[1]) })), p3 = e5.points.map((w4, I4) => p(e5.x + w4[0], e5.y + w4[1])), m2 = u3[s2].index - 1, f3 = u3[s2].index, E4 = u3[s2].start, h3 = u3[s2].end, g2 = p3[m2 - 1] && !A(p3[m2], p3[m2 - 1]) ? et3(p3[m2 - 1], p3[m2]) : void 0, x3 = p3[f3 + 1] && !A(p3[f3], p3[f3 + 1]) ? et3(p3[f3 + 1], p3[f3]) : void 0;
  if (g2 !== void 0) {
    let w4 = g2 ? 1 : 0;
    p3[m2 - 1][w4] = E4[w4];
  }
  if (p3[m2] = E4, p3[f3] = h3, x3 !== void 0) {
    let w4 = x3 ? 1 : 0;
    p3[f3 + 1][w4] = h3[w4];
  }
  let y4 = u3.findIndex((w4) => w4.index === m2);
  if (y4 !== -1) {
    let w4 = et3(u3[y4].end, u3[y4].start) ? 1 : 0;
    u3[y4].start[w4] = E4[w4], u3[y4].end = E4;
  }
  let b2 = u3.findIndex((w4) => w4.index === f3 + 1);
  if (b2 !== -1) {
    let w4 = et3(u3[b2].end, u3[b2].start) ? 1 : 0;
    u3[b2].end[w4] = h3[w4], u3[b2].start = h3;
  }
  if (a2 === -1 && m2 === 0) {
    let w4 = o2 ? ke2(n2) : et3(p3[1], p3[0]);
    p3.unshift(p(w4 ? E4[0] : e5.x + e5.points[0][0], w4 ? e5.y + e5.points[0][1] : E4[1])), o2 && p3.unshift(p(e5.x + e5.points[0][0], e5.y + e5.points[0][1]));
    for (let I4 of u3) I4.index += o2 ? 2 : 1;
  }
  if (l2 === -1 && f3 === e5.points.length - 1) {
    let w4 = ke2(i2);
    p3.push(p(w4 ? h3[0] : e5.x + e5.points[e5.points.length - 1][0], w4 ? e5.y + e5.points[e5.points.length - 1][1] : h3[1])), r2 && p3.push(p(e5.x + e5.points[e5.points.length - 1][0], e5.y + e5.points[e5.points.length - 1][1]));
  }
  return Tt2(p3, u3.map((w4) => ({ ...w4, start: p(w4.start[0] - e5.x, w4.start[1] - e5.y), end: p(w4.end[0] - e5.x, w4.end[1] - e5.y) })), false, false);
};
var wp = (e5, t2, n2, i2, o2, r2, s2, a2, l2) => {
  let c3 = e5.startIsSpecial ?? null, d2 = e5.endIsSpecial ?? null, u3 = t2.map((h3, g2) => g2 === 0 ? p(e5.x + h3[0], e5.y + h3[1]) : g2 === t2.length - 1 ? p(e5.x + h3[0], e5.y + h3[1]) : p(e5.x + e5.points[g2][0], e5.y + e5.points[g2][1])), p3 = n2.map((h3) => ({ ...h3, start: p(e5.x + (h3.start[0] - t2[0][0]), e5.y + (h3.start[1] - t2[0][1])), end: p(e5.x + (h3.end[0] - t2[0][0]), e5.y + (h3.end[1] - t2[0][1])) })), m2 = [], f3 = 2 + (c3 ? 1 : 0), E4 = 2 + (d2 ? 1 : 0);
  for (; m2.length + f3 < u3.length - E4; ) m2.push(u3[m2.length + f3]);
  {
    let h3 = u3[c3 ? 2 : 1], g2 = u3[c3 ? 3 : 2], x3 = ke2(i2), y4 = ke2(Mt2(h(h3, g2)));
    if (a2 && x3 === y4) {
      let b2 = x3 ? ue2(i2, pe2) : ue2(i2, we2);
      if (m2.unshift(p(y4 ? r2[0] + (b2 ? J2 : -J2) : g2[0], y4 ? g2[1] : r2[1] + (b2 ? J2 : -J2))), m2.unshift(p(x3 ? r2[0] + (b2 ? J2 : -J2) : r2[0], x3 ? r2[1] : r2[1] + (b2 ? J2 : -J2))), !c3) {
        c3 = true;
        for (let w4 of p3) w4.index > 1 && (w4.index += 1);
      }
    } else if (m2.unshift(p(y4 ? r2[0] : h3[0], y4 ? h3[1] : r2[1])), c3) {
      c3 = false;
      for (let b2 of p3) b2.index > 1 && (b2.index -= 1);
    }
    m2.unshift(r2);
  }
  {
    let h3 = u3[u3.length - (d2 ? 3 : 2)], g2 = u3[u3.length - (d2 ? 4 : 3)], x3 = ke2(o2), y4 = et3(g2, h3);
    if (l2 && x3 === y4) {
      let b2 = x3 ? ue2(o2, pe2) : ue2(o2, we2);
      m2.push(p(y4 ? s2[0] + (b2 ? J2 : -J2) : g2[0], y4 ? g2[1] : s2[1] + (b2 ? J2 : -J2))), m2.push(p(x3 ? s2[0] + (b2 ? J2 : -J2) : s2[0], x3 ? s2[1] : s2[1] + (b2 ? J2 : -J2))), d2 || (d2 = true);
    } else m2.push(p(y4 ? s2[0] : h3[0], y4 ? h3[1] : s2[1])), d2 && (d2 = false);
  }
  return m2.push(s2), Tt2(m2, p3.map(({ index: h3 }) => ({ index: h3, start: m2[h3 - 1], end: m2[h3] })).map((h3) => ({ ...h3, start: p(h3.start[0] - r2[0], h3.start[1] - r2[1]), end: p(h3.end[0] - r2[0], h3.end[1] - r2[1]) })), c3, d2);
};
var Xt3 = 1e6;
var Tn2 = (e5, t2, n2, i2) => {
  if (e5.points.length < 2) return { points: n2.points ?? e5.points };
  A2.PROD || (rs(!n2.points || n2.points.length >= 2, "Updated point array length must match the arrow point length, contain exactly the new start and end points or not be specified at all (i.e. you can't add new points between start and end manually to elbow arrows)"), rs(!e5.fixedSegments || e5.fixedSegments.map((w4) => w4.start[0] === w4.end[0] || w4.start[1] === w4.end[1]).every(Boolean), "Fixed segments must be either horizontal or vertical"), rs(!n2.fixedSegments || n2.fixedSegments.map((w4) => w4.start[0] === w4.end[0] || w4.start[1] === w4.end[1]).every(Boolean), "Updates to fixed segments must be either horizontal or vertical"), rs(e5.points.slice(1).map((w4, I4) => w4[0] === e5.points[I4][0] || w4[1] === e5.points[I4][1]), "Elbow arrow segments must be either horizontal or vertical"), rs(n2.fixedSegments?.find((w4) => w4.index === 1 && A(w4.start, (n2.points ?? e5.points)[0])) == null && n2.fixedSegments?.find((w4) => w4.index === (n2.points ?? e5.points).length - 1 && A(w4.end, (n2.points ?? e5.points)[(n2.points ?? e5.points).length - 1])) == null, "The first and last segments cannot be fixed"));
  let o2 = n2.fixedSegments ?? e5.fixedSegments ?? [], r2 = n2.points ? n2.points && n2.points.length === 2 ? e5.points.map((w4, I4) => I4 === 0 ? n2.points[0] : I4 === e5.points.length - 1 ? n2.points[1] : w4) : n2.points.slice() : e5.points.slice(), { startBinding: s2, endBinding: a2, ...l2 } = n2, c3 = typeof s2 < "u" ? s2 : e5.startBinding, d2 = typeof a2 < "u" ? a2 : e5.endBinding, u3 = c3 && Ji(c3.elementId, t2), p3 = d2 && Ji(d2.elementId, t2), m2 = Ga(r2);
  if (c3 && !u3 && m2 || d2 && !p3 && m2 || t2.size === 0 && m2 || Object.keys(l2).length === 0 && (u3?.id !== c3?.elementId || p3?.id !== d2?.elementId)) return Tt2(r2.map((w4) => p(e5.x + w4[0], e5.y + w4[1])), e5.fixedSegments, e5.startIsSpecial, e5.endIsSpecial);
  let { startHeading: f3, endHeading: E4, startGlobalPoint: h3, endGlobalPoint: g2, hoveredStartElement: x3, hoveredEndElement: y4, ...b2 } = xr({ x: e5.x, y: e5.y, startBinding: c3, endBinding: d2, startArrowhead: e5.startArrowhead, endArrowhead: e5.endArrowhead, points: e5.points }, t2, r2, i2);
  return t2.size === 0 && m2 ? Tt2(r2.map((w4) => p(e5.x + w4[0], e5.y + w4[1])), e5.fixedSegments, e5.startIsSpecial, e5.endIsSpecial) : !n2.points && !n2.fixedSegments && !n2.startBinding && !n2.endBinding ? Ep(e5, t2) : n2.startBinding === e5.startBinding && n2.endBinding === e5.endBinding && (n2.points ?? []).every((w4, I4) => A(w4, e5.points[I4] ?? p(1 / 0, 1 / 0))) && m2 ? {} : o2.length === 0 ? Tt2(yr2(br(wr(e5, { startHeading: f3, endHeading: E4, startGlobalPoint: h3, endGlobalPoint: g2, hoveredStartElement: x3, hoveredEndElement: y4, ...b2 }) ?? [])), o2, null, null) : (e5.fixedSegments?.length ?? 0) > o2.length ? gp(e5, o2, t2) : n2.points ? n2.points && n2.fixedSegments ? n2 : wp(e5, r2, o2, f3, E4, h3, g2, x3, y4) : xp(e5, o2, f3, E4, x3, y4);
};
var xr = (e5, t2, n2, i2) => {
  let o2 = lt(n2[0], L(e5.x, e5.y)), r2 = lt(n2[n2.length - 1], L(e5.x, e5.y)), s2 = null, a2 = null;
  if (i2?.isDragging) {
    let w4 = Array.from(t2.values());
    s2 = La(o2, t2, w4, i2?.zoom) || null, a2 = La(r2, t2, w4, i2?.zoom) || null;
  } else s2 = e5.startBinding && Ji(e5.startBinding.elementId, t2) || null, a2 = e5.endBinding && Ji(e5.endBinding.elementId, t2) || null;
  let l2 = va({ ...e5, type: "arrow", elbowed: true, points: n2 }, "start", e5.startBinding?.fixedPoint, o2, s2, t2, i2?.isDragging), c3 = va({ ...e5, type: "arrow", elbowed: true, points: n2 }, "end", e5.endBinding?.fixedPoint, r2, a2, t2, i2?.isDragging), d2 = Da(l2, c3, s2, o2, t2), u3 = Da(c3, l2, a2, r2, t2), p3 = [l2[0] - 2, l2[1] - 2, l2[0] + 2, l2[1] + 2], m2 = [c3[0] - 2, c3[1] - 2, c3[0] + 2, c3[1] + 2], f3 = s2 ? Ve2(s2, t2, Ut3(d2, e5.startArrowhead ? oe * 6 : oe * 2, 1)) : p3, E4 = a2 ? Ve2(a2, t2, Ut3(u3, e5.endArrowhead ? oe * 6 : oe * 2, 1)) : m2, h3 = Mn(l2, a2 ? Ve2(a2, t2, Ut3(u3, J2, J2)) : m2) || Mn(c3, s2 ? Ve2(s2, t2, Ut3(d2, J2, J2)) : p3), g2 = Ba(h3 ? [p3, m2] : [f3, E4]), x3 = Pp(h3 ? p3 : f3, h3 ? m2 : E4, g2, h3 ? Ut3(d2, !s2 && !a2 ? 0 : J2, 0) : Ut3(d2, !s2 && !a2 ? 0 : J2 - (e5.startArrowhead ? oe * 6 : oe * 2), J2), h3 ? Ut3(u3, !s2 && !a2 ? 0 : J2, 0) : Ut3(u3, !s2 && !a2 ? 0 : J2 - (e5.endArrowhead ? oe * 6 : oe * 2), J2), h3, s2 && Ve2(s2, t2), a2 && Ve2(a2, t2)), y4 = Aa(x3[0], d2, l2), b2 = Aa(x3[1], u3, c3);
  return { dynamicAABBs: x3, startDonglePosition: y4, startGlobalPoint: l2, startHeading: d2, endDonglePosition: b2, endGlobalPoint: c3, endHeading: u3, commonBounds: g2, hoveredStartElement: s2, hoveredEndElement: a2, boundsOverlap: h3, startElementBounds: f3, endElementBounds: E4 };
};
var wr = (e5, t2) => {
  let { dynamicAABBs: n2, startDonglePosition: i2, startGlobalPoint: o2, startHeading: r2, endDonglePosition: s2, endGlobalPoint: a2, endHeading: l2, commonBounds: c3, hoveredEndElement: d2 } = t2, u3 = Ip(n2, i2 || o2, r2, s2 || a2, l2, c3), p3 = i2 && Qi(i2, u3), m2 = s2 && Qi(s2, u3), f3 = Qi(a2, u3);
  f3 && d2 && (f3.closed = true);
  let E4 = Qi(o2, u3);
  E4 && e5.startBinding && (E4.closed = true);
  let h3 = p3 && m2 && (Mn(p3.pos, n2[1]) || Mn(m2.pos, n2[0])), g2 = yp(p3 || E4, m2 || f3, u3, r2 || pe2, l2 || pe2, h3 ? [] : n2);
  if (g2) {
    let x3 = g2.map((y4) => [y4.pos[0], y4.pos[1]]);
    return p3 && x3.unshift(o2), m2 && x3.push(a2), x3;
  }
  return null;
};
var Ut3 = (e5, t2, n2) => {
  switch (e5) {
    case He:
      return [t2, n2, n2, n2];
    case pe2:
      return [n2, t2, n2, n2];
    case we2:
      return [n2, n2, t2, n2];
  }
  return [n2, n2, n2, t2];
};
var yp = (e5, t2, n2, i2, o2, r2) => {
  let s2 = mr2(e5.pos, t2.pos), a2 = new $2((l2) => l2.f);
  for (a2.push(e5); a2.size() > 0; ) {
    let l2 = a2.pop();
    if (!l2 || l2.closed) continue;
    if (l2 === t2) return bp(e5, l2);
    l2.closed = true;
    let c3 = Mp(l2.addr, n2);
    for (let d2 = 0; d2 < 4; d2++) {
      let u3 = c3[d2];
      if (!u3 || u3.closed) continue;
      let p3 = Yt(u3.pos, l2.pos, 0.5);
      if (ds(...r2.map((b2) => Mn(p3, b2)))) continue;
      let m2 = Tp(d2), f3 = l2.parent ? Mt2(h(l2.pos, l2.parent.pos)) : i2, E4 = pr(f3);
      if (ue2(E4, m2) || Ca(e5.addr, u3.addr) && ue2(m2, i2) || Ca(t2.addr, u3.addr) && ue2(m2, o2)) continue;
      let g2 = f3 !== m2, x3 = l2.g + mr2(u3.pos, l2.pos) + (g2 ? Math.pow(s2, 3) : 0), y4 = u3.visited;
      if (!y4 || x3 < u3.g) {
        let b2 = Sp(u3, t2, m2, o2);
        u3.visited = true, u3.parent = l2, u3.h = mr2(t2.pos, u3.pos) + b2 * Math.pow(s2, 2), u3.g = x3, u3.f = u3.g + u3.h, y4 ? a2.rescoreElement(u3) : a2.push(u3);
      }
    }
  }
  return null;
};
var bp = (e5, t2) => {
  let n2 = t2, i2 = [];
  for (; n2.parent; ) i2.unshift(n2), n2 = n2.parent;
  return i2.unshift(e5), i2;
};
var mr2 = (e5, t2) => Math.abs(e5[0] - t2[0]) + Math.abs(e5[1] - t2[1]);
var Pp = (e5, t2, n2, i2, o2, r2, s2, a2) => {
  let l2 = s2 ?? e5, c3 = a2 ?? t2, [d2, u3, p3, m2] = i2 ?? [0, 0, 0, 0], [f3, E4, h3, g2] = o2 ?? [0, 0, 0, 0], x3 = [e5[0] > t2[2] ? e5[1] > t2[3] || e5[3] < t2[1] ? Math.min((l2[0] + c3[2]) / 2, e5[0] - m2) : (l2[0] + c3[2]) / 2 : e5[0] > t2[0] ? e5[0] - m2 : n2[0] - m2, e5[1] > t2[3] ? e5[0] > t2[2] || e5[2] < t2[0] ? Math.min((l2[1] + c3[3]) / 2, e5[1] - d2) : (l2[1] + c3[3]) / 2 : e5[1] > t2[1] ? e5[1] - d2 : n2[1] - d2, e5[2] < t2[0] ? e5[1] > t2[3] || e5[3] < t2[1] ? Math.max((l2[2] + c3[0]) / 2, e5[2] + u3) : (l2[2] + c3[0]) / 2 : e5[2] < t2[2] ? e5[2] + u3 : n2[2] + u3, e5[3] < t2[1] ? e5[0] > t2[2] || e5[2] < t2[0] ? Math.max((l2[3] + c3[1]) / 2, e5[3] + p3) : (l2[3] + c3[1]) / 2 : e5[3] < t2[3] ? e5[3] + p3 : n2[3] + p3], y4 = [t2[0] > e5[2] ? t2[1] > e5[3] || t2[3] < e5[1] ? Math.min((c3[0] + l2[2]) / 2, t2[0] - g2) : (c3[0] + l2[2]) / 2 : t2[0] > e5[0] ? t2[0] - g2 : n2[0] - g2, t2[1] > e5[3] ? t2[0] > e5[2] || t2[2] < e5[0] ? Math.min((c3[1] + l2[3]) / 2, t2[1] - f3) : (c3[1] + l2[3]) / 2 : t2[1] > e5[1] ? t2[1] - f3 : n2[1] - f3, t2[2] < e5[0] ? t2[1] > e5[3] || t2[3] < e5[1] ? Math.max((c3[2] + l2[0]) / 2, t2[2] + E4) : (c3[2] + l2[0]) / 2 : t2[2] < e5[2] ? t2[2] + E4 : n2[2] + E4, t2[3] < e5[1] ? t2[0] > e5[2] || t2[2] < e5[0] ? Math.max((c3[3] + l2[1]) / 2, t2[3] + h3) : (c3[3] + l2[1]) / 2 : t2[3] < e5[3] ? t2[3] + h3 : n2[3] + h3], b2 = Ba([x3, y4]);
  if (!r2 && x3[2] - x3[0] + y4[2] - y4[0] > b2[2] - b2[0] + 1e-11 && x3[3] - x3[1] + y4[3] - y4[1] > b2[3] - b2[1] + 1e-11) {
    let [w4, I4] = [(y4[0] + y4[2]) / 2, (y4[1] + y4[3]) / 2];
    if (t2[0] > e5[2] && e5[1] > t2[3]) {
      let M4 = x3[2] + (y4[0] - x3[2]) / 2, v3 = y4[3] + (x3[1] - y4[3]) / 2;
      return N(L(e5[2] - w4, e5[1] - I4), L(e5[0] - w4, e5[3] - I4)) > 0 ? [[x3[0], x3[1], M4, x3[3]], [M4, y4[1], y4[2], y4[3]]] : [[x3[0], v3, x3[2], x3[3]], [y4[0], y4[1], y4[2], v3]];
    } else if (e5[2] < t2[0] && e5[3] < t2[1]) {
      let M4 = x3[2] + (y4[0] - x3[2]) / 2, v3 = x3[3] + (y4[1] - x3[3]) / 2;
      return N(L(e5[0] - w4, e5[1] - I4), L(e5[2] - w4, e5[3] - I4)) > 0 ? [[x3[0], x3[1], x3[2], v3], [y4[0], v3, y4[2], y4[3]]] : [[x3[0], x3[1], M4, x3[3]], [M4, y4[1], y4[2], y4[3]]];
    } else if (e5[0] > t2[2] && e5[3] < t2[1]) {
      let M4 = y4[2] + (x3[0] - y4[2]) / 2, v3 = x3[3] + (y4[1] - x3[3]) / 2;
      return N(L(e5[2] - w4, e5[1] - I4), L(e5[0] - w4, e5[3] - I4)) > 0 ? [[M4, x3[1], x3[2], x3[3]], [y4[0], y4[1], M4, y4[3]]] : [[x3[0], x3[1], x3[2], v3], [y4[0], v3, y4[2], y4[3]]];
    } else if (e5[0] > t2[2] && e5[1] > t2[3]) {
      let M4 = y4[2] + (x3[0] - y4[2]) / 2, v3 = y4[3] + (x3[1] - y4[3]) / 2;
      return N(L(e5[0] - w4, e5[1] - I4), L(e5[2] - w4, e5[3] - I4)) > 0 ? [[M4, x3[1], x3[2], x3[3]], [y4[0], y4[1], M4, y4[3]]] : [[x3[0], v3, x3[2], x3[3]], [y4[0], y4[1], y4[2], v3]];
    }
  }
  return [x3, y4];
};
var Ip = (e5, t2, n2, i2, o2, r2) => {
  let s2 = /* @__PURE__ */ new Set(), a2 = /* @__PURE__ */ new Set();
  n2 === Oe2 || n2 === pe2 ? a2.add(t2[1]) : s2.add(t2[0]), o2 === Oe2 || o2 === pe2 ? a2.add(i2[1]) : s2.add(i2[0]), e5.forEach((d2) => {
    s2.add(d2[0]), s2.add(d2[2]), a2.add(d2[1]), a2.add(d2[3]);
  }), s2.add(r2[0]), s2.add(r2[2]), a2.add(r2[1]), a2.add(r2[3]);
  let l2 = Array.from(a2).sort((d2, u3) => d2 - u3), c3 = Array.from(s2).sort((d2, u3) => d2 - u3);
  return { row: l2.length, col: c3.length, data: l2.flatMap((d2, u3) => c3.map((p3, m2) => ({ f: 0, g: 0, h: 0, closed: false, visited: false, parent: null, addr: [m2, u3], pos: [p3, d2] }))) };
};
var Aa = (e5, t2, n2) => {
  switch (t2) {
    case He:
      return p(n2[0], e5[1]);
    case pe2:
      return p(e5[2], n2[1]);
    case we2:
      return p(n2[0], e5[3]);
  }
  return p(e5[0], n2[1]);
};
var Sp = (e5, t2, n2, i2) => {
  if (i2 === pe2) switch (n2) {
    case pe2:
      return e5.pos[0] >= t2.pos[0] ? 4 : e5.pos[1] === t2.pos[1] ? 0 : 2;
    case He:
      return e5.pos[1] > t2.pos[1] && e5.pos[0] < t2.pos[0] ? 1 : 3;
    case we2:
      return e5.pos[1] < t2.pos[1] && e5.pos[0] < t2.pos[0] ? 1 : 3;
    case Oe2:
      return e5.pos[1] === t2.pos[1] ? 4 : 2;
  }
  else if (i2 === Oe2) switch (n2) {
    case pe2:
      return e5.pos[1] === t2.pos[1] ? 4 : 2;
    case He:
      return e5.pos[1] > t2.pos[1] && e5.pos[0] > t2.pos[0] ? 1 : 3;
    case we2:
      return e5.pos[1] < t2.pos[1] && e5.pos[0] > t2.pos[0] ? 1 : 3;
    case Oe2:
      return e5.pos[0] <= t2.pos[0] ? 4 : e5.pos[1] === t2.pos[1] ? 0 : 2;
  }
  else if (i2 === He) switch (n2) {
    case pe2:
      return e5.pos[1] > t2.pos[1] && e5.pos[0] < t2.pos[0] ? 1 : 3;
    case He:
      return e5.pos[1] >= t2.pos[1] ? 4 : e5.pos[0] === t2.pos[0] ? 0 : 2;
    case we2:
      return e5.pos[0] === t2.pos[0] ? 4 : 2;
    case Oe2:
      return e5.pos[1] > t2.pos[1] && e5.pos[0] > t2.pos[0] ? 1 : 3;
  }
  else if (i2 === we2) switch (n2) {
    case pe2:
      return e5.pos[1] < t2.pos[1] && e5.pos[0] < t2.pos[0] ? 1 : 3;
    case He:
      return e5.pos[0] === t2.pos[0] ? 4 : 2;
    case we2:
      return e5.pos[1] <= t2.pos[1] ? 4 : e5.pos[0] === t2.pos[0] ? 0 : 2;
    case Oe2:
      return e5.pos[1] < t2.pos[1] && e5.pos[0] > t2.pos[0] ? 1 : 3;
  }
  return 0;
};
var Mp = ([e5, t2], n2) => [ni([e5, t2 - 1], n2), ni([e5 + 1, t2], n2), ni([e5, t2 + 1], n2), ni([e5 - 1, t2], n2)];
var ni = ([e5, t2], n2) => e5 < 0 || e5 >= n2.col || t2 < 0 || t2 >= n2.row ? null : n2.data[t2 * n2.col + e5] ?? null;
var Qi = (e5, t2) => {
  for (let n2 = 0; n2 < t2.col; n2++) for (let i2 = 0; i2 < t2.row; i2++) {
    let o2 = ni([n2, i2], t2);
    if (o2 && e5[0] === o2.pos[0] && e5[1] === o2.pos[1]) return o2;
  }
  return null;
};
var Ba = (e5) => [Math.min(...e5.map((t2) => t2[0])), Math.min(...e5.map((t2) => t2[1])), Math.max(...e5.map((t2) => t2[2])), Math.max(...e5.map((t2) => t2[3]))];
var Ji = (e5, t2) => {
  let n2 = t2.get(e5);
  return n2 && Le2(n2) ? n2 : null;
};
var Tt2 = (e5, t2, n2, i2) => {
  let o2 = e5[0][0], r2 = e5[0][1], s2 = e5.map((a2) => lt(a2, M(h(e5[0]), -1)));
  return (o2 < -Xt3 || o2 > Xt3 || r2 < -Xt3 || r2 > Xt3 || o2 + s2[s2.length - 1][0] < -Xt3 || r2 + s2[s2.length - 1][0] > Xt3 || o2 + s2[s2.length - 1][1] < -Xt3 || r2 + s2[s2.length - 1][1] > Xt3) && console.error("Elbow arrow normalization is outside reasonable bounds (> 1e6)", { x: o2, y: r2, points: s2, ...kr(s2) }), s2 = s2.map(([a2, l2]) => p(ft(a2, -1e6, 1e6), ft(l2, -1e6, 1e6))), { points: s2, x: ft(o2, -1e6, 1e6), y: ft(r2, -1e6, 1e6), fixedSegments: (t2?.length ?? 0) > 0 ? t2 : null, ...kr(s2), startIsSpecial: n2, endIsSpecial: i2 };
};
var yr2 = (e5) => {
  if (e5.length > 1) {
    let t2 = Math.abs(e5[0][1] - e5[1][1]) < Math.abs(e5[0][0] - e5[1][0]);
    return e5.filter((n2, i2) => {
      if (i2 === 0 || i2 === e5.length - 1) return true;
      let o2 = e5[i2 + 1], r2 = Math.abs(n2[1] - o2[1]) < Math.abs(n2[0] - o2[0]);
      return t2 === r2 ? (t2 = r2, false) : (t2 = r2, true);
    });
  }
  return e5;
};
var br = (e5) => e5.length >= 4 ? e5.filter((t2, n2) => {
  if (n2 === 0 || n2 === e5.length - 1) return true;
  let i2 = e5[n2 - 1];
  return _(i2, t2) > gr2;
}) : e5;
var Tp = (e5) => {
  switch (e5) {
    case 0:
      return He;
    case 1:
      return pe2;
    case 2:
      return we2;
  }
  return Oe2;
};
var va = (e5, t2, n2, i2, o2, r2, s2) => s2 ? o2 && r2 ? Pr2(e5, o2, t2, r2) : i2 : o2 ? eo(n2 || [0, 0], o2, r2 ?? Bo([o2])) : i2;
var Da = (e5, t2, n2, i2, o2) => Oa(e5, t2, n2, n2 && Ve2(n2, o2, Array(4).fill(_t(n2, o2, e5))), i2, o2);
var La = (e5, t2, n2, i2) => Wt(Ro(e5), n2, t2, i2, true, true);
var Ca = (e5, t2) => e5[0] === t2[0] && e5[1] === t2[1];
var Ga = (e5, t2 = gr2) => e5.slice(1).map((n2, i2) => Math.abs(n2[0] - e5[i2][0]) < t2 || Math.abs(n2[1] - e5[i2][1]) < t2).every(Boolean);
var ye2 = (e5, t2, n2, i2) => {
  let o2 = false, { points: r2, fixedSegments: s2, startBinding: a2, endBinding: l2, fileId: c3 } = n2;
  G(e5) && (Object.keys(n2).length === 0 || typeof r2 < "u" || typeof s2 < "u" || typeof a2 < "u" || typeof l2 < "u") ? n2 = { ...n2, angle: 0, ...Tn2({ ...e5, x: n2.x || e5.x, y: n2.y || e5.y }, t2, n2, i2) } : typeof r2 < "u" && (n2 = { ...kr(r2), ...n2 });
  for (let d2 in n2) {
    let u3 = n2[d2];
    if (typeof u3 < "u") {
      if (e5[d2] === u3 && (typeof u3 != "object" || u3 === null || d2 === "groupIds" || d2 === "scale")) continue;
      if (d2 === "scale") {
        let p3 = e5[d2], m2 = u3;
        if (p3[0] === m2[0] && p3[1] === m2[1]) continue;
      } else if (d2 === "points") {
        let p3 = e5[d2], m2 = u3;
        if (p3.length === m2.length) {
          let f3 = false, E4 = p3.length;
          for (; --E4; ) {
            let h3 = p3[E4], g2 = m2[E4];
            if (h3[0] !== g2[0] || h3[1] !== g2[1]) {
              f3 = true;
              break;
            }
          }
          if (!f3) continue;
        }
      }
      e5[d2] = u3, o2 = true;
    }
  }
  return o2 && ((typeof n2.height < "u" || typeof n2.width < "u" || typeof c3 < "u" || typeof r2 < "u") && be2.delete(e5), e5.version = n2.version ?? e5.version + 1, e5.versionNonce = n2.versionNonce ?? hs(), e5.updated = Ko()), e5;
};
var Me2 = (e5, t2, n2 = false) => {
  let i2 = false;
  for (let o2 in t2) {
    let r2 = t2[o2];
    if (typeof r2 < "u") {
      if (e5[o2] === r2 && (typeof r2 != "object" || r2 === null)) continue;
      i2 = true;
    }
  }
  return !i2 && !n2 ? e5 : { ...e5, ...t2, version: t2.version ?? e5.version + 1, versionNonce: t2.versionNonce ?? hs(), updated: Ko() };
};
var Mr = (e5) => e5.isBindingEnabled;
var oe = 5;
var kp = 10;
var Rp = (e5, t2) => {
  let n2 = [];
  return t2.forEach((i2) => {
    let o2 = e5.getNonDeletedElement(i2);
    o2 != null && n2.push(o2);
  }), n2;
};
var Tr2 = (e5, t2, n2, i2) => {
  let o2 = i2.getNonDeletedElementsMap(), r2 = /* @__PURE__ */ new Set(), s2 = /* @__PURE__ */ new Set();
  Na(e5, t2, n2, "start", r2, s2, i2, o2), Na(e5, n2, t2, "end", r2, s2, i2, o2);
  let a2 = Array.from(s2).filter((l2) => !r2.has(l2));
  Rp(i2, a2).forEach((l2) => {
    i2.mutateElement(l2, { boundElements: l2.boundElements?.filter((c3) => c3.type !== "arrow" || c3.id !== e5.id) });
  });
};
var Na = (e5, t2, n2, i2, o2, r2, s2, a2) => {
  if (t2 !== "keep") {
    if (t2 === null) {
      let l2 = _p(e5, i2, s2);
      l2 != null && r2.add(l2);
      return;
    }
    Wa(e5) ? (n2 == null || (n2 === "keep" ? !Xa(e5, t2, i2) : i2 === "start" || n2.id !== t2.id)) && (pn(e5, t2, i2, s2), o2.add(t2.id)) : (pn(e5, t2, i2, s2), o2.add(t2.id));
  }
};
var Ya = (e5, t2, n2, i2, o2) => Array.from(t2.reduce((r2, s2) => {
  let a2 = Wt(s2, n2.getNonDeletedElements(), n2.getNonDeletedElementsMap(), i2, G(e5), G(e5));
  return a2 != null && !Ua(e5, o2?.id, a2) && r2.add(a2), r2;
}, /* @__PURE__ */ new Set()));
var Hp = (e5, t2) => ({ ...e5, gap: Math.min(e5.gap, so(t2, t2.width, t2.height)) });
var pn = (e5, t2, n2, i2) => {
  if (!_2(e5)) return;
  let o2 = { elementId: t2.id, ...Hp(Up(e5, t2, n2, i2.getNonDeletedElementsMap()), t2) };
  G(e5) && (o2 = { ...o2, ...ja(e5, t2, n2, i2.getNonDeletedElementsMap()) }), i2.mutateElement(e5, { [n2 === "start" ? "startBinding" : "endBinding"]: o2 }), Bo(t2.boundElements || []).has(e5.id) || i2.mutateElement(t2, { boundElements: (t2.boundElements || []).concat({ id: e5.id, type: "arrow" }) });
};
var Xa = (e5, t2, n2) => {
  let i2 = e5[n2 === "start" ? "endBinding" : "startBinding"];
  return Ua(e5, i2?.elementId, t2);
};
var Ua = (e5, t2, n2) => t2 === n2.id && Wa(e5);
var Wa = (e5) => e5.points.length < 3 && !G(e5);
var _p = (e5, t2, n2) => {
  let i2 = t2 === "start" ? "startBinding" : "endBinding", o2 = e5[i2];
  return o2 == null ? null : (n2.mutateElement(e5, { [i2]: null }), o2.elementId);
};
var Wt = (e5, t2, n2, i2, o2, r2) => {
  if (r2) {
    let a2 = false, l2 = Xp(t2, (d2) => Le2(d2, false) && no2(d2, e5, n2, i2, (o2 || !Io(d2)) && !V2(d2))).filter((d2) => a2 ? false : (Io(d2) || (a2 = true), true));
    if (!l2 || l2.length === 0) return null;
    if (l2.length === 1) return l2[0];
    let c3 = l2.filter((d2) => no2(d2, e5, n2, i2, false));
    return c3.length === 1 ? c3[0] : l2.sort((d2, u3) => u3.width ** 2 + u3.height ** 2 - (d2.width ** 2 + d2.height ** 2)).pop();
  }
  return Yp(t2, (a2) => Le2(a2, false) && no2(a2, e5, n2, i2, (o2 || !Io(a2)) && !V2(a2)));
};
var Yp = (e5, t2) => {
  let n2 = null;
  for (let i2 = e5.length - 1; i2 >= 0; --i2) {
    let o2 = e5[i2];
    if (!o2.isDeleted && t2(o2)) {
      n2 = o2;
      break;
    }
  }
  return n2;
};
var Xp = (e5, t2) => {
  let n2 = [];
  for (let i2 = e5.length - 1; i2 >= 0; --i2) {
    let o2 = e5[i2];
    o2.isDeleted || t2(o2) && n2.push(o2);
  }
  return n2;
};
var Up = (e5, t2, n2, i2) => {
  let o2 = n2 === "start" ? -1 : 1, r2 = o2 === -1 ? 0 : e5.points.length - 1, s2 = r2 - o2, a2 = Y3.getPointAtIndexGlobalCoordinates(e5, r2, i2), l2 = Y3.getPointAtIndexGlobalCoordinates(e5, s2, i2);
  return { focus: Kp(t2, i2, l2, a2), gap: Math.max(1, _t(t2, i2, a2)) };
};
var Xe2 = (e5, t2, n2) => {
  if (!Le2(e5)) return;
  let { newSize: i2, simultaneouslyUpdated: o2 } = n2 ?? {}, r2 = jp(o2), s2 = t2.getNonDeletedElementsMap();
  n2?.changedElements && (s2 = new Map(s2), n2.changedElements.forEach((a2) => {
    s2.set(a2.id, a2);
  })), oo(s2, e5, (a2) => {
    if (!U2(a2) || a2.isDeleted || !Wp(a2, e5)) return;
    let l2 = a2.startBinding ? s2.get(a2.startBinding.elementId) : null, c3 = a2.endBinding ? s2.get(a2.endBinding.elementId) : null, d2 = null, u3 = null;
    l2 && c3 && (d2 = he2(l2, s2), u3 = he2(c3, s2));
    let p3 = { startBinding: za(e5, a2.startBinding, i2), endBinding: za(e5, a2.endBinding, i2) };
    if (r2.has(a2.id)) {
      t2.mutateElement(a2, p3);
      return;
    }
    let m2 = ro(s2, a2, (E4, h3) => {
      if (E4 && Le2(E4) && (h3 === "startBinding" || h3 === "endBinding") && (e5.id === a2[h3]?.elementId || e5.id === a2[h3 === "startBinding" ? "endBinding" : "startBinding"]?.elementId && !un2(d2, u3))) {
        let g2 = qp(a2, h3, p3[h3], E4, s2);
        if (g2) return [h3 === "startBinding" ? 0 : a2.points.length - 1, { point: g2 }];
      }
      return null;
    }).filter((E4) => E4 !== null);
    Y3.movePoints(a2, t2, new Map(m2), { ...e5.id === a2.startBinding?.elementId ? { startBinding: p3.startBinding } : {}, ...e5.id === a2.endBinding?.elementId ? { endBinding: p3.endBinding } : {} });
    let f3 = Z2(a2, s2);
    f3 && !f3.isDeleted && dn(a2, t2, false);
  });
};
var Wp = (e5, t2) => e5.startBinding?.elementId === t2.id || e5.endBinding?.elementId === t2.id;
var jp = (e5) => new Set((e5 || []).map((t2) => t2.id));
var Oa = (e5, t2, n2, i2, o2, r2, s2) => {
  let a2 = Mt2(h(t2, e5));
  return !n2 || !i2 ? a2 : Vp(o2, n2, r2, s2) ? ti(n2, i2, e5) : Mt2(h(e5, me2(n2, r2)));
};
var Vp = (e5, t2, n2, i2) => {
  let o2 = _t(t2, n2, e5), r2 = so(t2, t2.width, t2.height, i2);
  return o2 > r2 ? null : o2;
};
var Pr2 = (e5, t2, n2, i2) => {
  (Xo() || D()) && rs(e5.points.length > 1, "Arrow should have at least 2 points");
  let o2 = Ve2(t2, i2), r2 = e5.points[n2 === "start" ? 0 : e5.points.length - 1], s2 = p(e5.x + r2[0], e5.y + r2[1]), a2 = ra(t2) ? $p(t2, i2, s2) : s2, l2 = G(e5), c3 = ct2(o2), d2 = n2 === "start" ? 1 : e5.points.length - 2, u3 = w(p(e5.x + e5.points[d2][0], e5.y + e5.points[d2][1]), c3, e5.angle ?? 0), p3 = null;
  if (l2) {
    let m2 = ke2(ti(t2, o2, s2)), f3 = Zp(t2, i2, a2), E4 = p(m2 ? c3[0] : f3[0], m2 ? f3[1] : c3[1]), h3 = v(E4, I(M(T(h(f3, E4)), Math.max(t2.width, t2.height) * 2), E4));
    p3 = In2(t2, i2, h3, oe).sort(Xt)[0];
  } else p3 = In2(t2, i2, v(u3, I(M(T(h(a2, u3)), _(a2, u3) + Math.max(t2.width, t2.height) * 2), u3)), oe).sort((m2, f3) => Xt(m2, u3) - Xt(f3, u3))[0];
  return !p3 || Xt(a2, p3) < y ? a2 : l2 ? p3 : a2;
};
var $p = (e5, t2, n2) => {
  let i2 = me2(e5, t2), o2 = w(n2, i2, -e5.angle);
  return o2[0] < e5.x && o2[1] < e5.y ? o2[1] - e5.y > -oe ? w(p(e5.x - oe, e5.y), i2, e5.angle) : w(p(e5.x, e5.y - oe), i2, e5.angle) : o2[0] < e5.x && o2[1] > e5.y + e5.height ? o2[0] - e5.x > -oe ? w(p(e5.x, e5.y + e5.height + oe), i2, e5.angle) : w(p(e5.x - oe, e5.y + e5.height), i2, e5.angle) : o2[0] > e5.x + e5.width && o2[1] > e5.y + e5.height ? o2[0] - e5.x < e5.width + oe ? w(p(e5.x + e5.width, e5.y + e5.height + oe), i2, e5.angle) : w(p(e5.x + e5.width + oe, e5.y + e5.height), i2, e5.angle) : o2[0] > e5.x + e5.width && o2[1] < e5.y ? o2[0] - e5.x < e5.width + oe ? w(p(e5.x + e5.width, e5.y - oe), i2, e5.angle) : w(p(e5.x + e5.width + oe, e5.y), i2, e5.angle) : n2;
};
var Zp = (e5, t2, n2, i2 = 0.05) => {
  let { x: o2, y: r2, width: s2, height: a2, angle: l2 } = e5, c3 = me2(e5, t2, -0.1, -0.1), d2 = w(n2, c3, -l2), u3 = ft(i2 * a2, 5, 80), p3 = ft(i2 * s2, 5, 80);
  if (d2[0] <= o2 + s2 / 2 && d2[1] > c3[1] - u3 && d2[1] < c3[1] + u3) return w(p(o2 - oe, c3[1]), c3, l2);
  if (d2[1] <= r2 + a2 / 2 && d2[0] > c3[0] - p3 && d2[0] < c3[0] + p3) return w(p(c3[0], r2 - oe), c3, l2);
  if (d2[0] >= o2 + s2 / 2 && d2[1] > c3[1] - u3 && d2[1] < c3[1] + u3) return w(p(o2 + s2 + oe, c3[1]), c3, l2);
  if (d2[1] >= r2 + a2 / 2 && d2[0] > c3[0] - p3 && d2[0] < c3[0] + p3) return w(p(c3[0], r2 + a2 + oe), c3, l2);
  if (e5.type === "diamond") {
    let m2 = oe, f3 = p(o2 + s2 / 4 - m2, r2 + a2 / 4 - m2), E4 = p(o2 + 3 * s2 / 4 + m2, r2 + a2 / 4 - m2), h3 = p(o2 + s2 / 4 - m2, r2 + 3 * a2 / 4 + m2), g2 = p(o2 + 3 * s2 / 4 + m2, r2 + 3 * a2 / 4 + m2);
    if (_(f3, d2) < Math.max(p3, u3)) return w(f3, c3, l2);
    if (_(E4, d2) < Math.max(p3, u3)) return w(E4, c3, l2);
    if (_(h3, d2) < Math.max(p3, u3)) return w(h3, c3, l2);
    if (_(g2, d2) < Math.max(p3, u3)) return w(g2, c3, l2);
  }
  return n2;
};
var qp = (e5, t2, n2, i2, o2) => {
  if (n2 == null || n2.elementId !== i2.id && e5.points.length > 2) return null;
  let r2 = t2 === "startBinding" ? -1 : 1, s2 = r2 === -1 ? 0 : e5.points.length - 1;
  if (G(e5) && Qn2(n2)) {
    let u3 = Ar(n2.fixedPoint) ?? ja(e5, i2, t2 === "startBinding" ? "start" : "end", o2).fixedPoint, p3 = me2(i2, o2), m2 = p(i2.x + u3[0] * i2.width, i2.y + u3[1] * i2.height), f3 = w(m2, p3, i2.angle);
    return Y3.pointFromAbsoluteCoords(e5, f3, o2);
  }
  let a2 = s2 - r2, l2 = Y3.getPointAtIndexGlobalCoordinates(e5, a2, o2), c3 = Qp(i2, o2, n2.focus, l2), d2;
  if (n2.gap === 0) d2 = c3;
  else {
    let u3 = Y3.getPointAtIndexGlobalCoordinates(e5, s2, o2), p3 = me2(i2, o2), m2 = _(l2, u3) + _(l2, p3) + Math.max(i2.width, i2.height) * 2, f3 = [...In2(i2, o2, v(l2, I(M(T(h(c3, l2)), m2), l2)), n2.gap).sort((E4, h3) => Xt(E4, l2) - Xt(h3, l2)), I(M(T(h(c3, l2)), _(l2, u3)), l2)];
    f3.length > 1 ? d2 = f3[0] : f3.length === 1 ? d2 = c3 : d2 = u3;
  }
  return Y3.pointFromAbsoluteCoords(e5, d2, o2);
};
var ja = (e5, t2, n2, i2) => {
  let o2 = [t2.x, t2.y, t2.x + t2.width, t2.y + t2.height], r2 = Pr2(e5, t2, n2, i2), s2 = p(o2[0] + (o2[2] - o2[0]) / 2, o2[1] + (o2[3] - o2[1]) / 2), a2 = w(r2, s2, -t2.angle);
  return { fixedPoint: Ar([(a2[0] - t2.x) / t2.width, (a2[1] - t2.y) / t2.height]) };
};
var za = (e5, t2, n2) => {
  if (t2 == null || n2 == null) return t2;
  let { width: i2, height: o2 } = n2, { width: r2, height: s2 } = e5, a2 = Math.max(1, Math.min(so(e5, i2, o2), t2.gap * (i2 < o2 ? i2 / r2 : o2 / s2)));
  return { ...t2, gap: a2 };
};
var ly = (e5, t2) => {
  let n2 = Bo(e5);
  for (let i2 of t2) Vt2.unbindAffected(n2, i2, (o2, r2) => ye2(o2, n2, r2)), $t.unbindAffected(n2, i2, (o2, r2) => ye2(o2, n2, r2));
};
var oi = (e5, t2, n2 = []) => {
  if (!e5) return null;
  let i2 = e5.filter((o2) => !t2.has(o2.id));
  return i2.push(...n2.map((o2) => ({ id: o2.id, type: o2.type }))), i2;
};
var no2 = (e5, { x: t2, y: n2 }, i2, o2, r2) => {
  let s2 = p(t2, n2), a2 = so(e5, e5.width, e5.height, o2), l2 = (r2 || !Io(e5)) && !V2(e5), c3 = [t2 - a2, n2 - a2, t2 + a2, n2 + a2], d2 = he2(e5, i2);
  if (!un2(c3, d2)) return false;
  let u3 = In2(e5, i2, v(me2(e5, i2), s2)), p3 = _t(e5, i2, s2);
  return l2 ? u3.length === 0 || p3 <= a2 : u3.length > 0 && p3 <= a2;
};
var so = (e5, t2, n2, i2) => {
  let o2 = i2?.value && i2.value < 1 ? i2.value : 1, s2 = (e5.type === "diamond" ? 1 / Math.sqrt(2) : 1) * Math.min(t2, n2);
  return Math.max(16, Math.min(0.25 * s2, 32), kp / o2 + oe);
};
var Kp = (e5, t2, n2, i2) => {
  let o2 = me2(e5, t2);
  if (A(n2, i2)) return 0;
  let r2 = w(n2, o2, -e5.angle), s2 = w(i2, o2, -e5.angle), a2 = Math.sign(N(h(s2, n2), h(s2, o2))) * -1, l2 = v(s2, I(M(T(h(s2, r2)), Math.max(e5.width * 2, e5.height * 2)), s2)), c3 = e5.type === "diamond" ? [v(p(e5.x + e5.width / 2, e5.y), p(e5.x + e5.width / 2, e5.y + e5.height)), v(p(e5.x, e5.y + e5.height / 2), p(e5.x + e5.width, e5.y + e5.height / 2))] : [v(p(e5.x, e5.y), p(e5.x + e5.width, e5.y + e5.height)), v(p(e5.x + e5.width, e5.y), p(e5.x, e5.y + e5.height))], d2 = e5.type === "diamond" ? [v(p(e5.x + e5.width / 2, e5.y - e5.height), p(e5.x + e5.width / 2, e5.y + e5.height * 2)), v(p(e5.x - e5.width, e5.y + e5.height / 2), p(e5.x + e5.width * 2, e5.y + e5.height / 2))] : [v(p(e5.x - e5.width, e5.y - e5.height), p(e5.x + e5.width * 2, e5.y + e5.height * 2)), v(p(e5.x + e5.width * 2, e5.y - e5.height), p(e5.x - e5.width, e5.y + e5.height * 2))];
  return [et(l2, d2[0]), et(l2, d2[1])].filter((m2) => m2 !== null).sort((m2, f3) => Xt(m2, i2) - Xt(f3, i2)).map((m2, f3) => a2 * _(o2, m2) / (e5.type === "diamond" ? _(c3[f3][0], c3[f3][1]) / 2 : Math.sqrt(e5.width ** 2 + e5.height ** 2) / 2)).sort((m2, f3) => Math.abs(m2) - Math.abs(f3))[0] ?? 0;
};
var Qp = (e5, t2, n2, i2) => {
  let o2 = me2(e5, t2);
  if (n2 === 0) return o2;
  let r2 = (e5.type === "diamond" ? [p(e5.x, e5.y + e5.height / 2), p(e5.x + e5.width / 2, e5.y), p(e5.x + e5.width, e5.y + e5.height / 2), p(e5.x + e5.width / 2, e5.y + e5.height)] : [p(e5.x, e5.y), p(e5.x + e5.width, e5.y), p(e5.x + e5.width, e5.y + e5.height), p(e5.x, e5.y + e5.height)]).map((l2) => I(M(h(l2, o2), Math.abs(n2)), o2)).map((l2) => w(l2, o2, e5.angle)), s2 = [N(h(i2, r2[0]), h(r2[1], r2[0])) > 0 && (n2 > 0 ? N(h(i2, r2[1]), h(r2[2], r2[1])) < 0 : N(h(i2, r2[3]), h(r2[0], r2[3])) < 0), N(h(i2, r2[1]), h(r2[2], r2[1])) > 0 && (n2 > 0 ? N(h(i2, r2[2]), h(r2[3], r2[2])) < 0 : N(h(i2, r2[0]), h(r2[1], r2[0])) < 0), N(h(i2, r2[2]), h(r2[3], r2[2])) > 0 && (n2 > 0 ? N(h(i2, r2[3]), h(r2[0], r2[3])) < 0 : N(h(i2, r2[1]), h(r2[2], r2[1])) < 0), N(h(i2, r2[3]), h(r2[0], r2[3])) > 0 && (n2 > 0 ? N(h(i2, r2[0]), h(r2[1], r2[0])) < 0 : N(h(i2, r2[2]), h(r2[3], r2[2])) < 0)];
  return s2[0] ? n2 > 0 ? r2[1] : r2[0] : s2[1] ? n2 > 0 ? r2[2] : r2[1] : s2[2] ? n2 > 0 ? r2[3] : r2[2] : n2 > 0 ? r2[0] : r2[3];
};
var oo = (e5, t2, n2) => {
  Le2(t2) && (t2.boundElements?.slice() ?? []).forEach(({ id: o2 }) => {
    n2(e5.get(o2), "boundElements", o2);
  });
};
var ro = (e5, t2, n2) => {
  let i2 = [];
  if (t2.frameId) {
    let o2 = t2.frameId;
    i2.push(n2(e5.get(o2), "frameId", o2));
  }
  if (fe2(t2)) {
    let o2 = t2.containerId;
    i2.push(n2(e5.get(o2), "containerId", o2));
  }
  if (_2(t2)) {
    if (t2.startBinding) {
      let o2 = t2.startBinding.elementId;
      i2.push(n2(e5.get(o2), "startBinding", o2));
    }
    if (t2.endBinding) {
      let o2 = t2.endBinding.elementId;
      i2.push(n2(e5.get(o2), "endBinding", o2));
    }
  }
  return i2;
};
var Vt2 = class {
  static unbindAffected(t2, n2, i2) {
    n2 && ro(t2, n2, (o2) => {
      !o2 || o2.isDeleted || oo(t2, o2, (r2, s2, a2) => {
        a2 === n2.id && i2(o2, { boundElements: oi(o2.boundElements, /* @__PURE__ */ new Set([a2])) });
      });
    });
  }
  static rebindAffected = (t2, n2, i2) => {
    !n2 || n2.isDeleted || ro(t2, n2, (o2, r2) => {
      if (!o2 || o2.isDeleted) {
        i2(n2, { [r2]: null });
        return;
      }
      r2 !== "frameId" && (o2.boundElements?.find((s2) => s2.id === n2.id) || (_2(n2) && i2(o2, { boundElements: oi(o2.boundElements, /* @__PURE__ */ new Set(), new Array(n2)) }), ne2(n2) && (o2.boundElements?.find((s2) => s2.type === "text") ? i2(n2, { [r2]: null }) : i2(o2, { boundElements: oi(o2.boundElements, /* @__PURE__ */ new Set(), new Array(n2)) }))));
    });
  };
};
var $t = class {
  static unbindAffected(t2, n2, i2) {
    n2 && oo(t2, n2, (o2) => {
      !o2 || o2.isDeleted || ro(t2, o2, (r2, s2, a2) => {
        a2 === n2.id && i2(o2, { [s2]: null });
      });
    });
  }
  static rebindAffected = (t2, n2, i2) => {
    !n2 || n2.isDeleted || oo(t2, n2, (o2, r2, s2) => {
      if (!o2 || o2.isDeleted) {
        i2(n2, { boundElements: oi(n2.boundElements, /* @__PURE__ */ new Set([s2])) });
        return;
      }
      ne2(o2) && ((n2.boundElements?.slice() ?? []).reverse().find((l2) => l2.type === "text")?.id === o2.id ? o2.containerId !== n2.id && i2(o2, { containerId: n2.id }) : (o2.containerId !== null && i2(o2, { containerId: null }), i2(n2, { boundElements: oi(n2.boundElements, /* @__PURE__ */ new Set([o2.id])) })));
    });
  };
};
var eo = (e5, t2, n2) => {
  let [i2, o2] = Ar(e5);
  return w(p(t2.x + t2.width * i2, t2.y + t2.height * o2), me2(t2, n2), t2.angle);
};
var Ar = (e5) => e5 && (Math.abs(e5[0] - 0.5) < 1e-4 || Math.abs(e5[1] - 0.5) < 1e-4) ? e5.map((t2) => Math.abs(t2 - 0.5) < 1e-4 ? 0.5001 : t2) : e5;
var Dr = ({ points: e5 }) => {
  let t2 = e5[0][0], n2 = e5[0][1];
  return { points: e5.map((i2) => p(i2[0] - t2, i2[1] - n2)), offsetX: t2, offsetY: n2 };
};
var Y3 = class e {
  elementId;
  selectedPointsIndices;
  pointerDownState;
  isDragging;
  lastUncommittedPoint;
  pointerOffset;
  startBindingElement;
  endBindingElement;
  hoverPointIndex;
  segmentMidPointHoveredCoords;
  elbowed;
  customLineAngle;
  constructor(t2, n2) {
    this.elementId = t2.id, A(t2.points[0], p(0, 0)) || (console.error("Linear element is not normalized", Error().stack), ye2(t2, n2, e.getNormalizeElementPointsAndCoords(t2))), this.selectedPointsIndices = null, this.lastUncommittedPoint = null, this.isDragging = false, this.pointerOffset = { x: 0, y: 0 }, this.startBindingElement = "keep", this.endBindingElement = "keep", this.pointerDownState = { prevSelectedPointsIndices: null, lastClickedPoint: -1, lastClickedIsEndPoint: false, origin: null, segmentMidpoint: { value: null, index: null, added: false } }, this.hoverPointIndex = -1, this.segmentMidPointHoveredCoords = null, this.elbowed = G(t2) && t2.elbowed, this.customLineAngle = null;
  }
  static POINT_HANDLE_SIZE = 10;
  static getElement(t2, n2) {
    let i2 = n2.get(t2);
    return i2 || null;
  }
  static handleBoxSelection(t2, n2, i2, o2) {
    if (!n2.editingLinearElement || !n2.selectionElement) return false;
    let { editingLinearElement: r2 } = n2, { selectedPointsIndices: s2, elementId: a2 } = r2, l2 = e.getElement(a2, o2);
    if (!l2) return false;
    let [c3, d2, u3, p3] = H(n2.selectionElement, o2), f3 = e.getPointsGlobalCoordinates(l2, o2).reduce((E4, h3, g2) => ((h3[0] >= c3 && h3[0] <= u3 && h3[1] >= d2 && h3[1] <= p3 || t2.shiftKey && s2?.includes(g2)) && E4.push(g2), E4), []).filter((E4) => !(G(l2) && E4 !== 0 && E4 !== l2.points.length - 1));
    i2({ editingLinearElement: { ...r2, selectedPointsIndices: f3.length ? f3 : null } });
  }
  static handlePointDragging(t2, n2, i2, o2, r2) {
    if (!r2) return null;
    let { elementId: s2 } = r2, a2 = n2.scene.getNonDeletedElementsMap(), l2 = e.getElement(s2, a2), c3 = r2.customLineAngle;
    if (!l2 || G(l2) && !r2.pointerDownState.lastClickedIsEndPoint && r2.pointerDownState.lastClickedPoint !== 0) return null;
    let d2 = G(l2) ? [r2.selectedPointsIndices?.includes(0) ? 0 : void 0, r2.selectedPointsIndices?.find((m2) => m2 > 0) ? l2.points.length - 1 : void 0].filter((m2) => m2 !== void 0) : r2.selectedPointsIndices, u3 = G(l2) ? r2.pointerDownState.lastClickedPoint > 0 ? l2.points.length - 1 : 0 : r2.pointerDownState.lastClickedPoint, p3 = l2.points[u3];
    if (d2 && p3) {
      if (Pr(t2) && d2.length === 1 && l2.points.length > 1) {
        let h3 = d2[0], g2 = l2.points[h3 === 0 ? 1 : h3 - 1];
        c3 = r2.customLineAngle ?? Math.atan2(l2.points[h3][1] - g2[1], l2.points[h3][0] - g2[0]);
        let [x3, y4] = e._getShiftLockedDelta(l2, a2, g2, p(i2, o2), t2[y2.CTRL_OR_CMD] ? null : n2.getEffectiveGridSize(), c3);
        e.movePoints(l2, n2.scene, /* @__PURE__ */ new Map([[h3, { point: p(x3 + g2[0], y4 + g2[1]), isDragging: h3 === u3 }]]));
      } else {
        let h3 = e.createPointAt(l2, a2, i2 - r2.pointerOffset.x, o2 - r2.pointerOffset.y, t2[y2.CTRL_OR_CMD] ? null : n2.getEffectiveGridSize()), g2 = h3[0] - p3[0], x3 = h3[1] - p3[1];
        e.movePoints(l2, n2.scene, new Map(d2.map((y4) => {
          let b2 = y4 === u3 ? e.createPointAt(l2, a2, i2 - r2.pointerOffset.x, o2 - r2.pointerOffset.y, t2[y2.CTRL_OR_CMD] ? null : n2.getEffectiveGridSize()) : p(l2.points[y4][0] + g2, l2.points[y4][1] + x3);
          return [y4, { point: b2, isDragging: y4 === u3 }];
        })));
      }
      Z2(l2, a2) && dn(l2, n2.scene, false);
      let f3 = [];
      if (Qo(l2, false)) {
        let h3 = d2[0] === 0, g2 = d2[d2.length - 1] === l2.points.length - 1, x3 = [];
        !h3 != !g2 ? x3.push({ x: i2, y: o2 }) : (h3 && x3.push(Ro(e.getPointGlobalCoordinates(l2, l2.points[0], a2))), g2 && x3.push(Ro(e.getPointGlobalCoordinates(l2, l2.points[d2[d2.length - 1]], a2)))), x3.length && (f3 = Ya(l2, x3, n2.scene, n2.state.zoom));
      }
      let E4 = { ...r2, selectedPointsIndices: d2, segmentMidPointHoveredCoords: u3 !== 0 && u3 !== l2.points.length - 1 ? this.getPointGlobalCoordinates(l2, p3, a2) : null, hoverPointIndex: u3 === 0 || u3 === l2.points.length - 1 ? u3 : -1, isDragging: true, customLineAngle: c3 };
      return { ...n2.state, editingLinearElement: n2.state.editingLinearElement ? E4 : null, selectedLinearElement: E4, suggestedBindings: f3 };
    }
    return null;
  }
  static handlePointerUp(t2, n2, i2, o2) {
    let r2 = o2.getNonDeletedElementsMap(), s2 = o2.getNonDeletedElements(), a2 = go(t2, i2), { elementId: l2, selectedPointsIndices: c3, isDragging: d2, pointerDownState: u3 } = n2, p3 = e.getElement(l2, r2);
    if (!p3) return n2;
    let m2 = {};
    if (d2 && c3) {
      for (let f3 of c3) if (f3 === 0 || f3 === p3.points.length - 1) {
        an2(p3.points, i2.zoom.value) && (ln(p3) && o2.mutateElement(p3, { ...nl(p3, true) }, { informMutation: false, isDragging: false }), e.movePoints(p3, o2, /* @__PURE__ */ new Map([[f3, { point: f3 === 0 ? p3.points[p3.points.length - 1] : p3.points[0] }]])));
        let E4 = Mr(i2) ? Wt((c3?.length ?? 0) > 1 ? Ro(e.getPointAtIndexGlobalCoordinates(p3, f3, r2)) : a2, s2, r2, i2.zoom, G(p3), G(p3)) : null;
        m2[f3 === 0 ? "startBindingElement" : "endBindingElement"] = E4;
      }
    }
    return { ...n2, ...m2, segmentMidPointHoveredCoords: null, hoverPointIndex: -1, selectedPointsIndices: d2 || t2.shiftKey ? !d2 && t2.shiftKey && u3.prevSelectedPointsIndices?.includes(u3.lastClickedPoint) ? c3 && c3.filter((f3) => f3 !== u3.lastClickedPoint) : c3 : c3?.includes(u3.lastClickedPoint) ? [u3.lastClickedPoint] : c3, isDragging: false, pointerOffset: { x: 0, y: 0 }, customLineAngle: null };
  }
  static getEditorMidPoints = (t2, n2, i2) => {
    let o2 = Z2(t2, n2);
    if (!G(t2) && !i2.editingLinearElement && t2.points.length > 2 && !o2) return [];
    let r2 = e.getPointsGlobalCoordinates(t2, n2), s2 = 0, a2 = [];
    for (; s2 < r2.length - 1; ) {
      if (e.isSegmentTooShort(t2, t2.points[s2], t2.points[s2 + 1], s2, i2.zoom)) {
        a2.push(null), s2++;
        continue;
      }
      let l2 = e.getSegmentMidPoint(t2, s2 + 1);
      a2.push(l2), s2++;
    }
    return a2;
  };
  static getSegmentMidpointHitCoords = (t2, n2, i2, o2) => {
    let { elementId: r2 } = t2, s2 = e.getElement(r2, o2);
    if (!s2) return null;
    let a2 = e.getPointIndexUnderCursor(s2, o2, i2.zoom, n2.x, n2.y);
    if (!G(s2) && a2 >= 0 || e.getPointsGlobalCoordinates(s2, o2).length >= 3 && !i2.editingLinearElement && !G(s2)) return null;
    let c3 = (e.POINT_HANDLE_SIZE + 1) / i2.zoom.value, d2 = t2.segmentMidPointHoveredCoords;
    if (d2 && _(p(d2[0], d2[1]), p(n2.x, n2.y)) <= c3) return d2;
    let u3 = 0, p3 = e.getEditorMidPoints(s2, o2, i2);
    for (; u3 < p3.length; ) {
      if (p3[u3] !== null && _(p3[u3], p(n2.x, n2.y)) <= c3) return p3[u3];
      u3++;
    }
    return null;
  };
  static isSegmentTooShort(t2, n2, i2, o2, r2) {
    if (G(t2)) return o2 >= 0 && o2 < t2.points.length ? _(n2, i2) * r2.value < e.POINT_HANDLE_SIZE / 2 : false;
    let s2 = _(n2, i2);
    if (t2.points.length > 2 && t2.roundness) {
      let [a2, l2] = Ci(t2);
      rs(a2.length === 0 && l2.length > 0, "Only linears built out of curves are supported"), rs(a2.length + l2.length >= o2, "Invalid segment index while calculating mid point"), s2 = nt(l2[o2]);
    }
    return s2 * r2.value < e.POINT_HANDLE_SIZE * 4;
  }
  static getSegmentMidPoint(t2, n2) {
    if (G(t2)) {
      rs(t2.points.length >= n2, "Invalid segment index while calculating elbow arrow mid point");
      let r2 = z(t2.points[n2 - 1], t2.points[n2]);
      return p(t2.x + r2[0], t2.y + r2[1]);
    }
    let [i2, o2] = Ci(t2);
    if (rs(i2.length === 0 && o2.length > 0 || i2.length > 0 && o2.length === 0, "Only linears built out of either segments or curves are supported"), rs(i2.length + o2.length >= n2, "Invalid segment index while calculating mid point"), i2.length) {
      let r2 = i2[n2 - 1];
      return z(r2[0], r2[1]);
    }
    if (o2.length) {
      let r2 = o2[n2 - 1];
      return rn(r2, 0.5);
    }
    rs(false, "Invalid segment type while calculating mid point");
  }
  static getSegmentMidPointIndex(t2, n2, i2, o2) {
    let r2 = e.getElement(t2.elementId, o2);
    if (!r2) return -1;
    let s2 = e.getEditorMidPoints(r2, o2, n2), a2 = 0;
    for (; a2 < s2.length; ) {
      if (e.arePointsEqual(i2, s2[a2])) return a2 + 1;
      a2++;
    }
    return -1;
  }
  static handlePointerDown(t2, n2, i2, o2, r2, s2) {
    let a2 = n2.state, l2 = s2.getNonDeletedElementsMap(), c3 = s2.getNonDeletedElements(), d2 = { didAddPoint: false, hitElement: null, linearElementEditor: null };
    if (!r2) return d2;
    let { elementId: u3 } = r2, p3 = e.getElement(u3, l2);
    if (!p3) return d2;
    let m2 = e.getSegmentMidpointHitCoords(r2, o2, a2, l2), f3 = null;
    if (m2) f3 = e.getSegmentMidPointIndex(r2, a2, m2, l2);
    else if (t2.altKey && a2.editingLinearElement) return r2.lastUncommittedPoint == null && (s2.mutateElement(p3, { points: [...p3.points, e.createPointAt(p3, l2, o2.x, o2.y, t2[y2.CTRL_OR_CMD] ? null : n2.getEffectiveGridSize())] }), d2.didAddPoint = true), i2.scheduleCapture(), d2.linearElementEditor = { ...r2, pointerDownState: { prevSelectedPointsIndices: r2.selectedPointsIndices, lastClickedPoint: -1, lastClickedIsEndPoint: false, origin: { x: o2.x, y: o2.y }, segmentMidpoint: { value: m2, index: f3, added: false } }, selectedPointsIndices: [p3.points.length - 1], lastUncommittedPoint: null, endBindingElement: Wt(o2, c3, l2, n2.state.zoom, r2.elbowed) }, d2.didAddPoint = true, d2;
    let E4 = e.getPointIndexUnderCursor(p3, l2, a2.zoom, o2.x, o2.y);
    if (E4 >= 0 || m2) d2.hitElement = p3;
    else {
      let { startBindingElement: v3, endBindingElement: T4 } = r2;
      Mr(a2) && Qo(p3) && Tr2(p3, v3, T4, s2);
    }
    let [h3, g2, x3, y4] = H(p3, l2), b2 = (h3 + x3) / 2, w4 = (g2 + y4) / 2, I4 = E4 > -1 && w(p(p3.x + p3.points[E4][0], p3.y + p3.points[E4][1]), p(b2, w4), p3.angle), M4 = E4 > -1 || t2.shiftKey ? t2.shiftKey || r2.selectedPointsIndices?.includes(E4) ? sm([...r2.selectedPointsIndices || [], E4]) : [E4] : null;
    return d2.linearElementEditor = { ...r2, pointerDownState: { prevSelectedPointsIndices: r2.selectedPointsIndices, lastClickedPoint: E4, lastClickedIsEndPoint: E4 === p3.points.length - 1, origin: { x: o2.x, y: o2.y }, segmentMidpoint: { value: m2, index: f3, added: false } }, selectedPointsIndices: M4, pointerOffset: I4 ? { x: o2.x - I4[0], y: o2.y - I4[1] } : { x: 0, y: 0 } }, d2;
  }
  static arePointsEqual(t2, n2) {
    return !t2 && !n2 ? true : !t2 || !n2 ? false : A(t2, n2);
  }
  static handlePointerMove(t2, n2, i2, o2) {
    let r2 = o2.state;
    if (!r2.editingLinearElement) return null;
    let { elementId: s2, lastUncommittedPoint: a2 } = r2.editingLinearElement, l2 = o2.scene.getNonDeletedElementsMap(), c3 = e.getElement(s2, l2);
    if (!c3) return r2.editingLinearElement;
    let { points: d2 } = c3, u3 = d2[d2.length - 1];
    if (!t2.altKey) return u3 === a2 && e.deletePoints(c3, o2, [d2.length - 1]), { ...r2.editingLinearElement, lastUncommittedPoint: null };
    let p3;
    if (Pr(t2) && d2.length >= 2) {
      let m2 = d2[d2.length - 2], [f3, E4] = e._getShiftLockedDelta(c3, l2, m2, p(n2, i2), t2[y2.CTRL_OR_CMD] ? null : o2.getEffectiveGridSize());
      p3 = p(f3 + m2[0], E4 + m2[1]);
    } else p3 = e.createPointAt(c3, l2, n2 - r2.editingLinearElement.pointerOffset.x, i2 - r2.editingLinearElement.pointerOffset.y, t2[y2.CTRL_OR_CMD] || G(c3) ? null : o2.getEffectiveGridSize());
    return u3 === a2 ? e.movePoints(c3, o2.scene, /* @__PURE__ */ new Map([[c3.points.length - 1, { point: p3 }]])) : e.addPoints(c3, o2.scene, [p3]), { ...r2.editingLinearElement, lastUncommittedPoint: c3.points[c3.points.length - 1] };
  }
  static getPointGlobalCoordinates(t2, n2, i2) {
    let [o2, r2, s2, a2] = H(t2, i2), l2 = (o2 + s2) / 2, c3 = (r2 + a2) / 2, { x: d2, y: u3 } = t2;
    return w(p(d2 + n2[0], u3 + n2[1]), p(l2, c3), t2.angle);
  }
  static getPointsGlobalCoordinates(t2, n2) {
    let [i2, o2, r2, s2] = H(t2, n2), a2 = (i2 + r2) / 2, l2 = (o2 + s2) / 2;
    return t2.points.map((c3) => {
      let { x: d2, y: u3 } = t2;
      return w(p(d2 + c3[0], u3 + c3[1]), p(a2, l2), t2.angle);
    });
  }
  static getPointAtIndexGlobalCoordinates(t2, n2, i2) {
    let o2 = n2 < 0 ? t2.points.length + n2 : n2, [r2, s2, a2, l2] = H(t2, i2), c3 = (r2 + a2) / 2, d2 = (s2 + l2) / 2, u3 = t2.points[o2], { x: p3, y: m2 } = t2;
    return u3 ? w(p(p3 + u3[0], m2 + u3[1]), p(c3, d2), t2.angle) : w(p(p3, m2), p(c3, d2), t2.angle);
  }
  static pointFromAbsoluteCoords(t2, n2, i2) {
    if (G(t2)) return p(n2[0] - t2.x, n2[1] - t2.y);
    let [o2, r2, s2, a2] = H(t2, i2), l2 = (o2 + s2) / 2, c3 = (r2 + a2) / 2, [d2, u3] = w(p(n2[0], n2[1]), p(l2, c3), -t2.angle);
    return p(d2 - t2.x, u3 - t2.y);
  }
  static getPointIndexUnderCursor(t2, n2, i2, o2, r2) {
    let s2 = e.getPointsGlobalCoordinates(t2, n2), a2 = s2.length;
    for (; --a2 > -1; ) {
      let l2 = s2[a2];
      if (_(p(o2, r2), p(l2[0], l2[1])) * i2.value < e.POINT_HANDLE_SIZE + 1) return a2;
    }
    return -1;
  }
  static createPointAt(t2, n2, i2, o2, r2) {
    let s2 = Kr(i2, o2, r2), [a2, l2, c3, d2] = H(t2, n2), u3 = (a2 + c3) / 2, p3 = (l2 + d2) / 2, [m2, f3] = w(p(s2[0], s2[1]), p(u3, p3), -t2.angle);
    return p(m2 - t2.x, f3 - t2.y);
  }
  static getNormalizeElementPointsAndCoords(t2) {
    let { points: n2, offsetX: i2, offsetY: o2 } = Dr(t2);
    return { points: n2, x: t2.x + i2, y: t2.y + o2 };
  }
  static duplicateSelectedPoints(t2, n2) {
    rs(t2.editingLinearElement, "Not currently editing a linear element");
    let i2 = n2.getNonDeletedElementsMap(), { selectedPointsIndices: o2, elementId: r2 } = t2.editingLinearElement, s2 = e.getElement(r2, i2);
    rs(s2, "The linear element does not exist in the provided Scene"), rs(o2 != null, "There are no selected points to duplicate");
    let { points: a2 } = s2, l2 = [], c3 = false, d2 = -1, u3 = a2.reduce((p3, m2, f3) => {
      if (++d2, p3.push(m2), o2.includes(f3)) {
        let h3 = a2[f3 + 1];
        h3 || (c3 = true), p3.push(h3 ? p((m2[0] + h3[0]) / 2, (m2[1] + h3[1]) / 2) : p(m2[0], m2[1])), l2.push(d2 + 1), ++d2;
      }
      return p3;
    }, []);
    if (n2.mutateElement(s2, { points: u3 }), c3) {
      let p3 = s2.points[s2.points.length - 1];
      e.movePoints(s2, n2, /* @__PURE__ */ new Map([[s2.points.length - 1, { point: p(p3[0] + 30, p3[1] + 30) }]]));
    }
    return { ...t2, editingLinearElement: { ...t2.editingLinearElement, selectedPointsIndices: l2 } };
  }
  static deletePoints(t2, n2, i2) {
    let o2 = n2.state.editingLinearElement?.lastUncommittedPoint === t2.points[t2.points.length - 1], r2 = t2.points.filter((d2, u3) => !i2.includes(u3));
    ln(t2) && t2.polygon && (o2 || i2.includes(0) || i2.includes(t2.points.length - 1)) && (r2[0] = p(r2[r2.length - 1][0], r2[r2.length - 1][1]));
    let { points: a2, offsetX: l2, offsetY: c3 } = Dr({ points: r2 });
    e._updatePoints(t2, n2.scene, a2, l2, c3);
  }
  static addPoints(t2, n2, i2) {
    let o2 = [...t2.points, ...i2];
    ln(t2) && t2.polygon && (o2[0] = p(o2[o2.length - 1][0], o2[o2.length - 1][1]));
    let { points: r2, offsetX: s2, offsetY: a2 } = Dr({ points: o2 });
    e._updatePoints(t2, n2, r2, s2, a2);
  }
  static movePoints(t2, n2, i2, o2) {
    let { points: r2 } = t2;
    if (ln(t2) && t2.polygon) {
      let d2 = i2.get(0), u3 = i2.get(r2.length - 1);
      d2 ? i2.set(r2.length - 1, { point: p(d2.point[0], d2.point[1]), isDragging: d2.isDragging }) : u3 && i2.set(0, { point: p(u3.point[0], u3.point[1]), isDragging: u3.isDragging });
    }
    let s2 = i2.get(0)?.point ?? p(0, 0), [a2, l2] = s2, c3 = G(t2) ? [i2.get(0)?.point ?? r2[0], i2.get(r2.length - 1)?.point ?? r2[r2.length - 1]] : r2.map((d2, u3) => {
      let p3 = i2.get(u3)?.point ?? d2;
      return p(p3[0] - a2, p3[1] - l2);
    });
    e._updatePoints(t2, n2, c3, a2, l2, o2, { isDragging: Array.from(i2.values()).some((d2) => d2.isDragging) });
  }
  static shouldAddMidpoint(t2, n2, i2, o2) {
    let r2 = e.getElement(t2.elementId, o2);
    if (r2 && G(r2) || !r2) return false;
    let { segmentMidpoint: s2 } = t2.pointerDownState;
    if (s2.added || s2.value === null || s2.index === null || t2.pointerDownState.origin === null) return false;
    let a2 = t2.pointerDownState.origin, l2 = _(p(a2.x, a2.y), p(n2.x, n2.y));
    return !(!i2.editingLinearElement && l2 < Bt / i2.zoom.value);
  }
  static addMidpoint(t2, n2, i2, o2, r2) {
    let s2 = r2.getNonDeletedElementsMap(), a2 = e.getElement(t2.elementId, s2);
    if (!a2) return;
    let { segmentMidpoint: l2 } = t2.pointerDownState, c3 = { pointerDownState: t2.pointerDownState, selectedPointsIndices: t2.selectedPointsIndices }, d2 = e.createPointAt(a2, s2, n2.x, n2.y, o2 && !G(a2) ? i2.getEffectiveGridSize() : null), u3 = [...a2.points.slice(0, l2.index), d2, ...a2.points.slice(l2.index)];
    return r2.mutateElement(a2, { points: u3 }), c3.pointerDownState = { ...t2.pointerDownState, segmentMidpoint: { ...t2.pointerDownState.segmentMidpoint, added: true }, lastClickedPoint: l2.index }, c3.selectedPointsIndices = [l2.index], c3;
  }
  static _updatePoints(t2, n2, i2, o2, r2, s2, a2) {
    if (G(t2)) {
      let l2 = {};
      s2?.startBinding !== void 0 && (l2.startBinding = s2.startBinding !== null && Qn2(s2.startBinding) ? s2.startBinding : null), s2?.endBinding !== void 0 && (l2.endBinding = s2.endBinding !== null && Qn2(s2.endBinding) ? s2.endBinding : null), l2.points = Array.from(i2), n2.mutateElement(t2, l2, { informMutation: true, isDragging: a2?.isDragging ?? false });
    } else {
      let l2 = Lr(t2, i2), c3 = Lr(t2, t2.points), d2 = (l2[0] + l2[2]) / 2, u3 = (l2[1] + l2[3]) / 2, p3 = (c3[0] + c3[2]) / 2, m2 = (c3[1] + c3[3]) / 2, f3 = p3 - d2, E4 = m2 - u3, h3 = w(p(o2, r2), p(f3, E4), t2.angle);
      n2.mutateElement(t2, { ...s2, points: i2, x: t2.x + h3[0], y: t2.y + h3[1] });
    }
  }
  static _getShiftLockedDelta(t2, n2, i2, o2, r2, s2) {
    let a2 = e.getPointGlobalCoordinates(t2, i2, n2);
    if (G(t2)) return [o2[0] - a2[0], o2[1] - a2[1]];
    let [l2, c3] = Kr(o2[0], o2[1], r2), { width: d2, height: u3 } = il(a2[0], a2[1], l2, c3, s2);
    return w(p(d2, u3), p(0, 0), -t2.angle);
  }
  static getBoundTextElementPosition = (t2, n2, i2) => {
    e.getPointsGlobalCoordinates(t2, i2).length < 2 && ye2(n2, i2, { isDeleted: true });
    let r2 = 0, s2 = 0;
    if (t2.points.length % 2 === 1) {
      let a2 = Math.floor(t2.points.length / 2), l2 = e.getPointGlobalCoordinates(t2, t2.points[a2], i2);
      r2 = l2[0] - n2.width / 2, s2 = l2[1] - n2.height / 2;
    } else {
      let a2 = t2.points.length / 2 - 1, l2 = e.getSegmentMidPoint(t2, a2 + 1);
      r2 = l2[0] - n2.width / 2, s2 = l2[1] - n2.height / 2;
    }
    return { x: r2, y: s2 };
  };
  static getMinMaxXYWithBoundText = (t2, n2, i2, o2) => {
    let [r2, s2, a2, l2] = i2, c3 = (r2 + a2) / 2, d2 = (s2 + l2) / 2, { x: u3, y: p3 } = e.getBoundTextElementPosition(t2, o2, n2), m2 = u3 + o2.width, f3 = p3 + o2.height, E4 = p(c3, d2), h3 = w(p(r2, s2), E4, t2.angle), g2 = w(p(a2, s2), E4, t2.angle), x3 = w(p(u3, p3), E4, -t2.angle), y4 = w(p(m2, p3), E4, -t2.angle), b2 = w(p(u3, f3), E4, -t2.angle), w4 = w(p(m2, f3), E4, -t2.angle);
    return h3[0] < g2[0] && h3[1] >= g2[1] ? (r2 = Math.min(r2, b2[0]), a2 = Math.max(a2, Math.max(y4[0], w4[0])), s2 = Math.min(s2, x3[1]), l2 = Math.max(l2, w4[1])) : h3[0] >= g2[0] && h3[1] > g2[1] ? (r2 = Math.min(r2, w4[0]), a2 = Math.max(a2, Math.max(x3[0], y4[0])), s2 = Math.min(s2, b2[1]), l2 = Math.max(l2, y4[1])) : h3[0] >= g2[0] ? (r2 = Math.min(r2, y4[0]), a2 = Math.max(a2, b2[0]), s2 = Math.min(s2, w4[1]), l2 = Math.max(l2, x3[1])) : h3[1] <= g2[1] && (r2 = Math.min(r2, Math.min(y4[0], x3[0])), a2 = Math.max(a2, w4[0]), s2 = Math.min(s2, y4[1]), l2 = Math.max(l2, b2[1])), [r2, s2, a2, l2, c3, d2];
  };
  static getElementAbsoluteCoords = (t2, n2, i2 = false) => {
    let o2, r2, s2, a2, l2;
    if (t2.points.length < 2 || !be2.get(t2)) {
      let { minX: p3, minY: m2, maxX: f3, maxY: E4 } = t2.points.reduce((h3, [g2, x3]) => (h3.minY = Math.min(h3.minY, x3), h3.minX = Math.min(h3.minX, g2), h3.maxX = Math.max(h3.maxX, g2), h3.maxY = Math.max(h3.maxY, x3), h3), { minX: 1 / 0, minY: 1 / 0, maxX: -1 / 0, maxY: -1 / 0 });
      r2 = p3 + t2.x, s2 = m2 + t2.y, a2 = f3 + t2.x, l2 = E4 + t2.y;
    } else {
      let p3 = be2.generateElementShape(t2, null), m2 = gt2(p3[0]), [f3, E4, h3, g2] = si(m2);
      r2 = f3 + t2.x, s2 = E4 + t2.y, a2 = h3 + t2.x, l2 = g2 + t2.y;
    }
    let c3 = (r2 + a2) / 2, d2 = (s2 + l2) / 2;
    if (o2 = [r2, s2, a2, l2, c3, d2], !i2) return o2;
    let u3 = Z2(t2, n2);
    return u3 && (o2 = e.getMinMaxXYWithBoundText(t2, n2, [r2, s2, a2, l2], u3)), o2;
  };
  static moveFixedSegment(t2, n2, i2, o2, r2) {
    let s2 = r2.getNonDeletedElementsMap(), a2 = e.getElement(t2.elementId, s2);
    if (!a2 || !G(a2)) return t2;
    if (n2 && n2 > 0 && n2 < a2.points.length) {
      let l2 = ke2(Mt2(h(a2.points[n2], a2.points[n2 - 1]))), c3 = (a2.fixedSegments ?? []).reduce((m2, f3) => (m2[f3.index] = f3, m2), {});
      c3[n2] = { index: n2, start: p(l2 ? a2.points[n2 - 1][0] : i2 - a2.x, l2 ? o2 - a2.y : a2.points[n2 - 1][1]), end: p(l2 ? a2.points[n2][0] : i2 - a2.x, l2 ? o2 - a2.y : a2.points[n2][1]) };
      let d2 = Object.values(c3).sort((m2, f3) => m2.index - f3.index), u3 = d2.map((m2) => m2.index).reduce((m2, f3) => f3 < n2 ? m2 + 1 : m2, 0);
      r2.mutateElement(a2, { fixedSegments: d2 });
      let p3 = p(a2.x + (a2.fixedSegments[u3].start[0] + a2.fixedSegments[u3].end[0]) / 2, a2.y + (a2.fixedSegments[u3].start[1] + a2.fixedSegments[u3].end[1]) / 2);
      return { ...t2, segmentMidPointHoveredCoords: p3, pointerDownState: { ...t2.pointerDownState, segmentMidpoint: { added: false, index: a2.fixedSegments[u3].index, value: p3 } } };
    }
    return t2;
  }
  static deleteFixedSegment(t2, n2, i2) {
    n2.mutateElement(t2, { fixedSegments: t2.fixedSegments?.filter((o2) => o2.index !== i2) });
  }
};
var sm = (e5) => {
  let t2 = [...new Set(e5.filter((n2) => n2 !== null && n2 !== -1))];
  return t2 = t2.sort((n2, i2) => n2 - i2), t2.length ? t2 : null;
};
P();
P();
P();
P();
P();
var ml = (function() {
  let e5 = null, t2 = null, n2 = null, i2 = (r2, s2, a2, l2) => {
    if (n2 !== void 0 && s2 === t2 && r2 === e5 && a2.editingGroupId === n2?.editingGroupId) return n2;
    let c3 = {};
    for (let p3 of r2) {
      let m2 = p3.groupIds;
      if (a2.editingGroupId) {
        let f3 = m2.indexOf(a2.editingGroupId);
        f3 > -1 && (m2 = m2.slice(0, f3));
      }
      if (m2.length > 0) {
        let f3 = m2[m2.length - 1];
        c3[f3] = true;
      }
    }
    let d2 = {}, u3 = s2.reduce((p3, m2) => {
      if (m2.isDeleted) return p3;
      let f3 = m2.groupIds.find((E4) => c3[E4]);
      return f3 && (p3[m2.id] = true, Array.isArray(d2[f3]) ? d2[f3].push(m2.id) : d2[f3] = [m2.id]), p3;
    }, {});
    for (let p3 of Object.keys(d2)) d2[p3].length < 2 && c3[p3] && (c3[p3] = false);
    return t2 = s2, e5 = r2, n2 = { editingGroupId: a2.editingGroupId, selectedGroupIds: c3, selectedElementIds: Br({ ...a2.selectedElementIds, ...u3 }, l2) }, n2;
  }, o2 = (r2, s2, a2, l2) => {
    let c3 = l2 ? l2.scene.getSelectedElements({ selectedElementIds: r2.selectedElementIds, elements: s2 }) : pt2(s2, r2);
    return c3.length ? i2(c3, s2, r2, a2) : { selectedGroupIds: {}, editingGroupId: null, selectedElementIds: Br(r2.selectedElementIds, a2) };
  };
  return o2.clearCache = () => {
    t2 = null, e5 = null, n2 = null;
  }, o2;
})();
var bm = (e5, t2) => e5.groupIds.includes(t2);
var Ae2 = (e5, t2) => {
  let n2 = [];
  for (let i2 of e5.values()) bm(i2, t2) && n2.push(i2);
  return n2;
};
var Jy = (function() {
  let e5 = null, t2 = null, n2 = null, i2 = (o2, r2) => (n2 != null && o2 === e5 && r2.selectedElementIds === t2 || (n2 = o2.some((s2) => r2.selectedElementIds[s2.id]), e5 = o2, t2 = r2.selectedElementIds), n2);
  return i2.clearCache = () => {
    e5 = null, t2 = null, n2 = null;
  }, i2;
})();
var pt2 = (e5, t2, n2) => {
  let i2 = /* @__PURE__ */ new Set(), o2 = [];
  for (let r2 of e5.values()) {
    if (t2.selectedElementIds[r2.id]) {
      o2.push(r2), i2.add(r2.id);
      continue;
    }
    if (n2?.includeBoundTextElement && fe2(r2) && t2.selectedElementIds[r2?.containerId]) {
      o2.push(r2), i2.add(r2.id);
      continue;
    }
  }
  if (n2?.includeElementsInFrames) {
    let r2 = [];
    return o2.forEach((s2) => {
      V2(s2) && qt(e5, s2.id).forEach((a2) => !i2.has(a2.id) && r2.push(a2)), r2.push(s2);
    }), r2;
  }
  return o2;
};
var Br = (e5, t2) => Qe(t2.selectedElementIds, e5) ? t2.selectedElementIds : e5;
var qt = (e5, t2) => {
  let n2 = [];
  for (let i2 of e5.values()) i2.frameId === t2 && n2.push(i2);
  return n2;
};
var Cl = typeof document < "u" ? document.createElement("img") : { src: "" };
Cl.src = `data:${Z.svg},${encodeURIComponent('<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="image" class="svg-inline--fa fa-image fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#888" d="M464 448H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h416c26.51 0 48 21.49 48 48v288c0 26.51-21.49 48-48 48zM112 120c-30.928 0-56 25.072-56 56s25.072 56 56 56 56-25.072 56-56-25.072-56-56-56zM64 384h384V272l-87.515-87.515c-4.686-4.686-12.284-4.686-16.971 0L208 320l-55.515-55.515c-4.686-4.686-12.284-4.686-16.971 0L64 336v48z"></path></svg>')}`;
var Bl = typeof document < "u" ? document.createElement("img") : { src: "" };
Bl.src = `data:${Z.svg},${encodeURIComponent('<svg viewBox="0 0 668 668" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2"><path d="M464 448H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h416c26.51 0 48 21.49 48 48v288c0 26.51-21.49 48-48 48ZM112 120c-30.928 0-56 25.072-56 56s25.072 56 56 56 56-25.072 56-56-25.072-56-56-56ZM64 384h384V272l-87.515-87.515c-4.686-4.686-12.284-4.686-16.971 0L208 320l-55.515-55.515c-4.686-4.686-12.284-4.686-16.971 0L64 336v48Z" style="fill:#888;fill-rule:nonzero" transform="matrix(.81709 0 0 .81709 124.825 145.825)"/><path d="M256 8C119.034 8 8 119.033 8 256c0 136.967 111.034 248 248 248s248-111.034 248-248S392.967 8 256 8Zm130.108 117.892c65.448 65.448 70 165.481 20.677 235.637L150.47 105.216c70.204-49.356 170.226-44.735 235.638 20.676ZM125.892 386.108c-65.448-65.448-70-165.481-20.677-235.637L361.53 406.784c-70.203 49.356-170.226 44.736-235.638-20.676Z" style="fill:#888;fill-rule:nonzero" transform="matrix(.30366 0 0 .30366 506.822 60.065)"/></svg>')}`;
var Eo = /* @__PURE__ */ new WeakMap();
var Gl = /* @__PURE__ */ new WeakMap([]);
function Ol(e5) {
  let t2 = Wm(e5), n2 = new Path2D(t2);
  return Gl.set(e5, n2), n2;
}
function Wm(e5) {
  let t2 = e5.simulatePressure ? e5.points : e5.points.length ? e5.points.map(([i2, o2], r2) => [i2, o2, e5.pressures[r2]]) : [[0, 0, 0.5]], n2 = { simulatePressure: e5.simulatePressure, size: e5.strokeWidth * 4.25, thinning: 0.6, smoothing: 0.5, streamline: 0.5, easing: (i2) => Math.sin(i2 * Math.PI / 2), last: !!e5.lastCommittedPoint };
  return Vm(Vs(t2, n2));
}
function Tl(e5, t2) {
  return [(e5[0] + t2[0]) / 2, (e5[1] + t2[1]) / 2];
}
var jm = /(\s?[A-Z]?,?-?[0-9]*\.[0-9]{0,2})(([0-9]|e|-)*)/g;
function Vm(e5) {
  if (!e5.length) return "";
  let t2 = e5.length - 1;
  return e5.reduce((n2, i2, o2, r2) => (o2 === t2 ? n2.push(i2, Tl(i2, r2[0]), "L", r2[0], "Z") : n2.push(i2, Tl(i2, r2[o2 + 1])), n2), ["M", e5[0], "Q"]).join(" ").replace(jm, "$1");
}
P();
var kl = (e5) => e5 === "rectangle" || e5 === "iframe" || e5 === "embeddable" || e5 === "line" || e5 === "diamond" || e5 === "image";
var be2 = class e2 {
  static rg = new Ue2();
  static cache = /* @__PURE__ */ new WeakMap();
  static get = (t2) => e2.cache.get(t2);
  static set = (t2, n2) => e2.cache.set(t2, n2);
  static delete = (t2) => e2.cache.delete(t2);
  static destroy = () => {
    e2.cache = /* @__PURE__ */ new WeakMap();
  };
  static generateElementShape = (t2, n2) => {
    let i2 = n2?.isExporting ? void 0 : e2.get(t2);
    if (i2 !== void 0) return i2;
    Eo.delete(t2);
    let o2 = ef(t2, e2.rg, n2 || { isExporting: false, canvasBackgroundColor: u.white, embedsValidationStatus: null });
    return e2.cache.set(t2, o2), o2;
  };
};
var Qm = (e5) => [8, 8 + e5];
var zl = (e5) => [1.5, 6 + e5];
function Jm(e5) {
  let t2 = e5.roughness, n2 = Math.max(e5.width, e5.height), i2 = Math.min(e5.width, e5.height);
  return i2 >= 20 && n2 >= 50 || i2 >= 15 && e5.roundness && kl(e5.type) || U2(e5) && n2 >= 50 ? t2 : Math.min(t2 / (n2 < 10 ? 3 : 2), 2.5);
}
var Re2 = (e5, t2 = false) => {
  let n2 = { seed: e5.seed, strokeLineDash: e5.strokeStyle === "dashed" ? Qm(e5.strokeWidth) : e5.strokeStyle === "dotted" ? zl(e5.strokeWidth) : void 0, disableMultiStroke: e5.strokeStyle !== "solid", strokeWidth: e5.strokeStyle !== "solid" ? e5.strokeWidth + 0.5 : e5.strokeWidth, fillWeight: e5.strokeWidth / 2, hachureGap: e5.strokeWidth * 4, roughness: Jm(e5), stroke: e5.strokeColor, preserveVertices: t2 || e5.roughness < ke.cartoonist };
  switch (e5.type) {
    case "rectangle":
    case "iframe":
    case "embeddable":
    case "diamond":
    case "ellipse":
      return n2.fillStyle = e5.fillStyle, n2.fill = je(e5.backgroundColor) ? void 0 : e5.backgroundColor, e5.type === "ellipse" && (n2.curveFitting = 1), n2;
    case "line":
    case "freedraw":
      return an2(e5.points) && (n2.fillStyle = e5.fillStyle, n2.fill = e5.backgroundColor === "transparent" ? void 0 : e5.backgroundColor), n2;
    case "arrow":
      return n2;
    default:
      throw new Error(`Unimplemented type ${e5.type}`);
  }
};
var Fl = (e5, t2, n2) => Oi(e5) && (t2 || ia(e5) && n2?.get(e5.id) !== true) && je(e5.backgroundColor) && je(e5.strokeColor) ? { ...e5, roughness: 0, backgroundColor: "#d3d3d3", fillStyle: "solid" } : Gi(e5) ? { ...e5, strokeColor: je(e5.strokeColor) ? "#000000" : e5.strokeColor, backgroundColor: je(e5.backgroundColor) ? "#f4f4f6" : e5.backgroundColor } : e5;
var Nl = (e5, t2, n2, i2, o2, r2, s2) => {
  let a2 = Hr2(e5, t2, n2, i2);
  if (a2 === null) return [];
  let l2 = (c3, d2) => {
    if (c3 === null) return [];
    let [, , u3, p3, m2, f3] = c3;
    return [o2.line(u3, p3, m2, f3, d2)];
  };
  switch (i2) {
    case "dot":
    case "circle":
    case "circle_outline": {
      let [c3, d2, u3] = a2;
      return delete r2.strokeLineDash, [o2.circle(c3, d2, u3, { ...r2, fill: i2 === "circle_outline" ? s2 : e5.strokeColor, fillStyle: "solid", stroke: e5.strokeColor, roughness: Math.min(0.5, r2.roughness || 0) })];
    }
    case "triangle":
    case "triangle_outline": {
      let [c3, d2, u3, p3, m2, f3] = a2;
      return delete r2.strokeLineDash, [o2.polygon([[c3, d2], [u3, p3], [m2, f3], [c3, d2]], { ...r2, fill: i2 === "triangle_outline" ? s2 : e5.strokeColor, fillStyle: "solid", roughness: Math.min(1, r2.roughness || 0) })];
    }
    case "diamond":
    case "diamond_outline": {
      let [c3, d2, u3, p3, m2, f3, E4, h3] = a2;
      return delete r2.strokeLineDash, [o2.polygon([[c3, d2], [u3, p3], [m2, f3], [E4, h3], [c3, d2]], { ...r2, fill: i2 === "diamond_outline" ? s2 : e5.strokeColor, fillStyle: "solid", roughness: Math.min(1, r2.roughness || 0) })];
    }
    case "crowfoot_one":
      return l2(a2, r2);
    case "bar":
    case "arrow":
    case "crowfoot_many":
    case "crowfoot_one_or_many":
    default: {
      let [c3, d2, u3, p3, m2, f3] = a2;
      if (e5.strokeStyle === "dotted") {
        let E4 = zl(e5.strokeWidth - 1);
        r2.strokeLineDash = [E4[0], E4[1] - 1];
      } else delete r2.strokeLineDash;
      return r2.roughness = Math.min(1, r2.roughness || 0), [o2.line(u3, p3, c3, d2, r2), o2.line(m2, f3, c3, d2, r2), ...i2 === "crowfoot_one_or_many" ? l2(Hr2(e5, t2, n2, "crowfoot_one"), r2) : []];
    }
  }
};
var ta = (e5) => {
  let t2 = new Ue2(), n2 = { seed: e5.seed, disableMultiStroke: true, disableMultiStrokeFill: true, roughness: 0, preserveVertices: true }, i2 = ct2(e5.points.reduce((o2, r2) => [Math.min(e5.x + r2[0], o2[0]), Math.min(e5.y + r2[1], o2[1]), Math.max(e5.x + r2[0], o2[2]), Math.max(e5.y + r2[1], o2[3])], [1 / 0, 1 / 0, -1 / 0, -1 / 0]));
  switch (e5.type) {
    case "line":
    case "arrow": {
      let o2 = e5.points.length ? e5.points : [p(0, 0)];
      return G(e5) ? t2.path(Hl(o2, 16), n2).sets[0].ops : e5.roundness ? t2.curve(o2, n2).sets[0].ops.slice(0, e5.points.length).map((r2, s2) => {
        if (s2 === 0) {
          let a2 = w(p(e5.x + r2.data[0], e5.y + r2.data[1]), i2, e5.angle);
          return { op: "move", data: p(a2[0] - e5.x, a2[1] - e5.y) };
        }
        return { op: "bcurveTo", data: [w(p(e5.x + r2.data[0], e5.y + r2.data[1]), i2, e5.angle), w(p(e5.x + r2.data[2], e5.y + r2.data[3]), i2, e5.angle), w(p(e5.x + r2.data[4], e5.y + r2.data[5]), i2, e5.angle)].map((a2) => p(a2[0] - e5.x, a2[1] - e5.y)).flat() };
      }) : o2.map((r2, s2) => {
        let a2 = w(p(e5.x + r2[0], e5.y + r2[1]), i2, e5.angle);
        return { op: s2 === 0 ? "move" : "lineTo", data: p(a2[0] - e5.x, a2[1] - e5.y) };
      });
    }
    case "freedraw": {
      if (e5.points.length < 2) return [];
      let o2 = Wn2(e5.points, 0.75);
      return t2.curve(o2, n2).sets[0].ops.slice(0, e5.points.length).map((r2, s2) => {
        if (s2 === 0) {
          let a2 = w(p(e5.x + r2.data[0], e5.y + r2.data[1]), i2, e5.angle);
          return { op: "move", data: p(a2[0] - e5.x, a2[1] - e5.y) };
        }
        return { op: "bcurveTo", data: [w(p(e5.x + r2.data[0], e5.y + r2.data[1]), i2, e5.angle), w(p(e5.x + r2.data[2], e5.y + r2.data[3]), i2, e5.angle), w(p(e5.x + r2.data[4], e5.y + r2.data[5]), i2, e5.angle)].map((a2) => p(a2[0] - e5.x, a2[1] - e5.y)).flat() };
      });
    }
  }
};
var ef = (e5, t2, { isExporting: n2, canvasBackgroundColor: i2, embedsValidationStatus: o2 }) => {
  switch (e5.type) {
    case "rectangle":
    case "iframe":
    case "embeddable": {
      let r2;
      if (e5.roundness) {
        let s2 = e5.width, a2 = e5.height, l2 = yt3(Math.min(s2, a2), e5);
        r2 = t2.path(`M ${l2} 0 L ${s2 - l2} 0 Q ${s2} 0, ${s2} ${l2} L ${s2} ${a2 - l2} Q ${s2} ${a2}, ${s2 - l2} ${a2} L ${l2} ${a2} Q 0 ${a2}, 0 ${a2 - l2} L 0 ${l2} Q 0 0, ${l2} 0`, Re2(Fl(e5, n2, o2), true));
      } else r2 = t2.rectangle(0, 0, e5.width, e5.height, Re2(Fl(e5, n2, o2), false));
      return r2;
    }
    case "diamond": {
      let r2, [s2, a2, l2, c3, d2, u3, p3, m2] = Bi(e5);
      if (e5.roundness) {
        let f3 = yt3(Math.abs(s2 - p3), e5), E4 = yt3(Math.abs(c3 - a2), e5);
        r2 = t2.path(`M ${s2 + f3} ${a2 + E4} L ${l2 - f3} ${c3 - E4}
            C ${l2} ${c3}, ${l2} ${c3}, ${l2 - f3} ${c3 + E4}
            L ${d2 + f3} ${u3 - E4}
            C ${d2} ${u3}, ${d2} ${u3}, ${d2 - f3} ${u3 - E4}
            L ${p3 + f3} ${m2 + E4}
            C ${p3} ${m2}, ${p3} ${m2}, ${p3 + f3} ${m2 - E4}
            L ${s2 - f3} ${a2 + E4}
            C ${s2} ${a2}, ${s2} ${a2}, ${s2 + f3} ${a2 + E4}`, Re2(e5, true));
      } else r2 = t2.polygon([[s2, a2], [l2, c3], [d2, u3], [p3, m2]], Re2(e5));
      return r2;
    }
    case "ellipse":
      return t2.ellipse(e5.width / 2, e5.height / 2, e5.width, e5.height, Re2(e5));
    case "line":
    case "arrow": {
      let r2, s2 = Re2(e5), a2 = e5.points.length ? e5.points : [p(0, 0)];
      if (G(e5) ? a2.every((l2) => Math.abs(l2[0]) <= 1e6 && Math.abs(l2[1]) <= 1e6) ? r2 = [t2.path(Hl(a2, 16), Re2(e5, true))] : (console.error("Elbow arrow with extreme point positions detected. Arrow not rendered.", e5.id, JSON.stringify(a2)), r2 = []) : e5.roundness ? r2 = [t2.curve(a2, s2)] : s2.fill ? r2 = [t2.polygon(a2, s2)] : r2 = [t2.linearPath(a2, s2)], e5.type === "arrow") {
        let { startArrowhead: l2 = null, endArrowhead: c3 = "arrow" } = e5;
        if (l2 !== null) {
          let d2 = Nl(e5, r2, "start", l2, t2, s2, i2);
          r2.push(...d2);
        }
        if (c3 !== null) {
          let d2 = Nl(e5, r2, "end", c3, t2, s2, i2);
          r2.push(...d2);
        }
      }
      return r2;
    }
    case "freedraw": {
      let r2;
      if (Ol(e5), an2(e5.points)) {
        let s2 = Wn2(e5.points, 0.75);
        r2 = t2.curve(s2, { ...Re2(e5), stroke: "none" });
      } else r2 = null;
      return r2;
    }
    case "frame":
    case "magicframe":
    case "text":
    case "image":
      return null;
    default:
      return ns(e5, `generateElementShape(): Unimplemented type ${e5?.type}`), null;
  }
};
var Hl = (e5, t2) => {
  let n2 = [];
  for (let o2 = 1; o2 < e5.length - 1; o2 += 1) {
    let r2 = e5[o2 - 1], s2 = e5[o2 + 1], a2 = e5[o2], l2 = et3(a2, r2), c3 = et3(s2, a2), d2 = Math.min(t2, _(e5[o2], s2) / 2, _(e5[o2], r2) / 2);
    l2 ? r2[0] < a2[0] ? n2.push([e5[o2][0] - d2, e5[o2][1]]) : n2.push([e5[o2][0] + d2, e5[o2][1]]) : r2[1] < a2[1] ? n2.push([e5[o2][0], e5[o2][1] - d2]) : n2.push([e5[o2][0], e5[o2][1] + d2]), n2.push(e5[o2]), c3 ? s2[0] < a2[0] ? n2.push([e5[o2][0] - d2, e5[o2][1]]) : n2.push([e5[o2][0] + d2, e5[o2][1]]) : s2[1] < a2[1] ? n2.push([e5[o2][0], e5[o2][1] - d2]) : n2.push([e5[o2][0], e5[o2][1] + d2]);
  }
  let i2 = [`M ${e5[0][0]} ${e5[0][1]}`];
  for (let o2 = 0; o2 < n2.length; o2 += 3) i2.push(`L ${n2[o2][0]} ${n2[o2][1]}`), i2.push(`Q ${n2[o2 + 1][0]} ${n2[o2 + 1][1]}, ${n2[o2 + 2][0]} ${n2[o2 + 2][1]}`);
  return i2.push(`L ${e5[e5.length - 1][0]} ${e5[e5.length - 1][1]}`), i2.join(" ");
};
var nl = (e5, t2) => {
  let n2 = [...e5.points];
  if (t2) {
    if (!la(e5.points)) return null;
    let o2 = n2[0], r2 = n2[n2.length - 1];
    Math.hypot(o2[0] - r2[0], o2[1] - r2[1]) > Er || n2.length < 4 ? n2.push(p(o2[0], o2[1])) : n2[n2.length - 1] = p(o2[0], o2[1]);
  }
  return { polygon: t2, points: n2 };
};
var Xr = class e3 {
  static boundsCache = /* @__PURE__ */ new WeakMap();
  static nonRotatedBoundsCache = /* @__PURE__ */ new WeakMap();
  static getBounds(t2, n2, i2 = false) {
    let o2 = i2 && t2.angle !== 0 ? e3.nonRotatedBoundsCache.get(t2) : e3.boundsCache.get(t2);
    if (o2?.version && o2.version === t2.version && !fe2(t2)) return o2.bounds;
    if (i2 && t2.angle !== 0) {
      let s2 = e3.calculateBounds({ ...t2, angle: 0 }, n2);
      return e3.nonRotatedBoundsCache.set(t2, { version: t2.version, bounds: s2 }), s2;
    }
    let r2 = e3.calculateBounds(t2, n2);
    return e3.boundsCache.set(t2, { version: t2.version, bounds: r2 }), r2;
  }
  static calculateBounds(t2, n2) {
    let i2, [o2, r2, s2, a2, l2, c3] = H(t2, n2);
    if (Se2(t2)) {
      let [d2, u3, p3, m2] = Ur(t2.points.map(([f3, E4]) => w(p(f3, E4), p(l2 - t2.x, c3 - t2.y), t2.angle)));
      return [d2 + t2.x, u3 + t2.y, p3 + t2.x, m2 + t2.y];
    } else if (U2(t2)) i2 = df(t2, l2, c3, n2);
    else if (t2.type === "diamond") {
      let [d2, u3] = w(p(l2, r2), p(l2, c3), t2.angle), [p3, m2] = w(p(l2, a2), p(l2, c3), t2.angle), [f3, E4] = w(p(o2, c3), p(l2, c3), t2.angle), [h3, g2] = w(p(s2, c3), p(l2, c3), t2.angle), x3 = Math.min(d2, p3, f3, h3), y4 = Math.min(u3, m2, E4, g2), b2 = Math.max(d2, p3, f3, h3), w4 = Math.max(u3, m2, E4, g2);
      i2 = [x3, y4, b2, w4];
    } else if (t2.type === "ellipse") {
      let d2 = (s2 - o2) / 2, u3 = (a2 - r2) / 2, p3 = Math.cos(t2.angle), m2 = Math.sin(t2.angle), f3 = Math.hypot(d2 * p3, u3 * m2), E4 = Math.hypot(u3 * p3, d2 * m2);
      i2 = [l2 - f3, c3 - E4, l2 + f3, c3 + E4];
    } else {
      let [d2, u3] = w(p(o2, r2), p(l2, c3), t2.angle), [p3, m2] = w(p(o2, a2), p(l2, c3), t2.angle), [f3, E4] = w(p(s2, a2), p(l2, c3), t2.angle), [h3, g2] = w(p(s2, r2), p(l2, c3), t2.angle), x3 = Math.min(d2, p3, f3, h3), y4 = Math.min(u3, m2, E4, g2), b2 = Math.max(d2, p3, f3, h3), w4 = Math.max(u3, m2, E4, g2);
      i2 = [x3, y4, b2, w4];
    }
    return i2;
  }
};
var H = (e5, t2, n2 = false) => {
  if (Se2(e5)) return sf(e5);
  if (U2(e5)) return Y3.getElementAbsoluteCoords(e5, t2, n2);
  if (ne2(e5)) {
    let i2 = t2 ? Ce(e5, t2) : null;
    if (_2(i2)) {
      let { x: o2, y: r2 } = Y3.getBoundTextElementPosition(i2, e5, t2);
      return [o2, r2, o2 + e5.width, r2 + e5.height, o2 + e5.width / 2, r2 + e5.height / 2];
    }
  }
  return [e5.x, e5.y, e5.x + e5.width, e5.y + e5.height, e5.x + e5.width / 2, e5.y + e5.height / 2];
};
var Bi = (e5) => {
  let t2 = Math.floor(e5.width / 2) + 1, n2 = 0, i2 = e5.width, o2 = Math.floor(e5.height / 2) + 1, r2 = t2, s2 = e5.height;
  return [t2, n2, i2, o2, r2, s2, 0, o2];
};
var Wl = (e5, t2, n2, i2, o2) => {
  let r2 = 1 - e5;
  return Math.pow(r2, 3) * t2 + 3 * Math.pow(r2, 2) * e5 * n2 + 3 * r2 * Math.pow(e5, 2) * i2 + Math.pow(e5, 3) * o2;
};
var jl = (e5, t2, n2, i2) => {
  let o2 = t2 - e5, r2 = n2 - t2, s2 = i2 - n2, a2 = 3 * o2 - 6 * r2 + 3 * s2, l2 = 6 * r2 - 6 * o2, c3 = 3 * o2, d2 = l2 * l2 - 4 * a2 * c3;
  if (!(d2 >= 0)) return false;
  let p3 = null, m2 = null, f3 = 1 / 0, E4 = 1 / 0;
  return a2 === 0 ? f3 = E4 = -c3 / l2 : (f3 = (-l2 + Math.sqrt(d2)) / (2 * a2), E4 = (-l2 - Math.sqrt(d2)) / (2 * a2)), f3 >= 0 && f3 <= 1 && (p3 = Wl(f3, e5, t2, n2, i2)), E4 >= 0 && E4 <= 1 && (m2 = Wl(E4, e5, t2, n2, i2)), [p3, m2];
};
var Wi = (e5, t2, n2, i2) => {
  let o2 = jl(e5[0], t2[0], n2[0], i2[0]), r2 = jl(e5[1], t2[1], n2[1], i2[1]), s2 = Math.min(e5[0], i2[0]), a2 = Math.max(e5[0], i2[0]);
  if (o2) {
    let d2 = o2.filter((u3) => u3 !== null);
    s2 = Math.min(s2, ...d2), a2 = Math.max(a2, ...d2);
  }
  let l2 = Math.min(e5[1], i2[1]), c3 = Math.max(e5[1], i2[1]);
  if (r2) {
    let d2 = r2.filter((u3) => u3 !== null);
    l2 = Math.min(l2, ...d2), c3 = Math.max(c3, ...d2);
  }
  return [s2, l2, a2, c3];
};
var si = (e5, t2) => {
  let n2 = p(0, 0), { minX: i2, minY: o2, maxX: r2, maxY: s2 } = e5.reduce((a2, { op: l2, data: c3 }) => {
    if (l2 === "move") {
      let d2 = Tt(c3);
      rs(d2 != null, "Op data is not a point"), n2 = d2;
    } else if (l2 === "bcurveTo") {
      let d2 = p(c3[0], c3[1]), u3 = p(c3[2], c3[3]), p3 = p(c3[4], c3[5]), m2 = t2 ? t2(d2) : d2, f3 = t2 ? t2(u3) : u3, E4 = t2 ? t2(p3) : p3, h3 = t2 ? t2(n2) : n2;
      n2 = p3;
      let [g2, x3, y4, b2] = Wi(h3, m2, f3, E4);
      a2.minX = Math.min(a2.minX, g2), a2.minY = Math.min(a2.minY, x3), a2.maxX = Math.max(a2.maxX, y4), a2.maxY = Math.max(a2.maxY, b2);
    }
    return a2;
  }, { minX: 1 / 0, minY: 1 / 0, maxX: -1 / 0, maxY: -1 / 0 });
  return [i2, o2, r2, s2];
};
var Ur = (e5) => {
  let t2 = 1 / 0, n2 = 1 / 0, i2 = -1 / 0, o2 = -1 / 0;
  for (let [r2, s2] of e5) t2 = Math.min(t2, r2), n2 = Math.min(n2, s2), i2 = Math.max(i2, r2), o2 = Math.max(o2, s2);
  return [t2, n2, i2, o2];
};
var sf = (e5) => {
  let [t2, n2, i2, o2] = Ur(e5.points), r2 = t2 + e5.x, s2 = n2 + e5.y, a2 = i2 + e5.x, l2 = o2 + e5.y;
  return [r2, s2, a2, l2, (r2 + a2) / 2, (s2 + l2) / 2];
};
var af = (e5) => {
  switch (e5) {
    case "arrow":
      return 25;
    case "diamond":
    case "diamond_outline":
      return 12;
    case "crowfoot_many":
    case "crowfoot_one":
    case "crowfoot_one_or_many":
      return 20;
    default:
      return 15;
  }
};
var lf = (e5) => {
  switch (e5) {
    case "bar":
      return 90;
    case "arrow":
      return 20;
    default:
      return 25;
  }
};
var Hr2 = (e5, t2, n2, i2) => {
  if (t2.length < 1) return null;
  let o2 = gt2(t2[0]);
  if (o2.length < 1) return null;
  let r2 = n2 === "start" ? 1 : o2.length - 1, s2 = o2[r2].data;
  rs(s2.length === 6, "Op data length is not 6");
  let a2 = p(s2[4], s2[5]), l2 = p(s2[2], s2[3]), c3 = p(s2[0], s2[1]), d2 = o2[r2 - 1], u3 = p(0, 0);
  if (d2.op === "move") {
    let N3 = Tt(d2.data);
    rs(N3 != null, "Op data is not a point"), u3 = N3;
  } else d2.op === "bcurveTo" && (u3 = p(d2.data[4], d2.data[5]));
  let p3 = (N3, ee3) => Math.pow(1 - N3, 3) * a2[ee3] + 3 * N3 * Math.pow(1 - N3, 2) * l2[ee3] + 3 * Math.pow(N3, 2) * (1 - N3) * c3[ee3] + u3[ee3] * Math.pow(N3, 3), [m2, f3] = n2 === "start" ? u3 : a2, [E4, h3] = [p3(0.3, 0), p3(0.3, 1)], g2 = Math.hypot(m2 - E4, f3 - h3), x3 = (m2 - E4) / g2, y4 = (f3 - h3) / g2, b2 = af(i2), w4 = 0;
  {
    let [N3, ee3] = n2 === "end" ? e5.points[e5.points.length - 1] : e5.points[0], [S3, K2] = e5.points.length > 1 ? n2 === "end" ? e5.points[e5.points.length - 2] : e5.points[1] : [0, 0];
    w4 = Math.hypot(N3 - S3, ee3 - K2);
  }
  let M4 = Math.min(b2, w4 * (i2 === "diamond" || i2 === "diamond_outline" ? 0.25 : 0.5)), v3 = m2 - x3 * M4, T4 = f3 - y4 * M4;
  if (i2 === "dot" || i2 === "circle" || i2 === "circle_outline") {
    let N3 = Math.hypot(T4 - f3, v3 - m2) + e5.strokeWidth - 2;
    return [m2, f3, N3];
  }
  let F4 = lf(i2);
  if (i2 === "crowfoot_many" || i2 === "crowfoot_one_or_many") {
    let [N3, ee3] = w(p(m2, f3), p(v3, T4), K(-F4)), [S3, K2] = w(p(m2, f3), p(v3, T4), K(F4));
    return [v3, T4, N3, ee3, S3, K2];
  }
  let [C4, R2] = w(p(v3, T4), p(m2, f3), -F4 * Math.PI / 180), [L4, W] = w(p(v3, T4), p(m2, f3), K(F4));
  if (i2 === "diamond" || i2 === "diamond_outline") {
    let N3, ee3;
    if (n2 === "start") {
      let [S3, K2] = e5.points.length > 1 ? e5.points[1] : [0, 0];
      [N3, ee3] = w(p(m2 + M4 * 2, f3), p(m2, f3), Math.atan2(K2 - f3, S3 - m2));
    } else {
      let [S3, K2] = e5.points.length > 1 ? e5.points[e5.points.length - 2] : [0, 0];
      [N3, ee3] = w(p(m2 - M4 * 2, f3), p(m2, f3), Math.atan2(f3 - K2, m2 - S3));
    }
    return [m2, f3, C4, R2, N3, ee3, L4, W];
  }
  return [m2, f3, C4, R2, L4, W];
};
var cf = (e5) => {
  let t2 = sn2.generator(), n2 = Re2(e5), i2 = e5.roundness ? "curve" : n2.fill ? "polygon" : "linearPath";
  return t2[i2](e5.points, n2);
};
var df = (e5, t2, n2, i2) => {
  let o2 = Z2(e5, i2);
  if (e5.points.length < 2) {
    let [u3, p3] = e5.points[0], [m2, f3] = w(p(e5.x + u3, e5.y + p3), p(t2, n2), e5.angle), E4 = [m2, f3, m2, f3];
    if (o2) {
      let h3 = Y3.getMinMaxXYWithBoundText(e5, i2, [m2, f3, m2, f3], o2);
      E4 = [h3[0], h3[1], h3[2], h3[3]];
    }
    return E4;
  }
  let s2 = be2.get(e5)?.[0] ?? cf(e5), a2 = gt2(s2), c3 = si(a2, ([u3, p3]) => w(p(e5.x + u3, e5.y + p3), p(t2, n2), e5.angle)), d2 = [c3[0], c3[1], c3[2], c3[3]];
  if (o2) {
    let u3 = Y3.getMinMaxXYWithBoundText(e5, i2, d2, o2);
    d2 = [u3[0], u3[1], u3[2], u3[3]];
  }
  return d2;
};
var he2 = (e5, t2, n2 = false) => Xr.getBounds(e5, t2, n2);
var Nt = (e5, t2, n2, i2) => {
  if (!(U2(e5) || Se2(e5))) return [e5.x, e5.y, e5.x + t2, e5.y + n2];
  let o2 = Hr(0, t2, Hr(1, n2, e5.points, i2), i2), r2;
  if (Se2(e5)) r2 = Ur(o2);
  else {
    let d2 = sn2.generator(), u3 = e5.roundness ? d2.curve(o2, Re2(e5)) : d2.linearPath(o2, Re2(e5)), p3 = gt2(u3);
    r2 = si(p3);
  }
  let [s2, a2, l2, c3] = r2;
  return [s2 + e5.x, a2 + e5.y, l2 + e5.x, c3 + e5.y];
};
var Lr = (e5, t2) => {
  let n2 = sn2.generator(), i2 = e5.roundness == null ? n2.linearPath(t2, Re2(e5)) : n2.curve(t2, Re2(e5)), o2 = gt2(i2), [r2, s2, a2, l2] = si(o2);
  return [r2 + e5.x, s2 + e5.y, a2 + e5.x, l2 + e5.y];
};
var ct2 = (e5) => p(e5[0] + (e5[2] - e5[0]) / 2, e5[1] + (e5[3] - e5[1]) / 2);
var Ve2 = (e5, t2, n2) => {
  let i2 = { minX: e5.x, minY: e5.y, maxX: e5.x + e5.width, maxY: e5.y + e5.height, midX: e5.x + e5.width / 2, midY: e5.y + e5.height / 2 }, o2 = me2(e5, t2), [r2, s2] = w(p(i2.minX, i2.minY), o2, e5.angle), [a2, l2] = w(p(i2.maxX, i2.minY), o2, e5.angle), [c3, d2] = w(p(i2.maxX, i2.maxY), o2, e5.angle), [u3, p3] = w(p(i2.minX, i2.maxY), o2, e5.angle), m2 = [Math.min(r2, a2, c3, u3), Math.min(s2, l2, d2, p3), Math.max(r2, a2, c3, u3), Math.max(s2, l2, d2, p3)];
  if (n2) {
    let [f3, E4, h3, g2] = n2;
    return [m2[0] - g2, m2[1] - f3, m2[2] + E4, m2[3] + h3];
  }
  return m2;
};
var Mn = (e5, t2) => e5[0] > t2[0] && e5[0] < t2[2] && e5[1] > t2[1] && e5[1] < t2[3];
var un2 = (e5, t2) => {
  if (e5 == null || t2 == null) return false;
  let [n2, i2, o2, r2] = e5, [s2, a2, l2, c3] = t2;
  return n2 < l2 && o2 > s2 && i2 < c3 && r2 > a2;
};
var me2 = (e5, t2, n2 = 0, i2 = 0) => {
  let [o2, r2] = ct2(he2(e5, t2));
  return p(o2 + n2, r2 + i2);
};
var il = (e5, t2, n2, i2, o2) => {
  let r2 = n2 - e5, s2 = i2 - t2, a2 = Math.atan2(s2, r2), l2 = Math.round(a2 / Xt2) * Xt2;
  if (o2) {
    let c3 = Math.floor(o2 / Xt2) * Xt2;
    Vt(a2, c3, c3 + Xt2) && (Ct(a2, o2) < Xt2 / 6 ? l2 = o2 : C(a2) > C(o2) ? l2 = c3 + Xt2 : l2 = c3);
  }
  if (l2 === 0) s2 = 0;
  else if (l2 === Math.PI / 2) r2 = 0;
  else {
    let c3 = Math.tan(l2), d2 = -1, u3 = t2 - c3 * e5, p3 = -1 / c3, m2 = -1, f3 = i2 - p3 * n2, E4 = (d2 * f3 - m2 * u3) / (c3 * m2 - p3 * d2), h3 = (u3 * p3 - f3 * c3) / (c3 * m2 - p3 * d2);
    r2 = E4 - e5, s2 = h3 - t2;
  }
  return { width: r2, height: s2 };
};
P();
P();
P();
P();
P();
P();
P();
var lc = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function kn(e5, t2, n2) {
  let i2 = n2[0];
  if (t2 != null && e5 >= t2) throw new Error(e5 + " >= " + t2);
  if (e5.slice(-1) === i2 || t2 && t2.slice(-1) === i2) throw new Error("trailing zero");
  if (t2) {
    let s2 = 0;
    for (; (e5[s2] || i2) === t2[s2]; ) s2++;
    if (s2 > 0) return t2.slice(0, s2) + kn(e5.slice(s2), t2.slice(s2), n2);
  }
  let o2 = e5 ? n2.indexOf(e5[0]) : 0, r2 = t2 != null ? n2.indexOf(t2[0]) : n2.length;
  if (r2 - o2 > 1) {
    let s2 = Math.round(0.5 * (o2 + r2));
    return n2[s2];
  } else return t2 && t2.length > 1 ? t2.slice(0, 1) : n2[o2] + kn(e5.slice(1), null, n2);
}
function cc(e5) {
  if (e5.length !== dc(e5[0])) throw new Error("invalid integer part of order key: " + e5);
}
function dc(e5) {
  if (e5 >= "a" && e5 <= "z") return e5.charCodeAt(0) - 97 + 2;
  if (e5 >= "A" && e5 <= "Z") return 90 - e5.charCodeAt(0) + 2;
  throw new Error("invalid order key head: " + e5);
}
function di(e5) {
  let t2 = dc(e5[0]);
  if (t2 > e5.length) throw new Error("invalid order key: " + e5);
  return e5.slice(0, t2);
}
function sc(e5, t2) {
  if (e5 === "A" + t2[0].repeat(26)) throw new Error("invalid order key: " + e5);
  let n2 = di(e5);
  if (e5.slice(n2.length).slice(-1) === t2[0]) throw new Error("invalid order key: " + e5);
}
function ac(e5, t2) {
  cc(e5);
  let [n2, ...i2] = e5.split(""), o2 = true;
  for (let r2 = i2.length - 1; o2 && r2 >= 0; r2--) {
    let s2 = t2.indexOf(i2[r2]) + 1;
    s2 === t2.length ? i2[r2] = t2[0] : (i2[r2] = t2[s2], o2 = false);
  }
  if (o2) {
    if (n2 === "Z") return "a" + t2[0];
    if (n2 === "z") return null;
    let r2 = String.fromCharCode(n2.charCodeAt(0) + 1);
    return r2 > "a" ? i2.push(t2[0]) : i2.pop(), r2 + i2.join("");
  } else return n2 + i2.join("");
}
function Bf(e5, t2) {
  cc(e5);
  let [n2, ...i2] = e5.split(""), o2 = true;
  for (let r2 = i2.length - 1; o2 && r2 >= 0; r2--) {
    let s2 = t2.indexOf(i2[r2]) - 1;
    s2 === -1 ? i2[r2] = t2.slice(-1) : (i2[r2] = t2[s2], o2 = false);
  }
  if (o2) {
    if (n2 === "a") return "Z" + t2.slice(-1);
    if (n2 === "A") return null;
    let r2 = String.fromCharCode(n2.charCodeAt(0) - 1);
    return r2 < "Z" ? i2.push(t2.slice(-1)) : i2.pop(), r2 + i2.join("");
  } else return n2 + i2.join("");
}
function On(e5, t2, n2 = lc) {
  if (e5 != null && sc(e5, n2), t2 != null && sc(t2, n2), e5 != null && t2 != null && e5 >= t2) throw new Error(e5 + " >= " + t2);
  if (e5 == null) {
    if (t2 == null) return "a" + n2[0];
    let l2 = di(t2), c3 = t2.slice(l2.length);
    if (l2 === "A" + n2[0].repeat(26)) return l2 + kn("", c3, n2);
    if (l2 < t2) return l2;
    let d2 = Bf(l2, n2);
    if (d2 == null) throw new Error("cannot decrement any more");
    return d2;
  }
  if (t2 == null) {
    let l2 = di(e5), c3 = e5.slice(l2.length), d2 = ac(l2, n2);
    return d2 ?? l2 + kn(c3, null, n2);
  }
  let i2 = di(e5), o2 = e5.slice(i2.length), r2 = di(t2), s2 = t2.slice(r2.length);
  if (i2 === r2) return i2 + kn(o2, s2, n2);
  let a2 = ac(i2, n2);
  if (a2 == null) throw new Error("cannot increment any more");
  return a2 < t2 ? a2 : i2 + kn(o2, null, n2);
}
function yo(e5, t2, n2, i2 = lc) {
  if (n2 === 0) return [];
  if (n2 === 1) return [On(e5, t2, i2)];
  if (t2 == null) {
    let s2 = On(e5, t2, i2), a2 = [s2];
    for (let l2 = 0; l2 < n2 - 1; l2++) s2 = On(s2, t2, i2), a2.push(s2);
    return a2;
  }
  if (e5 == null) {
    let s2 = On(e5, t2, i2), a2 = [s2];
    for (let l2 = 0; l2 < n2 - 1; l2++) s2 = On(e5, s2, i2), a2.push(s2);
    return a2.reverse(), a2;
  }
  let o2 = Math.floor(n2 / 2), r2 = On(e5, t2, i2);
  return [...yo(e5, r2, o2, i2), r2, ...yo(r2, t2, n2 - o2 - 1, i2)];
}
var Qr = class extends Error {
  code = "ELEMENT_HAS_INVALID_INDEX";
};
var Gf = (e5, { shouldThrow: t2 = false, includeBoundTextValidation: n2 = false, ignoreLogs: i2, reconciliationContext: o2 }) => {
  let r2 = [], s2 = (l2) => `${l2?.index}:${l2?.id}:${l2?.type}:${l2?.isDeleted}:${l2?.version}:${l2?.versionNonce}`, a2 = e5.map((l2) => l2.index);
  for (let [l2, c3] of a2.entries()) {
    let d2 = a2[l2 - 1], u3 = a2[l2 + 1];
    if (Jr(c3, d2, u3) || r2.push(`Fractional indices invariant has been compromised: "${s2(e5[l2 - 1])}", "${s2(e5[l2])}", "${s2(e5[l2 + 1])}"`), n2 && st2(e5[l2])) {
      let p3 = e5[l2], m2 = Z2(p3, Bo(e5));
      m2 && m2.index <= p3.index && r2.push(`Fractional indices invariant for bound elements has been compromised: "${s2(m2)}", "${s2(p3)}"`);
    }
  }
  if (r2.length) {
    let l2 = new Qr(), c3 = [];
    if (o2 && (c3.push("Additional reconciliation context:"), c3.push(o2.localElements.map((d2) => s2(d2))), c3.push(o2.remoteElements.map((d2) => s2(d2)))), i2 || console.error(r2.join(`

`), l2.stack, e5.map((d2) => s2(d2)), ...c3), t2) throw l2;
  }
};
var ui = (e5, t2) => {
  try {
    let n2 = Bo(e5), i2 = kf(e5, t2), o2 = es(e5, i2), r2 = e5.map((s2) => {
      let a2 = o2.get(s2);
      return a2 ? { ...s2, index: a2.index } : s2;
    });
    Gf(r2, { includeBoundTextValidation: false, shouldThrow: true, ignoreLogs: true });
    for (let [s2, { index: a2 }] of o2) ye2(s2, n2, { index: a2 });
  } catch {
    Of(e5);
  }
  return e5;
};
var Of = (e5) => {
  let t2 = Bo(e5), n2 = mc(e5), i2 = es(e5, n2);
  for (let [o2, { index: r2 }] of i2) ye2(o2, t2, { index: r2 });
  return e5;
};
var kf = (e5, t2) => {
  let n2 = [], i2 = 0;
  for (; i2 < e5.length; ) if (t2.has(e5[i2].id)) {
    let o2 = [i2 - 1, i2];
    for (; ++i2 < e5.length && t2.has(e5[i2].id); ) o2.push(i2);
    o2.push(i2), n2.push(o2);
  } else i2++;
  return n2;
};
var mc = (e5) => {
  let t2 = [], n2, i2, o2 = -1, r2 = 0, s2 = (c3) => {
    let d2 = e5[o2] ? e5[o2].index : void 0, u3 = e5[c3 - 1]?.index;
    return !d2 && u3 || d2 && u3 && u3 > d2 ? [u3, c3 - 1] : [d2, o2];
  }, a2 = (c3) => {
    let d2 = e5[r2] ? e5[r2].index : void 0;
    if (d2 && c3 < r2) return [d2, r2];
    let u3 = r2;
    for (; ++u3 < e5.length; ) {
      let p3 = e5[u3]?.index;
      if (!d2 && p3 || d2 && p3 && p3 > d2) return [p3, u3];
    }
    return [void 0, u3];
  }, l2 = 0;
  for (; l2 < e5.length; ) {
    let c3 = e5[l2].index;
    if ([n2, o2] = s2(l2), [i2, r2] = a2(l2), Jr(c3, n2, i2)) l2++;
    else {
      let d2 = [o2, l2];
      for (; ++l2 < e5.length; ) {
        let u3 = e5[l2].index, [p3, m2] = s2(l2), [f3, E4] = a2(l2);
        if (Jr(u3, p3, f3)) break;
        [n2, o2] = [p3, m2], [i2, r2] = [f3, E4], d2.push(l2);
      }
      d2.push(r2), t2.push(d2);
    }
  }
  return t2;
};
var Jr = (e5, t2, n2) => e5 ? t2 && n2 ? t2 < e5 && e5 < n2 : !t2 && n2 ? e5 < n2 : t2 && !n2 ? t2 < e5 : !!e5 : false;
var es = (e5, t2) => {
  let n2 = /* @__PURE__ */ new Map();
  for (let i2 of t2) {
    let o2 = i2.shift(), r2 = i2.pop(), s2 = yo(e5[o2]?.index, e5[r2]?.index, i2.length);
    for (let a2 = 0; a2 < i2.length; a2++) {
      let l2 = e5[i2[a2]];
      n2.set(l2, { index: s2[a2] });
    }
  }
  return n2;
};
P();
var Mc = gd(xc(), 1);
var Sc = (e5) => {
  let t2 = /* @__PURE__ */ new Map(), n2 = [];
  for (let i2 of e5) i2.isDeleted || (n2.push(i2), t2.set(i2.id, i2));
  return { elementsMap: t2, elements: n2 };
};
var lh = (0, Mc.default)((e5) => {
  (Xo() || D() || window?.DEBUG_FRACTIONAL_INDICES) && Gf(e5, { shouldThrow: Xo() || D(), includeBoundTextValidation: true });
}, 1e3 * 60, { leading: true, trailing: false });
var ch = (e5) => {
  let t2 = ["includeBoundTextElement", "includeElementsInFrames"], n2 = "";
  for (let i2 of t2) n2 += `${i2}:${e5[i2] ? "1" : "0"}`;
  return n2;
};
var Io2 = class {
  callbacks = /* @__PURE__ */ new Set();
  nonDeletedElements = [];
  nonDeletedElementsMap = ps(/* @__PURE__ */ new Map());
  elements = [];
  nonDeletedFramesLikes = [];
  frames = [];
  elementsMap = ps(/* @__PURE__ */ new Map());
  selectedElementsCache = { selectedElementIds: null, elements: null, cache: /* @__PURE__ */ new Map() };
  sceneNonce;
  getSceneNonce() {
    return this.sceneNonce;
  }
  getNonDeletedElementsMap() {
    return this.nonDeletedElementsMap;
  }
  getElementsIncludingDeleted() {
    return this.elements;
  }
  getElementsMapIncludingDeleted() {
    return this.elementsMap;
  }
  getNonDeletedElements() {
    return this.nonDeletedElements;
  }
  getFramesIncludingDeleted() {
    return this.frames;
  }
  constructor(t2 = null) {
    t2 && this.replaceAllElements(t2);
  }
  getSelectedElements(t2) {
    let n2 = ch(t2), i2 = t2?.elements || this.nonDeletedElements;
    if (this.selectedElementsCache.elements === i2 && this.selectedElementsCache.selectedElementIds === t2.selectedElementIds) {
      let r2 = this.selectedElementsCache.cache.get(n2);
      if (r2) return r2;
    } else t2?.elements == null && this.selectedElementsCache.cache.clear();
    let o2 = pt2(i2, { selectedElementIds: t2.selectedElementIds }, t2);
    return t2?.elements == null && (this.selectedElementsCache.selectedElementIds = t2.selectedElementIds, this.selectedElementsCache.elements = this.nonDeletedElements, this.selectedElementsCache.cache.set(n2, o2)), o2;
  }
  getNonDeletedFramesLikes() {
    return this.nonDeletedFramesLikes;
  }
  getElement(t2) {
    return this.elementsMap.get(t2) || null;
  }
  getNonDeletedElement(t2) {
    let n2 = this.getElement(t2);
    return n2 && xS(n2) ? n2 : null;
  }
  mapElements(t2) {
    let n2 = false, i2 = this.elements.map((o2) => {
      let r2 = t2(o2);
      return r2 !== o2 && (n2 = true), r2;
    });
    return n2 && this.replaceAllElements(i2), n2;
  }
  replaceAllElements(t2) {
    let n2 = Vo(t2), i2 = [];
    lh(n2), this.elements = Of(n2), this.elementsMap.clear(), this.elements.forEach((r2) => {
      V2(r2) && i2.push(r2), this.elementsMap.set(r2.id, r2);
    });
    let o2 = Sc(this.elements);
    this.nonDeletedElements = o2.elements, this.nonDeletedElementsMap = o2.elementsMap, this.frames = i2, this.nonDeletedFramesLikes = Sc(this.frames).elements, this.triggerUpdate();
  }
  triggerUpdate() {
    this.sceneNonce = hs();
    for (let t2 of Array.from(this.callbacks)) t2();
  }
  onUpdate(t2) {
    if (this.callbacks.has(t2)) throw new Error();
    return this.callbacks.add(t2), () => {
      if (!this.callbacks.has(t2)) throw new Error();
      this.callbacks.delete(t2);
    };
  }
  destroy() {
    this.elements = [], this.nonDeletedElements = [], this.nonDeletedFramesLikes = [], this.frames = [], this.elementsMap.clear(), this.selectedElementsCache.selectedElementIds = null, this.selectedElementsCache.elements = null, this.selectedElementsCache.cache.clear(), this.callbacks.clear();
  }
  insertElementAtIndex(t2, n2) {
    if (!Number.isFinite(n2) || n2 < 0) throw new Error("insertElementAtIndex can only be called with index >= 0");
    let i2 = [...this.elements.slice(0, n2), t2, ...this.elements.slice(n2)];
    ui(i2, Bo([t2])), this.replaceAllElements(i2);
  }
  insertElementsAtIndex(t2, n2) {
    if (!t2.length) return;
    if (!Number.isFinite(n2) || n2 < 0) throw new Error("insertElementAtIndex can only be called with index >= 0");
    let i2 = [...this.elements.slice(0, n2), ...t2, ...this.elements.slice(n2)];
    ui(i2, Bo(t2)), this.replaceAllElements(i2);
  }
  insertElement = (t2) => {
    let n2 = t2.frameId ? this.getElementIndex(t2.frameId) : this.elements.length;
    this.insertElementAtIndex(t2, n2);
  };
  insertElements = (t2) => {
    if (!t2.length) return;
    let n2 = t2[0]?.frameId ? this.getElementIndex(t2[0].frameId) : this.elements.length;
    this.insertElementsAtIndex(t2, n2);
  };
  getElementIndex(t2) {
    return this.elements.findIndex((n2) => n2.id === t2);
  }
  getContainerElement = (t2) => t2 && t2.containerId && this.getElement(t2.containerId) || null;
  getElementsFromId = (t2) => {
    let n2 = this.getNonDeletedElementsMap(), i2 = n2.get(t2);
    return i2 ? [i2] : Ae2(n2, t2);
  };
  mutateElement(t2, n2, i2 = { informMutation: true, isDragging: false }) {
    let o2 = this.getNonDeletedElementsMap(), { version: r2 } = t2, { version: s2 } = ye2(t2, o2, n2, i2);
    return this.elementsMap.has(t2.id) && r2 !== s2 && i2.informMutation && this.triggerUpdate(), t2;
  }
};
P();
P();
P();
P();
P();
var nt2 = (e5, { x: t2, y: n2, strokeColor: i2 = rr.strokeColor, backgroundColor: o2 = rr.backgroundColor, fillStyle: r2 = rr.fillStyle, strokeWidth: s2 = rr.strokeWidth, strokeStyle: a2 = rr.strokeStyle, roughness: l2 = rr.roughness, opacity: c3 = rr.opacity, width: d2 = 0, height: u3 = 0, angle: p3 = 0, groupIds: m2 = [], frameId: f3 = null, index: E4 = null, roundness: h3 = null, boundElements: g2 = null, link: x3 = null, locked: y4 = rr.locked, ...b2 }) => ((t2 < -1e6 || t2 > 1e6 || n2 < -1e6 || n2 > 1e6 || d2 < -1e6 || d2 > 1e6 || u3 < -1e6 || u3 > 1e6) && console.error("New element size or position is too large", { x: t2, y: n2, width: d2, height: u3, points: b2.points }), { id: b2.id || gs(), type: e5, x: t2, y: n2, width: d2, height: u3, angle: p3, strokeColor: i2, backgroundColor: o2, fillStyle: r2, strokeWidth: s2, strokeStyle: a2, roughness: l2, opacity: c3, groupIds: m2, frameId: f3, index: E4, roundness: h3, seed: b2.seed ?? hs(), version: b2.version || 1, versionNonce: b2.versionNonce ?? 0, isDeleted: false, boundElements: g2, updated: Ko(), link: x3, locked: y4, customData: b2.customData });
var ns2 = (e5) => nt2(e5.type, e5);
var Cc = (e5, t2) => ({ x: e5.textAlign === "center" ? t2.width / 2 : e5.textAlign === "right" ? t2.width : 0, y: e5.verticalAlign === "middle" ? t2.height / 2 : 0 });
var Bc = (e5) => {
  let t2 = e5.fontFamily || rn2, n2 = e5.fontSize || nn2, i2 = e5.lineHeight || gr(t2), o2 = tr2(e5.text), r2 = Qe2(o2, co({ fontFamily: t2, fontSize: n2 }), i2), s2 = e5.textAlign || on2, a2 = e5.verticalAlign || sn, l2 = Cc({ textAlign: s2, verticalAlign: a2 }, r2), c3 = { ...nt2("text", e5), text: o2, fontSize: n2, fontFamily: t2, textAlign: s2, verticalAlign: a2, x: e5.x - l2.x, y: e5.y - l2.y, width: r2.width, height: r2.height, containerId: e5.containerId || null, originalText: e5.originalText ?? o2, autoResize: e5.autoResize ?? true, lineHeight: i2 };
  return Me2(c3, {});
};
var Mh = (e5, t2, n2) => {
  let { width: i2, height: o2 } = Qe2(n2, co(e5), e5.lineHeight);
  e5.autoResize || (i2 = e5.width);
  let { textAlign: r2, verticalAlign: s2 } = e5, a2, l2;
  if (r2 === "center" && s2 === Zn.MIDDLE && !e5.containerId && e5.autoResize) {
    let c3 = Qe2(e5.text, co(e5), e5.lineHeight), d2 = Cc(e5, { width: i2 - c3.width, height: o2 - c3.height });
    a2 = e5.x - d2.x, l2 = e5.y - d2.y;
  } else {
    let [c3, d2, u3, p3] = H(e5, t2), [m2, f3, E4, h3] = Nt(e5, i2, o2, false), g2 = (c3 - m2) / 2, x3 = (d2 - f3) / 2, y4 = (u3 - E4) / 2, b2 = (p3 - h3) / 2;
    [a2, l2] = Th({ s: true, e: r2 === "center" || r2 === "left", w: r2 === "center" || r2 === "right" }, e5.x, e5.y, e5.angle, g2, x3, y4, b2);
  }
  return { width: i2, height: o2, x: Number.isFinite(a2) ? a2 : e5.x, y: Number.isFinite(l2) ? l2 : e5.y };
};
var Th = (e5, t2, n2, i2, o2, r2, s2, a2) => {
  let l2 = Math.cos(i2), c3 = Math.sin(i2);
  return e5.e && e5.w ? t2 += o2 + s2 : e5.e ? (t2 += o2 * (1 + l2), n2 += o2 * c3, t2 += s2 * (1 - l2), n2 += s2 * -c3) : e5.w && (t2 += o2 * (1 - l2), n2 += o2 * -c3, t2 += s2 * (1 + l2), n2 += s2 * c3), e5.n && e5.s ? n2 += r2 + a2 : e5.n ? (t2 += r2 * c3, n2 += r2 * (1 - l2), t2 += a2 * -c3, n2 += a2 * (1 + l2)) : e5.s && (t2 += r2 * -c3, n2 += r2 * (1 + l2), t2 += a2 * c3, n2 += a2 * (1 - l2)), [t2, n2];
};
var OP = (e5, t2, n2, i2 = e5.text) => {
  if (e5.isDeleted) return;
  (t2 || !e5.autoResize) && (i2 = Pt3(i2, co(e5), t2 ? Je(t2, e5) : e5.width));
  let o2 = Mh(e5, n2, i2);
  return { text: i2, ...o2 };
};
var kP = (e5) => ({ ...nt2(e5.type, e5), points: e5.points || [], pressures: e5.pressures || [], simulatePressure: e5.simulatePressure, lastCommittedPoint: null });
var RP = (e5) => {
  let t2 = { ...nt2(e5.type, e5), points: e5.points || [], lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: null };
  return ln(t2) ? { ...t2, polygon: e5.polygon ?? false } : t2;
};
var Gc = (e5) => e5.elbowed ? { ...nt2(e5.type, e5), points: e5.points || [], lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: e5.startArrowhead || null, endArrowhead: e5.endArrowhead || null, elbowed: true, fixedSegments: e5.fixedSegments || [], startIsSpecial: false, endIsSpecial: false } : { ...nt2(e5.type, e5), points: e5.points || [], lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: e5.startArrowhead || null, endArrowhead: e5.endArrowhead || null, elbowed: false };
var FP = (e5) => ({ ...nt2("image", e5), strokeColor: "transparent", status: e5.status ?? "pending", fileId: e5.fileId ?? null, scale: e5.scale ?? [1, 1], crop: e5.crop ?? null });
P();
P();
P();
P();
P();
P();
P();
var uE = (e5) => e5.filter((t2) => !t2.isDeleted);
var xS = (e5) => !e5.isDeleted;
var ys = (e5) => uE(e5).map((t2) => Ko2(t2.type) ? { ...t2, lastCommittedPoint: null } : t2);
var yS = (e5) => ys(e5);

// src/geometry.js
import { PathBuilder } from "gpui-kit";

// node_modules/perfect-freehand/dist/esm/index.mjs
var { PI: e4 } = Math;
var t = e4 + 1e-4;
var n = 0.5;
var r = [1, 1];
function i(e5, t2, n2, r2 = (e6) => e6) {
  return e5 * r2(0.5 - t2 * (0.5 - n2));
}
var { min: a } = Math;
function o(e5, t2, n2) {
  let r2 = a(1, t2 / n2);
  return a(1, e5 + (a(1, 1 - r2) - e5) * (r2 * 0.275));
}
function s(e5) {
  return [-e5[0], -e5[1]];
}
function c2(e5, t2) {
  return [e5[0] + t2[0], e5[1] + t2[1]];
}
function l(e5, t2, n2) {
  return e5[0] = t2[0] + n2[0], e5[1] = t2[1] + n2[1], e5;
}
function u2(e5, t2) {
  return [e5[0] - t2[0], e5[1] - t2[1]];
}
function d(e5, t2, n2) {
  return e5[0] = t2[0] - n2[0], e5[1] = t2[1] - n2[1], e5;
}
function f2(e5, t2) {
  return [e5[0] * t2, e5[1] * t2];
}
function p2(e5, t2, n2) {
  return e5[0] = t2[0] * n2, e5[1] = t2[1] * n2, e5;
}
function m(e5, t2) {
  return [e5[0] / t2, e5[1] / t2];
}
function h2(e5) {
  return [e5[1], -e5[0]];
}
function g(e5, t2) {
  let n2 = t2[0];
  return e5[0] = t2[1], e5[1] = -n2, e5;
}
function ee2(e5, t2) {
  return e5[0] * t2[0] + e5[1] * t2[1];
}
function _3(e5, t2) {
  return e5[0] === t2[0] && e5[1] === t2[1];
}
function v2(e5) {
  return Math.hypot(e5[0], e5[1]);
}
function y3(e5, t2) {
  let n2 = e5[0] - t2[0], r2 = e5[1] - t2[1];
  return n2 * n2 + r2 * r2;
}
function b(e5) {
  return m(e5, v2(e5));
}
function x2(e5, t2) {
  return Math.hypot(e5[1] - t2[1], e5[0] - t2[0]);
}
function S2(e5, t2, n2) {
  let r2 = Math.sin(n2), i2 = Math.cos(n2), a2 = e5[0] - t2[0], o2 = e5[1] - t2[1], s2 = a2 * i2 - o2 * r2, c3 = a2 * r2 + o2 * i2;
  return [s2 + t2[0], c3 + t2[1]];
}
function C3(e5, t2, n2, r2) {
  let i2 = Math.sin(r2), a2 = Math.cos(r2), o2 = t2[0] - n2[0], s2 = t2[1] - n2[1], c3 = o2 * a2 - s2 * i2, l2 = o2 * i2 + s2 * a2;
  return e5[0] = c3 + n2[0], e5[1] = l2 + n2[1], e5;
}
function w3(e5, t2, n2) {
  return c2(e5, f2(u2(t2, e5), n2));
}
function te(e5, t2, n2, r2) {
  let i2 = n2[0] - t2[0], a2 = n2[1] - t2[1];
  return e5[0] = t2[0] + i2 * r2, e5[1] = t2[1] + a2 * r2, e5;
}
function T3(e5, t2, n2) {
  return c2(e5, f2(t2, n2));
}
var E3 = [0, 0];
var D3 = [0, 0];
var O3 = [0, 0];
function k2(e5, n2) {
  let r2 = T3(e5, b(h2(u2(e5, c2(e5, [1, 1])))), -n2), i2 = [], a2 = 1 / 13;
  for (let n3 = a2; n3 <= 1; n3 += a2) i2.push(S2(r2, e5, t * 2 * n3));
  return i2;
}
function A3(e5, n2, r2) {
  let i2 = [], a2 = 1 / r2;
  for (let r3 = a2; r3 <= 1; r3 += a2) i2.push(S2(n2, e5, t * r3));
  return i2;
}
function j3(e5, t2, n2) {
  let r2 = u2(t2, n2), i2 = f2(r2, 0.5), a2 = f2(r2, 0.51);
  return [u2(e5, i2), u2(e5, a2), c2(e5, a2), c2(e5, i2)];
}
function M3(e5, n2, r2, i2) {
  let a2 = [], o2 = T3(e5, n2, r2), s2 = 1 / i2;
  for (let n3 = s2; n3 < 1; n3 += s2) a2.push(S2(o2, e5, t * 3 * n3));
  return a2;
}
function ne3(e5, t2, n2) {
  return [c2(e5, f2(t2, n2)), c2(e5, f2(t2, n2 * 0.99)), u2(e5, f2(t2, n2 * 0.99)), u2(e5, f2(t2, n2))];
}
function N2(e5, t2, n2) {
  return e5 === false || e5 === void 0 ? 0 : e5 === true ? Math.max(t2, n2) : e5;
}
function re(e5, t2, n2) {
  return e5.slice(0, 10).reduce((e6, r2) => {
    let i2 = r2.pressure;
    return t2 && (i2 = o(e6, r2.distance, n2)), (e6 + i2) / 2;
  }, e5[0].pressure);
}
function P2(e5, n2 = {}) {
  let { size: r2 = 16, smoothing: a2 = 0.5, thinning: f3 = 0.5, simulatePressure: m2 = true, easing: _4 = (e6) => e6, start: v3 = {}, end: b2 = {}, last: x3 = false } = n2, { cap: S3 = true, easing: w4 = (e6) => e6 * (2 - e6) } = v3, { cap: T4 = true, easing: P3 = (e6) => --e6 * e6 * e6 + 1 } = b2;
  if (e5.length === 0 || r2 <= 0) return [];
  let F4 = e5[e5.length - 1].runningLength, I4 = N2(v3.taper, r2, F4), L4 = N2(b2.taper, r2, F4), R2 = (r2 * a2) ** 2, z3 = [], B2 = [], V3 = re(e5, m2, r2), H2 = i(r2, f3, e5[e5.length - 1].pressure, _4), U3, W = e5[0].vector, G2 = e5[0].point, K2 = G2, q3 = G2, J3 = K2, Y4 = false;
  for (let n3 = 0; n3 < e5.length; n3++) {
    let { pressure: a3 } = e5[n3], { point: s2, vector: h3, distance: v4, runningLength: b3 } = e5[n3], x4 = n3 === e5.length - 1;
    if (!x4 && F4 - b3 < 3) continue;
    f3 ? (m2 && (a3 = o(V3, v4, r2)), H2 = i(r2, f3, a3, _4)) : H2 = r2 / 2, U3 === void 0 && (U3 = H2);
    let S4 = b3 < I4 ? w4(b3 / I4) : 1, T5 = F4 - b3 < L4 ? P3((F4 - b3) / L4) : 1;
    H2 = Math.max(0.01, H2 * Math.min(S4, T5));
    let k3 = (x4 ? e5[n3] : e5[n3 + 1]).vector, A4 = x4 ? 1 : ee2(h3, k3), j4 = ee2(h3, W) < 0 && !Y4, M4 = A4 !== null && A4 < 0;
    if (j4 || M4) {
      g(E3, W), p2(E3, E3, H2);
      for (let e6 = 0; e6 <= 1; e6 += 0.07692307692307693) d(D3, s2, E3), C3(D3, D3, s2, t * e6), q3 = [D3[0], D3[1]], z3.push(q3), l(O3, s2, E3), C3(O3, O3, s2, t * -e6), J3 = [O3[0], O3[1]], B2.push(J3);
      G2 = q3, K2 = J3, M4 && (Y4 = true);
      continue;
    }
    if (Y4 = false, x4) {
      g(E3, h3), p2(E3, E3, H2), z3.push(u2(s2, E3)), B2.push(c2(s2, E3));
      continue;
    }
    te(E3, k3, h3, A4), g(E3, E3), p2(E3, E3, H2), d(D3, s2, E3), q3 = [D3[0], D3[1]], (n3 <= 1 || y3(G2, q3) > R2) && (z3.push(q3), G2 = q3), l(O3, s2, E3), J3 = [O3[0], O3[1]], (n3 <= 1 || y3(K2, J3) > R2) && (B2.push(J3), K2 = J3), V3 = a3, W = h3;
  }
  let X3 = [e5[0].point[0], e5[0].point[1]], Z3 = e5.length > 1 ? [e5[e5.length - 1].point[0], e5[e5.length - 1].point[1]] : c2(e5[0].point, [1, 1]), Q3 = [], $3 = [];
  if (e5.length === 1) {
    if (!(I4 || L4) || x3) return k2(X3, U3 || H2);
  } else {
    I4 || L4 && e5.length === 1 || (S3 ? Q3.push(...A3(X3, B2[0], 13)) : Q3.push(...j3(X3, z3[0], B2[0])));
    let t2 = h2(s(e5[e5.length - 1].vector));
    L4 || I4 && e5.length === 1 ? $3.push(Z3) : T4 ? $3.push(...M3(Z3, t2, H2, 29)) : $3.push(...ne3(Z3, t2, H2));
  }
  return z3.concat($3, B2.reverse(), Q3);
}
var F3 = [0, 0];
function I3(e5) {
  return e5 != null && e5 >= 0;
}
function L3(e5, t2 = {}) {
  let { streamline: i2 = 0.5, size: a2 = 16, last: o2 = false } = t2;
  if (e5.length === 0) return [];
  let s2 = 0.15 + (1 - i2) * 0.85, l2 = Array.isArray(e5[0]) ? e5 : e5.map(({ x: e6, y: t3, pressure: r2 = n }) => [e6, t3, r2]);
  if (l2.length === 2) {
    let e6 = l2[1];
    l2 = l2.slice(0, -1);
    for (let t3 = 1; t3 < 5; t3++) l2.push(w3(l2[0], e6, t3 / 4));
  }
  l2.length === 1 && (l2 = [...l2, [...c2(l2[0], r), ...l2[0].slice(2)]]);
  let u3 = [{ point: [l2[0][0], l2[0][1]], pressure: I3(l2[0][2]) ? l2[0][2] : 0.25, vector: [...r], distance: 0, runningLength: 0 }], f3 = false, p3 = 0, m2 = u3[0], h3 = l2.length - 1;
  for (let e6 = 1; e6 < l2.length; e6++) {
    let t3 = o2 && e6 === h3 ? [l2[e6][0], l2[e6][1]] : w3(m2.point, l2[e6], s2);
    if (_3(m2.point, t3)) continue;
    let r2 = x2(t3, m2.point);
    if (p3 += r2, e6 < h3 && !f3) {
      if (p3 < a2) continue;
      f3 = true;
    }
    d(F3, m2.point, t3), m2 = { point: t3, pressure: I3(l2[e6][2]) ? l2[e6][2] : n, vector: b(F3), distance: r2, runningLength: p3 }, u3.push(m2);
  }
  return u3[0].vector = u3[1]?.vector || [0, 0], u3;
}

// src/board.js
var IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "tif", "tiff", "bmp", "svg"];
var VIDEO_EXTS = ["mp4", "mov", "m4v", "webm", "mkv"];
var BOARD_EXTS = [".board", ".excalidraw"];
var dirname = (p3) => p3.slice(0, p3.lastIndexOf("/")) || "/";
var basename = (p3) => p3.slice(p3.lastIndexOf("/") + 1);
var extOf = (p3) => {
  const b2 = basename(p3);
  const i2 = b2.lastIndexOf(".");
  return i2 > 0 ? b2.slice(i2 + 1).toLowerCase() : "";
};
var kindOf = (p3) => {
  const e5 = extOf(p3);
  return e5 === "gif" ? "gif" : IMAGE_EXTS.includes(e5) ? "image" : VIDEO_EXTS.includes(e5) ? "video" : null;
};
function openableMedia(path, kind) {
  if (typeof path !== "string" || kind !== "gif" && kind !== "video") return false;
  return kindOf(path) === kind;
}
var makeId = () => Array.from({ length: 8 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");
var assetsDirFor = (boardFile) => `${boardFile.replace(/\.[^./]+$/, "")}.assets`;
var relAssetFor = (boardFile, name) => `${basename(assetsDirFor(boardFile))}/${name}`;
function absAsset(boardFile, rel) {
  if (typeof rel !== "string" || !rel || rel.includes("\0") || rel.includes("\\") || rel.startsWith("/")) return null;
  const parts = rel.split("/");
  if (parts.length !== 2 || parts[0] !== basename(assetsDirFor(boardFile)) || !parts[1] || parts.some((x3) => x3 === ".." || x3 === "." || x3 === "")) return null;
  return `${dirname(boardFile)}/${rel}`;
}
var Generation = class {
  constructor() {
    this.n = 0;
  }
  next() {
    return ++this.n;
  }
  /** Invalidates every ticket taken so far. */
  bump() {
    this.n++;
  }
  current(ticket) {
    return ticket === this.n;
  }
};
var canLeaveBoard = ({ dirty, saved, saveError = null }) => !saveError && (!dirty || saved === true);
var mergeFiles = (local, external) => ({ ...local ?? {}, ...external ?? {} });
function indexGroups(elements) {
  const index = /* @__PURE__ */ new Map();
  for (const el of elements) for (const g2 of el.groupIds ?? []) {
    if (!index.has(g2)) index.set(g2, []);
    index.get(g2).push(el.id);
  }
  return index;
}
var TIERS = [256, 1024, 0];
var MAKE_COPY = [
  'px=$(sips -g pixelWidth -g pixelHeight "$1" 2>/dev/null); w=$(printf "%s\\n" "$px" | sed -n "s/.*pixelWidth: *//p"); h=$(printf "%s\\n" "$px" | sed -n "s/.*pixelHeight: *//p")',
  '[ "$w" -gt 0 ] 2>/dev/null && [ "$h" -gt 0 ] 2>/dev/null || exit 1',
  'long=$w; [ "$h" -gt "$long" ] && long=$h',
  'if [ "$3" -gt 0 ] && [ "$long" -gt "$3" ]; then set -- "$1" "$2" -Z "$3"; else set -- "$1" "$2"; fi',
  'src=$1; out=$2; shift 2; sips "$@" -s format png "$src" --out "$out.part.png" >/dev/null || exit 1; mv -f "$out.part.png" "$out" || exit 1',
  'echo "$w $h"'
].join("\n");
var rank = (t2) => t2 === 0 ? Infinity : t2;
function tierFor(needPx, max = 0) {
  const t2 = TIERS.find((side) => side !== 0 && needPx <= side) ?? 0;
  return rank(t2) <= rank(max) ? t2 : max;
}
function pickTier(want, built) {
  const have = [...built];
  if (!have.length) return null;
  if (have.includes(want)) return want;
  const bigger = have.filter((t2) => rank(t2) > rank(want)).sort((a2, b2) => rank(a2) - rank(b2));
  return bigger.length ? bigger[0] : have.sort((a2, b2) => rank(b2) - rank(a2))[0];
}
function tierFile(key, tier) {
  return tier === 1024 ? `${key}.png` : tier === 0 ? `${key}.full.png` : `${key}.t${tier}.png`;
}
function cacheKey(boardFile, fileId, size, mtime) {
  let h3 = 5381;
  for (const c3 of boardFile) h3 = (h3 * 33 ^ c3.charCodeAt(0)) >>> 0;
  return `${h3.toString(36)}_${fileId.replace(/[^A-Za-z0-9_-]/g, "_")}_${size}_${mtime}`;
}
function animAttempt(out, stamp) {
  if (typeof stamp !== "string" || !/^[A-Za-z0-9_-]+$/.test(stamp)) throw new Error("anim attempt needs a unique stamp");
  const tmp = `${out}.${stamp}.part.gif`;
  const fail = `${out}.${stamp}.fail`;
  return { tmp, fail, clear: [`${out}.fail`, `${out}.part.gif`, fail, tmp] };
}
function ffmpegAnimArgs(bin, src, vf, tmp, out, fail) {
  const script = '( "$1" -v error -y -t 60 -i "$2" -an -vf "$3" -loop 0 "$4" && mv "$4" "$5" || { rm -f "$4"; touch "$6"; } ) >/dev/null 2>&1 &';
  return ["sh", ["-c", script, "sh", bin, src, vf, tmp, out, fail]];
}
function applyDerivedFiles(scene, history, pending) {
  const ready = [];
  for (const item of pending) {
    const el = scene.getElement(item.elementId);
    if (!el || el.isDeleted) continue;
    ready.push(item);
  }
  if (!ready.length) return 0;
  history.record(scene.getElementsIncludingDeleted());
  let n2 = 0;
  for (const item of ready) {
    const el = scene.getElement(item.elementId);
    if (!el || el.isDeleted) continue;
    scene.mutateElement(el, { fileId: item.fileId });
    n2++;
  }
  return n2;
}
var STICKY_COLORS = ["#ffe58a", "#fbcfe8", "#bbf7d0", "#bfdbfe"];
var STICKY_INK = "#1e1e1e";
var STICKY_FONT = 22;
var STICKY_LINE = 1.3;
var STICKY_PAD = 16;
var STICKY_MIN_H = 200;
var STICKY_W = 200;
var isWide = (c3) => c3 >= 4352 && c3 <= 4447 || c3 >= 11904 && c3 <= 42191 || c3 >= 44032 && c3 <= 55203 || c3 >= 63744 && c3 <= 64255 || c3 >= 65072 && c3 <= 65103 || c3 >= 65280 && c3 <= 65376 || c3 >= 65504 && c3 <= 65510 || c3 >= 127744 && c3 <= 129791;
var lineWidth = (text, size) => {
  let w4 = 0;
  for (const ch2 of text) {
    const c3 = ch2.codePointAt(0);
    w4 += (isWide(c3) ? 1 : c3 === 32 ? 0.3 : 0.55) * size;
  }
  return w4;
};
function wrapText(text, maxWidth, size = STICKY_FONT) {
  const out = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const word of para.split(/(?<= )/)) {
      if (lineWidth((line + word).trimEnd(), size) <= maxWidth) {
        line += word;
        continue;
      }
      if (line) {
        out.push(line.trimEnd());
        line = "";
      }
      let rest = word;
      while (lineWidth(rest.trimEnd(), size) > maxWidth && rest.length > 1) {
        let n2 = rest.length - 1;
        while (n2 > 1 && lineWidth(rest.slice(0, n2), size) > maxWidth) n2--;
        out.push(rest.slice(0, n2));
        rest = rest.slice(n2);
      }
      line = rest;
    }
    out.push(line.trimEnd());
  }
  return out;
}
var stickyLines = (el) => wrapText(el.customData?.text ?? "", el.width - 2 * STICKY_PAD);
var stickyHeight = (el) => Math.max(STICKY_MIN_H, Math.ceil(stickyLines(el).length * STICKY_FONT * STICKY_LINE) + 2 * STICKY_PAD);
var isSticky = (el) => !!el?.customData?.sticky;
function newSticky({ x: x3, y: y4, color = STICKY_COLORS[0], text = "", width = STICKY_W }) {
  const el = ns2({
    type: "rectangle",
    x: x3,
    y: y4,
    width,
    height: STICKY_MIN_H,
    strokeColor: "transparent",
    backgroundColor: color,
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    roundness: { type: 3, value: 8 },
    customData: { sticky: true, text }
  });
  el.height = stickyHeight(el);
  return el;
}
function newImage({ x: x3, y: y4, width, height, fileId, path, name, kind, mimeType }) {
  const el = FP({
    type: "image",
    x: x3,
    y: y4,
    width,
    height,
    fileId,
    status: "saved",
    scale: [1, 1],
    opacity: 100,
    roundness: null,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0
  });
  el.customData = { name, kind };
  return { element: el, file: { id: fileId, mimeType, created: Date.now(), path, name, kind } };
}
function fitSize(w4, h3, longSide = 480) {
  const k3 = Math.min(1, longSide / Math.max(w4, h3, 1));
  return { width: Math.max(8, Math.round(w4 * k3)), height: Math.max(8, Math.round(h3 * k3)) };
}
var MIN_IMAGE = 24;
function reorder(elements, ids, front) {
  const moved = elements.filter((e5) => ids.has(e5.id));
  const rest = elements.filter((e5) => !ids.has(e5.id));
  return front ? [...rest, ...moved] : [...moved, ...rest];
}
var isMedia = (el) => el?.type === "image" && (el.customData?.kind === "gif" || el.customData?.kind === "video");
function mediaLabel(kind, seconds) {
  if (kind === "gif") return "GIF";
  if (typeof seconds !== "number" || !(seconds >= 0)) return "VIDEO";
  const t2 = Math.round(seconds), h3 = Math.floor(t2 / 3600), m2 = Math.floor(t2 % 3600 / 60), sec = String(t2 % 60).padStart(2, "0");
  return h3 ? `${h3}:${String(m2).padStart(2, "0")}:${sec}` : `${m2}:${sec}`;
}
var PEN_SIZES = [["S", 2], ["M", 3.5], ["L", 5], ["XL", 10]];
var MARKER_WIDTH = { 2: 20.16, 3.5: 26.88, 5: 40.32, 10: 49.28 };
var MARKER_UNDER = 0.82;
var PALETTE = [
  ["black", null, "#fddd00"],
  ["grey", "#9fa8b2", "#cbe7f1"],
  ["light-violet", "#e085f4", "#ff88ff"],
  ["violet", "#ae3ec9", "#c77cff"],
  ["blue", "#4465e9", "#10acff"],
  ["light-blue", "#4ba1f1", "#00f4ff"],
  ["yellow", "#f1ac4b", "#fddd00"],
  ["orange", "#e16919", "#ffa500"],
  ["green", "#099268", "#00ffc8"],
  ["light-green", "#4cb05e", "#65f641"],
  ["light-red", "#f87777", "#ff7fa3"],
  ["red", "#e03131", "#ff636e"],
  ["white", "#ffffff", "#ffffff"]
];
var MARKER_INK = "#f1ac4b";
var neonFor = (ink) => PALETTE.find((p3) => p3[1] === ink)?.[2] ?? "#fddd00";
var OPACITIES = [0.1, 0.25, 0.5, 0.75, 1];
var FONT_SIZES = [["S", 18], ["M", 24], ["L", 36], ["XL", 44]];
function fillPatch(kind, color) {
  if (kind === "none") return { backgroundColor: "transparent", fillStyle: "solid" };
  if (kind === "semi") return { backgroundColor: `${color.slice(0, 7)}40`, fillStyle: "solid" };
  if (kind === "pattern") return { backgroundColor: color, fillStyle: "hachure" };
  return { backgroundColor: color, fillStyle: "solid" };
}
function fillKindOf(el) {
  if (!el.backgroundColor || el.backgroundColor === "transparent") return "none";
  if (el.fillStyle === "hachure" || el.fillStyle === "cross-hatch") return "pattern";
  return el.backgroundColor.length === 9 ? "semi" : "solid";
}
function dashKindOf(el) {
  return el.strokeStyle !== "solid" ? el.strokeStyle : el.roughness > 0 ? "draw" : "solid";
}
var SHAPE_TYPES = /* @__PURE__ */ new Set(["rectangle", "diamond", "ellipse"]);
function elementStyleChanges(el, prop, value, boundText) {
  if (!el || el.type === "image" || isSticky(el)) return false;
  const text = el.type === "text" ? el : boundText || null;
  if (prop === "color") {
    const c3 = isMarker(el) ? neonFor(value) : value;
    if (el.strokeColor !== c3) return true;
    if (SHAPE_TYPES.has(el.type)) {
      const patch = fillPatch(fillKindOf(el), value);
      if (el.backgroundColor !== patch.backgroundColor || el.fillStyle !== patch.fillStyle) return true;
    }
    if (text && text !== el && text.strokeColor !== c3) return true;
    return false;
  }
  if (prop === "opacity") return el.opacity !== value;
  if (prop === "fill") {
    if (!SHAPE_TYPES.has(el.type)) return false;
    const patch = fillPatch(value, el.strokeColor);
    return el.backgroundColor !== patch.backgroundColor || el.fillStyle !== patch.fillStyle;
  }
  if (prop === "dash") {
    const strokeStyle = value === "draw" ? "solid" : value;
    const roughness = value === "draw" ? 1 : 0;
    return el.strokeStyle !== strokeStyle || el.roughness !== roughness;
  }
  if (prop === "size") {
    if (text && text.fontSize !== value.font) return true;
    if (el.type !== "text" && el.strokeWidth !== value.stroke) return true;
    return false;
  }
  if (prop === "fontFamily") return !!text && text.fontFamily !== value;
  if (prop === "textAlign") return !!text && text.textAlign !== value;
  if (prop === "arrowStart") return el.type === "arrow" && el.startArrowhead !== value;
  if (prop === "arrowEnd") return el.type === "arrow" && el.endArrowhead !== value;
  return false;
}
var isMarker = (el) => !!el?.customData?.marker;
var strokeDiameter = (el) => isMarker(el) ? MARKER_WIDTH[el.strokeWidth] ?? el.strokeWidth * 6 : el.strokeWidth + 1;
var easeOutSine = (t2) => Math.sin(t2 * Math.PI / 2);
var penStreamline = (size) => 0.64 + Math.min(1, Math.max(0, (size - 9) / 7)) * 0.1;
function penPolygons(el) {
  const raw = el.points.map(([x3, y4]) => [x3, y4]);
  if (raw.length === 1) raw.push([raw[0][0] + 0.01, raw[0][1]]);
  const size = strokeDiameter(el);
  const opts = { size, thinning: 0.5, smoothing: 0.62, streamline: penStreamline(size), easing: easeOutSine, simulatePressure: true, last: true };
  const sp = L3(raw, opts);
  const runs = [];
  let start = 0, turn = 0;
  for (let i2 = 1; i2 < sp.length; i2++) {
    if (i2 >= 2) {
      const a2 = Math.atan2(sp[i2 - 1].point[1] - sp[i2 - 2].point[1], sp[i2 - 1].point[0] - sp[i2 - 2].point[0]);
      const b2 = Math.atan2(sp[i2].point[1] - sp[i2 - 1].point[1], sp[i2].point[0] - sp[i2 - 1].point[0]);
      let d2 = Math.abs(b2 - a2);
      if (d2 > Math.PI) d2 = 2 * Math.PI - d2;
      turn += d2;
    }
    if (i2 - start >= 24 || turn > 2 * Math.PI / 3) {
      runs.push([start, i2]);
      start = Math.max(0, i2 - 1);
      turn = 0;
    }
  }
  if (start < sp.length - 1 || !runs.length) runs.push([start, Math.max(start + 1, sp.length - 1)]);
  const polys = runs.map(([a2, b2]) => P2(sp.slice(a2, Math.min(b2, sp.length - 1) + 1), { ...opts, last: b2 >= sp.length - 1 }));
  for (const [a2] of runs.slice(1)) {
    const [x3, y4] = sp[a2 + 1]?.point ?? sp[a2].point;
    const r2 = size * easeOutSine(0.5 - 0.5 * (0.5 - (sp[a2 + 1] ?? sp[a2]).pressure)) * 0.5;
    polys.push(Array.from({ length: 16 }, (_4, k3) => [x3 + r2 * Math.cos(k3 / 16 * 2 * Math.PI), y4 + r2 * Math.sin(k3 / 16 * 2 * Math.PI)]));
  }
  return polys;
}
function mixHex(fg, bg, a2) {
  const rgb = (h3) => [1, 3, 5].map((i2) => parseInt(h3.slice(i2, i2 + 2), 16));
  const [f3, g2] = [rgb(fg), rgb(bg)];
  return `#${f3.map((c3, i2) => Math.round(c3 * a2 + g2[i2] * (1 - a2)).toString(16).padStart(2, "0")).join("")}`;
}
function markerPoints(el) {
  const raw = el.points.map(([x3, y4]) => [x3, y4]);
  if (raw.length === 1) raw.push([raw[0][0] + 0.01, raw[0][1]]);
  return L3(raw, { size: 1 + strokeDiameter(el), streamline: 0.5, smoothing: 0.5, simulatePressure: false, last: true }).map((p3) => p3.point);
}
function freedrawBounds(el) {
  const xs = el.points.map((p3) => p3[0]), ys2 = el.points.map((p3) => p3[1]);
  const r2 = strokeDiameter(el) / 2;
  const x1 = el.x + Math.min(...xs) - r2, y1 = el.y + Math.min(...ys2) - r2;
  const x22 = el.x + Math.max(...xs) + r2, y22 = el.y + Math.max(...ys2) + r2;
  const angle = el.angle || 0;
  if (!angle || !el.points.length) return [x1, y1, x22, y22];
  const c3 = elementCenter(el);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x3, y4] of [[x1, y1], [x22, y1], [x22, y22], [x1, y22]]) {
    const p3 = rotateAbout({ x: x3, y: y4 }, c3, angle);
    if (p3.x < minX) minX = p3.x;
    if (p3.y < minY) minY = p3.y;
    if (p3.x > maxX) maxX = p3.x;
    if (p3.y > maxY) maxY = p3.y;
  }
  return [minX, minY, maxX, maxY];
}
function bindingsForGesture(el, ids) {
  if (el?.type !== "arrow" && el?.type !== "line" || !el.startBinding && !el.endBinding) return null;
  const keep = (b2) => b2 && ids.has(b2.elementId) ? "keep" : null;
  return [keep(el.startBinding), keep(el.endBinding)];
}
var HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
var handlePoint = (box, h3) => ({
  x: h3.includes("w") ? box.x : h3.includes("e") ? box.x + box.width : box.x + box.width / 2,
  y: h3.includes("n") ? box.y : h3.includes("s") ? box.y + box.height : box.y + box.height / 2
});
var canRotate = (el) => el.type !== "image" && el.type !== "text" && !isSticky(el);
function axisAlignedAngle(angle) {
  const turns = (angle || 0) / (Math.PI / 2);
  return Math.abs(turns - Math.round(turns)) < 1e-6;
}
function resizeKeepsAspect(lock, shift, elements) {
  if (lock || shift) return true;
  for (const el of elements) if (el && canRotate(el) && el.angle && !axisAlignedAngle(el.angle)) return true;
  return false;
}
function resizeHandleBox(box, handle, p3, lock, min = MIN_IMAGE) {
  const right = box.x + box.width, bottom = box.y + box.height;
  let x1 = box.x, y1 = box.y, x22 = right, y22 = bottom;
  if (handle.includes("w")) x1 = Math.min(p3.x, right - min);
  if (handle.includes("e")) x22 = Math.max(p3.x, box.x + min);
  if (handle.includes("n")) y1 = Math.min(p3.y, bottom - min);
  if (handle.includes("s")) y22 = Math.max(p3.y, box.y + min);
  let w4 = x22 - x1, h3 = y22 - y1;
  if (lock && box.height > 0) {
    const r2 = box.width / box.height;
    if (handle.length === 2) {
      if (w4 / h3 > r2) w4 = h3 * r2;
      else h3 = w4 / r2;
      if (handle.includes("w")) x1 = right - w4;
      else x22 = x1 + w4;
      if (handle.includes("n")) y1 = bottom - h3;
      else y22 = y1 + h3;
    } else if ("ew".includes(handle)) {
      h3 = w4 / r2;
      const cy = (box.y + bottom) / 2;
      y1 = cy - h3 / 2;
      y22 = cy + h3 / 2;
    } else {
      w4 = h3 * r2;
      const cx = (box.x + right) / 2;
      x1 = cx - w4 / 2;
      x22 = cx + w4 / 2;
    }
  }
  return { x: x1, y: y1, width: x22 - x1, height: y22 - y1 };
}
var rotateAbout = (p3, c3, a2) => ({ x: c3.x + (p3.x - c3.x) * Math.cos(a2) - (p3.y - c3.y) * Math.sin(a2), y: c3.y + (p3.x - c3.x) * Math.sin(a2) + (p3.y - c3.y) * Math.cos(a2) });
function elementCenter(el, elementsMap) {
  if (el.center) return el.center;
  if ((el.type === "arrow" || el.type === "line") && el.roundness && el.points?.length >= 2 && !be2.get(el)) {
    try {
      be2.generateElementShape(el, null);
    } catch {
    }
  }
  const [, , , , cx, cy] = H(el, elementsMap);
  return { x: cx, y: cy };
}
function handleSnap(el, elementsMap) {
  return {
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    angle: el.angle ?? 0,
    type: el.type,
    points: el.points?.map((q3) => [...q3]),
    customData: el.customData,
    center: elementCenter(el, elementsMap),
    roundness: el.roundness,
    roughness: el.roughness,
    seed: el.seed,
    strokeStyle: el.strokeStyle,
    strokeColor: el.strokeColor,
    backgroundColor: el.backgroundColor,
    fillStyle: el.fillStyle
  };
}
function rotateElement(el, pivot, angle, elementsMap) {
  const c3 = elementCenter(el, elementsMap);
  const next = rotateAbout(c3, pivot, angle);
  return { x: el.x + (next.x - c3.x), y: el.y + (next.y - c3.y), angle: (el.angle ?? 0) + angle };
}
function linearScenePoint(el, local, elementsMap) {
  return rotateAbout({ x: el.x + local[0], y: el.y + local[1] }, elementCenter(el, elementsMap), el.angle || 0);
}
function linearHandlePoints(el, elementsMap) {
  if (el?.type !== "arrow" && el?.type !== "line" || !el.points || el.points.length < 2) return null;
  const last = el.points[el.points.length - 1];
  const mid = el.points.length === 3 ? el.points[1] : [last[0] / 2, last[1] / 2];
  return { start: linearScenePoint(el, el.points[0], elementsMap), end: linearScenePoint(el, last, elementsMap), bend: linearScenePoint(el, mid, elementsMap) };
}
function linearCurveOffset(el, points, width, height) {
  if (el?.type !== "arrow" && el?.type !== "line" || !el.roundness || points.length < 2) return null;
  const temp = { ...el, x: 0, y: 0, angle: 0, width, height, points: points.map((p3) => [p3[0], p3[1]]) };
  delete temp.center;
  try {
    be2.generateElementShape(temp, null);
  } catch {
    return null;
  }
  const [, , , , cx, cy] = H(temp);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return { x: cx, y: cy };
}
function encodeDrawnPoints(visual, angle, el) {
  const unrot = visual.map((p3) => rotateAbout(p3, { x: 0, y: 0 }, -angle));
  const points = unrot.map((p3) => [p3.x - unrot[0].x, p3.y - unrot[0].y]);
  const xs = points.map((p3) => p3[0]), ys2 = points.map((p3) => p3[1]);
  const width = Math.max(...xs) - Math.min(...xs), height = Math.max(...ys2) - Math.min(...ys2);
  let offset = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys2) + Math.max(...ys2)) / 2 };
  const curve = linearCurveOffset(el, points, width, height);
  if (curve) offset = curve;
  const c3 = rotateAbout({ x: visual[0].x + offset.x, y: visual[0].y + offset.y }, visual[0], angle);
  const origin = rotateAbout(visual[0], c3, -angle);
  return { x: origin.x, y: origin.y, points, width, height };
}
var scaleWorld = (p3, from, to, sx, sy) => ({ x: to.x + (p3.x - from.x) * sx, y: to.y + (p3.y - from.y) * sy });
function scaleFreedraw(el, from, to, sx, sy) {
  const r2 = strokeDiameter(el) / 2;
  const xs = el.points.map((p3) => p3[0]), ys2 = el.points.map((p3) => p3[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys2), maxY = Math.max(...ys2);
  const spanX = maxX - minX, spanY = maxY - minY;
  if (!(spanX > 0) || !(spanY > 0)) return null;
  const fitted = fittedBoxScale({
    x: el.x + minX - r2,
    y: el.y + minY - r2,
    width: spanX + 2 * r2,
    height: spanY + 2 * r2,
    angle: el.angle,
    center: elementCenter(el)
  }, from, to, sx, sy);
  if (!fitted) return null;
  const pointW = fitted.width - 2 * r2, pointH = fitted.height - 2 * r2;
  if (!(pointW > 0) || !(pointH > 0)) return null;
  const points = el.points.map(([px, py]) => [(px - minX) / spanX * pointW, (py - minY) / spanY * pointH]);
  const ox = points[0][0], oy = points[0][1];
  const stored = points.map(([px, py]) => [px - ox, py - oy]);
  const sxs = stored.map((p3) => p3[0]), sys = stored.map((p3) => p3[1]);
  return {
    x: fitted.x + r2 + ox,
    y: fitted.y + r2 + oy,
    points: stored,
    width: Math.max(...sxs) - Math.min(...sxs),
    height: Math.max(...sys) - Math.min(...sys)
  };
}
function fittedBoxScale(el, from, to, sx, sy) {
  if (!(el.width > 0) || !(el.height > 0)) return null;
  const angle = el.angle || 0;
  const center = elementCenter(el);
  const corners = [
    { x: el.x, y: el.y },
    { x: el.x + el.width, y: el.y },
    { x: el.x + el.width, y: el.y + el.height },
    { x: el.x, y: el.y + el.height }
  ].map((p3) => scaleWorld(rotateAbout(p3, center, angle), from, to, sx, sy));
  const ex = { x: corners[1].x - corners[0].x, y: corners[1].y - corners[0].y };
  const ey = { x: corners[3].x - corners[0].x, y: corners[3].y - corners[0].y };
  const len = Math.hypot(ex.x, ex.y) + Math.hypot(ey.x, ey.y);
  const gap = Math.hypot(corners[2].x - (corners[0].x + ex.x + ey.x), corners[2].y - (corners[0].y + ex.y + ey.y));
  if (Math.abs(ex.x * ey.x + ex.y * ey.y) > len * 1e-6 || gap > len * 1e-6) return null;
  let edge = Math.atan2(ex.y, ex.x) - angle;
  while (edge > Math.PI) edge -= 2 * Math.PI;
  while (edge < -Math.PI) edge += 2 * Math.PI;
  if (Math.abs(edge) > 1e-6) return null;
  const width = Math.hypot(ex.x, ex.y), height = Math.hypot(ey.x, ey.y);
  const mid = { x: (corners[0].x + corners[2].x) / 2, y: (corners[0].y + corners[2].y) / 2 };
  return { x: mid.x - width / 2, y: mid.y - height / 2, width, height };
}
function linearDrag(el, which, pointer, shift = false) {
  if (!el?.points || el.points.length < 2 || which !== "start" && which !== "end" && which !== "bend") return null;
  const angle = el.angle || 0;
  const center = elementCenter(el);
  const visual = el.points.map(([x3, y4]) => rotateAbout({ x: el.x + x3, y: el.y + y4 }, center, angle));
  const last = visual.length - 1;
  let q3 = { x: pointer.x, y: pointer.y };
  if (shift && which !== "bend") {
    const o2 = visual[which === "end" ? 0 : last];
    const len = Math.hypot(q3.x - o2.x, q3.y - o2.y);
    const a2 = snap15(Math.atan2(q3.y - o2.y, q3.x - o2.x));
    q3 = { x: o2.x + len * Math.cos(a2), y: o2.y + len * Math.sin(a2) };
  }
  if (which === "start") visual[0] = q3;
  else if (which === "end") visual[last] = q3;
  else if (visual.length === 3) visual[1] = q3;
  else {
    const start = visual[0], end = visual[last];
    visual.length = 0;
    visual.push(start, q3, end);
  }
  return encodeDrawnPoints(visual, angle, el);
}
var snap15 = (a2) => Math.round(a2 / (Math.PI / 12)) * (Math.PI / 12);
function scaleElement(el, from, to, handle = "") {
  const sx = from.width ? to.width / from.width : 1, sy = from.height ? to.height / from.height : 1;
  const angle = el.angle || 0;
  if (angle && canRotate(el) && Math.abs(sx - sy) > 1e-12) {
    if (el.type === "freedraw" && el.points?.length) {
      const drawn = scaleFreedraw(el, from, to, sx, sy);
      if (drawn) return drawn;
    }
    if (el.points?.length) {
      const center = elementCenter(el);
      const visual = el.points.map(([px, py]) => scaleWorld(rotateAbout({ x: el.x + px, y: el.y + py }, center, angle), from, to, sx, sy));
      return encodeDrawnPoints(visual, angle, el);
    }
    const fitted = fittedBoxScale(el, from, to, sx, sy);
    if (fitted) return fitted;
  }
  const x3 = to.x + (el.x - from.x) * sx, y4 = to.y + (el.y - from.y) * sy;
  if (el.type === "text") return { x: x3, y: y4 };
  const next = { x: x3, y: y4, width: Math.max(1, Math.abs(el.width * sx)), height: Math.max(1, Math.abs(el.height * sy)) };
  if (el.points) next.points = el.points.map(([px, py]) => [px * sx, py * sy]);
  if (isSticky(el)) {
    const height = stickyHeight({ width: next.width, customData: el.customData });
    if (handle.includes("n") || handle === "w") next.y = y4 + next.height - height;
    next.height = height;
  }
  return next;
}
var NOTE_COLORS = PALETTE.filter(([n2]) => n2 !== "white").map(([, hex2]) => hex2 ? mixHex(hex2, "#ffffff", 0.45) : "#ffe58a");
function openTarget({ file, remembered, overlay }) {
  if (file) return "file";
  if (overlay) return "picker";
  return remembered ? "remembered" : "untitled";
}
function resolveBoardPath(file, { home: homeDir, base } = {}) {
  if (typeof file !== "string" || !file.trim()) return null;
  const f3 = file.trim();
  if (f3 === "~") return homeDir || null;
  if (f3.startsWith("~/")) return homeDir ? homeDir + f3.slice(1) : null;
  if (f3.startsWith("/")) return f3;
  if (typeof base !== "string" || !base.startsWith("/")) return null;
  return `${base.replace(/\/$/, "")}/${f3}`;
}

// src/geometry.js
var layoutScale = (vz) => vz;
function textBox(d2, vz) {
  const lineHeight = d2.fontSize * d2.lineHeight * vz;
  return { left: d2.x * vz, top: d2.y * vz, w: Math.max(d2.w, 1) * vz, h: d2.lines.length * lineHeight, lineHeight, fontSize: d2.fontSize * vz };
}
var LAYER_OPS = 4e4;
var BATCH_ITEMS = 200;
var NAMED = { black: "000000", white: "ffffff", red: "ff0000", green: "008000", blue: "0000ff", gray: "808080", grey: "808080" };
function toColor(value, opacity = 100) {
  if (!value || value === "transparent") return null;
  let h3 = String(value).trim().toLowerCase();
  if (h3.startsWith("#")) h3 = h3.slice(1);
  else if (NAMED[h3]) h3 = NAMED[h3];
  else return null;
  if (h3.length === 3 || h3.length === 4) h3 = [...h3].map((c3) => c3 + c3).join("");
  if (!/^[0-9a-f]+$/.test(h3) || h3.length !== 6 && h3.length !== 8) return null;
  const base = h3.slice(0, 6);
  const alpha = (h3.length === 8 ? parseInt(h3.slice(6), 16) / 255 : 1) * Math.max(0, Math.min(100, opacity)) / 100;
  if (alpha <= 0) return null;
  return alpha >= 1 ? `#${base}` : `#${base}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
}
function dashFor(el) {
  if (el.strokeStyle === "dashed") return [8, 8 + el.strokeWidth];
  if (el.strokeStyle === "dotted") return [1.5, 6 + el.strokeWidth];
  return null;
}
function transformFor(el, elementsMap, scale) {
  const angle = el.angle || 0;
  if (!angle) return (lx, ly2) => [(el.x + lx) * scale, (el.y + ly2) * scale];
  const [, , , , cx, cy] = H(el, elementsMap);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (lx, ly2) => {
    const dx = el.x + lx - cx;
    const dy = el.y + ly2 - cy;
    return [(cx + dx * cos - dy * sin) * scale, (cy + dx * sin + dy * cos) * scale];
  };
}
function piece(fill, width, color, dash, n2, emit, loop = 0) {
  return { key: `${fill ? "F" : "S"}|${width.toFixed(3)}|${color}|${dash ? dash.join(",") : ""}|${loop}`, fill, width, color, dash, n: n2, emit };
}
function opsPolyline(ops) {
  const pts = [];
  let cur = null;
  for (const op2 of ops) {
    const d2 = op2.data;
    if (op2.op === "move") {
      cur = [d2[0], d2[1]];
      pts.push(cur);
    } else if (op2.op === "lineTo") {
      cur = [d2[0], d2[1]];
      pts.push(cur);
    } else if (op2.op === "bcurveTo" && cur) {
      const [x0, y0] = cur;
      for (let k3 = 1; k3 <= 12; k3++) {
        const t2 = k3 / 12, u3 = 1 - t2;
        pts.push([u3 * u3 * u3 * x0 + 3 * u3 * u3 * t2 * d2[0] + 3 * u3 * t2 * t2 * d2[2] + t2 * t2 * t2 * d2[4], u3 * u3 * u3 * y0 + 3 * u3 * u3 * t2 * d2[1] + 3 * u3 * t2 * t2 * d2[3] + t2 * t2 * t2 * d2[5]]);
      }
      cur = [d2[4], d2[5]];
    }
  }
  return pts;
}
function fitDash(dash, perimeter) {
  const cycle = dash[0] + dash[1];
  const n2 = Math.max(1, Math.round(perimeter / cycle));
  const k3 = perimeter / (n2 * cycle);
  return [dash[0] * k3, dash[1] * k3];
}
function cleanOutlineOps(el) {
  const w4 = el.width, h3 = el.height;
  const pts = el.type === "diamond" ? [[w4 / 2, 0], [w4, h3 / 2], [w4 / 2, h3], [0, h3 / 2]] : [[0, 0], [w4, 0], [w4, h3], [0, h3]];
  return [...pts.map(([x3, y4], i2) => ({ op: i2 ? "lineTo" : "move", data: [x3, y4] })), { op: "lineTo", data: [...pts[0]] }];
}
function drawablePieces(el, drawable, xf, scale) {
  const out = [];
  if (!drawable?.sets) return out;
  for (const set of drawable.sets) {
    const fill = set.type === "fillPath";
    const outline = set.type === "path";
    const color = toColor(outline ? drawable.options.stroke : drawable.options.fill ?? drawable.options.stroke, el.opacity);
    if (!color) continue;
    const width = fill ? 0 : (set.type === "fillSketch" ? drawable.options.fillWeight ?? el.strokeWidth / 2 : drawable.options.strokeWidth ?? el.strokeWidth) * scale;
    const setOps = outline && !el.roundness && el.roughness === 0 && (el.type === "rectangle" || el.type === "diamond") ? cleanOutlineOps(el) : set.ops;
    const poly = outline ? opsPolyline(setOps) : null;
    const closed = !!poly && poly.length > 3 && Math.hypot(poly[0][0] - poly[poly.length - 1][0], poly[0][1] - poly[poly.length - 1][1]) < 1;
    let dash = outline ? dashFor(el) : null;
    if (dash && closed) {
      let len = 0;
      for (let k3 = 1; k3 < poly.length; k3++) len += Math.hypot(poly[k3][0] - poly[k3 - 1][0], poly[k3][1] - poly[k3 - 1][1]);
      dash = fitDash(dash, len);
    }
    dash = dash ? dash.map((v3) => v3 * scale) : null;
    const loops = fill ? splitAtMoves(setOps) : [setOps];
    loops.forEach((ops0, i2) => out.push(piece(fill, width, color, dash, ops0.length, (b2) => {
      const ops = closed && ops0[ops0.length - 1].op === "lineTo" ? ops0.slice(0, -1) : ops0;
      for (const op2 of ops) {
        const d2 = op2.data;
        if (op2.op === "move") b2 = b2.move_to(...xf(d2[0], d2[1]));
        else if (op2.op === "lineTo") b2 = b2.line_to(...xf(d2[0], d2[1]));
        else if (op2.op === "bcurveTo") {
          const [c1x, c1y] = xf(d2[0], d2[1]);
          const [c2x, c2y] = xf(d2[2], d2[3]);
          const [tx, ty] = xf(d2[4], d2[5]);
          b2 = b2.cubic_bezier_to(tx, ty, c1x, c1y, c2x, c2y);
        }
      }
      return closed ? b2.close() : b2;
    }, i2)));
  }
  return out;
}
function splitAtMoves(ops) {
  const loops = [];
  for (const op2 of ops) {
    if (op2.op === "move" || !loops.length) loops.push([]);
    loops[loops.length - 1].push(op2);
  }
  return loops;
}
var circle = (x3, y4, r2) => Array.from({ length: 16 }, (_4, k3) => [x3 + r2 * Math.cos(k3 / 16 * 2 * Math.PI), y4 + r2 * Math.sin(k3 / 16 * 2 * Math.PI)]);
function freedrawPieces(el, color, xf, scale) {
  let loop = 0;
  const poly = (pts2) => piece(true, 0, color, null, pts2.length + 1, (b2) => {
    pts2.forEach(([x3, y4], i2) => {
      const [px, py] = xf(x3, y4);
      b2 = i2 ? b2.line_to(px, py) : b2.move_to(px, py);
    });
    return b2.close();
  }, loop++);
  if (!isMarker(el)) return penPolygons(el).map(poly);
  const pts = markerPoints(el);
  const r2 = strokeDiameter(el) / 2;
  const out = [piece(false, strokeDiameter(el) * scale, color, null, pts.length, (b2) => {
    pts.forEach(([x3, y4], i2) => {
      const [px, py] = xf(x3, y4);
      b2 = i2 ? b2.line_to(px, py) : b2.move_to(px, py);
    });
    return b2;
  }, loop++)];
  const caps = /* @__PURE__ */ new Set([0, pts.length - 1]);
  for (let i2 = 1; i2 < pts.length - 1; i2++) {
    const a2 = Math.atan2(pts[i2][1] - pts[i2 - 1][1], pts[i2][0] - pts[i2 - 1][0]), b2 = Math.atan2(pts[i2 + 1][1] - pts[i2][1], pts[i2 + 1][0] - pts[i2][0]);
    let d2 = Math.abs(b2 - a2);
    if (d2 > Math.PI) d2 = 2 * Math.PI - d2;
    if (d2 > 0.35) caps.add(i2);
  }
  for (const i2 of caps) out.push(poly(circle(pts[i2][0], pts[i2][1], r2)));
  return out;
}
function boxPiece(el, color, xf, scale) {
  const w4 = el.width, h3 = el.height;
  return piece(false, 1 * scale, color, [6 * scale, 4 * scale], 5, (b2) => b2.move_to(...xf(0, 0)).line_to(...xf(w4, 0)).line_to(...xf(w4, h3)).line_to(...xf(0, h3)).close());
}
var FONTS = {
  1: "Excalifont",
  // Virgil: Excalifont is its successor and ships with this mod
  2: "Helvetica",
  3: "JetBrains Mono",
  // Cascadia; JetBrains Mono ships with Herdr
  5: "Excalifont",
  6: "Helvetica Neue",
  // Nunito
  7: "Helvetica Neue",
  // Lilita One
  8: "Comic Sans MS",
  // Comic Shanns
  9: "Helvetica"
  // Liberation Sans
};
var fontName = (family) => FONTS[family] ?? "Excalifont";
function elementItem(el, elementsMap, scale, opts) {
  if (el.isDeleted || el.type === "selection") return null;
  if ((el.type === "arrow" || el.type === "line") && el.roundness) {
    try {
      be2.generateElementShape(el, opts.shapeConfig);
    } catch {
    }
  }
  const bounds = he2(el, elementsMap);
  const xf = transformFor(el, elementsMap, scale);
  const pieces = [];
  const texts = [];
  const images = [];
  if (el.type === "text") {
    if (opts.hiddenText?.has(el.id)) return null;
    const color = toColor(el.strokeColor, el.opacity);
    if (color) texts.push({ x: el.x, y: el.y, w: el.width, h: el.height, lines: String(el.text).split("\n"), fontSize: el.fontSize, lineHeight: el.lineHeight, font: fontName(el.fontFamily), color, align: el.textAlign });
  } else if (el.type === "freedraw") {
    const color = isMarker(el) ? mixHex(toColor(el.strokeColor) ?? "#fddd00", opts.markerBg ?? "#000000", MARKER_UNDER * ((el.opacity ?? 100) / 100)) : toColor(el.strokeColor, el.opacity);
    if (color && el.points.length) pieces.push(...freedrawPieces(el, color, xf, scale));
  } else if (el.type === "image") {
    const file = opts.imagePath?.(el.fileId);
    if (!file) pieces.push(boxPiece(el, "#868e96", xf, scale));
  } else if (el.type === "frame" || el.type === "magicframe") {
    pieces.push(boxPiece(el, "#868e96", xf, scale));
    if (el.name) texts.push({ x: el.x, y: el.y - 20, w: Math.max(el.width, 1), h: 18, lines: [el.name], fontSize: 14, lineHeight: 1.25, font: "Helvetica", color: "#868e96", align: "left" });
  } else {
    let shape = null;
    try {
      shape = be2.generateElementShape(el, opts.shapeConfig);
    } catch {
      shape = null;
    }
    const list = Array.isArray(shape) ? shape : shape ? [shape] : [];
    for (const d2 of list) pieces.push(...drawablePieces(el, d2, xf, scale));
    if (!list.length) pieces.push(boxPiece(el, "#868e96", xf, scale));
    if (isSticky(el) && !opts.hiddenText?.has(el.id)) {
      const lines = stickyLines(el);
      if (lines.some(Boolean)) texts.push({ x: el.x + STICKY_PAD, y: el.y + STICKY_PAD, w: el.width - 2 * STICKY_PAD, h: lines.length * STICKY_FONT * STICKY_LINE, lines, fontSize: STICKY_FONT, lineHeight: STICKY_LINE, font: "Helvetica Neue", color: STICKY_INK, align: "left" });
    }
  }
  if (!pieces.length && !texts.length && !images.length) return null;
  return { id: el.id, bounds, pieces, texts, images, ops: pieces.reduce((s2, p3) => s2 + p3.n, 0) };
}
var overlaps = (a2, b2) => a2[0] <= b2[2] && b2[0] <= a2[2] && a2[1] <= b2[3] && b2[1] <= a2[3];
function batchDrawList(items) {
  const groups = /* @__PURE__ */ new Map();
  const extras = [];
  for (const item of items) {
    for (const p3 of item.pieces) {
      let g2 = groups.get(p3.key);
      if (!g2) {
        let b2 = p3.fill ? PathBuilder.fill() : PathBuilder.stroke(p3.width);
        if (p3.dash) b2 = b2.dash_array(p3.dash);
        groups.set(p3.key, g2 = { b: b2, color: p3.color, fill: p3.fill });
      }
      g2.b = p3.emit(g2.b);
    }
    for (const t2 of item.texts) extras.push({ kind: "text", ...t2 });
    for (const i2 of item.images) extras.push({ kind: "image", ...i2 });
  }
  const paths = [...groups.values()].sort((a2, b2) => Number(b2.fill) - Number(a2.fill)).map((g2) => ({ kind: "path", path: g2.b.build(), color: g2.color }));
  return [...paths, ...extras];
}
function buildLayers(elements, elementsMap, scale, opts) {
  const batches = [];
  let batch = null;
  for (const el of elements) {
    let item;
    try {
      item = elementItem(el, elementsMap, scale, opts);
    } catch (e5) {
      opts.onError?.(el, e5);
      continue;
    }
    if (!item) continue;
    const pad = (el.strokeWidth || 1) * 2 + 4;
    const box = [item.bounds[0] - pad, item.bounds[1] - pad, item.bounds[2] + pad, item.bounds[3] + pad];
    if (!batch || batch.items.length >= BATCH_ITEMS || batch.boxes.some((b2) => overlaps(b2, box))) {
      batch = { items: [], boxes: [], ops: 0 };
      batches.push(batch);
    }
    batch.items.push(item);
    batch.boxes.push(box);
    batch.ops += item.ops;
  }
  const layers = [];
  let layer = null;
  for (const b2 of batches) {
    if (!layer || layer.ops + b2.ops > LAYER_OPS) {
      layer = { ops: 0, batches: [], bounds: [Infinity, Infinity, -Infinity, -Infinity] };
      layers.push(layer);
    }
    layer.batches.push(b2);
    layer.ops += b2.ops;
    for (const box of b2.boxes) {
      layer.bounds = [Math.min(layer.bounds[0], box[0]), Math.min(layer.bounds[1], box[1]), Math.max(layer.bounds[2], box[2]), Math.max(layer.bounds[3], box[3])];
    }
  }
  return layers.map((l2) => ({ bounds: l2.bounds, draw: l2.batches.flatMap((b2) => batchDrawList(b2.items)) }));
}

// src/picker.js
import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { home, pickFolder, writeTextFile } from "herdr";
import * as fs from "fs/promises";

// src/document.js
var SOURCE = "herdr-excalidraw";
function legacyRoundness(el) {
  if (el.roundness !== void 0) return el.roundness;
  if (el.strokeSharpness === "round") {
    return { type: el.type === "rectangle" || el.type === "diamond" ? tr.LEGACY : tr.PROPORTIONAL_RADIUS };
  }
  return null;
}
function normalizeElement(el) {
  const base = {
    ...rr,
    angle: 0,
    groupIds: [],
    frameId: null,
    boundElements: null,
    link: null,
    locked: false,
    isDeleted: false,
    version: 1,
    updated: Date.now(),
    index: null,
    ...el
  };
  base.seed ??= hs();
  base.versionNonce ??= hs();
  base.roundness = legacyRoundness(el);
  delete base.strokeSharpness;
  base.width ??= 0;
  base.height ??= 0;
  if (base.type === "text") {
    base.fontSize ??= nn2;
    base.fontFamily ??= rn2;
    base.textAlign ??= "left";
    base.verticalAlign ??= "top";
    base.lineHeight ??= gr(base.fontFamily);
    base.text ??= "";
    base.originalText ??= base.text;
    base.containerId ??= null;
    base.autoResize ??= true;
  }
  if (base.type === "arrow" || base.type === "line" || base.type === "freedraw") {
    base.points ??= [[0, 0]];
  }
  if (base.type === "arrow" || base.type === "line") {
    base.startBinding ??= null;
    base.endBinding ??= null;
    base.startArrowhead ??= null;
    base.endArrowhead ??= base.type === "arrow" ? "arrow" : null;
    if (base.type === "arrow") base.elbowed ??= false;
    if (base.type === "line") base.polygon ??= false;
  }
  if (base.type === "freedraw") {
    base.pressures ??= [];
    base.simulatePressure ??= true;
  }
  return base;
}
var emptyDocument = () => ({ elements: [], appState: { viewBackgroundColor: "#ffffff" }, files: {}, source: SOURCE });
function parseDocument(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== "object" || data.type && data.type !== "excalidraw" || !Array.isArray(data.elements)) {
    throw new Error('not an Excalidraw file (expected type "excalidraw" with an elements array)');
  }
  return {
    elements: data.elements.filter((e5) => e5 && typeof e5 === "object" && e5.type && e5.id).map(normalizeElement),
    // Kept whole so saving round-trips settings this editor doesn't use.
    appState: { viewBackgroundColor: "#ffffff", ...data.appState ?? {} },
    files: data.files ?? {},
    source: data.source ?? SOURCE
  };
}
function serializeDocument({ elements, appState, files, source }) {
  const live = yS(Of(uE(elements)));
  return JSON.stringify({ type: "excalidraw", version: 2, source, elements: live, appState, files }, null, 2) + "\n";
}
var clone = (elements) => elements.map((e5) => ({ ...e5 }));
var History = class {
  constructor(limit = 100) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
  }
  /** Call before a change, with the elements as they are. */
  record(elements) {
    this.undoStack.push(clone(elements));
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }
  /** Returns the elements to restore, or null. */
  undo(current) {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push(clone(current));
    return clone(prev);
  }
  redo(current) {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(clone(current));
    return clone(next);
  }
};

// src/picker.js
var NEW_EXT = ".board";
var isBoard = (name) => BOARD_EXTS.some((e5) => name.toLowerCase().endsWith(e5));
var stripExt = (name) => {
  const e5 = BOARD_EXTS.find((x3) => name.toLowerCase().endsWith(x3));
  return e5 ? name.slice(0, -e5.length) : name;
};
var MAX_FILES = 300;
var ROW = 32;
var LIST_MAX = 320;
var tildify = (p3) => p3 === home() ? "~" : p3.startsWith(`${home()}/`) ? `~${p3.slice(home().length)}` : p3;
var Picker = class {
  constructor(folder) {
    this.folder = folder;
    this.files = [];
    this.error = null;
    this.index = 0;
    this.loaded = false;
  }
  async refresh() {
    try {
      const entries = await fs.readdir(this.folder, { withFileTypes: true });
      this.files = entries.filter((e5) => !e5.isDirectory() && isBoard(e5.name) && !e5.name.startsWith(".")).map((e5) => e5.name).sort((a2, b2) => a2.localeCompare(b2)).slice(0, MAX_FILES);
      this.error = null;
    } catch (e5) {
      this.files = [];
      this.error = `Can't list this folder: ${e5?.message ?? e5}`;
    }
    this.index = Math.min(this.index, this.items().length - 1);
    this.loaded = true;
  }
  path(name) {
    return `${this.folder}/${name}`;
  }
  /** What ↑↓ Enter move over: the files, then the two actions. */
  items() {
    return [...this.files.map((name) => ({ kind: "file", name })), { kind: "new" }, { kind: "folder" }];
  }
  async chooseFolder() {
    const folder = await pickFolder({ prompt: "Folder with boards" });
    if (!folder) return false;
    this.folder = folder;
    this.index = 0;
    await this.refresh();
    return true;
  }
  /** Creates refs.board (or refs-2, -3, …) in the folder and returns its path. */
  async newDrawing() {
    for (let n2 = 1; n2 < 1e3; n2++) {
      const path = this.path(n2 === 1 ? `refs${NEW_EXT}` : `refs-${n2}${NEW_EXT}`);
      if (await fs.exists(path)) continue;
      await writeTextFile(path, serializeDocument(emptyDocument()), null);
      return path;
    }
    throw new Error("no free refs-N.board name");
  }
  /** ↑↓ move (wrapping), Enter returns the item to act on; anything else returns null. */
  key(e5) {
    const n2 = this.items().length;
    if (e5.key === "down") this.index = (this.index + 1) % n2;
    else if (e5.key === "up") this.index = (this.index + n2 - 1) % n2;
    else if (e5.key === "enter") return this.items()[this.index];
    return null;
  }
  /**
   * `t` is Herdr's theme; `actions`: open(name), openInTab?(name), newDrawing(), chooseFolder().
   * `title` heads it; `escHint` shows "Esc" at the right, as Herdr's popups do; `bg` overrides
   * the popover background (a pane uses the terminals' background).
   */
  render(t2, actions, { title, escHint, bg }) {
    const row = (id, i2, content, onPress) => h_flex().id(id).mx(4).px(10).h(ROW).flex_none().items_center().gap(10).rounded(7).cursor_pointer().when(i2 === this.index, (el) => el.bg(t2.hover)).hover((s2) => s2.bg(t2.hover)).on_mouse_down("left", (e5, cx) => {
      cx.stop_propagation();
      this.index = i2;
      onPress(cx);
    }).children(content);
    const files = this.files.map((name, i2) => row(`file-${i2}`, i2, [
      div().w(14).flex_none().text_color(t2.dim).child("\u25C7"),
      div().flex_1().truncate().text_color(t2.foreground).child(stripExt(name)),
      actions.openInTab ? div().id(`file-tab-${i2}`).px(6).rounded(5).text_size(11).text_color(t2.muted).hover((s2) => s2.text_color(t2.foreground).bg(t2.raised)).on_mouse_down("left", (e5, cx) => {
        cx.stop_propagation();
        actions.openInTab(name, cx);
      }).child("new tab") : div()
    ], (cx) => actions.open(name, cx)));
    const n2 = this.files.length;
    const action = (i2, glyph, label, onPress) => row(i2 === n2 ? "new-drawing" : "choose-folder", i2, [
      div().w(14).flex_none().text_color(t2.muted).child(glyph),
      div().flex_1().text_color(t2.foreground).child(label)
    ], onPress);
    const empty = !this.loaded ? "Loading\u2026" : this.error ?? "No boards in this folder yet.";
    const listHeight = Math.min(LIST_MAX, Math.max(n2, 1) * (ROW + 2));
    return v_flex().w_full().min_h(0).p(18).gap(10).bg(bg ?? t2.popover).text_size(13).children([
      h_flex().items_center().gap(10).children([
        div().flex_1().text_size(15).font_semibold().text_color(t2.foreground).child(title),
        escHint ? div().text_size(11).text_color(t2.muted).child("Esc") : div()
      ]),
      div().text_size(11).text_color(t2.muted).truncate().child(tildify(this.folder)),
      n2 ? v_flex().id("file-list").h(listHeight).min_h(0).gap(2).overflow_y_scrollbar().children(files) : div().mx(4).px(10).h(ROW).flex().items_center().text_color(t2.muted).child(empty),
      v_flex().gap(2).pt(6).border_t_1().border_color(t2.input).children([
        action(n2, "+", "New board", (cx) => actions.newDrawing(cx)),
        action(n2 + 1, "\u2026", "Choose folder", (cx) => actions.chooseFolder(cx))
      ])
    ]);
  }
};

// src/gesture.js
function moveReportsButtonHeld(event) {
  if (event == null || typeof event !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(event, "pressed_button")) {
    const button = event.pressed_button;
    return !(button == null || button === "" || button === "none");
  }
  if (Object.prototype.hasOwnProperty.call(event, "buttons") && typeof event.buttons === "number") {
    return event.buttons !== 0;
  }
  return null;
}
function moveReportsButtonsUp(event) {
  return moveReportsButtonHeld(event) === false;
}
function pointerBlocksSave(pointer, paneHover) {
  return pointer != null && paneHover !== false;
}
function pointerLeftPane(pointer, paneHover, leftDuringGesture = false) {
  return pointer != null && (paneHover === false || leftDuringGesture === true);
}

// src/drop-target.js
function canvasHint({ count, editing, pointer, dragOver }) {
  if (dragOver) return "drop";
  return count || editing || pointer ? null : "empty";
}
function dashedBorder(el) {
  return typeof el.border_dashed === "function" ? el.border_dashed() : el;
}
function wireDrop(el, target, importPaths) {
  const set = (over, cx) => {
    if (target.over !== over) {
      target.over = over;
      cx.notify();
    }
  };
  el = el.on_drop((e5, cx) => {
    set(false, cx);
    importPaths(e5.paths, cx);
  });
  if (typeof el.on_drag_enter !== "function" || typeof el.on_drag_leave !== "function") return el;
  return el.on_drag_enter((_e2, cx) => set(true, cx)).on_drag_leave((_e2, cx) => set(false, cx));
}

// src/save-gate.js
function createSaveGate() {
  let depth = 0;
  let generation = 0;
  let release = () => {
  };
  let gate = Promise.resolve();
  return {
    get saving() {
      return depth > 0;
    },
    get generation() {
      return generation;
    },
    start() {
      if (depth === 0) gate = new Promise((resolve) => {
        release = resolve;
      });
      depth += 1;
    },
    finish() {
      if (depth === 0) return;
      depth -= 1;
      generation += 1;
      if (depth === 0) {
        const done = release;
        release = () => {
        };
        done();
      }
    },
    async ready() {
      while (depth > 0) await gate;
    }
  };
}
function createSaveQueue() {
  let tail = Promise.resolve();
  return function enqueue(run2) {
    const done = tail.then(() => run2(), () => run2());
    tail = done.then(() => {
    }, () => {
    });
    return done;
  };
}
var SAVE_RETRY_MS = 5e3;
function backoffSaveAt(now, retryMs = SAVE_RETRY_MS) {
  return now + retryMs;
}
function autosaveDue({ dirty, saving, now, saveAt, blocked, editing }) {
  return Boolean(dirty) && !saving && now >= saveAt && !blocked && !editing;
}
function saveCommitted({ dirty, adoptedExternal }) {
  return !adoptedExternal && !dirty;
}
function externalChange(text, lastText) {
  return text != null && text !== lastText ? text : null;
}
async function readWhenSaveSettled(gate, read) {
  for (; ; ) {
    await gate.ready();
    const generation = gate.generation;
    const text = await read();
    if (!gate.saving && gate.generation === generation) return text;
  }
}

// src/main.js
Rx({ getLineWidth: (text, font) => lineWidth(text, parseFloat(font) || 20) });
var MOD = "fork-board";
var boundsOf = (el, map) => el.type === "freedraw" ? freedrawBounds(el) : he2(el, map);
var commonOf = (els, map) => {
  const bs2 = els.map((e5) => boundsOf(e5, map));
  return [Math.min(...bs2.map((b2) => b2[0])), Math.min(...bs2.map((b2) => b2[1])), Math.max(...bs2.map((b2) => b2[2])), Math.max(...bs2.map((b2) => b2[3]))];
};
var ICONS = `mods/${MOD}/icons`;
var CACHE = "data/herdr-board";
var CACHE_SIDE = 1024;
var SWAP_MS = 1500;
var TIER_TRIES = 4;
var DEVICE_PX = 2;
var ASSET_CHECK = 'd=$(cd "$(dirname "$1")" 2>/dev/null && pwd -P) || exit 1; a=$(cd "$2" 2>/dev/null && pwd -P) || exit 1; [ -L "$1" ] && exit 1; [ -L "$2" ] && exit 1; [ "$d" = "$a" ] || exit 1';
var SHAPES = ["rectangle", "ellipse", "diamond"];
var TOOLS = [
  { id: "selection", icon: "selection", key: "V or 1", title: "Select" },
  { id: "hand", icon: "hand", key: "H, or hold Space", title: "Hand (pan)" },
  null,
  { id: "freedraw", icon: "freedraw", key: "D, P or 7", title: "Draw" },
  { id: "highlighter", icon: "highlighter", key: "Shift-D or Shift-P", title: "Highlighter" },
  { id: "eraser", icon: "eraser", key: "E or 0", title: "Eraser" },
  { id: "shape", icon: "rectangle", key: "R, O", title: "Shape (click again for the next)" },
  { id: "arrow", icon: "arrow", key: "A or 5", title: "Arrow" },
  { id: "text", icon: "text", key: "T or 8", title: "Text" },
  { id: "sticky", icon: "sticky", key: "N or S", title: "Note" },
  { id: "image", icon: "image", key: "\u2318U, \u2318V or drop files", title: "Add images" }
];
var CONTAINERS = ["rectangle", "diamond", "ellipse"];
var TOOL_KEYS = {
  v: "selection",
  1: "selection",
  h: "hand",
  r: "rectangle",
  2: "rectangle",
  3: "diamond",
  o: "ellipse",
  4: "ellipse",
  a: "arrow",
  5: "arrow",
  l: "line",
  6: "line",
  p: "freedraw",
  d: "freedraw",
  b: "freedraw",
  x: "freedraw",
  7: "freedraw",
  t: "text",
  8: "text",
  e: "eraser",
  0: "eraser",
  s: "sticky",
  n: "sticky"
};
var INK = [null, "#e03131", "#f1ac4b", "#4465e9"];
var CLIP_JS = `ObjC.import('AppKit');
function run(a){
  var mode=a[0], arg=a[1], pb=$.NSPasteboard.generalPasteboard;
  if(mode==='get'){
    var d=pb.dataForType('public.png');
    if(!d||!d.length){var t=pb.dataForType('public.tiff');if(!t||!t.length)return '';d=$.NSBitmapImageRep.imageRepWithData(t).representationUsingTypeProperties($.NSBitmapImageFileTypePNG,$({}));}
    d.writeToFileAtomically(arg,true);return 'png';
  }
  if(mode==='files'){
    var u=pb.readObjectsForClassesOptions($([$.NSURL]),$({NSPasteboardURLReadingFileURLsOnlyKey:true}));
    var o=[];if(u&&u.count)for(var i=0;i<u.count;i++)o.push(ObjC.unwrap(u.objectAtIndex(i).path));return o.join('\\n');
  }
  if(mode==='text'){var s=pb.stringForType('public.utf8-plain-text');return s?ObjC.unwrap(s):'';}
  pb.clearContents;
  if(mode==='put'){pb.writeObjects($([$.NSImage.alloc.initWithContentsOfFile(arg)]));return 'ok';}
  if(mode==='putfile'){var l=arg.split('\\n').map(function(p){return $.NSURL.fileURLWithPath(p);});pb.writeObjects($(l));return 'ok';}
}`;
var CHOOSE_FILES = 'set fs to choose file with prompt "Add to the board" with multiple selections allowed\nset o to ""\nrepeat with f in fs\nset o to o & POSIX path of f & linefeed\nend repeat\nreturn o';
var GRAY_PROFILE = "/System/Library/ColorSync/Profiles/Generic Gray Profile.icc";
var HANDLE = 5;
var ROTATE_RADIUS = 32;
var hex = (c3, fallback) => typeof c3 === "string" && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(c3) ? c3.slice(0, 7) : fallback;
var sel = () => hex(theme().accent, "#6c8bff");
var uiColors = () => {
  const t2 = theme();
  return { surface: t2.popover ?? t2.surface, border: t2.border, swatchBorder: t2.input ?? t2.border, foreground: t2.foreground, muted: t2.muted, selected: t2.selected, hover: t2.hover };
};
var isLight = (c3) => {
  const h3 = hex(c3, "#1e1e1e");
  const [r2, g2, b2] = [1, 3, 5].map((i2) => parseInt(h3.slice(i2, i2 + 2), 16));
  return 0.299 * r2 + 0.587 * g2 + 0.114 * b2 > 128;
};
var dropColors = () => {
  const t2 = theme();
  const light = isLight(t2.background);
  const accent = hex(t2.accent ?? t2.selected ?? t2.primary, light ? "#315cff" : "#8fb0e0");
  return { accent, tint: light ? "#eef2ffd6" : `${accent}1f` };
};
var MIN_ZOOM = 0.1;
var MAX_ZOOM = 30;
var tildify2 = (p3) => p3 === home2() ? "~" : p3.startsWith(`${home2()}/`) ? `~${p3.slice(home2().length)}` : p3;
var dirname2 = (p3) => p3.slice(0, p3.lastIndexOf("/")) || "/";
var basename2 = (p3) => p3.slice(p3.lastIndexOf("/") + 1);
var samePath = (a2, b2) => a2 === b2 || a2 === `/private${b2}` || `/private${a2}` === b2;
var resolveFile = (file, base) => resolveBoardPath(file, { home: home2(), base });
var rectPath = (x1, y1, x22, y22, width, dash) => {
  let b2 = width ? PathBuilder2.stroke(width) : PathBuilder2.fill();
  if (dash) b2 = b2.dash_array(dash);
  return b2.move_to(x1, y1).line_to(x22, y1).line_to(x22, y22).line_to(x1, y22).close().build();
};
var Board = class extends View {
  init(_props, cx) {
    this.focus = cx.focus_handle();
    this.vz = 1;
    this.scrollX = 0;
    this.scrollY = 0;
    this.size = null;
    this.tool = "selection";
    this.style = { strokeColor: hex(theme().foreground, "#e8e8e8"), backgroundColor: "transparent", fill: "none", opacity: 100, strokeWidth: 3.5, strokeStyle: "solid", roughness: 0, fontSize: 24, fontFamily: 1, textAlign: "left", arrowStart: null, arrowEnd: "arrow" };
    this.selected = /* @__PURE__ */ new Set();
    this.pointer = null;
    this.editing = null;
    this.spaceDown = false;
    this.history = new History();
    this.scene = new Io2([]);
    this.doc = emptyDocument();
    this.lastText = null;
    this.dirty = false;
    this.saves = createSaveGate();
    this.enqueueSave = createSaveQueue();
    this.paneHover = void 0;
    this.gestureLeft = false;
    this.dropTarget = { over: false };
    this.saveAt = 0;
    this.saveError = null;
    this.imageFiles = /* @__PURE__ */ new Map();
    this.pics = /* @__PURE__ */ new Map();
    this.picShown = /* @__PURE__ */ new Map();
    this.tierWant = /* @__PURE__ */ new Set();
    this.pixels = /* @__PURE__ */ new Map();
    this.preparing = false;
    this.tries = /* @__PURE__ */ new Map();
    this.slideSeq = 0;
    this.boardGen = new Generation();
    this.playSeq = 0;
    this.playTickets = /* @__PURE__ */ new Map();
    this.groupIdx = null;
    this.playing = /* @__PURE__ */ new Set();
    this.anim = /* @__PURE__ */ new Map();
    this.hoverId = null;
    this.menu = null;
    this.shapeKind = "rectangle";
    this.markerInk = MARKER_INK;
    this.stickyColor = STICKY_COLORS[0];
    this.toast = null;
    this.layers = [];
    this.builtVz = 1;
    this.active = /* @__PURE__ */ new Set();
    this.status = "loading";
    this.panelCollapsed = localStorage.getItem("panelCollapsed") === "1";
    const editor = this;
    this.Layer = class Layer extends View {
      init(p4) {
        this.idx = p4.idx;
      }
      render() {
        return editor.renderLayer(this.idx);
      }
    };
    this.layerViews = [];
    this.liveView = cx.new(class Live extends View {
      render() {
        return editor.renderLive();
      }
    });
    cx.bind_keys([{ keystroke: "escape", action: "excalidraw_end_edit", context: "ExcalidrawTextEditor" }]);
    this.watchGen = 0;
    const p3 = props() ?? {};
    this.overlay = p3.overlay ?? null;
    this.fromPane = this.overlay ? focused()?.pane ?? null : null;
    cx.timer.every(200, (cx2) => this.tick(cx2));
    const folder = this.startFolder();
    const asked = typeof p3.file === "string" && p3.file.trim();
    const opened = resolveFile(p3.file, folder);
    if (asked && !opened) {
      this.fail(cx, `can't open ${p3.file.trim()}`);
      return;
    }
    const remembered = this.overlay ? null : resolveFile(localStorage.getItem("file"), folder);
    const target = openTarget({ file: opened, remembered, overlay: !!this.overlay });
    if (target === "file") this.openFile(opened, cx);
    else if (target === "remembered") this.openFile(remembered, cx);
    else if (target === "untitled") this.openUntitled(cx);
    else this.showPicker(cx);
  }
  // ---- choosing a drawing ------------------------------------------------------------
  openFile(file, cx) {
    this.file = file;
    this.status = "loading";
    this.picker = null;
    this.history = new History();
    this.selected = /* @__PURE__ */ new Set();
    this.active = /* @__PURE__ */ new Set();
    this.pointer = null;
    this.gestureLeft = false;
    this.editing = null;
    this.vz = 1;
    this.scrollX = 0;
    this.scrollY = 0;
    this.dirty = false;
    this.saveError = null;
    this.lastText = null;
    this.boardGen.bump();
    this.imageFiles = /* @__PURE__ */ new Map();
    this.tries = /* @__PURE__ */ new Map();
    this.anim = /* @__PURE__ */ new Map();
    this.playing = /* @__PURE__ */ new Set();
    this.playTickets = /* @__PURE__ */ new Map();
    this.pics = /* @__PURE__ */ new Map();
    this.picShown = /* @__PURE__ */ new Map();
    this.tierWant = /* @__PURE__ */ new Set();
    this.pixels = /* @__PURE__ */ new Map();
    this.tiering = false;
    this.swapUntil = 0;
    this.preparing = false;
    this.prepareAgain = false;
    this.groupIdx = null;
    const gen = ++this.watchGen;
    cx.spawn(async (cx2) => {
      if (await this.load(cx2)) await this.watch(cx2, gen);
    });
    cx.notify();
  }
  /** An empty board for a pane opened with no file: untitled.board in the terminal's folder, created now so the name is reserved. */
  openUntitled(cx) {
    this.status = "loading";
    cx.spawn(async (cx2) => {
      try {
        const folder = this.startFolder();
        const body = serializeDocument(emptyDocument());
        let file = null;
        for (let n2 = 1; n2 < 1e3; n2++) {
          const name = n2 === 1 ? "untitled.board" : `untitled-${n2}.board`;
          const path = `${folder}/${name}`;
          if ((await exec("test", ["-e", path])).code === 0) continue;
          try {
            await writeTextFile2(path, body, null);
          } catch (e5) {
            if ((await exec("test", ["-e", path])).code === 0) continue;
            throw e5;
          }
          file = path;
          break;
        }
        if (!file) throw new Error("no free untitled board name");
        localStorage.setItem("file", file);
        this.openFile(file, cx2);
      } catch (e5) {
        this.fail(cx2, `can't create an untitled board: ${e5?.message ?? e5}`);
      }
    });
  }
  /** The folder a list starts in: the current drawing's, else the terminal you were in, else home. */
  startFolder() {
    if (this.file) return dirname2(this.file);
    const f3 = focused();
    return f3?.cwd ?? panes().find((p3) => p3.tab === f3?.tab && p3.cwd)?.cwd ?? home2();
  }
  showPicker(cx) {
    this.status = "pick";
    this.picker = new Picker(this.startFolder());
    cx.spawn(async (cx2) => {
      await this.picker?.refresh();
      cx2.notify();
      await cx2.sleep(16);
      this.focus.focus();
    });
    cx.notify();
  }
  /** From the editor: save, then show the list to pick another drawing for this pane. */
  switchFile(cx) {
    cx.spawn(async (cx2) => {
      if (this.editing) this.endEdit(cx2, {});
      this.endAbandonedGesture(cx2);
      const saved = this.dirty ? await this.save(cx2) : true;
      if (!canLeaveBoard({ dirty: this.dirty, saved, saveError: this.saveError })) {
        this.say("Board: not saved", `${basename2(this.file)} could not be saved${this.saveError ? ` (${this.saveError})` : ""}. Staying on this board.`, "error");
        return;
      }
      this.showPicker(cx2);
    });
  }
  /** Opens a drawing: beside the launcher's pane (or in a new tab), or in this pane. */
  choose(path, cx, { tab = false } = {}) {
    if (!this.overlay) {
      localStorage.setItem("file", path);
      this.openFile(path, cx);
      return;
    }
    const spec = { mod: MOD, props: { file: path } };
    if (tab || !this.fromPane) run("tab.new", { name: basename2(path), ...spec });
    else run("pane.split", { direction: "right", pane: this.fromPane, ...spec });
    closeOverlay(this.overlay);
  }
  pickerActions() {
    const fail = (what, e5) => notify({ title: `Board: ${what}`, body: String(e5?.message ?? e5), level: "error" });
    return {
      open: (name, cx) => this.choose(this.picker.path(name), cx),
      openInTab: this.overlay ? (name, cx) => this.choose(this.picker.path(name), cx, { tab: true }) : null,
      newDrawing: (cx) => cx.spawn(async (cx2) => {
        try {
          this.choose(await this.picker.newDrawing(), cx2);
        } catch (e5) {
          fail("can't create a drawing", e5);
        }
      }),
      chooseFolder: (cx) => cx.spawn(async (cx2) => {
        if (await this.picker.chooseFolder()) cx2.notify();
      })
    };
  }
  pickerKey(e5, cx) {
    if (e5.key === "escape") {
      if (this.overlay) closeOverlay(this.overlay);
      else if (this.file) this.openFile(this.file, cx);
      return;
    }
    const item = this.picker.key(e5);
    const actions = this.pickerActions();
    if (item?.kind === "file") actions.open(item.name, cx);
    else if (item?.kind === "new") actions.newDrawing(cx);
    else if (item?.kind === "folder") actions.chooseFolder(cx);
    cx.notify();
  }
  // ---- coordinates -------------------------------------------------------------------
  herdrZoom() {
    return Number(settings()?.zoom) || 1;
  }
  /** Window pixels per scene unit: pointer positions and `on_size_change`. Drawing uses drawScale. */
  scale() {
    return this.vz * this.herdrZoom();
  }
  /** Layout pixels per scene unit for paths, text and images. Herdr zoom is applied by the host; including it here squares it. */
  drawScale() {
    return layoutScale(this.vz);
  }
  toScene(local) {
    const s2 = this.scale();
    return { x: local.x / s2 - this.scrollX, y: local.y / s2 - this.scrollY };
  }
  map() {
    return this.scene.getNonDeletedElementsMap();
  }
  elements() {
    return this.scene.getNonDeletedElements();
  }
  // ---- file --------------------------------------------------------------------------
  async load(cx) {
    let text;
    try {
      text = await readTextFile(this.file);
    } catch (e5) {
      return this.fail(cx, `can't read ${this.file}: ${e5?.message ?? e5}`);
    }
    if (text == null) {
      this.doc = emptyDocument();
      this.lastText = null;
    } else {
      try {
        this.doc = parseDocument(text);
      } catch (e5) {
        return this.fail(cx, `${this.file}: ${e5.message}`);
      }
      this.lastText = text;
    }
    this.scene.replaceAllElements(this.doc.elements);
    this.fixStickies();
    const els = this.elements();
    if (els.length) {
      const [x1, y1] = commonOf(els, this.map());
      this.scrollX = 40 - x1;
      this.scrollY = 80 - y1;
      this.needFit = true;
    }
    this.status = "ready";
    this.rebuild(cx);
    this.prepareImages(cx);
    return true;
  }
  fail(cx, message) {
    this.status = "error";
    this.error = message;
    cx.notify();
    return false;
  }
  /** Reloads when the file changes on disk (another editor, an agent, git). */
  async watch(cx, gen) {
    const dir = dirname2(this.file);
    for (; ; ) {
      let changed;
      try {
        changed = await watchFolder(dir);
      } catch {
        return;
      }
      if (this.closed || gen !== this.watchGen) return;
      if (!changed.some((p3) => samePath(p3, this.file))) continue;
      const text = await readWhenSaveSettled(this.saves, () => readTextFile(this.file).catch(() => null));
      if (this.closed || gen !== this.watchGen) return;
      if (externalChange(text, this.lastText)) await this.applyExternal(text, cx);
    }
  }
  /** Stickies are as tall as their text needs, also for a file written by another tool. */
  fixStickies() {
    for (const el of this.elements()) if (isSticky(el)) {
      const h3 = stickyHeight(el);
      if (h3 !== el.height) this.scene.mutateElement(el, { height: h3 });
    }
  }
  async applyExternal(text, cx) {
    let doc;
    try {
      doc = parseDocument(text);
    } catch (e5) {
      notify({ title: `${basename2(this.file)} changed on disk`, body: `Not loaded: ${e5.message}`, level: "warning" });
      return;
    }
    if (this.dirty) {
      notify({ title: `${basename2(this.file)} changed on disk`, body: "Loaded the file's version; undo brings back your unsaved changes.", level: "warning" });
    }
    if (this.editing) this.endEdit(cx, {});
    this.history.record(this.scene.getElementsIncludingDeleted());
    this.doc = { ...doc, files: mergeFiles(this.doc.files, doc.files) };
    this.lastText = text;
    this.dirty = false;
    this.scene.replaceAllElements(doc.elements);
    this.fixStickies();
    const live = this.map();
    this.selected = new Set([...this.selected].filter((id) => live.has(id)));
    this.pointer = null;
    this.gestureLeft = false;
    this.active = /* @__PURE__ */ new Set();
    this.rebuild(cx);
    this.prepareImages(cx);
  }
  // ---- image files -------------------------------------------------------------------
  /**
   * Herdr draws images only from files under its own home. The board keeps the originals in
   * `<board>.assets/` (relative paths in the file); what is drawn is a downscaled PNG copy in a
   * cache folder under the app home, made here when missing (it is disposable). Images embedded
   * as data URLs (an Excalidraw file) are written to the same cache.
   */
  prepareImages(cx) {
    if (this.preparing) {
      this.prepareAgain = true;
      return;
    }
    this.preparing = true;
    const ticket = this.boardGen.n;
    cx.spawn(async (cx2) => {
      try {
        for (let i2 = 0; this.needFit && i2 < 80; i2++) await cx2.sleep(50);
        let built = 0, rebuiltAt = Date.now();
        do {
          this.prepareAgain = false;
          const todo = Object.entries(this.doc.files ?? {}).filter(([id]) => !this.imageFiles.has(id) && (this.tries.get(id) ?? 0) < TIER_TRIES);
          for (const [id] of todo) this.tries.set(id, (this.tries.get(id) ?? 0) + 1);
          for (let i2 = 0; i2 < todo.length; i2 += 6) {
            await Promise.all(todo.slice(i2, i2 + 6).map(([id, f3]) => this.cacheOne(id, f3, ticket)));
            if (!this.boardGen.current(ticket)) return;
            built++;
            if (Date.now() - rebuiltAt >= 1e3) {
              rebuiltAt = Date.now();
              built = 0;
              this.rebuild(cx2);
            } else cx2.notify();
          }
        } while (this.prepareAgain);
        if (built && this.boardGen.current(ticket)) this.rebuild(cx2);
      } finally {
        if (this.boardGen.current(ticket)) this.preparing = false;
      }
    });
  }
  /** An asset's path, checked: inside `<board>.assets/` by name, and on disk (no `..`, no symlink out, and the assets folder itself is not a symlink). Throws otherwise. */
  async safeAsset(rel, file = this.file) {
    const abs = absAsset(file, rel);
    if (!abs) throw new Error("the picture's path leaves the board's assets folder");
    const r2 = await exec("sh", ["-c", ASSET_CHECK, "sh", abs, assetsDirFor(file)]);
    if (r2.code !== 0) throw new Error("the picture is not inside the board's assets folder");
    return abs;
  }
  /** safeAsset and cacheName in one process: the checked path and the picture's cache key. */
  async assetKey(id, rel, file = this.file) {
    const abs = absAsset(file, rel);
    if (!abs) throw new Error("the picture's path leaves the board's assets folder");
    const r2 = await exec("sh", ["-c", `${ASSET_CHECK}; stat -f %z-%m "$1" 2>/dev/null || echo 0-0`, "sh", abs, assetsDirFor(file)]);
    if (r2.code !== 0) throw new Error("the picture is not inside the board's assets folder");
    const [size, mtime] = String(r2.stdout).trim().split("-");
    return { abs, key: cacheKey(file, id, size ?? "0", mtime ?? "0") };
  }
  /** The cache name of a picture: board + id + content (size and modified time). */
  async cacheName(id, abs, file = this.file) {
    const r2 = await exec("stat", ["-f", "%z-%m", abs]).catch(() => null);
    const [size, mtime] = (r2?.code === 0 ? r2.stdout.trim() : "0-0").split("-");
    return cacheKey(file, id, size, mtime);
  }
  async cacheOne(id, f3, ticket = this.boardGen.n, need = 0) {
    const file = this.file;
    const live = () => this.boardGen.current(ticket) && this.file === file;
    try {
      await fs2.mkdir(`${appHome()}/${CACHE}`, { recursive: true });
      const m2 = /^data:image\/([a-z0-9+.-]+);base64,(.*)$/is.exec(f3?.dataURL ?? "");
      if (m2) {
        const ext = { jpeg: "jpg", "svg+xml": "svg" }[m2[1].toLowerCase()] ?? m2[1].toLowerCase();
        const safe = cacheKey(file, id, "data", 0);
        await fs2.writeFile(`${appHome()}/${CACHE}/${safe}.${ext}`, Buffer.from(m2[2], "base64"));
        if (live()) this.imageFiles.set(id, `${CACHE}/${safe}.${ext}`);
        return;
      }
      if (!f3?.path) return;
      const { abs, key } = await this.assetKey(id, f3.path, file);
      if (extOf(f3.path) === "svg") {
        const cache2 = `${CACHE}/${key}.svg`;
        if (!await fs2.exists(`${appHome()}/${cache2}`)) await exec("cp", [abs, `${appHome()}/${cache2}`]);
        if (!live()) return;
        this.pics.set(id, { abs, key, single: cache2 });
        this.imageFiles.set(id, cache2);
        return;
      }
      const max = f3.kind === "video" ? CACHE_SIDE : 0;
      const tier = tierFor(Math.max(this.needPx(id), need), max);
      const cache = `${CACHE}/${tierFile(key, tier)}`;
      if (await this.copyMissing(cache)) {
        const px = await this.makeCache(abs, `${appHome()}/${cache}`, f3.kind, tier);
        if (px && live()) this.pixels.set(id, px);
      }
      if (!live()) return;
      this.pics.set(id, { abs, key, kind: f3.kind, max, files: /* @__PURE__ */ new Map([[tier, cache]]) });
      this.imageFiles.set(id, cache);
      if (f3.kind === "video" && f3.duration == null) {
        this.probeDuration(abs).then((d2) => {
          if (d2 != null) f3.duration = d2;
        }, () => {
        });
      }
    } catch (e5) {
      console.log(`board: image ${id}: ${e5?.message ?? e5}`);
    }
  }
  /**
   * Writes one drawable copy of an asset: a PNG at most `side` on the long side (0: the source's
   * own size; a video's poster frame, a GIF's first frame). Returns the source's pixel size.
   */
  async makeCache(src, dest, kind, side = CACHE_SIDE) {
    let from = src;
    if (kind === "video") {
      const tmp = `${appHome()}/${CACHE}/ql-${makeId()}`;
      await fs2.mkdir(tmp, { recursive: true });
      await exec("qlmanage", ["-t", "-s", String(CACHE_SIDE), "-o", tmp, src]);
      from = `${tmp}/${src.slice(src.lastIndexOf("/") + 1)}.png`;
    }
    const r2 = await exec("sh", ["-c", MAKE_COPY, "sh", from, dest, String(side)]);
    if (from !== src) await exec("rm", ["-rf", from.slice(0, from.lastIndexOf("/"))]);
    if (r2.code !== 0) throw new Error(String(r2.stderr || "sips failed").trim());
    const [w4, h3] = String(r2.stdout).trim().split(" ").map(Number);
    return w4 > 0 && h3 > 0 ? { w: w4, h: h3 } : null;
  }
  /** Device pixels the largest element showing this picture covers on its long side, at the current zoom. */
  needPx(fileId) {
    let need = 0;
    for (const e5 of this.elements()) if (e5.type === "image" && e5.fileId === fileId) need = Math.max(need, e5.width, e5.height);
    return need * this.scale() * DEVICE_PX;
  }
  /**
   * The file to draw for picture `e` now, and the copy it replaced if that was just now (drawn
   * under it for a moment: the host loads a new file asynchronously and shows nothing until then).
   * The replaced copy is remembered per element: two elements can share a file and still need
   * different tiers, and a swap on one is not a swap on the other. A different picture on the
   * same element (flip, grayscale, or undo) is not a tier swap. Asks for a better-sized copy
   * when the view wants one and that tier has not already failed too often.
   */
  drawnFile(e5) {
    const pic = this.pics.get(e5.fileId);
    if (!pic?.files) return { file: this.imageFiles.get(e5.fileId), under: null };
    const want = tierFor(Math.max(e5.width, e5.height) * this.scale() * DEVICE_PX, pic.max);
    const got = pickTier(want, pic.files.keys());
    if (got !== want && (pic.tierTries?.get(want) ?? 0) < TIER_TRIES) this.tierWant.add(`${e5.fileId}|${want}`);
    const file = pic.files.get(got) ?? this.imageFiles.get(e5.fileId);
    const now = Date.now();
    let slot = this.picShown.get(e5.id);
    if (!slot || slot.fileId !== e5.fileId) this.picShown.set(e5.id, slot = { file: null, under: null, fileId: e5.fileId });
    if (slot.file && slot.file !== file) {
      slot.under = { file: slot.file, until: now + SWAP_MS };
      this.swapUntil = Math.max(this.swapUntil ?? 0, now + SWAP_MS);
    }
    slot.file = file;
    return { file, under: slot.under && slot.under.until > now ? slot.under.file : null };
  }
  /** The drawable copy is not in the cache yet. */
  async copyMissing(rel) {
    return !await fs2.exists(`${appHome()}/${rel}`);
  }
  /** The asset a later copy would read is still a real file inside `<board>.assets/` (not a symlink out). */
  async assetStillInside(abs, file = this.file) {
    const r2 = await exec("sh", ["-c", `${ASSET_CHECK}; [ -f "$1" ]`, "sh", abs, assetsDirFor(file)]);
    if (r2.code !== 0) throw new Error("the picture is not inside the board's assets folder");
  }
  /** Makes the copies the view asked for, six at a time, off the render path. A tier that fails is not tried again in this pass. */
  buildTiers(cx) {
    if (this.tiering || !this.tierWant.size) return;
    this.tiering = true;
    const ticket = this.boardGen.n, file = this.file;
    const live = () => this.boardGen.current(ticket) && this.file === file;
    cx.spawn(async (cx2) => {
      const attempted = /* @__PURE__ */ new Set();
      try {
        while (this.tierWant.size && live()) {
          const batch = [...this.tierWant].filter((w4) => !attempted.has(w4)).slice(0, 6);
          if (!batch.length) break;
          for (const w4 of batch) {
            this.tierWant.delete(w4);
            attempted.add(w4);
          }
          await Promise.all(batch.map(async (w4) => {
            const at = w4.lastIndexOf("|");
            const id = w4.slice(0, at), tier = Number(w4.slice(at + 1));
            const pic = this.pics.get(id);
            if (!pic?.files || pic.files.has(tier)) return;
            if ((pic.tierTries?.get(tier) ?? 0) >= TIER_TRIES) return;
            const cache = `${CACHE}/${tierFile(pic.key, tier)}`;
            try {
              if (await this.copyMissing(cache)) {
                await this.assetStillInside(pic.abs, file);
                await this.makeCache(pic.abs, `${appHome()}/${cache}`, pic.kind, tier);
              }
              if (live() && this.pics.get(id) === pic) pic.files.set(tier, cache);
            } catch (e5) {
              if (live() && this.pics.get(id) === pic) {
                const n2 = (pic.tierTries?.get(tier) ?? 0) + 1;
                if (!pic.tierTries) pic.tierTries = /* @__PURE__ */ new Map();
                pic.tierTries.set(tier, n2);
                if (n2 < TIER_TRIES) this.tierWant.add(w4);
              }
              console.log(`board: image ${id} at ${tier || "full"}: ${e5?.message ?? e5}`);
            }
          }));
          if (live()) cx2.notify();
        }
      } finally {
        if (this.boardGen.current(ticket)) this.tiering = false;
      }
    });
  }
  async pixelSize(path) {
    const r2 = await exec("sips", ["-g", "pixelWidth", "-g", "pixelHeight", path]);
    const w4 = Number(/pixelWidth: (\d+)/.exec(r2.stdout)?.[1]);
    const h3 = Number(/pixelHeight: (\d+)/.exec(r2.stdout)?.[1]);
    return w4 > 0 && h3 > 0 ? { w: w4, h: h3 } : { w: 400, h: 300 };
  }
  markDirty() {
    this.groupIdx = null;
    this.saveError = null;
    this.dirty = true;
    this.saveAt = Date.now() + 400;
  }
  tick(cx) {
    globalThis.__runDueTimers();
    if (this.status !== "ready") return;
    if (this.needFit && !this.size) this.sizeWait = (this.sizeWait ?? 0) + 1;
    if (this.needFit && (this.size || this.sizeWait > 15)) {
      this.needFit = false;
      this.fitView(cx, 1);
      return;
    }
    if (!this.preparing && Object.keys(this.doc.files ?? {}).some((id) => !this.imageFiles.has(id) && (this.tries.get(id) ?? 0) < TIER_TRIES)) this.prepareImages(cx);
    if (!this.preparing) this.buildTiers(cx);
    if (this.swapUntil && Date.now() > this.swapUntil) {
      this.swapUntil = 0;
      cx.notify();
    }
    this.endAbandonedGesture(cx);
    const now = Date.now();
    if (autosaveDue({
      dirty: this.dirty,
      saving: this.saves.saving,
      now,
      saveAt: this.saveAt,
      blocked: pointerBlocksSave(this.pointer, this.paneHover),
      editing: this.editing
    })) {
      cx.spawn(async (cx2) => this.save(cx2));
    }
  }
  /** Saves the board; true only if the file on disk now holds what is on the board.
   * One save at a time. A caller that arrives mid-write waits, then writes
   * again only when that save left newer edits dirty. */
  async save(cx) {
    return this.enqueueSave(() => this.performSave(cx));
  }
  async performSave(cx) {
    if (!this.dirty) return true;
    let ok = false;
    const text = serializeDocument({ ...this.doc, elements: this.scene.getElementsIncludingDeleted() });
    const seq = this.saveAt;
    this.saving = true;
    this.saves.start();
    try {
      await writeTextFile2(this.file, text, this.lastText);
      this.lastText = text;
      if (this.saveAt === seq) this.dirty = false;
      this.saveError = null;
      ok = saveCommitted({ dirty: this.dirty, adoptedExternal: false });
    } catch (e5) {
      const disk = await readTextFile(this.file).catch(() => null);
      const changed = externalChange(disk, this.lastText);
      let adoptedExternal = false;
      if (changed) {
        await this.applyExternal(changed, cx);
        this.saveError = "the file changed on disk; not overwritten";
        adoptedExternal = !this.dirty;
      } else {
        const message = String(e5?.message ?? e5);
        if (this.saveError !== message) {
          notify({ title: "Board: save failed", body: message, level: "error" });
        }
        this.saveError = message;
      }
      if (this.dirty) this.saveAt = backoffSaveAt(Date.now());
      ok = saveCommitted({ dirty: this.dirty, adoptedExternal });
    } finally {
      this.saving = false;
      this.saves.finish();
      cx.notify();
    }
    return ok;
  }
  async close(cx) {
    this.closed = true;
    if (this.editing) this.endEdit(cx, {});
    this.endAbandonedGesture(cx);
    if (this.dirty && this.status === "ready") await this.save(cx);
  }
  // ---- rendering ---------------------------------------------------------------------
  shapeOptions() {
    return {
      shapeConfig: { isExporting: false, canvasBackgroundColor: this.doc.appState.viewBackgroundColor ?? "#ffffff", embedsValidationStatus: /* @__PURE__ */ new Map() },
      imagePath: (id) => this.imageFiles.get(id),
      markerBg: hex(theme().background, "#000000"),
      hiddenText: this.editing ? /* @__PURE__ */ new Set([this.editing.id]) : null,
      onError: (el, e5) => console.log(`board: can't draw ${el.type} ${el.id}: ${e5?.message ?? e5}`)
    };
  }
  /** Rebuilds the static layers from every element not drawn live. */
  rebuild(cx) {
    this.groupIdx = null;
    const all = this.elements().filter((e5) => !this.active.has(e5.id));
    const els = [...all.filter(isMarker), ...all.filter((e5) => !isMarker(e5))];
    const s2 = this.drawScale();
    this.layers = buildLayers(els, this.map(), s2, this.shapeOptions());
    this.builtVz = s2;
    while (this.layerViews.length < this.layers.length) this.layerViews.push(cx.new(this.Layer, { idx: this.layerViews.length }));
    for (const v3 of this.layerViews) cx.notify(v3);
    cx.notify(this.liveView);
    cx.notify();
  }
  drawList(draw, vz) {
    return draw.map((d2) => {
      if (d2.kind === "path") return window.paint_path(d2.path, d2.color).absolute().top(0).left(0).size_full();
      if (d2.kind === "image") return image(d2.file).absolute().left(d2.x * vz).top(d2.y * vz).w(d2.w * vz).h(d2.h * vz);
      const { left, top, w: w4, lineHeight, fontSize } = textBox(d2, vz);
      return div2().absolute().left(left).top(top).w(w4).font_family(d2.font).text_size(fontSize).line_height(`${lineHeight}px`).text_color(d2.color).whitespace_nowrap().children(d2.lines.map((line) => {
        const row = div2().w_full().h(lineHeight).child(line || " ");
        return d2.align === "center" ? row.text_center() : d2.align === "right" ? row.text_right() : row;
      }));
    });
  }
  renderLayer(idx) {
    const layer = this.layers[idx];
    return div2().absolute().top(0).left(0).size_full().children(layer ? this.drawList(layer.draw, this.builtVz) : []);
  }
  /** Elements being drawn or dragged, the selection outline, the marquee. */
  renderLive() {
    const s2 = this.drawScale(), ws = this.scale();
    const map = this.map();
    const els = [...this.active].map((id) => map.get(id)).filter(Boolean);
    const draw = buildLayers(els, map, s2, this.shapeOptions()).flatMap((l2) => l2.draw);
    const pad = 6 / this.vz;
    const outline = (b2, color, dash) => ({ kind: "path", color, path: rectPath((b2[0] - pad) * s2, (b2[1] - pad) * s2, (b2[2] + pad) * s2, (b2[3] + pad) * s2, 1.5, dash) });
    const selected = [...this.selected].map((id) => map.get(id)).filter(Boolean);
    if (!this.editing) {
      for (const el of selected) draw.push(outline(boundsOf(el, map), sel(), null));
      if (selected.length > 1) draw.push(outline(commonOf(selected, map), sel(), [4, 4]));
    }
    const lin = this.linearHandles();
    if (lin) {
      for (const pt3 of Object.values(lin.handles)) {
        const c3 = { x: pt3.x * s2, y: pt3.y * s2 };
        draw.push({ kind: "path", color: theme().background ?? "#ffffff", path: rectPath(c3.x - HANDLE, c3.y - HANDLE, c3.x + HANDLE, c3.y + HANDLE, 0) });
        draw.push({ kind: "path", color: sel(), path: rectPath(c3.x - HANDLE, c3.y - HANDLE, c3.x + HANDLE, c3.y + HANDLE, 1.5) });
      }
    }
    const sb = lin ? null : this.selectionBox();
    if (sb && !sb.markersOnly && !(this.pointer?.mode === "move" && this.pointer.started)) {
      const wide = sb.box.width * ws >= 40, tall = sb.box.height * ws >= 40;
      for (const hp of HANDLES) {
        if ((hp === "n" || hp === "s") && !wide) continue;
        if ((hp === "e" || hp === "w") && !tall) continue;
        const pt3 = handlePoint(sb.box, hp), c3 = { x: pt3.x * s2, y: pt3.y * s2 };
        draw.push({ kind: "path", color: theme().background ?? "#ffffff", path: rectPath(c3.x - HANDLE, c3.y - HANDLE, c3.x + HANDLE, c3.y + HANDLE, 0) });
        draw.push({ kind: "path", color: sel(), path: rectPath(c3.x - HANDLE, c3.y - HANDLE, c3.x + HANDLE, c3.y + HANDLE, 1.5) });
      }
    }
    const p3 = this.pointer;
    if (p3?.mode === "textbox" && p3.active) {
      const [x1, x22] = [Math.min(p3.start.x, p3.cur.x), Math.max(p3.start.x, p3.cur.x)];
      draw.push({ kind: "path", color: sel(), path: rectPath(x1 * s2, p3.start.y * s2, x22 * s2, (p3.start.y + this.style.fontSize * 1.4) * s2, 1, [4, 4]) });
    }
    if (p3?.mode === "marquee" && p3.active) {
      const [x1, x22] = [Math.min(p3.start.x, p3.cur.x), Math.max(p3.start.x, p3.cur.x)];
      const [y1, y22] = [Math.min(p3.start.y, p3.cur.y), Math.max(p3.start.y, p3.cur.y)];
      draw.push({ kind: "path", color: `${sel()}1f`, path: rectPath(x1 * s2, y1 * s2, x22 * s2, y22 * s2, 0) });
      draw.push({ kind: "path", color: sel(), path: rectPath(x1 * s2, y1 * s2, x22 * s2, y22 * s2, 1) });
    }
    return div2().absolute().top(0).left(0).size_full().children(this.drawList(draw, s2));
  }
  /**
   * Pictures are drawn here, directly in the board's own render. Herdr only loads image files for
   * images that are part of a mod's own description, not for ones inside the retained layer views
   * the strokes and shapes use (seen in a headless run: the same file drew here and not there), so
   * pictures sit under the layers, in board order. Strokes and stickies always draw above them.
   */
  imageDivs() {
    const vz = this.vz;
    const view = this.viewBox();
    const out = [];
    for (const e5 of this.elements()) {
      if (e5.type !== "image" || !this.imageFiles.has(e5.fileId)) continue;
      if (e5.x > view[2] || e5.x + e5.width < view[0] || e5.y > view[3] || e5.y + e5.height < view[1]) continue;
      const media = isMedia(e5);
      const anim = media && this.playing.has(e5.id) ? this.anim.get(e5.fileId) : null;
      const still = this.drawnFile(e5);
      const file = anim?.state === "ready" ? anim.path : still.file;
      if (still.under && file === still.file) out.push(image(still.under).absolute().left(e5.x * vz).top(e5.y * vz).w(e5.width * vz).h(e5.height * vz));
      out.push(image(file).absolute().left(e5.x * vz).top(e5.y * vz).w(e5.width * vz).h(e5.height * vz));
      if (media) out.push(...this.mediaControls(e5, anim));
    }
    return out;
  }
  /** The play button's diameter in layout px: fixed on screen, smaller only on a tiny picture. */
  playSize(e5) {
    return Math.max(24, Math.min(44, Math.min(e5.width, e5.height) * this.vz * 0.6));
  }
  /** What sits on a video or GIF: poster = play button + badge; building = "preparing…"; playing = a stop button on hover or selection. */
  mediaControls(e5, anim) {
    const t2 = theme();
    const bg = `${hex(t2.background, "#000000")}b3`;
    const fg = hex(t2.foreground, "#ffffff");
    const vz = this.vz;
    const cx = (e5.x + e5.width / 2) * vz, cy = (e5.y + e5.height / 2) * vz;
    const playing = this.playing.has(e5.id);
    if (playing && anim?.state === "building") {
      return [div2().absolute().left(cx - 48).top(cy - 13).w(96).h(26).rounded(13).bg(bg).flex().items_center().justify_center().text_size(12).text_color(fg).child("preparing\u2026")];
    }
    const d2 = this.playSize(e5);
    const button = (icon) => div2().absolute().left(cx - d2 / 2).top(cy - d2 / 2).w(d2).h(d2).rounded(d2 / 2).bg(bg).border(1.5).border_color(`${fg}8c`).flex().items_center().justify_center().child(svg(`${ICONS}/${icon}.svg`).size(Math.round(d2 * 0.45)).text_color(fg));
    if (playing) return this.hoverId === e5.id || this.selected.has(e5.id) ? [button("stop")] : [];
    const label = mediaLabel(e5.customData?.kind, this.doc.files?.[e5.fileId]?.duration);
    const bw = lineWidth(label, 11) + 14;
    const badge = div2().absolute().left((e5.x + e5.width) * vz - 8 - bw).top((e5.y + e5.height) * vz - 8 - 20).w(bw).h(20).rounded(5).bg(bg).flex().items_center().justify_center().text_size(11).text_color(fg).child(label);
    return [button("play"), badge];
  }
  /** The media element whose play/stop button is under a pointer position (GPUI px), if it is showing. */
  playButtonAt(local) {
    const z3 = this.herdrZoom(), s2 = this.scale();
    for (const e5 of this.elements()) {
      if (!isMedia(e5) || !this.imageFiles.has(e5.fileId)) continue;
      if (this.playing.has(e5.id) && !(this.hoverId === e5.id || this.selected.has(e5.id))) continue;
      const cx = (e5.x + e5.width / 2 + this.scrollX) * s2, cy = (e5.y + e5.height / 2 + this.scrollY) * s2;
      if (Math.hypot(local.x - cx, local.y - cy) <= this.playSize(e5) / 2 * z3 + 4) return e5;
    }
    return null;
  }
  // ---- play and stop -------------------------------------------------------------------
  /** Play or stop one picture. Starting one stops any other. Nothing plays unless the user starts it. */
  togglePlay(el, cx) {
    if (this.playing.has(el.id)) {
      this.playing.delete(el.id);
      this.playTickets.delete(el.id);
      cx.notify();
      return;
    }
    this.playing = /* @__PURE__ */ new Set([el.id]);
    const request = ++this.playSeq;
    this.playTickets = /* @__PURE__ */ new Map([[el.id, request]]);
    this.selected = /* @__PURE__ */ new Set([el.id]);
    const f3 = this.doc.files?.[el.fileId];
    const cur = this.anim.get(el.fileId);
    if (cur?.state === "ready" || cur?.state === "building") {
      cx.notify();
      return;
    }
    this.anim.set(el.fileId, { state: "building" });
    cx.notify();
    const file = this.file, ticket = this.boardGen.n, fileId = el.fileId;
    cx.spawn(async (cx2) => {
      try {
        const path = await this.buildAnim(fileId, f3, cx2, file, ticket);
        if (!this.boardGen.current(ticket)) return;
        this.anim.set(fileId, { state: "ready", path });
      } catch (e5) {
        if (!this.boardGen.current(ticket)) return;
        this.anim.set(fileId, { state: "error" });
        let waiting = false;
        for (const id of [...this.playTickets.keys()]) {
          if (!this.playing.has(id)) continue;
          const cur2 = this.scene.getElement(id);
          if (cur2?.fileId !== fileId) continue;
          this.playTickets.delete(id);
          this.playing.delete(id);
          waiting = true;
        }
        if (waiting) this.say("Board: can't play this here", `${String(e5?.message ?? e5)}. Double-click opens it in your player.`, "warning");
      }
      cx2.notify();
    });
  }
  /** Runs a command-line tool; Herdr's PATH may not have Homebrew's folders, so those are tried too. */
  async tool(name, args) {
    return exec(await this.toolPath(name), args);
  }
  async probeDuration(src) {
    const r2 = await this.tool("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]);
    const d2 = parseFloat(r2.stdout);
    return d2 >= 0 ? d2 : null;
  }
  /**
   * The animated copy: a GIF with every frame kept (a video: about 15 fps, no audio, at most 60 s), long side at most 720.
   * Cached next to the poster; made by ffmpeg in the background (exec has a 30 s limit) and waited for here.
   */
  async buildAnim(id, f3, cx, file = this.file, ticket = this.boardGen.n) {
    if (!f3?.path) throw new Error("no file");
    const src = await this.safeAsset(f3.path, file);
    const safe = await this.cacheName(id, src, file);
    const out = `${appHome()}/${CACHE}/${safe}.anim.gif`;
    if (await fs2.exists(out)) return `${CACHE}/${safe}.anim.gif`;
    const fit = "scale='if(gt(iw,ih),min(720,iw),-2)':'if(gt(iw,ih),-2,min(720,ih))':flags=lanczos";
    const vf = `${f3.kind === "video" ? "fps=15," : ""}${fit},split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=5`;
    await fs2.mkdir(`${appHome()}/${CACHE}`, { recursive: true });
    const bin = await this.toolPath("ffmpeg");
    const attempt = animAttempt(out, makeId());
    await exec("rm", ["-f", ...attempt.clear]);
    const [cmd, args] = ffmpegAnimArgs(bin, src, vf, attempt.tmp, out, attempt.fail);
    await exec(cmd, args);
    for (let i2 = 0; i2 < 1200; i2++) {
      if (!this.boardGen.current(ticket)) throw new Error("board changed");
      await cx.sleep(500);
      if (!this.boardGen.current(ticket)) throw new Error("board changed");
      if (await fs2.exists(out)) return `${CACHE}/${safe}.anim.gif`;
      if (await fs2.exists(attempt.fail)) {
        await exec("rm", ["-f", attempt.fail, attempt.tmp]);
        throw new Error("ffmpeg could not convert it");
      }
    }
    throw new Error("converting took too long");
  }
  async toolPath(name) {
    for (const bin of [name, `/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`]) {
      try {
        await exec(bin, ["-version"]);
        return bin;
      } catch {
      }
    }
    throw new Error(`${name} is not installed (brew install ffmpeg)`);
  }
  /** The view in scene units, with a quarter of its size spare on each side. */
  viewBox() {
    const s2 = this.scale();
    const w4 = (this.size?.width ?? 4e3) / s2;
    const h3 = (this.size?.height ?? 4e3) / s2;
    return [-this.scrollX - w4 * 0.25, -this.scrollY - h3 * 0.25, -this.scrollX + w4 * 1.25, -this.scrollY + h3 * 1.25];
  }
  /** Static layers whose bounds meet the view. */
  visibleLayerViews() {
    const view = this.viewBox();
    return this.layers.map((l2, i2) => [l2.bounds, this.layerViews[i2]]).filter(([b2]) => b2[0] <= view[2] && view[0] <= b2[2] && b2[1] <= view[3] && view[1] <= b2[3]).map(([, v3]) => v3);
  }
  render(_cx) {
    const t2 = theme();
    const root = div2().id(MOD).size_full().relative().overflow_hidden().bg(t2.background ?? "#ffffff").on_size_change((size, cx) => {
      this.size = size;
      cx.notify();
    });
    if (this.status === "pick") {
      const list = this.picker.render(t2, this.pickerActions(), this.overlay ? { title: "Open a board", escHint: true } : { title: "Open a board in this pane", escHint: Boolean(this.file), bg: t2.background });
      const host = this.overlay ? div2().id(MOD).w_full() : root;
      return host.track_focus(this.focus).on_key_down((e5, cx) => this.pickerKey(e5, cx)).child(list);
    }
    if (this.status !== "ready") {
      const message = this.status === "error" ? ["Can't open the board.", this.error] : ["Loading\u2026"];
      return root.child(div2().p(16).gap(8).text_size(13).text_color(t2.foreground).children(message.map((m2) => div2().child(m2))));
    }
    const ui2 = uiColors();
    const bg = t2.background ?? "#1e1e1e";
    const cursor = (el) => this.tool === "hand" || this.spaceDown ? el.cursor_grab() : this.tool === "text" ? el.cursor_text() : this.tool === "selection" ? el.cursor_default() : el.cursor_crosshair();
    const canvas = wireDrop(cursor(div2().id("canvas").absolute().top(0).left(0).size_full().bg(bg).overflow_hidden()).on_mouse_down("left", (e5, cx) => this.onDown(e5, cx)).on_mouse_down("middle", (e5, cx) => this.onPanStart(e5, cx)).on_mouse_down("right", (e5, cx) => this.onContext(e5, cx)).on_mouse_move((e5, cx) => this.onMove(e5, cx)).on_hover((over, cx) => {
      if (!over && this.pointer) this.onUp(cx);
    }).on_mouse_up("left", (e5, cx) => this.onUp(cx)).on_mouse_up("middle", (e5, cx) => this.onUp(cx)).on_scroll_wheel((e5, cx) => this.onWheel(e5, cx)).child(div2().absolute().left(this.scrollX * this.vz).top(this.scrollY * this.vz).size_full().children([...this.imageDivs(), ...this.visibleLayerViews(), this.liveView, ...this.textEditor()])).child(this.emptyHint(ui2)), this.dropTarget, (paths, cx) => this.importPaths(paths, cx));
    return root.track_focus(this.focus).on_hover((hovered) => {
      this.paneHover = hovered;
      if (hovered === false && this.pointer) this.gestureLeft = true;
    }).on_mouse_up("left", (_e2, cx) => this.onUp(cx)).on_mouse_up("middle", (_e2, cx) => this.onUp(cx)).on_key_down((e5, cx) => this.onKey(e5, cx)).on_key_up((e5, cx) => {
      if (e5.key === "space") {
        this.spaceDown = false;
        cx.notify();
      }
    }).children([canvas, this.topBar(ui2), this.quickActions(ui2), this.toolbar(ui2), this.stylePanel(ui2), this.statusBar(ui2), this.renderMenu(ui2)]);
  }
  /** State a: a first step for an empty board, gone as soon as there is anything on the canvas.
   * State b: "Drop to add" while files are dragged over the canvas, on any board. */
  emptyHint(ui2) {
    const hint = canvasHint({ count: this.elements().length, editing: this.editing, pointer: this.pointer, dragOver: this.dropTarget.over });
    if (!hint) return div2();
    const centred = () => div2().flex().flex_col().items_center().justify_center();
    if (hint === "drop") {
      const { accent, tint } = dropColors();
      return dashedBorder(div2().absolute().top(24).left(24).right(24).bottom(24).border(2)).border_color(accent).rounded(6).bg(tint).child(centred().size_full().children([
        svg(`${ICONS}/drop.svg`).size(28).text_color(accent).mb(12),
        div2().text_size(13).font_semibold().text_color(accent).child("Drop to add")
      ]));
    }
    return centred().absolute().top(0).left(0).size_full().children([
      svg(`${ICONS}/drop.svg`).size(28).text_color(ui2.foreground).mb(12),
      div2().text_size(13).font_semibold().text_color(ui2.foreground).child("Drop, paste or draw"),
      div2().text_size(11).text_color(ui2.muted).mt(8).child("\u2318V paste \xB7 D draw \xB7 N note \xB7 T text")
    ]);
  }
  textEditor() {
    if (!this.editing) return [];
    const el = this.scene.getElement(this.editing.id);
    if (!el) return [];
    const vz = this.vz;
    if (this.editing.sticky) {
      const editor2 = Textarea.new(this.editing.state).font_family("Helvetica Neue").text_size(STICKY_FONT * vz).text_color("#1e1e1e");
      return [div2().id("text-editor").absolute().left((el.x + STICKY_PAD) * vz).top((el.y + STICKY_PAD) * vz).w((el.width - 2 * STICKY_PAD) * vz).key_context("ExcalidrawTextEditor").on_action("excalidraw_end_edit", (_e2, cx) => this.endEdit(cx, {})).on_key_down((e5, cx) => {
        if (e5.key === "escape") this.endEdit(cx, {});
      }).child(editor2)];
    }
    const container = el.containerId ? this.scene.getElement(el.containerId) : null;
    let x3 = el.x;
    let width = el.autoResize === false ? el.width + 4 : Math.max(el.width + el.fontSize * 2, 120);
    let top = el.y;
    if (container) {
      const lines = this.editing.state.value().split("\n");
      const textW = Math.max(...lines.map((l2) => lineWidth(l2, el.fontSize)), el.fontSize);
      const textH = lines.length * el.fontSize * el.lineHeight;
      width = Math.min(textW + el.fontSize, container.width);
      x3 = container.x + (container.width - width) / 2;
      top = container.y + Math.max(0, (container.height - textH) / 2) - 3 / vz;
    }
    let editor = Textarea.new(this.editing.state).font_family(fontName(el.fontFamily)).text_size(el.fontSize * vz).text_color(toColor(el.strokeColor) ?? "#1e1e1e");
    if (container) editor = editor.text_center();
    return [div2().id("text-editor").absolute().left(x3 * vz).top(top * vz).w(width * vz).p(2).rounded(4).border(1).border_color(sel()).bg(`${sel()}0d`).key_context("ExcalidrawTextEditor").on_action("excalidraw_end_edit", (_e2, cx) => this.endEdit(cx, {})).on_key_down((e5, cx) => {
      if (e5.key === "escape") this.endEdit(cx, {});
    }).child(editor)];
  }
  button(id, label, active, t2, onPress) {
    return div2().id(id).px(8).py(4).rounded(6).text_size(14).cursor_pointer().bg(active ? t2.selected : "#00000000").text_color(t2.foreground).hover((s2) => s2.bg(t2.hover)).on_mouse_down("left", (e5, cx) => {
      cx.stop_propagation();
      onPress(cx);
    }).child(label);
  }
  /** True while stickies are what you are making or editing: the swatches then pick a note color. */
  stickyMode() {
    const map = this.map();
    const selected = [...this.selected].map((id) => map.get(id)).filter(Boolean);
    return this.tool === "sticky" || selected.length > 0 && selected.every(isSticky);
  }
  toolbarPress(it, cx) {
    if (it.id === "image") return this.pickImages(cx);
    if (it.id === "shape") {
      if (SHAPES.includes(this.tool)) return this.setTool(SHAPES[(SHAPES.indexOf(this.tool) + 1) % SHAPES.length], cx);
      return this.setTool(this.shapeKind, cx);
    }
    this.setTool(it.id, cx);
  }
  toolbar(t2) {
    const active = (id) => this.editing ? id === (this.editing.sticky ? "sticky" : "text") : id === "shape" ? SHAPES.includes(this.tool) : this.tool === id;
    const tool = (it, i2) => it === null ? div2().w(1).h(20).mx(6).bg(t2.border) : div2().id(`tool-${it.id}`).w(34).h(32).flex().items_center().justify_center().rounded(8).cursor_pointer().tooltip(`${it.title} \u2014 ${it.key}`).bg(active(it.id) ? sel() : "#00000000").hover((s2) => s2.bg(active(it.id) ? sel() : t2.hover)).on_mouse_down("left", (e5, cx) => {
      cx.stop_propagation();
      this.toolbarPress(it, cx);
    }).child(svg(`${ICONS}/${it.id === "shape" ? this.shapeKind : it.icon}.svg`).size(18).text_color(active(it.id) ? theme().accent_foreground ?? "#ffffff" : t2.foreground));
    const sticky = this.stickyMode();
    const map = this.map();
    const first = [...this.selected].map((id) => map.get(id)).find(Boolean);
    const colors = sticky ? STICKY_COLORS : INK.map((c3) => c3 ?? hex(theme().foreground, "#e8e8e8"));
    const current = sticky ? first?.backgroundColor ?? this.stickyColor : this.tool === "highlighter" ? this.markerInk : this.style.strokeColor;
    const swatch = (c3) => div2().id(`swatch-${c3}`).w(20).h(20).rounded(10).cursor_pointer().bg(c3).border(current === c3 ? 2 : 1).border_color(current === c3 ? sel() : t2.swatchBorder).on_mouse_down("left", (e5, cx) => {
      cx.stop_propagation();
      sticky ? this.applyStickyColor(c3, cx) : this.applyStyle("color", c3, cx);
    });
    return div2().absolute().bottom(14).left(0).w_full().flex().justify_center().child(
      div2().flex().items_center().gap(2).p(5).rounded(12).bg(t2.surface).border(1).border_color(t2.border).on_mouse_down("left", (e5, cx) => cx.stop_propagation()).children([...TOOLS.map(tool), div2().w(1).h(20).mx(6).bg(t2.border), div2().flex().items_center().gap(8).px(4).children(colors.map(swatch))])
    );
  }
  /** tldraw's small bar above the toolbar: undo, redo, delete, duplicate. Greyed when there is nothing to do; tooltips give the keys. */
  quickActions(t2) {
    const has = this.selected.size > 0;
    const item = (id, glyph, tip, on4, fn) => div2().id(`qa-${id}`).w(30).h(26).flex().items_center().justify_center().rounded(6).text_size(14).text_color(on4 ? t2.foreground : t2.muted).opacity(on4 ? 1 : 0.4).tooltip(tip).when(on4, (el) => el.cursor_pointer().hover((s2) => s2.bg(t2.hover))).on_mouse_down("left", (e5, cx) => {
      cx.stop_propagation();
      if (on4) fn(cx);
    }).child(glyph);
    const del = (cx) => {
      this.history.record(this.scene.getElementsIncludingDeleted());
      this.deleteIds(new Set(this.selected));
      this.markDirty();
      this.rebuild(cx);
    };
    return div2().absolute().bottom(66).left(0).w_full().flex().justify_center().child(
      div2().flex().items_center().gap(1).p(3).rounded(10).bg(t2.surface).border(1).border_color(t2.border).on_mouse_down("left", (e5, cx) => cx.stop_propagation()).children([
        item("undo", "\u21B6", "Undo \u2014 \u2318Z", this.history.undoStack.length > 0, (cx) => this.undo(cx)),
        item("redo", "\u21B7", "Redo \u2014 \u21E7\u2318Z", this.history.redoStack.length > 0, (cx) => this.redo(cx)),
        item("delete", "\u232B", "Delete \u2014 \u232B", has, del),
        item("dup", "\u29C9", "Duplicate \u2014 \u2318D", has, (cx) => this.duplicateSelection(cx))
      ])
    );
  }
  /** tldraw's panel: colour grid, opacity, fill, dash, size, then font and align for text. Shows only the rows that apply. */
  stylePanel(t2) {
    const map = this.map();
    const selected = [...this.selected].map((id) => map.get(id)).filter((e5) => e5 && e5.type !== "image" && !isSticky(e5));
    const tool = this.tool;
    const drawing = !["selection", "hand", "eraser", "sticky"].includes(tool);
    const kinds = new Set(drawing ? [tool === "shape" ? this.shapeKind : tool] : selected.map((e5) => isMarker(e5) ? "highlighter" : e5.type));
    if (this.stickyMode()) return this.notePanel(t2);
    if (!kinds.size) return div2();
    const shape = ["rectangle", "diamond", "ellipse"].some((k3) => kinds.has(k3));
    const linear = kinds.has("arrow") || kinds.has("line");
    const text = kinds.has("text") || selected.some((e5) => Z2(e5, map));
    const strokes = kinds.has("freedraw") || kinds.has("highlighter");
    const first = selected[0];
    const st3 = this.style;
    const cur = {
      color: tool === "highlighter" && !selected.length ? this.markerInk : first && !isMarker(first) ? first.strokeColor : st3.strokeColor,
      opacity: first ? first.opacity : st3.opacity,
      fill: first ? fillKindOf(first) : st3.fill,
      dash: first ? dashKindOf(first) : st3.roughness > 0 ? "draw" : st3.strokeStyle,
      stroke: first && first.type !== "text" ? first.strokeWidth : st3.strokeWidth,
      font: first ? first.type === "text" ? first.fontSize : Z2(first, map)?.fontSize ?? st3.fontSize : st3.fontSize,
      family: first?.type === "text" ? first.fontFamily : st3.fontFamily,
      align: first?.type === "text" ? first.textAlign : st3.textAlign
    };
    const fg = hex(theme().foreground, "#e8e8e8");
    const row = (name, items) => div2().flex().flex_wrap().gap(4).children(items);
    const press = (id, el, fn) => el.id(id).cursor_pointer().on_mouse_down("left", (e5, cx) => {
      cx.stop_propagation();
      fn(cx);
    });
    const chip = (id, content, active, fn, w4 = 24) => press(id, div2().w(w4).h(24).rounded(6).flex().items_center().justify_center().text_size(w4 < 20 ? 9 : 12).text_color(t2.foreground).bg(active ? t2.selected : "#00000000").hover((s2) => s2.bg(t2.hover)), fn).child(content);
    const colors = PALETTE.map(([name, solid]) => {
      const c3 = solid ?? fg;
      return press(`col-${name}`, div2().w(24).h(24).rounded(12).bg(c3).border(cur.color === c3 ? 2 : 1).border_color(cur.color === c3 ? sel() : t2.swatchBorder), (cx) => this.applyStyle("color", c3, cx));
    });
    const rows = [row("Color", colors)];
    rows.push(row("Opacity", OPACITIES.map((o2) => chip(`op-${o2}`, `${Math.round(o2 * 100)}`, Math.abs(cur.opacity / 100 - o2) < 0.01, (cx) => this.applyStyle("opacity", o2 * 100, cx), 18))));
    if (shape) rows.push(row("Fill", [["none", "\u2205"], ["semi", "\u25D0"], ["solid", "\u25CF"], ["pattern", "\u25A8"]].map(([k3, g2]) => chip(`fill-${k3}`, g2, cur.fill === k3, (cx) => this.applyStyle("fill", k3, cx)))));
    if (shape || linear) rows.push(row("Dash", [["draw", "\u270E"], ["dashed", "- -"], ["dotted", "\xB7\xB7\xB7"], ["solid", "\u2500\u2500"]].map(([k3, g2]) => chip(`dash-${k3}`, g2, cur.dash === k3, (cx) => this.applyStyle("dash", k3, cx)))));
    if (kinds.has("arrow")) {
      const heads = [[null, "\u2014"], ["arrow", "\u2192"], ["triangle", "\u25B6"], ["bar", "|"], ["dot", "\u25CF"]];
      const curS = first?.type === "arrow" ? first.startArrowhead : st3.arrowStart, curE = first?.type === "arrow" ? first.endArrowhead : st3.arrowEnd;
      rows.push(row("Start", heads.map(([k3, g2]) => chip(`as-${k3}`, g2, curS === k3, (cx) => this.applyStyle("arrowStart", k3, cx), 18))));
      rows.push(row("End", heads.map(([k3, g2]) => chip(`ae-${k3}`, g2, curE === k3, (cx) => this.applyStyle("arrowEnd", k3, cx), 18))));
    }
    if (shape || linear || strokes || text) {
      rows.push(row("Size", PEN_SIZES.map(([lab, w4], i2) => chip(`size-${lab}`, lab, text && !shape && !linear && !strokes ? cur.font === FONT_SIZES[i2][1] : cur.stroke === w4, (cx) => this.applyStyle("size", { stroke: w4, font: FONT_SIZES[i2][1] }, cx)))));
    }
    if (text) {
      rows.push(row("Font", [[1, "\u270E"], [2, "Aa"], [3, "</>"]].map(([f3, g2]) => chip(`font-${f3}`, g2, cur.family === f3, (cx) => this.applyStyle("fontFamily", f3, cx)))));
      rows.push(row("Align", [["left", "\u21E4"], ["center", "\u2194"], ["right", "\u21E5"]].map(([a2, g2]) => chip(`align-${a2}`, g2, cur.align === a2, (cx) => this.applyStyle("textAlign", a2, cx)))));
    }
    if (this.panelCollapsed) {
      return press("style-panel-open", div2().absolute().top(48).right(12).px(10).py(5).rounded(8).text_size(12).bg(t2.surface).border(1).border_color(t2.border).text_color(t2.foreground).hover((s2) => s2.bg(t2.hover)).tooltip("Show the style panel"), (cx) => this.setPanelCollapsed(false, cx)).child("Style \u25B8");
    }
    return div2().id("style-panel").absolute().top(48).right(12).w(128).flex().flex_col().gap(6).p(8).rounded(10).bg(t2.surface).border(1).border_color(t2.border).text_color(t2.foreground).on_mouse_down("left", (e5, cx) => cx.stop_propagation()).children(rows);
  }
  /** A note's panel is just its colours. */
  notePanel(t2) {
    const map = this.map();
    const first = [...this.selected].map((id) => map.get(id)).find(isSticky);
    const cur = first?.backgroundColor ?? this.stickyColor;
    const dots = NOTE_COLORS.map((c3) => div2().id(`note-${c3}`).w(24).h(24).rounded(12).cursor_pointer().bg(c3).border(cur === c3 ? 2 : 1).border_color(cur === c3 ? sel() : t2.swatchBorder).on_mouse_down("left", (e5, cx) => {
      cx.stop_propagation();
      this.applyStickyColor(c3, cx);
    }));
    return div2().id("note-panel").absolute().top(48).right(12).w(128).flex().flex_col().gap(6).p(8).rounded(10).bg(t2.surface).border(1).border_color(t2.border).on_mouse_down("left", (e5, cx) => cx.stop_propagation()).children([div2().flex().flex_wrap().gap(4).children(dots)]);
  }
  setPanelCollapsed(collapsed, cx) {
    this.panelCollapsed = collapsed;
    localStorage.setItem("panelCollapsed", collapsed ? "1" : "0");
    cx.notify();
  }
  /** The board's name and where it is, and whether it is saved (as in the mock's header). */
  topBar(t2) {
    const state = this.editing ? "Editing \xB7 Esc to finish" : this.saveError ? `Save failed: ${this.saveError}` : this.saving ? "Saving\u2026" : this.dirty ? "Unsaved" : this.lastText == null ? "New board" : "Saved";
    const ok = !this.saveError;
    return div2().absolute().top(10).left(0).w_full().px(14).flex().items_center().justify_between().text_size(12).text_color(t2.muted).children([
      div2().flex().gap(8).items_center().children([
        div2().font_semibold().text_color(t2.foreground).child(basename2(this.file).replace(/\.[^.]+$/, "")),
        div2().child(tildify2(this.file))
      ]),
      div2().text_color(ok ? t2.muted : "#e03131").child(`\u25CF ${state}`)
    ]);
  }
  statusBar(t2) {
    const group = (id, children) => div2().absolute().bottom(14).flex().gap(4).items_center().text_size(12).text_color(t2.muted).children(children).id(id);
    const left = group("status-left", [
      this.button("undo", "\u21B6", false, t2, (cx) => this.undo(cx)),
      this.button("redo", "\u21B7", false, t2, (cx) => this.redo(cx)),
      this.button("open", "Open\u2026", false, t2, (cx) => this.switchFile(cx))
    ]).left(12);
    const right = group("status-right", [
      this.button("zoom-out", "\u2212", false, t2, (cx) => this.zoomBy(1 / 1.2, null, cx)),
      this.button("zoom-reset", `${Math.round(this.vz * 100)}%`, false, t2, (cx) => this.setZoom(1, null, cx)),
      this.button("zoom-in", "+", false, t2, (cx) => this.zoomBy(1.2, null, cx)),
      this.button("zoom-fit", "Fit", false, t2, (cx) => this.fitView(cx))
    ]).right(12);
    return div2().child(left).child(right);
  }
  // ---- images, stickies and the clipboard --------------------------------------------
  /** Where new things land: the middle of what you see. */
  viewCenter() {
    return this.toScene({ x: (this.size?.width ?? 800) / 2, y: (this.size?.height ?? 600) / 2 });
  }
  say(title, body, level = "info") {
    notify({ title, body, level });
  }
  /** Copies files into `<board>.assets/` and puts them on the board, fanned out from the view center. */
  async importAsync(paths, cx, bound = { file: this.file, ticket: this.boardGen.n }) {
    const { file, ticket } = bound;
    const here = () => this.boardGen.current(ticket) && this.file === file;
    const dir = assetsDirFor(file);
    const at = this.viewCenter();
    const added = [];
    const files = {};
    let skipped = 0;
    for (const src of paths) {
      const kind = kindOf(src);
      if (!kind) {
        skipped++;
        continue;
      }
      try {
        await exec("mkdir", ["-p", dir]);
        const id = makeId();
        const name = `${id}.${extOf(src)}`;
        const cp = await exec("cp", [src, `${dir}/${name}`]);
        if (cp.code !== 0) throw new Error(cp.stderr.trim() || "cp failed");
        const entry = { path: relAssetFor(file, name), kind };
        await this.cacheOne(id, entry, ticket);
        if (!here()) return;
        if (kind === "video") entry.duration = await this.probeDuration(`${dir}/${name}`).catch(() => null);
        const px = this.pixels.get(id) ?? await this.pixelSize(`${dir}/${name}`);
        if (!here()) return;
        const size = fitSize(px.w, px.h);
        const mime = { jpg: "jpeg", jpeg: "jpeg", svg: "svg+xml", tif: "tiff", heic: "heic" }[extOf(src)] ?? extOf(src);
        const made = newImage({ x: at.x - size.width / 2 + added.length * 28, y: at.y - size.height / 2 + added.length * 28, ...size, fileId: id, path: entry.path, name: src.slice(src.lastIndexOf("/") + 1), kind, mimeType: `${kind === "video" ? "video" : "image"}/${mime}` });
        if (entry.duration != null) made.file.duration = entry.duration;
        added.push(made.element);
        files[id] = made.file;
      } catch (e5) {
        this.say("Board: can't add a file", `${src}: ${e5?.message ?? e5}`, "error");
      }
    }
    if (!here()) return;
    if (skipped) this.say("Board", `${skipped} file${skipped > 1 ? "s" : ""} skipped: not an image, GIF or video`, "warning");
    if (!added.length) return;
    this.history.record(this.scene.getElementsIncludingDeleted());
    this.doc = { ...this.doc, files: { ...this.doc.files, ...files } };
    for (const el of added) this.scene.insertElement(el);
    this.selected = new Set(added.map((e5) => e5.id));
    this.tool = "selection";
    this.markDirty();
    this.rebuild(cx);
    this.say("Board", `Added ${added.length} item${added.length > 1 ? "s" : ""}`);
  }
  importPaths(paths, cx) {
    cx.spawn(async (cx2) => this.importAsync(paths, cx2));
  }
  clip(mode, arg = "") {
    return exec("osascript", ["-l", "JavaScript", "-e", CLIP_JS, mode, arg]);
  }
  /** ⌘V: copied files, else a copied image, else text (as a sticky). */
  pasteClipboard(cx) {
    const bound = { file: this.file, ticket: this.boardGen.n };
    const here = () => this.boardGen.current(bound.ticket) && this.file === bound.file;
    cx.spawn(async (cx2) => {
      try {
        const files = (await this.clip("files")).stdout.split("\n").filter(Boolean);
        if (!here()) return;
        if (files.length) return this.importAsync(files, cx2, bound);
        await fs2.mkdir(`${appHome()}/${CACHE}`, { recursive: true });
        const tmp = `${appHome()}/${CACHE}/paste-${makeId()}.png`;
        if ((await this.clip("get", tmp)).stdout.trim() === "png") {
          await this.importAsync([tmp], cx2, bound);
          await exec("rm", ["-f", tmp]);
          return;
        }
        const text = (await this.clip("text")).stdout.replace(/\n$/, "");
        if (!here()) return;
        if (text.trim()) {
          const c3 = this.viewCenter();
          const el = newSticky({ x: c3.x - 100, y: c3.y - 100, color: this.stickyColor, text });
          this.history.record(this.scene.getElementsIncludingDeleted());
          this.scene.insertElement(el);
          this.selected = /* @__PURE__ */ new Set([el.id]);
          this.markDirty();
          this.rebuild(cx2);
          return;
        }
        this.say("Board", "The clipboard has no image, file or text to paste");
      } catch (e5) {
        this.say("Board: paste failed", String(e5?.message ?? e5), "error");
      }
    });
  }
  selectedImages() {
    const map = this.map();
    return [...this.selected].map((id) => map.get(id)).filter((e5) => e5?.type === "image");
  }
  /** ⌘C copies the selected image's pixels, ⇧⌘C the file(s) themselves (paste into Finder, Slack, Mail). */
  copySelection(asFile, cx, only = null) {
    const imgs = only ?? this.selectedImages();
    const rels = imgs.map((e5) => this.doc.files?.[e5.fileId]?.path).filter(Boolean);
    if (!rels.length) {
      this.say("Board", "Select an image to copy");
      return;
    }
    cx.spawn(async (cx2) => {
      const paths = [];
      for (const rel of rels) {
        try {
          paths.push(await this.safeAsset(rel));
        } catch (e5) {
          this.say("Board: skipped a picture", String(e5?.message ?? e5), "warning");
        }
      }
      if (!paths.length) return;
      const r2 = asFile ? await this.clip("putfile", paths.join("\n")) : await this.clip("put", paths[0]);
      if (r2.code !== 0) this.say("Board: copy failed", r2.stderr.trim(), "error");
      else this.say("Board", asFile ? `Copied ${paths.length} file${paths.length > 1 ? "s" : ""}` : "Copied image");
    });
  }
  async reveal(el) {
    try {
      exec("open", ["-R", await this.safeAsset(this.doc.files?.[el.fileId]?.path)]);
    } catch (e5) {
      this.say("Board", String(e5?.message ?? e5), "warning");
    }
  }
  /** Launch a gif or video. Anything else is refused: `open` would run a script or app shipped in the assets folder. */
  async openMedia(el) {
    const entry = this.doc.files?.[el?.fileId];
    if (!openableMedia(entry?.path, el?.customData?.kind)) {
      this.say("Board", "Only a GIF or video can be opened", "warning");
      return;
    }
    try {
      exec("open", [await this.safeAsset(entry.path)]);
    } catch (e5) {
      this.say("Board", String(e5?.message ?? e5), "warning");
    }
  }
  /** Flip or grayscale: a new picture file next to the original (the original stays, undo works). */
  derive(how, cx) {
    const imgs = this.selectedImages().filter((e5) => e5.customData?.kind === "image" || !e5.customData?.kind);
    if (!imgs.length) {
      this.say("Board", `${how === "flip" ? "Flip" : "Grayscale"} works on still images`);
      return;
    }
    const ids = imgs.map((el) => el.id);
    const file = this.file, ticket = this.boardGen.n;
    cx.spawn(async (cx2) => {
      const pending = [];
      for (const elementId of ids) {
        try {
          let el = this.scene.getElement(elementId);
          if (!el || el.isDeleted) continue;
          const old = this.doc.files?.[el.fileId];
          const src = await this.safeAsset(old?.path);
          if (!this.boardGen.current(ticket)) return;
          el = this.scene.getElement(elementId);
          if (!el || el.isDeleted) continue;
          const fileId = makeId();
          const name = `${fileId}.png`;
          const args = how === "flip" ? ["-f", "horizontal"] : ["-m", GRAY_PROFILE];
          const r2 = await exec("sips", [...args, "-s", "format", "png", src, "--out", `${assetsDirFor(file)}/${name}`]);
          if (r2.code !== 0) throw new Error(r2.stderr.trim() || "sips failed");
          if (!this.boardGen.current(ticket)) return;
          el = this.scene.getElement(elementId);
          if (!el || el.isDeleted) continue;
          const entry = { ...old, id: fileId, path: relAssetFor(file, name), mimeType: "image/png", created: Date.now(), kind: "image" };
          await this.cacheOne(fileId, entry, ticket, Math.max(el.width, el.height) * this.scale() * DEVICE_PX);
          if (!this.boardGen.current(ticket)) return;
          el = this.scene.getElement(elementId);
          if (!el || el.isDeleted) continue;
          pending.push({ elementId, fileId, entry });
        } catch (e5) {
          this.say(`Board: ${how} failed`, String(e5?.message ?? e5), "error");
        }
      }
      if (!this.boardGen.current(ticket) || !pending.length) return;
      if (!applyDerivedFiles(this.scene, this.history, pending)) return;
      for (const item of pending) {
        const el = this.scene.getElement(item.elementId);
        if (el && !el.isDeleted && el.fileId === item.fileId) this.doc = { ...this.doc, files: { ...this.doc.files, [item.fileId]: item.entry } };
      }
      this.markDirty();
      this.rebuild(cx2);
    });
  }
  matchSize(ref, cx) {
    const imgs = this.selectedImages().filter((e5) => e5.id !== ref.id);
    if (!imgs.length) return;
    this.history.record(this.scene.getElementsIncludingDeleted());
    for (const el of imgs) this.scene.mutateElement(el, { width: ref.width, height: ref.width * (el.height / el.width) });
    this.markDirty();
    this.rebuild(cx);
  }
  zOrder(front, cx) {
    if (!this.selected.size) return;
    this.history.record(this.scene.getElementsIncludingDeleted());
    this.scene.replaceAllElements(reorder(this.scene.getElementsIncludingDeleted(), this.withBoundText(this.selected), front));
    this.markDirty();
    this.rebuild(cx);
  }
  /** The image button: pick files in the system dialog. */
  pickImages(cx) {
    cx.spawn(async (cx2) => {
      const r2 = await exec("osascript", ["-e", CHOOSE_FILES]).catch(() => null);
      const paths = (r2?.stdout ?? "").split("\n").filter(Boolean);
      if (paths.length) await this.importAsync(paths, cx2);
    });
  }
  // ---- stickies ----------------------------------------------------------------------
  addSticky(p3, cx) {
    const el = newSticky({ x: p3.x - 100, y: p3.y - 100, color: this.stickyColor });
    this.history.record(this.scene.getElementsIncludingDeleted());
    this.scene.insertElement(el);
    this.startSticky(el, true, cx);
  }
  startSticky(el, isNew, cx) {
    if (!isNew) this.history.record(this.scene.getElementsIncludingDeleted());
    const before = el.customData?.text ?? "";
    const state = TextareaState.new({ value: before });
    state.set_soft_wrap(true);
    state.set_auto_grow(1, 400);
    state.on("blur", (_e2, cx2) => this.endEdit(cx2, {}));
    state.on("change", (_e2, cx2) => {
      const live = this.scene.getElement(el.id);
      if (live) this.scene.mutateElement(live, { height: stickyHeight({ width: live.width, customData: { text: state.value() } }) }, { informMutation: false, isDragging: true });
      cx2.notify(this.liveView);
    });
    state.on("submit", (_e2, cx2) => this.endEdit(cx2, {}));
    this.editing = { id: el.id, sticky: true, state, isNew, before };
    this.selected = /* @__PURE__ */ new Set();
    this.tool = "selection";
    this.active = /* @__PURE__ */ new Set([el.id]);
    this.rebuild(cx);
    cx.spawn(async (cx2) => {
      await cx2.sleep(16);
      if (this.editing?.state === state) state.focus();
    });
  }
  endSticky(cx, { discard }) {
    const ed = this.editing;
    this.editing = null;
    const value = discard ? ed.before : ed.state.value();
    ed.state.release();
    const el = this.scene.getElement(ed.id);
    if (el && !el.isDeleted) {
      if (!value.trim() && ed.isNew) {
        this.deleteIds(/* @__PURE__ */ new Set([el.id]));
        this.history.undoStack.pop();
      } else {
        const customData = { ...el.customData, text: value };
        this.scene.mutateElement(el, { customData, height: stickyHeight({ width: el.width, customData }) });
        if (value === ed.before && !ed.isNew) this.history.undoStack.pop();
        else this.markDirty();
        this.selected = /* @__PURE__ */ new Set([el.id]);
      }
    }
    this.active = /* @__PURE__ */ new Set();
    this.focus.focus();
    this.rebuild(cx);
  }
  applyStickyColor(color, cx) {
    this.stickyColor = color;
    const stickies = [...this.selected].map((id) => this.map().get(id)).filter(isSticky);
    if (stickies.length) {
      this.history.record(this.scene.getElementsIncludingDeleted());
      for (const el of stickies) this.scene.mutateElement(el, { backgroundColor: color });
      this.markDirty();
      this.rebuild(cx);
    }
    cx.notify();
  }
  // ---- resize handles and the right-click menu ---------------------------------------
  /** Corner handles of the one selected image or sticky (GPUI px), or null. */
  /** The selection's box (scene units) and what may be done with it; null while editing or with nothing selected. */
  selectionBox() {
    if (!this.selected.size || this.editing) return null;
    const map = this.map();
    const els = [...this.selected].map((id) => map.get(id)).filter(Boolean);
    if (!els.length) return null;
    const [x1, y1, x22, y22] = commonOf(els, map);
    return { box: { x: x1, y: y1, width: x22 - x1, height: y22 - y1 }, els, markersOnly: els.every(isMarker), rotatable: els.every(canRotate) };
  }
  /** Which handle of the selection box (or rotate zone just outside a corner) a pointer position (GPUI px) is on. */
  /** A lone arrow or line has three handles instead of a box: its start, its end, and a bend point in the middle. */
  linearHandles() {
    if (this.selected.size !== 1 || this.editing) return null;
    const map = this.map();
    const el = map.get([...this.selected][0]);
    const handles = linearHandlePoints(el, map);
    return handles ? { el, handles } : null;
  }
  selectionHandleAt(local) {
    const lin = this.linearHandles();
    if (lin) {
      const s3 = this.scale();
      for (const [which, pt3] of Object.entries(lin.handles)) {
        const hit2 = (HANDLE + 5) * this.herdrZoom();
        if (Math.abs(local.x - (pt3.x + this.scrollX) * s3) <= hit2 && Math.abs(local.y - (pt3.y + this.scrollY) * s3) <= hit2) return { kind: "linear", which, el: lin.el };
      }
      return null;
    }
    const sb = this.selectionBox();
    if (!sb || sb.markersOnly) return null;
    const s2 = this.scale();
    const toLocal = (pt3) => ({ x: (pt3.x + this.scrollX) * s2, y: (pt3.y + this.scrollY) * s2 });
    const wide = sb.box.width * s2 >= 40, tall = sb.box.height * s2 >= 40;
    const z3 = this.herdrZoom();
    const hit = (HANDLE + 5) * z3;
    for (const h3 of HANDLES) {
      if ((h3 === "n" || h3 === "s") && !wide) continue;
      if ((h3 === "e" || h3 === "w") && !tall) continue;
      const c3 = toLocal(handlePoint(sb.box, h3));
      if (Math.abs(local.x - c3.x) <= hit && Math.abs(local.y - c3.y) <= hit) return { kind: "resize", handle: h3, sb };
    }
    if (sb.rotatable) {
      const rotate = ROTATE_RADIUS * z3;
      for (const h3 of ["nw", "ne", "se", "sw"]) {
        const c3 = toLocal(handlePoint(sb.box, h3));
        const dx = (local.x - c3.x) * (h3.includes("e") ? 1 : -1), dy = (local.y - c3.y) * (h3.includes("s") ? 1 : -1);
        if (dx > 0 && dy > 0 && Math.hypot(dx, dy) < rotate) return { kind: "rotate", handle: h3, sb };
      }
    }
    return null;
  }
  startHandleGesture(hd2, p3, e5) {
    const ids = [...this.withBoundText(this.selected)];
    const map = this.map();
    const snap = new Map(ids.map((id) => {
      const el = map.get(id);
      return [id, handleSnap(el, map)];
    }));
    if (hd2.kind === "rotate") {
      const b2 = hd2.sb.box, center = { x: b2.x + b2.width / 2, y: b2.y + b2.height / 2 };
      return { mode: "rotate", ids, center, a0: Math.atan2(p3.y - center.y, p3.x - center.x), snap, started: false };
    }
    const only = hd2.sb.els.length === 1 ? hd2.sb.els[0] : null;
    return { mode: "resize", ids, handle: hd2.handle, box0: { ...hd2.sb.box }, snap, lock: only?.type === "image" && hd2.handle.length === 2, started: false };
  }
  beginHandleDrag(ptr, cx) {
    ptr.started = true;
    this.history.record(this.scene.getElementsIncludingDeleted());
    this.releaseOutsideBindings(ptr.ids);
    const map = this.map();
    const live = new Set(ptr.ids);
    for (const id of ptr.ids) {
      for (const b2 of map.get(id)?.boundElements ?? []) {
        if (b2.type !== "arrow") continue;
        live.add(b2.id);
        const label = Z2(map.get(b2.id), map);
        if (label) live.add(label.id);
      }
    }
    this.active = live;
    this.rebuild(cx);
  }
  resizeTo(ptr, p3, e5, cx) {
    if (!ptr.started) this.beginHandleDrag(ptr, cx);
    const nb = resizeHandleBox(ptr.box0, ptr.handle, p3, resizeKeepsAspect(ptr.lock, e5.modifiers?.shift, ptr.snap.values()));
    const changed = [];
    let touchesImage = false;
    for (const id of ptr.ids) {
      const el = this.scene.getElement(id), o2 = ptr.snap.get(id);
      if (!el || !o2 || el.type === "text" && el.containerId) continue;
      if (el.type === "image") touchesImage = true;
      this.scene.mutateElement(el, scaleElement(o2, ptr.box0, nb, ptr.handle), { informMutation: false, isDragging: true });
      changed.push(el);
    }
    this.syncAttached(changed);
    if (touchesImage) cx.notify();
    cx.notify(this.liveView);
  }
  /** Drag an arrow's start, end or bend point. The bend makes a curve through three points. */
  linearTo(ptr, p3, e5, cx) {
    const el = this.scene.getElement(ptr.id);
    if (!el) return;
    if (!ptr.started) {
      ptr.started = true;
      this.history.record(this.scene.getElementsIncludingDeleted());
      this.active = /* @__PURE__ */ new Set([el.id]);
      this.rebuild(cx);
    }
    const next = linearDrag(el, ptr.which, p3, !!e5.modifiers?.shift);
    if (!next) return;
    this.scene.mutateElement(el, { ...next, startBinding: null, endBinding: null }, { informMutation: false, isDragging: true });
    cx.notify(this.liveView);
  }
  rotateTo(ptr, p3, e5, cx) {
    if (!ptr.started) this.beginHandleDrag(ptr, cx);
    let a2 = Math.atan2(p3.y - ptr.center.y, p3.x - ptr.center.x) - ptr.a0;
    if (e5.modifiers?.shift) a2 = snap15(a2);
    const changed = [];
    for (const id of ptr.ids) {
      const el = this.scene.getElement(id), o2 = ptr.snap.get(id);
      if (!el || !o2 || el.type === "text" && el.containerId) continue;
      this.scene.mutateElement(el, rotateElement(o2, ptr.center, a2), { informMutation: false, isDragging: true });
      changed.push(el);
    }
    this.syncAttached(changed);
    cx.notify(this.liveView);
  }
  /** An arrow or line transformed without the shapes it is attached to comes loose from them. */
  releaseOutsideBindings(ids) {
    const map = this.map();
    const idSet = ids instanceof Set ? ids : new Set(ids);
    for (const id of idSet) {
      const el = map.get(id);
      const ends = bindingsForGesture(el, idSet);
      if (ends) Tr2(el, ends[0], ends[1], this.scene);
    }
  }
  /** Labels stay on their container and arrows bound to it follow, the same as a move. */
  syncAttached(elements) {
    const map = this.map();
    for (const el of elements) {
      const text = Z2(el, map);
      if (text) ga(text, el, this.scene);
    }
    for (const el of elements) {
      if (el.boundElements?.some((b2) => b2.type === "arrow")) Xe2(el, this.scene, { simultaneouslyUpdated: elements });
    }
  }
  /** Copies of the elements (and the text inside them), offset by dx, dy. Does not touch history; returns the new ids. */
  cloneElements(ids, dx, dy) {
    const map = this.map();
    const all = this.withBoundText(ids);
    const idMap = new Map([...all].map((id) => [id, makeId()]));
    const groups = /* @__PURE__ */ new Map();
    const copies = [];
    for (const id of all) {
      const el = map.get(id);
      if (!el) continue;
      const copy = {
        ...el,
        id: idMap.get(id),
        x: el.x + dx,
        y: el.y + dy,
        version: 1,
        seed: hs(),
        versionNonce: hs(),
        index: null,
        points: el.points?.map((q3) => [...q3]),
        customData: el.customData ? { ...el.customData } : el.customData,
        groupIds: (el.groupIds ?? []).map((g2) => {
          if (!groups.has(g2)) groups.set(g2, makeId());
          return groups.get(g2);
        }),
        boundElements: (el.boundElements ?? []).filter((b2) => b2.type === "text" && idMap.has(b2.id)).map((b2) => ({ ...b2, id: idMap.get(b2.id) })),
        containerId: el.containerId && idMap.has(el.containerId) ? idMap.get(el.containerId) : null
      };
      if ("startBinding" in el) {
        copy.startBinding = null;
        copy.endBinding = null;
      }
      copies.push(copy);
    }
    for (const c3 of copies) this.scene.insertElement(c3);
    return copies.filter((c3) => !(c3.type === "text" && c3.containerId)).map((c3) => c3.id);
  }
  /** ⌘D: a copy beside the original, selected. */
  duplicateSelection(cx) {
    if (!this.selected.size) return;
    this.history.record(this.scene.getElementsIncludingDeleted());
    this.selected = new Set(this.cloneElements(this.selected, 12, 12));
    this.markDirty();
    this.rebuild(cx);
  }
  onContext(e5, cx) {
    this.focus.focus();
    if (this.editing || !e5.local_position) return;
    const hit = this.hit(this.toScene(e5.local_position));
    if (hit && !this.selected.has(hit.id)) this.selected = new Set(this.groupOf(hit));
    if (!hit) this.selected = /* @__PURE__ */ new Set();
    this.menu = { x: e5.local_position.x, y: e5.local_position.y, id: hit?.id ?? null };
    cx.notify(this.liveView);
    cx.notify();
  }
  menuItems() {
    const el = this.menu?.id ? this.map().get(this.menu.id) : null;
    const close = (fn) => (cx) => {
      this.menu = null;
      fn(cx);
      cx.notify();
    };
    const items = [];
    if (!el) return [{ label: "Paste", key: "\u2318V", run: close((cx) => this.pasteClipboard(cx)) }];
    if (el.type === "image") {
      const media = el.customData?.kind === "gif" || el.customData?.kind === "video";
      items.push(
        { label: "Copy image", key: "\u2318C", run: close((cx) => this.copySelection(false, cx, [el])) },
        { label: "Copy as file", key: "\u21E7\u2318C", run: close((cx) => this.copySelection(true, cx, this.selectedImages())) },
        { label: "Reveal in Finder", run: close(() => this.reveal(el)) }
      );
      if (media) items.push({ label: "Open", run: close(() => this.openMedia(el)) });
      else items.push("-", { label: "Flip horizontal", key: "\u21E7H", run: close((cx) => this.derive("flip", cx)) }, { label: "Grayscale", run: close((cx) => this.derive("gray", cx)) });
      if (this.selectedImages().length > 1) items.push({ label: "Match size", run: close((cx) => this.matchSize(el, cx)) });
      items.push("-");
    }
    items.push(
      { label: "Bring to front", key: "]", run: close((cx) => this.zOrder(true, cx)) },
      { label: "Send to back", key: "[", run: close((cx) => this.zOrder(false, cx)) },
      "-",
      { label: "Delete", key: "\u232B", run: close((cx) => {
        this.history.record(this.scene.getElementsIncludingDeleted());
        this.deleteIds(new Set(this.selected));
        this.markDirty();
        this.rebuild(cx);
      }) }
    );
    return items;
  }
  renderMenu(ui2) {
    if (!this.menu) return div2();
    const z3 = this.herdrZoom();
    const rows = this.menuItems().map((it, i2) => it === "-" ? div2().h(1).my(4).bg(ui2.border) : div2().id(`menu-${i2}`).flex().items_center().justify_between().gap(24).px(12).h(28).rounded(5).mx(4).cursor_pointer().text_size(13).text_color(ui2.foreground).hover((s2) => s2.bg(ui2.hover)).on_mouse_down("left", (e5, cx) => {
      cx.stop_propagation();
      it.run(cx);
    }).children([div2().child(it.label), div2().text_size(11).text_color(ui2.muted).child(it.key ?? "")]));
    return div2().id(`${MOD}-menu`).absolute().left(this.menu.x / z3).top(this.menu.y / z3).w(220).py(4).rounded(8).bg(ui2.surface).border(1).border_color(ui2.border).on_mouse_down("left", (e5, cx) => cx.stop_propagation()).on_mouse_down("right", (e5, cx) => cx.stop_propagation()).children(rows);
  }
  // ---- tools and styles --------------------------------------------------------------
  setTool(tool, cx) {
    if (this.editing) this.endEdit(cx, {});
    this.menu = null;
    if (SHAPES.includes(tool)) this.shapeKind = tool;
    this.tool = tool;
    if (tool !== "selection") this.selected = /* @__PURE__ */ new Set();
    cx.notify(this.liveView);
    cx.notify();
  }
  newStyle(type) {
    const st3 = this.style;
    const shape = ["rectangle", "diamond", "ellipse"].includes(type);
    const marker = type === "highlighter" ? { strokeColor: neonFor(this.markerInk), customData: { marker: true } } : {};
    const roundness = type === "highlighter" ? null : shape ? null : type === "arrow" || type === "line" ? { type: tr.PROPORTIONAL_RADIUS } : null;
    return { strokeColor: st3.strokeColor, ...shape ? fillPatch(st3.fill, st3.strokeColor) : { backgroundColor: "transparent", fillStyle: "solid" }, strokeWidth: st3.strokeWidth, strokeStyle: st3.strokeStyle, roughness: st3.roughness, opacity: st3.opacity, roundness, ...marker };
  }
  /**
   * The style panel's one entry point: prop is color, opacity, fill, dash, size, fontFamily or textAlign. It sets the default for
   * what is drawn next, and applies to whatever is selected (one history step).
   */
  applyStyle(prop, value, cx) {
    const st3 = this.style;
    const marker = this.tool === "highlighter";
    if (prop === "color") {
      if (marker) this.markerInk = value;
      else st3.strokeColor = value;
    }
    if (prop === "opacity") st3.opacity = value;
    if (prop === "fill") st3.fill = value;
    if (prop === "dash") {
      st3.strokeStyle = value === "draw" ? "solid" : value;
      st3.roughness = value === "draw" ? 1 : 0;
    }
    if (prop === "size") {
      st3.strokeWidth = value.stroke;
      st3.fontSize = value.font;
    }
    if (prop === "fontFamily") st3.fontFamily = value;
    if (prop === "textAlign") st3.textAlign = value;
    if (prop === "arrowStart") st3.arrowStart = value;
    if (prop === "arrowEnd") st3.arrowEnd = value;
    const map = this.map();
    const selected = [...this.selected].map((id) => map.get(id)).filter((el) => el && elementStyleChanges(el, prop, value, el.type === "text" ? el : Z2(el, map)));
    if (selected.length) {
      this.history.record(this.scene.getElementsIncludingDeleted());
      for (const el of selected) {
        const text = el.type === "text" ? el : Z2(el, map);
        if (el.type === "image" || isSticky(el)) continue;
        if (prop === "color") {
          const c3 = isMarker(el) ? neonFor(value) : value;
          const keepFill = ["rectangle", "diamond", "ellipse"].includes(el.type) ? fillPatch(fillKindOf(el), value) : {};
          this.scene.mutateElement(el, { strokeColor: c3, ...keepFill });
          if (text && text !== el) this.scene.mutateElement(text, { strokeColor: c3 });
        } else if (prop === "opacity") this.scene.mutateElement(el, { opacity: value });
        else if (prop === "fill") {
          if (["rectangle", "diamond", "ellipse"].includes(el.type)) this.scene.mutateElement(el, fillPatch(value, el.strokeColor));
        } else if (prop === "dash") this.scene.mutateElement(el, { strokeStyle: value === "draw" ? "solid" : value, roughness: value === "draw" ? 1 : 0 });
        else if (prop === "size") {
          if (text) this.setTextSize(text, value.font);
          if (el.type !== "text") this.scene.mutateElement(el, { strokeWidth: value.stroke });
        } else if (prop === "fontFamily" && text) {
          this.scene.mutateElement(text, { fontFamily: value, lineHeight: gr(value) });
          this.refitText(text, map);
        } else if (prop === "textAlign" && text) this.scene.mutateElement(text, { textAlign: value });
        else if (prop === "arrowStart" && el.type === "arrow") this.scene.mutateElement(el, { startArrowhead: value });
        else if (prop === "arrowEnd" && el.type === "arrow") this.scene.mutateElement(el, { endArrowhead: value });
      }
      this.rebuild(cx);
      this.markDirty();
    }
    cx.notify();
  }
  refitText(text, map) {
    const container = text.containerId ? this.scene.getElement(text.containerId) : null;
    if (container) ga(text, container, this.scene);
    else this.scene.mutateElement(text, OP(text, null, map));
  }
  setTextSize(text, fontSize) {
    const container = text.containerId ? this.scene.getElement(text.containerId) : null;
    this.scene.mutateElement(text, { fontSize, lineHeight: gr(text.fontFamily) });
    if (container) ga(text, container, this.scene);
    else this.scene.mutateElement(text, OP(text, null, this.map()));
  }
  // ---- hit testing and selection -----------------------------------------------------
  /** The topmost element under a scene point; bound text answers with its container. */
  hit(p3, margin = 10) {
    const map = this.map();
    const all = this.elements();
    const els = [...all.filter((e5) => isMarker(e5)), ...all.filter((e5) => !isMarker(e5))];
    const point = [p3.x, p3.y];
    for (let i2 = els.length - 1; i2 >= 0; i2--) {
      const el = els[i2];
      if (el.locked) continue;
      let hit;
      try {
        hit = el.type === "text" || el.type === "image" || el.type === "frame" ? Ju(point, el, map) : Qu({ point, element: el, threshold: margin / this.vz, elementsMap: map });
      } catch {
        const b2 = boundsOf(el, map);
        hit = p3.x >= b2[0] && p3.x <= b2[2] && p3.y >= b2[1] && p3.y <= b2[3];
      }
      if (hit) return el.type === "text" && el.containerId ? map.get(el.containerId) ?? el : el;
    }
    return null;
  }
  /**
   * The smallest rectangle, diamond or ellipse whose inside holds a scene point. Clicking inside
   * an unfilled shape finds nothing by hit test (only its outline is drawn); this is the fallback,
   * so a click inside a box selects the box and a double-click there labels it.
   */
  containerAt(p3) {
    const map = this.map();
    let best = null;
    let bestArea = Infinity;
    for (const el of this.elements()) {
      if (el.locked || !CONTAINERS.includes(el.type)) continue;
      let inside = false;
      try {
        inside = Sa([p3.x, p3.y], el, map);
      } catch {
        inside = false;
      }
      const area = Math.abs(el.width * el.height);
      if (inside && area < bestArea) {
        best = el;
        bestArea = area;
      }
    }
    return best;
  }
  /** The element and everything in its outermost group. */
  groupOf(el) {
    const outer = el.groupIds?.[el.groupIds.length - 1];
    if (!outer) return [el.id];
    this.groupIdx ??= indexGroups(this.elements());
    return this.groupIdx.get(outer) ?? [el.id];
  }
  /** Selected elements plus the text inside them: what moves and deletes together. */
  withBoundText(ids) {
    const map = this.map();
    const out = new Set(ids);
    for (const id of ids) {
      const t2 = Z2(map.get(id) ?? null, map);
      if (t2) out.add(t2.id);
    }
    return out;
  }
  // ---- pointer -----------------------------------------------------------------------
  onDown(e5, cx) {
    this.slideSeq++;
    this.focus.focus();
    if (this.menu) {
      this.menu = null;
      cx.notify();
    }
    if (this.editing) {
      this.endEdit(cx, {});
      return;
    }
    if (this.pointer) this.onUp(cx);
    if (!e5.local_position) return;
    const p3 = this.toScene(e5.local_position);
    const tool = this.spaceDown ? "hand" : this.tool;
    if (tool === "hand") return this.onPanStart(e5, cx);
    if (tool === "selection") return this.selectDown(e5, p3, cx);
    if (tool === "eraser") {
      this.pointer = { mode: "erase", ids: /* @__PURE__ */ new Set(), orig: /* @__PURE__ */ new Map(), last: null };
      this.eraseAt(p3, cx);
      cx.notify(this.liveView);
      return;
    }
    if (tool === "text") {
      this.pointer = { mode: "textbox", start: p3, cur: p3, startLocal: e5.local_position, active: false };
      return;
    }
    if (tool === "sticky") return this.addSticky(p3, cx);
    this.history.record(this.scene.getElementsIncludingDeleted());
    const base = { x: p3.x, y: p3.y, ...this.newStyle(tool) };
    let el;
    if (tool === "arrow") el = Gc({ type: "arrow", ...base, points: [[0, 0], [0, 0]], startArrowhead: this.style.arrowStart, endArrowhead: this.style.arrowEnd });
    else if (tool === "line") el = RP({ type: "line", ...base, points: [[0, 0], [0, 0]] });
    else if (tool === "freedraw" || tool === "highlighter") el = kP({ type: "freedraw", ...base, roundness: null, points: [[0, 0]], simulatePressure: true });
    else el = ns2({ type: tool, ...base, width: 0, height: 0 });
    this.scene.insertElement(el);
    this.active = /* @__PURE__ */ new Set([el.id]);
    this.pointer = { mode: "create", id: el.id, origin: p3, shift: false };
    cx.notify(this.liveView);
  }
  selectDown(e5, p3, cx) {
    const hd2 = e5.local_position && this.selectionHandleAt(e5.local_position);
    if (hd2?.kind === "linear") {
      this.pointer = { mode: "linear", id: hd2.el.id, which: hd2.which, started: false };
      return;
    }
    if (hd2) {
      this.pointer = this.startHandleGesture(hd2, p3, e5);
      return;
    }
    const media = e5.local_position && e5.click_count < 2 && this.playButtonAt(e5.local_position);
    if (media) {
      this.togglePlay(media, cx);
      cx.notify(this.liveView);
      return;
    }
    let hit = this.hit(p3);
    if (e5.click_count >= 2) {
      if (hit && isSticky(hit)) return this.startSticky(hit, false, cx);
      if (hit?.type === "image" && (hit.customData?.kind === "gif" || hit.customData?.kind === "video")) return this.openMedia(hit);
      if (hit?.type === "text") return this.startText(p3, hit, cx);
      const container = hit && CONTAINERS.includes(hit.type) ? hit : this.containerAt(p3);
      if (container) return this.startText(p3, container, cx);
      if (!hit) return this.startText(p3, null, cx);
    }
    hit ??= this.containerAt(p3);
    if (hit) {
      const ids = this.groupOf(hit);
      if (e5.modifiers?.shift) {
        const on4 = this.selected.has(hit.id);
        for (const id of ids) on4 ? this.selected.delete(id) : this.selected.add(id);
      } else if (!this.selected.has(hit.id)) {
        this.selected = new Set(ids);
      }
      this.pointer = { mode: "move", last: p3, started: false, alt: !!e5.modifiers?.alt };
    } else {
      const keep = e5.modifiers?.shift || e5.modifiers?.platform || e5.modifiers?.control;
      if (!keep) this.selected = /* @__PURE__ */ new Set();
      this.pointer = { mode: "marquee", start: p3, cur: p3, startLocal: e5.local_position, base: new Set(this.selected), active: false };
    }
    cx.notify(this.liveView);
    cx.notify();
  }
  /** A quick drag lets go with a gentle slide that fades out (tldraw's camera friction 0.09 per frame). */
  startSlide(ptr, cx) {
    const h3 = ptr.hist ?? [];
    const last = h3[h3.length - 1], first = h3.find((q3) => last && last.t - q3.t <= 90);
    if (!last || !first || Date.now() - last.t > 60 || last.t === first.t) return;
    let vx = (last.x - first.x) / (last.t - first.t), vy = (last.y - first.y) / (last.t - first.t);
    if (Math.hypot(vx, vy) < 0.3) return;
    const ticket = ++this.slideSeq;
    cx.spawn(async (cx2) => {
      let prev = Date.now();
      while (ticket === this.slideSeq && Math.hypot(vx, vy) > 0.02 && !this.pointer) {
        await cx2.sleep(16);
        const now = Date.now(), dt = now - prev;
        prev = now;
        const s2 = this.scale();
        this.scrollX += vx * dt / s2;
        this.scrollY += vy * dt / s2;
        const k3 = Math.pow(1 - 0.09, dt / 16.7);
        vx *= k3;
        vy *= k3;
        cx2.notify();
      }
    });
  }
  onPanStart(e5, cx) {
    this.slideSeq++;
    if (!e5.local_position) return;
    this.pointer = { mode: "pan", start: e5.local_position, scroll: [this.scrollX, this.scrollY] };
  }
  onMove(e5, cx) {
    if (this.pointer && (moveReportsButtonsUp(e5) || pointerLeftPane(this.pointer, this.paneHover, this.gestureLeft))) {
      this.onUp(cx);
      return;
    }
    const ptr = this.pointer;
    if (!ptr && this.playing.size && e5.local_position) {
      const over = this.hit(this.toScene(e5.local_position));
      const id = over && this.playing.has(over.id) ? over.id : null;
      if (id !== this.hoverId) {
        this.hoverId = id;
        cx.notify();
      }
    }
    if (!ptr || !e5.local_position) return;
    const p3 = this.toScene(e5.local_position);
    if (ptr.mode === "pan") {
      const s2 = this.scale();
      this.scrollX = ptr.scroll[0] + (e5.local_position.x - ptr.start.x) / s2;
      this.scrollY = ptr.scroll[1] + (e5.local_position.y - ptr.start.y) / s2;
      (ptr.hist ??= []).push({ t: Date.now(), x: e5.local_position.x, y: e5.local_position.y });
      if (ptr.hist.length > 8) ptr.hist.shift();
      cx.notify();
      return;
    }
    if (ptr.mode === "marquee") {
      this.brush(ptr, p3, e5, cx);
      return;
    }
    if (ptr.mode === "textbox") {
      ptr.cur = p3;
      if (!ptr.active && e5.local_position && Math.hypot(e5.local_position.x - ptr.startLocal.x, e5.local_position.y - ptr.startLocal.y) >= 4) ptr.active = true;
      if (ptr.active) cx.notify(this.liveView);
      return;
    }
    if (ptr.mode === "erase") {
      this.eraseAt(p3, cx);
      cx.notify(this.liveView);
      return;
    }
    if (ptr.mode === "move") return this.moveSelection(p3, cx);
    if (ptr.mode === "linear") return this.linearTo(ptr, p3, e5, cx);
    if (ptr.mode === "resize") return this.resizeTo(ptr, p3, e5, cx);
    if (ptr.mode === "rotate") return this.rotateTo(ptr, p3, e5, cx);
    if (ptr.mode === "create") return this.resizeNew(p3, e5.modifiers?.shift, cx);
  }
  /**
   * The select tool's brush, as tldraw: nothing until the pointer has moved 4 px, then the selection follows the brush live.
   * It takes whatever the brush touches (bounds overlap); with cmd/ctrl, only what it fully encloses. Shift adds to the earlier selection.
   */
  brush(ptr, p3, e5, cx) {
    ptr.cur = p3;
    if (!ptr.active) {
      if (!ptr.startLocal || Math.hypot(e5.local_position.x - ptr.startLocal.x, e5.local_position.y - ptr.startLocal.y) < 4) return;
      ptr.active = true;
    }
    const [x1, x22] = [Math.min(ptr.start.x, p3.x), Math.max(ptr.start.x, p3.x)];
    const [y1, y22] = [Math.min(ptr.start.y, p3.y), Math.max(ptr.start.y, p3.y)];
    const enclosed = e5.modifiers?.platform || e5.modifiers?.control;
    const map = this.map();
    const next = new Set(e5.modifiers?.shift ? ptr.base : []);
    for (const el of this.elements()) {
      if (el.locked || el.type === "text" && el.containerId) continue;
      const b2 = boundsOf(el, map);
      const hit = enclosed ? b2[0] >= x1 && b2[2] <= x22 && b2[1] >= y1 && b2[3] <= y22 : b2[0] <= x22 && b2[2] >= x1 && b2[1] <= y22 && b2[3] >= y1;
      if (hit) for (const id of this.groupOf(el)) next.add(id);
    }
    this.selected = next;
    cx.notify(this.liveView);
    cx.notify();
  }
  /**
   * The eraser, as tldraw: the whole path of the pointer counts, not just where events landed (the line between two events is
   * walked), anything within 4.5 px is marked and shown faded, and nothing goes until release.
   */
  eraseAt(p3, cx) {
    const ptr = this.pointer;
    const from = ptr.last ?? p3;
    const steps = Math.max(1, Math.ceil(Math.hypot(p3.x - from.x, p3.y - from.y) / (3 / this.vz)));
    let fresh = false;
    for (let i2 = 1; i2 <= steps; i2++) {
      const q3 = { x: from.x + (p3.x - from.x) * i2 / steps, y: from.y + (p3.y - from.y) * i2 / steps };
      const hit = this.hit(q3, 4.5);
      if (hit) {
        for (const id of this.groupOf(hit)) if (!ptr.ids.has(id)) {
          ptr.ids.add(id);
          fresh = true;
        }
      }
    }
    ptr.last = p3;
    if (!fresh) return;
    for (const id of this.withBoundText(ptr.ids)) {
      const el = this.scene.getElement(id);
      if (!el || ptr.orig.has(id)) continue;
      ptr.orig.set(id, el.opacity);
      this.scene.mutateElement(el, { opacity: Math.max(10, (el.opacity ?? 100) * 0.25) }, { informMutation: false, isDragging: true });
    }
    this.active = /* @__PURE__ */ new Set([...this.active, ...ptr.orig.keys()]);
    this.rebuild(cx);
  }
  restoreErase(ptr) {
    for (const [id, o2] of ptr.orig) {
      const el = this.scene.getElement(id);
      if (el) this.scene.mutateElement(el, { opacity: o2 }, { informMutation: false, isDragging: true });
    }
    ptr.orig.clear();
  }
  moveSelection(p3, cx) {
    const ptr = this.pointer;
    const dx = p3.x - ptr.last.x;
    const dy = p3.y - ptr.last.y;
    if (!dx && !dy) return;
    const map = this.map();
    if (!ptr.started) {
      ptr.started = true;
      this.history.record(this.scene.getElementsIncludingDeleted());
      if (ptr.alt) this.selected = new Set(this.cloneElements(this.selected, 0, 0));
      ptr.ids = this.withBoundText(this.selected);
      this.releaseOutsideBindings(ptr.ids);
      const live = new Set(ptr.ids);
      for (const id of ptr.ids) for (const b2 of map.get(id)?.boundElements ?? []) if (b2.type === "arrow") live.add(b2.id);
      this.active = live;
      this.rebuild(cx);
    }
    const moving = [...ptr.ids].map((id) => map.get(id)).filter(Boolean);
    for (const el of moving) this.scene.mutateElement(el, { x: el.x + dx, y: el.y + dy }, { informMutation: false, isDragging: true });
    for (const el of moving) if (el.boundElements?.some((b2) => b2.type === "arrow")) Xe2(el, this.scene, { simultaneouslyUpdated: moving });
    ptr.last = p3;
    if (moving.some((el) => el.type === "image")) cx.notify();
    cx.notify(this.liveView);
  }
  resizeNew(p3, square, cx) {
    const ptr = this.pointer;
    const el = this.scene.getElement(ptr.id);
    if (!el) return;
    const o2 = ptr.origin;
    let dx = p3.x - o2.x;
    let dy = p3.y - o2.y;
    if (el.type === "freedraw") {
      let end = [dx, dy];
      if (square) {
        ptr.straightFrom ??= el.points.length - 1;
        const [bx2, by] = el.points[ptr.straightFrom];
        const len = Math.hypot(dx - bx2, dy - by), a2 = Math.round(Math.atan2(dy - by, dx - bx2) / (Math.PI / 12)) * (Math.PI / 12);
        end = [bx2 + len * Math.cos(a2), by + len * Math.sin(a2)];
      } else ptr.straightFrom = null;
      const points = [...square ? el.points.slice(0, ptr.straightFrom + 1) : el.points, end];
      const xs = points.map((q3) => q3[0]);
      const ys2 = points.map((q3) => q3[1]);
      this.scene.mutateElement(el, { points, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys2) - Math.min(...ys2) }, { informMutation: false, isDragging: true });
    } else if (el.type === "arrow" || el.type === "line") {
      if (square) {
        const len = Math.hypot(dx, dy), a2 = snap15(Math.atan2(dy, dx));
        dx = len * Math.cos(a2);
        dy = len * Math.sin(a2);
      }
      this.scene.mutateElement(el, { points: [[0, 0], [dx, dy]], width: Math.abs(dx), height: Math.abs(dy) }, { informMutation: false, isDragging: true });
    } else {
      if (square) {
        const m2 = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * m2;
        dy = Math.sign(dy || 1) * m2;
      }
      this.scene.mutateElement(el, { x: Math.min(o2.x, o2.x + dx), y: Math.min(o2.y, o2.y + dy), width: Math.abs(dx), height: Math.abs(dy) }, { informMutation: false, isDragging: true });
    }
    cx.notify(this.liveView);
  }
  /** Finish a gesture that can no longer receive mouse-up. */
  endAbandonedGesture(cx) {
    if (pointerLeftPane(this.pointer, this.paneHover, this.gestureLeft)) this.onUp(cx);
  }
  onUp(cx) {
    const ptr = this.pointer;
    this.gestureLeft = false;
    if (!ptr) return;
    this.pointer = null;
    const map = this.map();
    if (ptr.mode === "pan") return this.startSlide(ptr, cx);
    if (ptr.mode === "textbox") {
      const w4 = Math.abs(ptr.cur.x - ptr.start.x);
      if (ptr.active && w4 >= 24) this.startText({ x: Math.min(ptr.start.x, ptr.cur.x), y: ptr.start.y + this.style.fontSize * 0.6 }, null, cx, { width: w4 });
      else this.startText(ptr.start, null, cx);
      return;
    }
    if (ptr.mode === "marquee") {
      cx.notify(this.liveView);
      cx.notify();
      return;
    }
    if (ptr.mode === "erase") {
      this.restoreErase(ptr);
      if (ptr.ids.size) {
        this.history.record(this.scene.getElementsIncludingDeleted());
        this.deleteIds(ptr.ids);
        this.markDirty();
      }
      this.active = /* @__PURE__ */ new Set();
      this.rebuild(cx);
      return;
    }
    if (ptr.mode === "move" || ptr.mode === "resize" || ptr.mode === "rotate" || ptr.mode === "linear") {
      if (ptr.started) {
        this.active = /* @__PURE__ */ new Set();
        this.rebuild(cx);
        this.markDirty();
      }
      return;
    }
    if (ptr.mode === "create") this.finishNew(ptr, cx);
  }
  finishNew(ptr, cx) {
    const map = this.map();
    const el = this.scene.getElement(ptr.id);
    this.active = /* @__PURE__ */ new Set();
    const tiny = !el || (el.type === "freedraw" ? el.points.length < 2 : Math.hypot(el.width, el.height) < 3);
    if (tiny && el && CONTAINERS.includes(el.type)) {
      this.scene.mutateElement(el, { x: ptr.origin.x - 50, y: ptr.origin.y - 50, width: 100, height: 100 });
      this.selected = /* @__PURE__ */ new Set([el.id]);
      this.tool = "selection";
      this.markDirty();
      this.rebuild(cx);
      return;
    }
    if (tiny) {
      if (el) this.scene.mutateElement(el, { isDeleted: true });
      this.history.undoStack.pop();
    } else {
      if (el.type === "arrow") {
        const others = this.elements().filter((e5) => e5.id !== el.id);
        const [sx, sy] = [el.x, el.y];
        const end = el.points[el.points.length - 1];
        const at = (x3, y4) => Wt({ x: x3, y: y4 }, others, map, { value: this.vz }, true);
        const start = at(sx, sy);
        const finish = at(sx + end[0], sy + end[1]);
        Tr2(el, start, finish && finish !== start ? finish : null, this.scene);
        const gap = (b2) => b2 && { ...b2, gap: 4 };
        this.scene.mutateElement(el, { startBinding: gap(el.startBinding), endBinding: gap(el.endBinding) });
        for (const shape of /* @__PURE__ */ new Set([start, finish])) if (shape) Xe2(shape, this.scene);
      }
      this.selected = /* @__PURE__ */ new Set([el.id]);
      if (el.type !== "freedraw") this.tool = "selection";
      this.markDirty();
    }
    this.rebuild(cx);
  }
  deleteIds(ids) {
    const map = this.map();
    const all = this.withBoundText(ids);
    const deleted = [];
    for (const id of all) {
      const el = map.get(id);
      if (!el) continue;
      if (el.type === "text" && el.containerId && !all.has(el.containerId)) {
        const c3 = map.get(el.containerId);
        if (c3) this.scene.mutateElement(c3, { boundElements: (c3.boundElements ?? []).filter((b2) => b2.id !== el.id) });
      }
      this.scene.mutateElement(el, { isDeleted: true });
      deleted.push(el);
    }
    ly(this.scene.getNonDeletedElements(), deleted);
    for (const id of all) this.selected.delete(id);
  }
  // ---- text --------------------------------------------------------------------------
  /** Edits `target` text, adds text to a `target` shape, or (no target) starts new text at p. */
  startText(p3, target, cx, opts = {}) {
    const map = this.map();
    this.history.record(this.scene.getElementsIncludingDeleted());
    let el = target?.type === "text" ? target : target ? Z2(target, map) : null;
    let isNew = false;
    if (!el) {
      isNew = true;
      const fontFamily = this.style.fontFamily ?? T2.Excalifont;
      const lineHeight = gr(fontFamily);
      el = Bc({
        text: "",
        x: p3.x,
        y: p3.y - this.style.fontSize * lineHeight / 2,
        fontSize: this.style.fontSize,
        fontFamily,
        lineHeight,
        strokeColor: this.style.strokeColor,
        opacity: this.style.opacity,
        roughness: this.style.roughness,
        textAlign: this.style.textAlign,
        ...target ? { containerId: target.id, textAlign: "center", verticalAlign: "middle" } : {}
      });
      if (opts.width) el = { ...el, autoResize: false, width: opts.width };
      this.scene.insertElement(el);
      if (target) this.scene.mutateElement(target, { boundElements: [...target.boundElements ?? [], { type: "text", id: el.id }] });
    }
    const state = TextareaState.new({ value: el.originalText ?? el.text });
    state.set_soft_wrap(!!el.containerId || el.autoResize === false);
    state.set_auto_grow(1, 200);
    state.on("blur", (_e2, cx2) => this.endEdit(cx2, {}));
    if (el.containerId) state.on("change", (_e2, cx2) => cx2.notify());
    state.on("submit", (_e2, cx2) => this.endEdit(cx2, {}));
    this.editing = { id: el.id, state, isNew, before: el.originalText ?? el.text };
    this.selected = /* @__PURE__ */ new Set();
    this.tool = "selection";
    this.rebuild(cx);
    cx.spawn(async (cx2) => {
      await cx2.sleep(16);
      if (this.editing?.state === state) state.focus();
    });
  }
  endEdit(cx, { discard }) {
    const ed = this.editing;
    if (!ed) return;
    if (ed.sticky) return this.endSticky(cx, { discard });
    this.editing = null;
    const value = discard ? ed.before : ed.state.value();
    ed.state.release();
    const el = this.scene.getElement(ed.id);
    if (el && !el.isDeleted) {
      if (!value.trim()) {
        this.deleteIds(/* @__PURE__ */ new Set([el.id]));
        if (ed.isNew) this.history.undoStack.pop();
        else this.markDirty();
      } else if (value === ed.before && !ed.isNew) {
        this.history.undoStack.pop();
      } else {
        const container = el.containerId ? this.scene.getElement(el.containerId) : null;
        this.scene.mutateElement(el, { originalText: value, text: value });
        if (container) ga(el, container, this.scene);
        else if (el.autoResize === false) {
          const lines = wrapText(value, el.width, el.fontSize);
          this.scene.mutateElement(el, { text: lines.join("\n"), height: Math.max(lines.length, 1) * el.fontSize * el.lineHeight });
        } else this.scene.mutateElement(el, OP(el, null, this.map(), value));
        this.selected = /* @__PURE__ */ new Set([container?.id ?? el.id]);
        this.markDirty();
      }
    }
    this.focus.focus();
    this.rebuild(cx);
  }
  // ---- view --------------------------------------------------------------------------
  onWheel(e5, cx) {
    const m2 = e5.modifiers ?? {};
    if (m2.platform || m2.control) {
      this.zoomBy(Math.exp(-e5.delta.y * 0.01), e5.local_position ?? null, cx);
      return;
    }
    const s2 = this.scale();
    const dx = m2.shift && !e5.delta.x ? e5.delta.y : e5.delta.x;
    const dy = m2.shift && !e5.delta.x ? 0 : e5.delta.y;
    this.scrollX += dx / s2;
    this.scrollY += dy / s2;
    cx.notify();
  }
  zoomBy(factor, at, cx) {
    this.setZoom(this.vz * factor, at, cx);
  }
  /** Zooms about `at` (pointer, GPUI px) or the view's center, keeping that point still. */
  setZoom(vz, at, cx) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vz));
    if (next === this.vz) return;
    const anchor = at ?? { x: (this.size?.width ?? 800) / 2, y: (this.size?.height ?? 600) / 2 };
    const before = this.toScene(anchor);
    this.vz = next;
    const s2 = this.scale();
    this.scrollX = anchor.x / s2 - before.x;
    this.scrollY = anchor.y / s2 - before.y;
    if (!this.zoomPending) {
      this.zoomPending = true;
      cx.spawn(async (cx2) => {
        await cx2.sleep(40);
        this.zoomPending = false;
        this.rebuild(cx2);
      });
    }
    cx.notify();
  }
  fitView(cx, maxZoom = MAX_ZOOM) {
    const els = this.elements();
    if (!els.length) return this.setZoom(1, null, cx);
    const [x1, y1, x22, y22] = commonOf(els, this.map());
    const w4 = (this.size?.width ?? 800) / this.herdrZoom();
    const h3 = (this.size?.height ?? 600) / this.herdrZoom();
    this.vz = Math.min(maxZoom, Math.max(MIN_ZOOM, Math.min((w4 - 80) / Math.max(x22 - x1, 1), (h3 - 120) / Math.max(y22 - y1, 1))));
    this.scrollX = (w4 / this.vz - (x22 - x1)) / 2 - x1;
    this.scrollY = (h3 / this.vz - (y22 - y1)) / 2 - y1;
    this.rebuild(cx);
  }
  undo(cx) {
    if (this.editing) this.endEdit(cx, {});
    const prev = this.history.undo(this.scene.getElementsIncludingDeleted());
    if (prev) this.restore(prev, cx);
  }
  redo(cx) {
    const next = this.history.redo(this.scene.getElementsIncludingDeleted());
    if (next) this.restore(next, cx);
  }
  restore(elements, cx) {
    this.scene.replaceAllElements(elements);
    const live = this.map();
    this.selected = new Set([...this.selected].filter((id) => live.has(id)));
    this.active = /* @__PURE__ */ new Set();
    this.markDirty();
    this.rebuild(cx);
  }
  // ---- keys --------------------------------------------------------------------------
  onKey(e5, cx) {
    if (this.editing) {
      if (e5.key === "escape") this.endEdit(cx, {});
      return;
    }
    const k3 = e5.keystroke;
    const map = this.map();
    if (k3 === "cmd-u") return this.pickImages(cx);
    if (k3 === "cmd-d") return this.duplicateSelection(cx);
    if (k3 === "cmd-c") return this.copySelection(false, cx);
    if (k3 === "cmd-shift-c") return this.copySelection(true, cx);
    if (k3 === "cmd-v") return this.pasteClipboard(cx);
    if (k3 === "shift-h" || e5.key === "H" && !e5.modifiers.platform) return this.derive("flip", cx);
    if (k3 === "shift-p" || k3 === "shift-d" || (e5.key === "P" || e5.key === "D") && !e5.modifiers.platform) return this.setTool("highlighter", cx);
    if (e5.key === "]" && !e5.modifiers.platform) return this.zOrder(true, cx);
    if (e5.key === "[" && !e5.modifiers.platform) return this.zOrder(false, cx);
    if (k3 === "cmd-z") return this.undo(cx);
    if (k3 === "cmd-shift-z" || k3 === "cmd-y") return this.redo(cx);
    if (k3 === "cmd-a") {
      this.tool = "selection";
      this.selected = new Set(this.elements().filter((el) => !(el.type === "text" && el.containerId)).map((el) => el.id));
      cx.notify(this.liveView);
      cx.notify();
      return;
    }
    const plain = !e5.modifiers.platform && !e5.modifiers.control && !e5.modifiers.alt;
    if (plain && (e5.key === ")" || e5.modifiers.shift && e5.key === "0")) return this.setZoom(1, null, cx);
    if (plain && (e5.key === "!" || e5.modifiers.shift && e5.key === "1")) return this.fitView(cx);
    if (k3 === "space" && this.selected.size === 1) {
      const el = map.get([...this.selected][0]);
      if (isMedia(el)) return this.togglePlay(el, cx);
    }
    if (k3 === "space") {
      if (!this.spaceDown) {
        this.spaceDown = true;
        cx.notify();
      }
      return;
    }
    if (k3 === "escape") {
      if (this.pointer?.mode === "erase") {
        this.restoreErase(this.pointer);
        this.pointer = null;
        this.active = /* @__PURE__ */ new Set();
        this.rebuild(cx);
      }
      if (this.pointer?.mode === "marquee") this.pointer = null;
      this.menu = null;
      this.selected = /* @__PURE__ */ new Set();
      this.tool = "selection";
      cx.notify(this.liveView);
      cx.notify();
      return;
    }
    if ((k3 === "backspace" || k3 === "delete") && this.selected.size) {
      this.history.record(this.scene.getElementsIncludingDeleted());
      this.deleteIds(new Set(this.selected));
      this.markDirty();
      this.rebuild(cx);
      return;
    }
    if (k3 === "enter" && this.selected.size === 1) {
      const el = map.get([...this.selected][0]);
      if (el && isSticky(el)) return this.startSticky(el, false, cx);
      if (el && (el.type === "text" || ["rectangle", "diamond", "ellipse"].includes(el.type))) return this.startText({ x: el.x, y: el.y }, el, cx);
    }
    const nudge = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[e5.key];
    if (nudge && this.selected.size && !e5.modifiers.platform) {
      const step = e5.modifiers.shift ? 10 : 1;
      this.history.record(this.scene.getElementsIncludingDeleted());
      const movingIds = this.withBoundText(this.selected);
      this.releaseOutsideBindings(movingIds);
      const moving = [...movingIds].map((id) => map.get(id)).filter(Boolean);
      for (const el of moving) this.scene.mutateElement(el, { x: el.x + nudge[0] * step, y: el.y + nudge[1] * step });
      for (const el of moving) if (el.boundElements?.some((b2) => b2.type === "arrow")) Xe2(el, this.scene, { simultaneouslyUpdated: moving });
      this.markDirty();
      this.rebuild(cx);
      return;
    }
    const m2 = e5.modifiers;
    if (!m2.platform && !m2.control && !m2.alt && TOOL_KEYS[e5.key]) this.setTool(TOOL_KEYS[e5.key], cx);
  }
};
export {
  Board as default
};
