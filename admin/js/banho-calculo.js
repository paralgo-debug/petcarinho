// PET NATUREZA - Banho & Tosa - cálculo da estimativa e constantes
// Usado pelo site público e pelo painel. Não depende de nenhum outro arquivo.
// A função calcular() segue exatamente a função SQL bt_calcular().
// Cada serviço tem um preço para cada porte (campo "precos").

export const PORTES = [
  { valor: 'mini', rotulo: 'Mini' },
  { valor: 'pequeno', rotulo: 'Pequeno' },
  { valor: 'medio', rotulo: 'Médio' },
  { valor: 'grande', rotulo: 'Grande' },
  { valor: 'gigante', rotulo: 'Gigante' }
];

export const PELAGENS = [
  { valor: 'curto', rotulo: 'Curto' },
  { valor: 'medio', rotulo: 'Médio' },
  { valor: 'longo', rotulo: 'Longo' },
  { valor: 'cacheado', rotulo: 'Cacheado' },
  { valor: 'outro', rotulo: 'Outro' }
];

export const ESPECIES = [
  { valor: 'cachorro', rotulo: 'Cachorro' },
  { valor: 'gato', rotulo: 'Gato' },
  { valor: 'outro', rotulo: 'Outro' }
];

export const STATUS = [
  { valor: 'novo', rotulo: 'Novo', classe: 'st-novo' },
  { valor: 'em_contato', rotulo: 'Em contato', classe: 'st-contato' },
  { valor: 'confirmado', rotulo: 'Confirmado', classe: 'st-confirmado' },
  { valor: 'cancelado', rotulo: 'Cancelado', classe: 'st-cancelado' },
  { valor: 'realizado', rotulo: 'Realizado', classe: 'st-realizado' }
];

export const AVISO_ESTIMATIVA =
  'Este é apenas um valor aproximado. O valor final será confirmado pela equipe.';

export const TEXTO_PRECO_PELA_EQUIPE =
  'O valor deste atendimento será informado pela equipe do Pet Natureza pelo WhatsApp.';

// Preços vazios (nulo = ainda não definido) para os 5 portes
export function precosVazios() {
  return { mini: null, pequeno: null, medio: null, grande: null, gigante: null };
}

export const CONFIG_PADRAO = {
  servicos: [
    { id: 'banho_simples', nome: 'Banho simples', precos: precosVazios(), ativo: true },
    { id: 'banho_tosa_higienica', nome: 'Banho e tosa higiênica', precos: precosVazios(), ativo: true },
    { id: 'tosa_completa', nome: 'Tosa completa', precos: precosVazios(), ativo: true },
    { id: 'hidratacao', nome: 'Hidratação', precos: precosVazios(), ativo: true },
    { id: 'escovacao', nome: 'Escovação', precos: precosVazios(), ativo: true }
  ],
  pelagem_adicional: { curto: null, medio: null, longo: null, cacheado: null, outro: null },
  peso_faixas: [],
  manejo_dificil: null,
  antecedencia_horas: 12,
  janela_dias: 30
};

// ---------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------
function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function arredondar2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function copiarConfig(cfg) {
  return JSON.parse(JSON.stringify(cfg));
}

export function rotuloDe(lista, valor) {
  const item = lista.find((x) => x.valor === valor);
  return item ? item.rotulo : '';
}

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function brl(valor) {
  const n = num(valor);
  return n === null ? '' : fmtBRL.format(n);
}

// Lê número digitado (aceita vírgula e ponto de milhar).
// Vazio -> null. Inválido -> NaN. Válido -> número.
export function lerNumero(texto) {
  let t = String(texto === null || texto === undefined ? '' : texto).trim().replace(/\s+/g, '');
  if (t === '') return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

// Número -> texto com vírgula (null -> vazio)
export function formatarNumero(n) {
  const v = num(n);
  return v === null ? '' : String(v).replace('.', ',');
}

// ---------------------------------------------------------------------
// Merge próprio e seguro com os valores padrão (aceita null nos preços)
// ---------------------------------------------------------------------
function mapaDePrecos(origem, chaves) {
  const saida = {};
  const o = origem && typeof origem === 'object' && !Array.isArray(origem) ? origem : {};
  for (const k of chaves) saida[k] = num(o[k]);
  return saida;
}

export function normalizarConfig(bruta) {
  const b = bruta && typeof bruta === 'object' && !Array.isArray(bruta) ? bruta : {};
  const chavesPorte = PORTES.map((p) => p.valor);

  let servicos;
  if (Array.isArray(b.servicos)) {
    servicos = b.servicos
      .filter((s) => s && typeof s === 'object' && typeof s.id === 'string' && s.id !== '')
      .map((s) => ({
        id: s.id,
        nome: typeof s.nome === 'string' ? s.nome : s.id,
        precos: mapaDePrecos(s.precos, chavesPorte),
        ativo: s.ativo !== false
      }));
  } else {
    servicos = copiarConfig(CONFIG_PADRAO.servicos);
  }

  const faixas = Array.isArray(b.peso_faixas)
    ? b.peso_faixas
        .filter((f) => f && typeof f === 'object' && num(f.acima_de_kg) !== null)
        .map((f) => ({ acima_de_kg: num(f.acima_de_kg), adicional: num(f.adicional) }))
    : [];

  const ant = num(b.antecedencia_horas);
  const jan = num(b.janela_dias);

  return {
    servicos,
    pelagem_adicional: mapaDePrecos(b.pelagem_adicional, PELAGENS.map((p) => p.valor)),
    peso_faixas: faixas,
    manejo_dificil: num(b.manejo_dificil),
    antecedencia_horas: ant !== null && ant >= 0 ? ant : CONFIG_PADRAO.antecedencia_horas,
    janela_dias: jan !== null && jan >= 1 ? jan : CONFIG_PADRAO.janela_dias
  };
}

// ---------------------------------------------------------------------
// Cálculo da estimativa
// entrada: { porte, pelagem, peso (número ou null), dificil (boolean), servicos: [ids] }
// retorno: { ok:true, total, itens:[{rotulo, valor}] }
//       ou { ok:false, motivo:'dados'|'preco', faltando:[...] }
// Itens, na ordem: serviços, pelagem, peso, manejo.
// ---------------------------------------------------------------------
const ROTULO_PELAGEM = { curto: 'curta', medio: 'média', longo: 'longa', cacheado: 'cacheada', outro: 'outra' };

export function calcular(cfg, entrada) {
  const e = entrada || {};
  const porte = e.porte || '';
  const pelagem = e.pelagem || '';
  const ids = Array.isArray(e.servicos) ? e.servicos : [];

  const faltaDados = [];
  if (!porte) faltaDados.push('porte');
  if (!pelagem) faltaDados.push('pelagem');
  if (ids.length === 0) faltaDados.push('servicos');
  if (faltaDados.length > 0) return { ok: false, motivo: 'dados', faltando: faltaDados };

  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    return { ok: false, motivo: 'preco', faltando: ['configuracao'] };
  }

  const faltaPreco = [];
  const itens = [];
  let total = 0;

  // Serviços: o preço vem do porte do pet
  const lista = Array.isArray(cfg.servicos) ? cfg.servicos : [];
  for (const id of ids) {
    const srv = lista.find((s) => s && s.id === id);
    const preco = srv && srv.precos ? num(srv.precos[porte]) : null;
    if (preco === null) {
      faltaPreco.push('servico:' + id);
    } else {
      itens.push({ rotulo: typeof srv.nome === 'string' ? srv.nome : id, valor: preco });
      total += preco;
    }
  }

  if (faltaPreco.length > 0) return { ok: false, motivo: 'preco', faltando: faltaPreco };

  // Pelagem (vazio vale 0)
  const vPel = num(cfg.pelagem_adicional ? cfg.pelagem_adicional[pelagem] : null) || 0;
  if (vPel > 0) {
    itens.push({ rotulo: 'Pelagem ' + (ROTULO_PELAGEM[pelagem] || pelagem), valor: vPel });
    total += vPel;
  }

  // Maior faixa de peso ultrapassada (faixas não se acumulam)
  const peso = num(e.peso);
  if (peso !== null && Array.isArray(cfg.peso_faixas)) {
    let melhor = null;
    let adicFaixa = 0;
    for (const f of cfg.peso_faixas) {
      const lim = f ? num(f.acima_de_kg) : null;
      if (lim !== null && peso > lim && (melhor === null || lim > melhor)) {
        melhor = lim;
        adicFaixa = num(f.adicional) || 0;
      }
    }
    if (melhor !== null && adicFaixa > 0) {
      itens.push({ rotulo: 'Peso acima de ' + String(melhor).replace('.', ',') + ' kg', valor: adicFaixa });
      total += adicFaixa;
    }
  }

  // Manejo difícil (vazio vale 0)
  if (e.dificil === true) {
    const vMan = num(cfg.manejo_dificil) || 0;
    if (vMan > 0) {
      itens.push({ rotulo: 'Manejo difícil', valor: vMan });
      total += vMan;
    }
  }

  return { ok: true, total: arredondar2(total), itens };
}

// ---------------------------------------------------------------------
// Texto para quando não há estimativa (sem o aviso fixo; use AVISO_ESTIMATIVA à parte)
// ---------------------------------------------------------------------
export function explicarSemEstimativa(est) {
  if (!est || est.ok) return '';
  if (est.motivo === 'preco') return TEXTO_PRECO_PELA_EQUIPE;

  const nomes = { porte: 'o porte do pet', pelagem: 'o tipo de pelagem', servicos: 'pelo menos um serviço' };
  const partes = (est.faltando || []).map((k) => nomes[k]).filter(Boolean);
  if (partes.length === 0) {
    return 'Para calcular o valor aproximado, informe o porte do pet, o tipo de pelagem e pelo menos um serviço.';
  }
  const texto = partes.length === 1
    ? partes[0]
    : partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1];
  return 'Para calcular o valor aproximado, informe ' + texto + '.';
}
