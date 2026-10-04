// Dado 3D con caras 0, 1 y 2 (cada valor aparece en dos caras, como un dado físico).

import { html } from './dom.js';
import { DIE_FACES } from '../core/rules.js';

// Rotación que deja visible cada cara (en el mismo orden que .die-face:nth-child).
const FACE_ROT = [
  [0, 0],
  [0, 180],
  [0, -90],
  [0, 90],
  [-90, 0],
  [90, 0],
];

export function createDie({ small = false } = {}) {
  const faces = DIE_FACES.map((v) => `<div class="die-face v${v}">${v}</div>`).join('');
  const el = html(`<div class="die${small ? ' small' : ''}" aria-hidden="true">${faces}</div>`);
  let spins = 0;

  function show(face, { animate = true } = {}) {
    const [x, y] = FACE_ROT[face];
    if (!animate) {
      el.style.transition = 'none';
      el.style.transform = `rotateX(${x - 12}deg) rotateY(${y + 14}deg)`;
      requestAnimationFrame(() => (el.style.transition = ''));
      return Promise.resolve();
    }
    spins += 2;
    const tx = x - 12 + 360 * spins;
    const ty = y + 14 + 360 * (spins + 1);
    el.style.transform = `rotateX(${tx}deg) rotateY(${ty}deg)`;
    return new Promise((resolve) => {
      const done = () => {
        el.removeEventListener('transitionend', done);
        resolve();
      };
      el.addEventListener('transitionend', done);
      setTimeout(done, 1600);
    });
  }

  return { el, show };
}
