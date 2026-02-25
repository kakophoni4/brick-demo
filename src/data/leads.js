'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname);
const LEADS_JSON = path.join(DATA_DIR, 'leads.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadLeads() {
  if (!fs.existsSync(LEADS_JSON)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(LEADS_JSON, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function addLead(lead) {
  const list = loadLeads();
  const item = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 9),
    createdAt: new Date().toISOString(),
    name: String(lead.name || '').trim(),
    phone: String(lead.phone || '').trim(),
    message: String(lead.message || '').trim(),
    source: String(lead.source || '').trim() || 'Сайт',
    fromCrm: !!lead.fromCrm
  };
  list.unshift(item);
  ensureDir(DATA_DIR);
  fs.writeFileSync(LEADS_JSON, JSON.stringify(list, null, 2), 'utf8');
  return item;
}

module.exports = {
  loadLeads,
  addLead,
  LEADS_JSON
};
