import { FB } from './firebase.js';
import { safeStr } from './utils.js';

export function normalizeModelNumber(value) {
  return safeStr(value).trim().toUpperCase();
}

export function normalizeProductName(value = '') {
  return safeStr(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function normalizeDiscountPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric);
}

export function formatDiscountLabel(value) {
  const rounded = normalizeDiscountPercent(value);
  if (!rounded) return '';
  return `${rounded}% OFF`;
}

export async function checkModelNumberExists(modelNumber, excludeProductId = null) {
  const normalized = normalizeModelNumber(modelNumber);
  if (!normalized) return null;

  const q = FB.query(
    FB.col('products'),
    FB.where('modelNumber', '==', normalized)
  );

  const snapshot = await FB.getDocs(q);
  const match = snapshot.docs.find(doc => doc.id !== excludeProductId);
  if (!match) return null;

  return { id: match.id, ...match.data() };
}
