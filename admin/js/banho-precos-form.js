// PET NATUREZA - Banho & Tosa (painel) - serviços e preços: modelo, formulário e validação
// O "modelo" guarda tudo como TEXTO (o que está digitado). A conversão para números
// acontece só em converter().
// Cada serviço tem um preço para cada porte (campo "precos").
import { esc } from './util.js';
import { PORTES, PELAGENS, normalizarConfig, lerNumero, formatarNumero } from './banho-calculo.js';

export const MAX_SERVICOS = 20;
export const MAX_FAIXAS = 10;
const MAX_VALOR = 100000;
const idOk = (v) => typeof v === 'string' && /^[a-z0-9_]{2,40}$/.test(v);
const txt = (v) => (typeof v === 'string' ? v : '');

// ---------------------------------------------------------------------
// Modelo (a ordem das chaves importa: o JSON é usado para comparar)
// ---------------------------------------------------------------------
export function modeloDe(cfgBruta) {
  const c = normalizarConfig(cfgBruta);
  const t = formatarNumero;
  return {
    servicos: c.servicos.slice(0, MAX_SERVICOS).map((s) => ({
      id: s.id,
      nome: s.nome,
      precos: Object.fromEntries(PORTES.map((p) => [p.valor, t(s.precos[p.valor])])),
      ativo: s.ativo
    })),
    pelagem: Object.fromEntries(PELAGENS.map((p) => [p.valor, t(c.pelagem_adicional[p.valor])])),
    faixas: c.peso_faixas.slice(0, MAX_FAIXAS).map((f) => ({ limite: t(f.acima_de_kg), adicional: t(f.adicional) })),
    manejo: t(c.manejo_dificil),
    antecedencia: String(c.antecedencia_horas),
    janela: String(c.janela_dias)
  };
}

// Valida um modelo vindo do localStorage (devolve null se estiver estranho)
export function sanearModelo(m) {
  if (!m || typeof m !== 'object' || !Array.isArray(m.servicos) || !Array.isArray(m.faixas)) return null;
  const mapa = (o, lista) => Object.fromEntries(lista.map((p) => [p.valor, txt(o && o[p.valor])]));
  return {
    servicos: m.servicos.slice(0, MAX_SERVICOS).map((s) => ({
      id: idOk(s && s.id) ? s.id : '',
      nome: txt(s && s.nome).slice(0, 60),
      precos: mapa(s && s.precos, PORTES),
      ativo: !(s && s.ativo === false)
    })),
    pelagem: mapa(m.pelagem, PELAGENS),
    faixas: m.faixas.slice(0, MAX_FAIXAS).map((f) => ({ limite: txt(f && f.limite), adicional: txt(f && f.adicional) })),
    manejo: txt(m.manejo),
    antecedencia: txt(m.antecedencia),
    janela: txt(m.janela)
  };
}

// ---------------------------------------------------------------------
// HTML do formulário
// ---------------------------------------------------------------------
function num(id, rotulo, valor, dica, modo) {
  return '<div class="campo"><label for="' + id + '">' + esc(rotulo) + '</label>' +
    (dica ? '<span class="ajuda" id="d-' + id + '">' + esc(dica) + '</span>' : '') +
    '<input type="text" id="' + id + '" inputmode="' + (modo || 'decimal') + '" autocomplete="off" value="' + esc(valor) +
    '" aria-describedby="' + (dica ? 'd-' + id + ' ' : '') + 'e-' + id + '">' +
    '<p class="erro" id="e-' + id + '" role="alert" hidden></p></div>';
}

const secao = (titulo, corpo) =>
  '<details class="cartao bp-sec" open><summary>' + esc(titulo) + '</summary><div class="bp-corpo">' + corpo + '</div></details>';

function htmlServico(s, i, total) {
  const nome = s.nome.trim() || 'sem nome';
  const btn = (acao, rot, verbo, desab, perigo) =>
    '<button type="button" class="btn ' + (perigo ? 'btn-perigo ' : '') + 'btn-pequeno" data-acao="' + acao + '" data-i="' + i +
    '" aria-label="' + esc(verbo + ' serviço ' + nome) + '"' + (desab ? ' disabled' : '') + '>' + rot + '</button>';
  const precos = PORTES.map((p) =>
    num('bp-s-' + i + '-' + p.valor, 'Preço, porte ' + p.rotulo.toLowerCase() + ' (R$)', s.precos[p.valor])).join('');
  return '<li class="bp-item bp-srv" data-sid="' + esc(s.id) + '">' +
    '<div class="campo"><label for="bp-s-nome-' + i + '">Nome do serviço</label>' +
    '<input type="text" id="bp-s-nome-' + i + '" maxlength="60" autocomplete="off" value="' + esc(s.nome) + '" aria-describedby="e-bp-s-nome-' + i + '">' +
    '<p class="erro" id="e-bp-s-nome-' + i + '" role="alert" hidden></p></div>' +
    '<p class="ajuda">Preço deste serviço para cada tamanho de pet. Deixe vazio o tamanho em que ainda não definiu o preço.</p>' +
    '<div class="bp-grade">' + precos + '</div>' +
    '<label class="bp-check"><input type="checkbox" id="bp-s-ativo-' + i + '"' + (s.ativo ? ' checked' : '') + '> <span>Disponível para os clientes</span></label>' +
    '<div class="acoes">' + btn('srv-subir', '↑ Subir', 'Subir', i === 0) + btn('srv-descer', '↓ Descer', 'Descer', i === total - 1) +
    btn('srv-rem', 'Remover', 'Remover', false, true) + '</div></li>';
}

function htmlFaixa(f, i) {
  const rot = f.limite.trim() ? 'acima de ' + f.limite.trim() + ' kg' : 'sem peso definido';
  return '<li class="bp-item bp-faixa"><div class="bp-grade">' +
    num('bp-f-lim-' + i, 'Peso acima de (kg)', f.limite) + num('bp-f-adic-' + i, 'Adicional (R$)', f.adicional) + '</div>' +
    '<div class="acoes"><button type="button" class="btn btn-perigo btn-pequeno" data-acao="faixa-rem" data-i="' + i +
    '" aria-label="' + esc('Remover faixa ' + rot) + '">Remover faixa</button></div></li>';
}

export function htmlForm(m) {
  const servicos = secao('Serviços e preços por tamanho',
    '<p class="ajuda">Cada serviço tem um preço para cada tamanho do pet. O valor aproximado mostrado ao cliente soma o preço de cada serviço escolhido, no tamanho do pet. Serviços desmarcados em "Disponível" não aparecem para os clientes. O identificador interno de cada serviço nunca muda, mesmo que você o renomeie.</p>' +
    '<ol class="bp-lista" id="bp-servicos">' + m.servicos.map((s, i) => htmlServico(s, i, m.servicos.length)).join('') + '</ol>' +
    '<p class="erro" id="e-bp-servicos" role="alert" hidden></p>' +
    '<div class="acoes"><button type="button" class="btn btn-pequeno" id="bp-srv-add" data-acao="srv-add"' +
    (m.servicos.length >= MAX_SERVICOS ? ' disabled' : '') + '>Adicionar serviço</button></div>');

  const pelagem = secao('Adicional por pelagem',
    '<p class="ajuda">Somado quando o pet tem essa pelagem. Vazio vale R$ 0,00.</p>' +
    '<div class="bp-grade">' + PELAGENS.map((p) => num('bp-pel-' + p.valor, 'Pelagem ' + p.rotulo.toLowerCase() + ' (R$)', m.pelagem[p.valor])).join('') + '</div>');

  const faixas = secao('Faixas de peso',
    '<p class="ajuda">Vale só a maior faixa que o peso do pet ultrapassar (as faixas não se somam). Até ' + MAX_FAIXAS + ' faixas.</p>' +
    '<ul class="bp-lista">' + m.faixas.map(htmlFaixa).join('') + '</ul>' +
    '<div class="acoes"><button type="button" class="btn btn-pequeno" id="bp-faixa-add" data-acao="faixa-add"' +
    (m.faixas.length >= MAX_FAIXAS ? ' disabled' : '') + '>Adicionar faixa de peso</button></div>');

  const regras = secao('Manejo difícil e agenda',
    '<div class="bp-grade">' +
    num('bp-manejo', 'Adicional de manejo difícil (R$)', m.manejo, 'Somado quando o pet é marcado como agressivo ou difícil. Vazio vale R$ 0,00.') +
    num('bp-ant', 'Antecedência mínima (horas)', m.antecedencia, 'Horários que começam em menos tempo que isso não aparecem. De 0 a 720.', 'numeric') +
    num('bp-jan', 'Janela de agendamento (dias)', m.janela, 'Até quantos dias à frente os clientes podem escolher. De 1 a 180.', 'numeric') + '</div>');

  return servicos + pelagem + faixas + regras;
}

// ---------------------------------------------------------------------
// Leitura do formulário (devolve o modelo com o que está digitado)
// ---------------------------------------------------------------------
export function lerForm(raiz) {
  const v = (id) => { const e = raiz.querySelector('#' + id); return e ? e.value : ''; };
  const m = { servicos: [], pelagem: {}, faixas: [], manejo: v('bp-manejo'), antecedencia: v('bp-ant'), janela: v('bp-jan') };
  raiz.querySelectorAll('li.bp-srv').forEach((li, i) => {
    const c = raiz.querySelector('#bp-s-ativo-' + i);
    const precos = {};
    PORTES.forEach((p) => { precos[p.valor] = v('bp-s-' + i + '-' + p.valor); });
    m.servicos.push({ id: li.dataset.sid || '', nome: v('bp-s-nome-' + i), precos, ativo: !!(c && c.checked) });
  });
  PELAGENS.forEach((p) => { m.pelagem[p.valor] = v('bp-pel-' + p.valor); });
  raiz.querySelectorAll('li.bp-faixa').forEach((li, i) => {
    m.faixas.push({ limite: v('bp-f-lim-' + i), adicional: v('bp-f-adic-' + i) });
  });
  return m;
}

// ---------------------------------------------------------------------
// Conversão e validação (mesmas regras do servidor)
// gravar = true: serviços novos recebem um identificador definitivo.
// gravar = false: usa um identificador temporário (para o simulador).
// ---------------------------------------------------------------------
function dinheiro(texto, id, erros) {
  const t = String(texto || '').trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    erros.push({ id, msg: 'Use vírgula para os centavos, por exemplo 1000,00.' });
    return null;
  }
  const n = lerNumero(t);
  if (n === null) return null;
  if (Number.isNaN(n)) { erros.push({ id, msg: 'Digite um número, por exemplo 45,90.' }); return null; }
  if (n < 0 || n > MAX_VALOR) { erros.push({ id, msg: 'Use um valor de 0 a 100.000.' }); return null; }
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) { erros.push({ id, msg: 'Use no máximo 2 casas decimais.' }); return null; }
  return n;
}

function inteiro(texto, id, min, max, msg, erros) {
  const n = lerNumero(texto);
  if (n === null || Number.isNaN(n) || !Number.isInteger(n) || n < min || n > max) {
    erros.push({ id, msg });
    return null;
  }
  return n;
}

function gerarId(nome, usados) {
  let base = String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 34).replace(/_+$/, '');
  if (base.length < 2) base = 'servico';
  let id = base;
  let n = 2;
  while (usados.has(id)) { id = base + '_' + n; n += 1; }
  return id;
}

export function converter(m, gravar) {
  const erros = [];
  const usados = new Set(m.servicos.map((s) => s.id).filter(Boolean));

  const servicos = m.servicos.map((s, i) => {
    const nome = s.nome.replace(/\s+/g, ' ').trim();
    if (!nome) erros.push({ id: 'bp-s-nome-' + i, msg: 'Informe o nome do serviço.' });
    const precos = {};
    PORTES.forEach((p) => { precos[p.valor] = dinheiro(s.precos[p.valor], 'bp-s-' + i + '-' + p.valor, erros); });
    let id = s.id;
    if (!id) {
      id = gravar ? gerarId(nome, usados) : '~novo' + i;
      if (gravar) s.id = id;
    }
    usados.add(id);
    return { id, nome, precos, ativo: s.ativo };
  });
  if (servicos.length < 1) erros.push({ id: 'bp-servicos', msg: 'Cadastre pelo menos um serviço.' });
  if (servicos.length > MAX_SERVICOS) erros.push({ id: 'bp-servicos', msg: 'Use no máximo ' + MAX_SERVICOS + ' serviços.' });

  const pelagem_adicional = {};
  PELAGENS.forEach((p) => { pelagem_adicional[p.valor] = dinheiro(m.pelagem[p.valor], 'bp-pel-' + p.valor, erros); });

  const vistos = [];
  let faixas = m.faixas.map((f, i) => {
    const lim = lerNumero(f.limite);
    let acima = null;
    const idLim = 'bp-f-lim-' + i;
    if (lim === null) erros.push({ id: idLim, msg: 'Informe o peso limite da faixa.' });
    else if (Number.isNaN(lim) || lim < 0.1 || lim > 150) erros.push({ id: idLim, msg: 'Informe um peso entre 0,1 e 150 kg.' });
    else if (Math.abs(lim * 100 - Math.round(lim * 100)) > 1e-6) erros.push({ id: idLim, msg: 'Use no máximo 2 casas decimais.' });
    else if (vistos.includes(lim)) erros.push({ id: idLim, msg: 'Já existe uma faixa com este limite.' });
    else { acima = lim; vistos.push(lim); }
    return { acima_de_kg: acima, adicional: dinheiro(f.adicional, 'bp-f-adic-' + i, erros) };
  }).filter((f) => f.acima_de_kg !== null);
  if (gravar) faixas = faixas.sort((a, b) => a.acima_de_kg - b.acima_de_kg);

  const manejo_dificil = dinheiro(m.manejo, 'bp-manejo', erros);
  const antecedencia_horas = inteiro(m.antecedencia, 'bp-ant', 0, 720, 'Informe um número inteiro de horas, de 0 a 720.', erros);
  const janela_dias = inteiro(m.janela, 'bp-jan', 1, 180, 'Informe um número inteiro de dias, de 1 a 180.', erros);

  return {
    cfg: { servicos, pelagem_adicional, peso_faixas: faixas, manejo_dificil, antecedencia_horas, janela_dias },
    erros
  };
}

// ---------------------------------------------------------------------
// Mensagens de erro ao lado dos campos
// ---------------------------------------------------------------------
export function limparErros(raiz) {
  raiz.querySelectorAll('.erro').forEach((p) => { p.hidden = true; });
  raiz.querySelectorAll('[aria-invalid]').forEach((n) => n.removeAttribute('aria-invalid'));
}

// Devolve o primeiro elemento com erro (para receber o foco)
export function mostrarErros(raiz, erros) {
  let primeiro = null;
  for (const e of erros) {
    const p = raiz.querySelector('#e-' + e.id);
    if (p) { p.textContent = e.msg; p.hidden = false; }
    const campo = e.id === 'bp-servicos' ? raiz.querySelector('#bp-srv-add') : raiz.querySelector('#' + e.id);
    if (campo && campo.tagName === 'INPUT') campo.setAttribute('aria-invalid', 'true');
    if (campo) {
      const det = campo.closest('details');
      if (det) det.open = true;
      if (!primeiro) primeiro = campo;
    }
  }
  return primeiro;
    }
