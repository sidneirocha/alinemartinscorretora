/**
 * Backend do painel de imóveis.
 * Publique como Web App com acesso restrito às contas autorizadas.
 * Configure ADMIN_EMAILS nas propriedades do script, separados por vírgula.
 */
const SPREADSHEET_ID = 'bhVc-cYfQik1PRGPrAMhtRZDu3U';
const SHEET_NAME = 'IMÓVEIS';
const HEADERS = ['ID', 'Título', 'Operação', 'Preço (texto do site)', 'Endereço / localização exibida', 'Área', 'Quartos', 'Banheiros', 'Andares (campo do site)', 'Condomínio', 'IPTU', 'Características e resumo da descrição'];

function doGet(e) {
  try {
    authorize_();
    const action = (e && e.parameter && e.parameter.action) || 'list';
    if (action === 'list') return json_({ ok: true, properties: list_() });
    return json_({ ok: false, error: 'Ação GET inválida.' });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function doPost(e) {
  try {
    authorize_();
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (payload.action === 'update') return json_({ ok: true, property: update_(payload.property) });
    if (payload.action === 'create') return json_({ ok: true, property: create_(payload.property) });
    return json_({ ok: false, error: 'Ação POST inválida.' });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function authorize_() {
  const email = Session.getActiveUser().getEmail().toLowerCase();
  const allowed = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS') || '';
  const emails = allowed.split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  if (!email || !emails.includes(email)) throw new Error('Conta Google não autorizada.');
}

function sheet_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('A aba IMÓVEIS não foi encontrada.');
  return sheet;
}

function list_() {
  const values = sheet_().getDataRange().getDisplayValues();
  return values.slice(1).filter(row => row[0]).map(rowToProperty_);
}

function rowToProperty_(row) {
  return HEADERS.reduce((property, header, index) => {
    property[header] = row[index] || '';
    return property;
  }, {});
}

function validate_(property) {
  if (!property || !property.ID) throw new Error('O ID do imóvel é obrigatório.');
  if (!property['Título']) throw new Error('O título do imóvel é obrigatório.');
  if (!property['Preço (texto do site)']) throw new Error('O preço do imóvel é obrigatório.');
}

function findRow_(id) {
  const values = sheet_().getRange(2, 1, Math.max(sheet_().getLastRow() - 1, 1), 1).getDisplayValues();
  const index = values.findIndex(row => row[0] === id);
  if (index < 0) throw new Error('Imóvel não encontrado.');
  return index + 2;
}

function update_(property) {
  validate_(property);
  const sheet = sheet_();
  const row = findRow_(property.ID);
  sheet.getRange(row, 1, 1, HEADERS.length).setValues([HEADERS.map(header => property[header] || '')]);
  return rowToProperty_(sheet.getRange(row, 1, 1, HEADERS.length).getDisplayValues()[0]);
}

function create_(property) {
  validate_(property);
  const sheet = sheet_();
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  if (sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getDisplayValues().flat().includes(property.ID)) {
    throw new Error('Já existe um imóvel com este ID.');
  }
  sheet.appendRow(HEADERS.map(header => property[header] || ''));
  return property;
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
