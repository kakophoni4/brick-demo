'use strict';

const fs = require('fs');
const path = require('path');

const baseSite = require('./site');
const USER_JSON = path.join(__dirname, 'siteUser.json');

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mergeSite() {
  const merged = deepClone(baseSite);
  if (!fs.existsSync(USER_JSON)) return merged;
  try {
    const user = JSON.parse(fs.readFileSync(USER_JSON, 'utf8'));
    if (user.contacts) {
      if (Array.isArray(user.contacts.phones)) merged.contacts.phones = user.contacts.phones;
      if (user.contacts.email) merged.contacts.email = String(user.contacts.email).trim();
      if (Array.isArray(user.contacts.addresses)) merged.contacts.addresses = user.contacts.addresses;
      if (Array.isArray(user.contacts.worktime)) merged.contacts.worktime = user.contacts.worktime;
    }
  } catch (_) {}
  return merged;
}

let cache = null;
function getSite() {
  if (!cache) cache = mergeSite();
  return cache;
}

function refreshSiteSettings() {
  cache = mergeSite();
}

/** 10 цифр без +7/8 для отображения и tel: */
function normalizePhone10(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length >= 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1);
  if (d.length > 10) d = d.slice(-10);
  return d;
}

function saveSiteContacts(payload) {
  const phones = [];
  const p1 = normalizePhone10(payload.phone1);
  const p2 = normalizePhone10(payload.phone2);
  if (p1.length >= 10) {
    phones.push({
      label: String(payload.phone1_label || '').trim(),
      value: p1.slice(-10)
    });
  }
  if (p2.length >= 10) {
    phones.push({
      label: String(payload.phone2_label || '').trim(),
      value: p2.slice(-10)
    });
  }
  if (phones.length === 0) {
    phones.push({ label: '', value: '9603721919' });
  }
  const email = String(payload.email || '').trim() || baseSite.contacts.email;
  const addresses = [{
    title: String(payload.address_title || 'Офис').trim() || 'Офис',
    line1: String(payload.address_line1 || '').trim(),
    line2: String(payload.address_line2 || '').trim()
  }];
  const worktimeRaw = String(payload.worktime || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const worktime = worktimeRaw.length ? worktimeRaw : baseSite.contacts.worktime;

  const out = {
    contacts: {
      phones,
      email,
      addresses,
      worktime
    }
  };
  fs.writeFileSync(USER_JSON, JSON.stringify(out, null, 2), 'utf8');
  refreshSiteSettings();
}

module.exports = {
  getSite,
  refreshSiteSettings,
  saveSiteContacts,
  USER_JSON
};
