/**
 * Backend do painel de imóveis.
 * Publique como Web App com acesso restrito às contas autorizadas.
 * Configure ADMIN_EMAILS nas propriedades do script, separados por vírgula.
 */
const SPREADSHEET_ID = '1Ewu6Ipro4xAHokeBbhVc-cYfQik1PRGPrAMhtRZDu3U';
const PHOTO_FOLDER_ID = '1fRDgyNIGAqQwj1rkJfXp0PPvWXmaEMq6';
const SHEET_NAME = 'IMÓVEIS';
const PHOTO_SHEET_NAME = 'FOTOS';
const HEADERS = ['ID', 'Título', 'Operação', 'Preço (texto do site)', 'Endereço / localização exibida', 'Área', 'Quartos', 'Banheiros', 'Andares (campo do site)', 'Condomínio', 'IPTU', 'Características e resumo da descrição'];
// Estrutura real da aba IMÓVEIS.
const ALL_HEADERS = HEADERS.concat(['URL', 'Fotos', 'Status CMS', 'Destaque', 'Slug', 'Atualizado em']);

function doGet(e) {
  try {
    authorize_();
    const action = (e && e.parameter && e.parameter.action) || 'list';
    if (action === 'list') return response_({ ok: true, properties: list_() }, e);
    return response_({ ok: false, error: 'Ação GET inválida.' }, e);
  } catch (error) {
    return response_({ ok: false, error: error.message }, e);
  }
}

function doPost(e) {
  try {
    authorize_();
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (payload.action === 'update') return json_({ ok: true, property: update_(payload.property) });
    if (payload.action === 'create') return json_({ ok: true, property: create_(payload.property) });
    if (payload.action === 'uploadPhoto') return json_({ ok: true, photo: uploadPhoto_(payload) });
    if (payload.action === 'status') return json_({ ok: true, property: setStatus_(payload.id, payload.status) });
    if (payload.action === 'delete') return json_({ ok: true, deleted: delete_(payload.id) });
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
  const property = ALL_HEADERS.reduce((result, header, index) => {
    result[header] = row[index] || '';
    return result;
  }, {});

  // O painel usa "Status", mas a coluna da planilha se chama "Status CMS".
  property.Status = property['Status CMS'] === 'Publicado'
    ? 'Ativo'
    : (property['Status CMS'] || 'Ativo');

  return property;
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
  const values = ALL_HEADERS.map(header => {
    if (header === 'Status CMS') {
      return property.Status === 'Ativo'
        ? 'Publicado'
        : (property.Status || property['Status CMS'] || 'Publicado');
    }
    return property[header] || '';
  });
  sheet.getRange(row, 1, 1, ALL_HEADERS.length).setValues([values]);
  return rowToProperty_(sheet.getRange(row, 1, 1, ALL_HEADERS.length).getDisplayValues()[0]);
}

function create_(property) {
  validate_(property);
  const sheet = sheet_();
  if (sheet.getLastRow() === 0) sheet.appendRow(ALL_HEADERS);
  if (sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getDisplayValues().flat().includes(property.ID)) {
    throw new Error('Já existe um imóvel com este ID.');
  }
  sheet.appendRow(ALL_HEADERS.map(header => {
    if (header === 'Status CMS') return property.Status === 'Ativo' ? 'Publicado' : (property.Status || 'Publicado');
    return property[header] || '';
  }));
  return property;
}

function setStatus_(id, status) {
  const allowed = ['Ativo', 'Vendido', 'Alugado', 'Desativado'];
  if (!allowed.includes(status)) throw new Error('Status inválido.');
  const sheet = sheet_();
  const row = findRow_(id);
  sheet.getRange(row, ALL_HEADERS.indexOf('Status CMS') + 1).setValue(status === 'Ativo' ? 'Publicado' : status);
  return rowToProperty_(sheet.getRange(row, 1, 1, ALL_HEADERS.length).getDisplayValues()[0]);
}

function delete_(id) {
  const sheet = sheet_();
  const row = findRow_(id);
  sheet.deleteRow(row);
  return id;
}

function uploadPhoto_(payload) {
  if (!payload.propertyId || !payload.base64 || !payload.fileName) throw new Error('Imóvel, arquivo e nome são obrigatórios.');
  const props = PropertiesService.getScriptProperties();
  let folderId = PHOTO_FOLDER_ID || props.getProperty('PHOTO_FOLDER_ID');
  let folder = folderId ? DriveApp.getFolderById(folderId) : null;
  if (!folder) {
    folder = DriveApp.createFolder('Aline Martins - Fotos de Imóveis');
    folderId = folder.getId();
    props.setProperty('PHOTO_FOLDER_ID', folderId);
  }
  const bytes = Utilities.base64Decode(payload.base64);
  const blob = Utilities.newBlob(bytes, payload.mimeType || 'image/jpeg', payload.fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = `https://drive.google.com/uc?export=view&id=${file.getId()}`;
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PHOTO_SHEET_NAME);
  if (sheet) sheet.appendRow([payload.propertyId, payload.title || '', Number(payload.order) || sheet.getLastRow(), 'Galeria de imóvel', url, url, '', '', '', 'Enviada pelo painel administrativo']);
  return { id: file.getId(), url: url, name: file.getName() };
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function response_(data, e) {
  const callback = e && e.parameter && e.parameter.callback;
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(data)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(data);
}
