/**
 * Backend do painel de imóveis.
 * Publique como Web App com acesso restrito às contas autorizadas.
 * Configure ADMIN_EMAILS nas propriedades do script, separados por vírgula.
 */
const SPREADSHEET_ID = '1Ewu6Ipro4xAHokeBbhVc-cYfQik1PRGPrAMhtRZDu3U';
const PHOTO_FOLDER_ID = '1fRDgyNIGAqQwj1rkJfXp0PPvWXmaEMq6';
const SHEET_NAME = 'IMÓVEIS';
const PHOTO_SHEET_NAME = 'FOTOS';
const DEFAULT_ADMIN_EMAILS = [
  'sidneisrbarros@gmail.com',
  'limartins.corretora@gmail.com',
  'alinemartinsframer@gmail.com'
];
const HEADERS = ['ID', 'Título', 'Operação', 'Preço (texto do site)', 'Endereço / localização exibida', 'Área', 'Quartos', 'Banheiros', 'Andares (campo do site)', 'Condomínio', 'IPTU', 'Características e resumo da descrição'];
// Estrutura real da aba IMÓVEIS.
const ALL_HEADERS = HEADERS.concat(['URL', 'Fotos', 'Status CMS', 'Destaque', 'Slug', 'Atualizado em', 'Cidade', 'Ano construção']);

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'list';
    if (action === 'public') return response_({ ok: true, properties: list_() }, e);
    const authorizedEmail = authorize_();
    if (action === 'create') {
      const property = JSON.parse((e && e.parameter && e.parameter.payload) || '{}');
      return response_({ ok: true, email: authorizedEmail, property: create_(property) }, e);
    }
    if (action === 'list') return response_({ ok: true, email: authorizedEmail, properties: list_() }, e);
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
    if (payload.action === 'deletePhoto') return json_({ ok: true, deleted: deletePhoto_(payload) });
    if (payload.action === 'reorderPhotos') return json_({ ok: true, reordered: reorderPhotos_(payload) });
    if (payload.action === 'status') return json_({ ok: true, property: setStatus_(payload.id, payload.status) });
    if (payload.action === 'delete') return json_({ ok: true, deleted: delete_(payload.id) });
    return json_({ ok: false, error: 'Ação POST inválida.' });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function authorize_() {
  const activeEmail = Session.getActiveUser().getEmail();
  const effectiveEmail = Session.getEffectiveUser().getEmail();
  const configured = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS') || '';
  const emails = [...new Set(DEFAULT_ADMIN_EMAILS.concat(configured.split(',')))].map(item => item.trim().toLowerCase()).filter(Boolean);
  const candidates = [activeEmail, effectiveEmail].map(item => String(item || '').trim().toLowerCase()).filter(Boolean);
  const authorizedEmail = candidates.find(email => emails.includes(email));
  if (!authorizedEmail) throw new Error('Conta Google não autorizada.');
  return authorizedEmail;
}

function sheet_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('A aba IMÓVEIS não foi encontrada.');

  // Mantém as colunas atuais e cria a nova coluna de cidade no fim da tabela.
  if (sheet.getMaxColumns() < ALL_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), ALL_HEADERS.length - sheet.getMaxColumns());
  }
  if (sheet.getRange(1, ALL_HEADERS.length - 1).getDisplayValue() !== 'Cidade') {
    sheet.getRange(1, ALL_HEADERS.length - 1).setValue('Cidade');
  }
  if (sheet.getRange(1, ALL_HEADERS.length).getDisplayValue() !== 'Ano construção') {
    sheet.getRange(1, ALL_HEADERS.length).setValue('Ano construção');
  }

  return sheet;
}

function list_() {
  const values = sheet_().getDataRange().getDisplayValues();
  const properties = values.slice(1).filter(row => row[0]).map(rowToProperty_);
  const photoSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PHOTO_SHEET_NAME);
  if (!photoSheet || photoSheet.getLastRow() < 2) return properties;

  const photosByProperty = {};
  photoSheet.getDataRange().getDisplayValues().slice(1).forEach(row => {
    const propertyId = row[0];
    const url = row[4] || row[5];
    const photoId = extractDriveId_(url);
    if (!propertyId || !url || !photoId) return;
    if (!photosByProperty[propertyId]) photosByProperty[propertyId] = [];
    const stableUrl = `https://lh3.googleusercontent.com/d/${photoId}=w1600`;
    const fallbackUrl = `https://drive.google.com/thumbnail?id=${photoId}&sz=w1600`;
    photosByProperty[propertyId].push({ id: photoId, localSrc: stableUrl, url: stableUrl, fallback: fallbackUrl, order: Number(row[2]) || 0 });
  });

  return properties.map(property => ({
    ...property,
    Images: (photosByProperty[property.ID] || []).sort((a, b) => a.order - b.order)
  }));
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
    if (header === 'Ano construção') return property[header] || 'Consultar';
    return property[header] || '';
  });
  sheet.getRange(row, 1, 1, ALL_HEADERS.length).setValues([values]);
  return rowToProperty_(sheet.getRange(row, 1, 1, ALL_HEADERS.length).getDisplayValues()[0]);
}

function create_(property) {
  property = { ...(property || {}) };
  if (!/^IMV\d+$/i.test(String(property.ID || ''))) property.ID = nextId_();
  validate_(property);
  const sheet = sheet_();
  if (sheet.getLastRow() === 0) sheet.appendRow(ALL_HEADERS);
  if (sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getDisplayValues().flat().includes(property.ID)) {
    throw new Error('Já existe um imóvel com este ID.');
  }
  sheet.appendRow(ALL_HEADERS.map(header => {
    if (header === 'Status CMS') return property.Status === 'Ativo' ? 'Publicado' : (property.Status || 'Publicado');
    if (header === 'Ano construção') return property[header] || 'Consultar';
    return property[header] || '';
  }));
  return property;
}

function nextId_() {
  const sheet = sheet_();
  if (sheet.getLastRow() < 2) return 'IMV001';
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().flat();
  const highest = ids.reduce((max, value) => {
    const match = String(value).match(/^IMV(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `IMV${String(highest + 1).padStart(3, '0')}`;
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
  const propertyId = payload.propertyId === 'Automático' ? latestPropertyId_() : payload.propertyId;
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
  const url = `https://lh3.googleusercontent.com/d/${file.getId()}=w1600`;
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PHOTO_SHEET_NAME);
  if (sheet) sheet.appendRow([propertyId, payload.title || '', Number(payload.order) || sheet.getLastRow(), 'Galeria de imóvel', url, url, '', '', '', 'Enviada pelo painel administrativo']);
  return { id: file.getId(), url: url, name: file.getName() };
}

function latestPropertyId_() {
  const sheet = sheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('O imóvel precisa ser criado antes do envio das fotos.');
  return sheet.getRange(lastRow, 1).getDisplayValue();
}

function deletePhoto_(payload) {
  if (!payload.propertyId || (!payload.photoId && !payload.photoUrl)) {
    throw new Error('Imóvel e imagem são obrigatórios.');
  }

  const fileId = payload.photoId || extractDriveId_(payload.photoUrl);
  if (fileId) {
    try {
      DriveApp.getFileById(fileId).setTrashed(true);
    } catch (error) {
      // O arquivo pode já ter sido removido do Drive; a linha ainda deve ser limpa.
    }
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PHOTO_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return payload.photoUrl || fileId;

  const rows = sheet.getDataRange().getDisplayValues();
  for (let index = rows.length - 1; index >= 1; index -= 1) {
    const row = rows[index];
    const sameProperty = row[0] === payload.propertyId;
    const samePhoto = payload.photoUrl ? row[4] === payload.photoUrl || row[5] === payload.photoUrl : true;
    if (sameProperty && samePhoto) sheet.deleteRow(index + 1);
  }

  return payload.photoUrl || fileId;
}

function reorderPhotos_(payload) {
  if (!payload.propertyId || !Array.isArray(payload.photoIds)) {
    throw new Error('Imóvel e ordem das imagens são obrigatórios.');
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PHOTO_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return true;

  const rows = sheet.getDataRange().getDisplayValues();
  payload.photoIds.forEach((photoId, order) => {
    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      const rowPhotoId = extractDriveId_(row[4] || row[5]);
      if (row[0] === payload.propertyId && rowPhotoId === photoId) {
        sheet.getRange(index + 1, 3).setValue(order + 1);
        break;
      }
    }
  });

  return true;
}

function extractDriveId_(url) {
  const value = String(url || '');
  const match = value.match(/[?&]id=([^&]+)/) || value.match(/\/d\/([A-Za-z0-9_-]+)/) || value.match(/googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : '';
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
