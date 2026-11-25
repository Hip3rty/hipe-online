// Utilitários de DOM mínimos (sem framework, para o app ficar leve).
import { sfx } from '../audio.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) {
      const ev = k.slice(2);
      el.addEventListener(ev, ev === 'click' ? (e) => { sfx('click'); v(e); } : v);
    } else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const ui = () => document.getElementById('ui');

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function fmt(n) {
  return Math.floor(n).toLocaleString('pt-BR');
}

// Canvas com prévia animada de um personagem
export function previewCanvas(w, hgt) {
  const c = document.createElement('canvas');
  c.width = w; c.height = hgt;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return c;
}
