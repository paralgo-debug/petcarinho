// PET NATUREZA - Banho & Tosa (painel) - aba Serviços e preços
// Cada serviço tem um preço para cada porte.
import { supabase } from './supabase.js';
import { esc, toast, confirmar, setStatusPub, formatarDataHora } from './util.js';
import { CONFIG_PADRAO } from './banho-calculo.js';
import { msgErro } from './banho-acoes.js';
import { modeloDe, sanearModelo, htmlForm, lerForm, converter, limparErros, mostrarErros } from './banho-precos-form.js';
import { htmlSimulador, ligarSimulador } from './banho-precos-sim.js';

const CHAVE = 'banho_tosa';
const LOCAL = 'bt_precos_rascunho_local'; // só configuração de preços; nenhum dado de cliente

function garantirCss() {
  if (document.getElementById('bt-precos-css')) return;
  const l = document.createElement('link');
  l.id = 'bt-precos-css';
  l.rel = 'stylesheet';
  l.href = 'css/banho-precos.css';
  document.head.append(l);
}

// Conta os preços ainda não definidos dos serviços disponíveis (por porte)
function contarVazios(cfg) {
  let n = 0;
  cfg.servicos.forEach((s) => {
    if (!s.ativo) return;
    Object.values(s.precos).forEach((v) => { if (v === null) n += 1; });
  });
  return n;
}

export async function viewPrecos(alvo, ctx) {
  garantirCss();
  const admin = !!ctx.ehAdmin;
  alvo.innerHTML = '<p class="carregando">Carregando serviços e preços…</p>';

  const consultas = [
    supabase.from('settings_draft').select('value,updated_at').eq('key', CHAVE).maybeSingle(),
    supabase.from('settings_published').select('value,published_at').eq('key', CHAVE).maybeSingle()
  ];
  if (admin) {
    consultas.push(supabase.from('settings_revisions').select('id,published_at,published_by').eq('key', CHAVE).order('id', { ascending: false }).limit(5));
    consultas.push(supabase.from('profiles').select('id,nome'));
  }
  const [d, p, r, pf] = await Promise.all(consultas);
  if (d.error) throw d.error;
  if (p.error) throw p.error;

  const srv = {
    rascunho: admin && !!d.data,
    atualizadoEm: d.data ? d.data.updated_at : '',
    publicado: !!p.data,
    publicadoEm: p.data ? p.data.published_at : ''
  };
  const baseCfg = (admin && d.data && d.data.value) || (p.data && p.data.value) || CONFIG_PADRAO;
  let modelo = modeloDe(baseCfg);
  let base = JSON.stringify(modelo);

  const raiz = document.createElement('div');
  alvo.replaceChildren(raiz);
  raiz.innerHTML =
    '<p class="ajuda">Tudo o que você altera aqui fica em <strong>rascunho</strong> até ser publicado. Preço vazio significa "não definido": nesse caso o site avisa o cliente que a equipe informará o valor pelo WhatsApp.</p>' +
    (admin ? '' : '<div class="nota">Somente o administrador altera serviços e preços. Você está vendo os valores publicados.</div>') +
    '<div id="bp-info" class="bp-info" role="status" aria-live="polite"></div>' +
    '<div id="bp-recup"></div>' +
    '<fieldset class="bp-fs"' + (admin ? '' : ' disabled') + '><div id="bp-form"></div></fieldset>' +
    htmlSimulador() +
    (admin
      ? '<div class="bp-acoes acoes"><button type="button" class="btn btn-primario" data-acao="salvar">Salvar rascunho</button>' +
        '<button type="button" class="btn btn-primario" data-acao="publicar">Publicar</button>' +
        '<button type="button" class="btn btn-perigo" data-acao="descartar">Descartar rascunho</button></div>' +
        '<details class="cartao bp-sec"><summary>Histórico de publicações (últimas 5)</summary><div class="bp-corpo" id="bp-hist"></div></details>'
      : '');

  const $ = (id) => raiz.querySelector('#' + id);
  const $form = $('bp-form');
  const sim = ligarSimulador(raiz, () => converter(lerForm($form), false).cfg);
  let ultSujo = null;
  let recuperavel = null;
  let espera = null;

  // ---------- Estado e recuperação local ----------
  const sujo = () => JSON.stringify(lerForm($form)) !== base;
  const limparLocal = () => { try { localStorage.removeItem(LOCAL); } catch (e) { /* ignora */ } };

  function atualizarInfo(s) {
    let t;
    if (srv.rascunho) t = 'Rascunho salvo em ' + formatarDataHora(srv.atualizadoEm) + '. Ainda não foi publicado: os clientes continuam vendo a versão anterior.';
    else if (srv.publicado) t = 'Não há rascunho. O formulário mostra o que está publicado desde ' + formatarDataHora(srv.publicadoEm) + '.';
    else t = 'Ainda não há serviços e preços publicados. O agendamento online fica indisponível até a primeira publicação.';
    $('bp-info').innerHTML = '<p>' + esc(t) + '</p>' + (s ? '<p><strong>Há alterações que ainda não foram salvas.</strong></p>' : '');
  }

  function sincronizar() {
    const s = sujo();
    if (s !== ultSujo) { ultSujo = s; atualizarInfo(s); }
    if (!admin) return;
    try {
      if (s) localStorage.setItem(LOCAL, JSON.stringify({ m: lerForm($form), t: Date.now() }));
      else localStorage.removeItem(LOCAL);
    } catch (e) { /* ignora */ }
  }

  function renderForm() { $form.innerHTML = htmlForm(modelo); }

  function depoisDeRedesenhar() {
    sim.atualizar();
    ultSujo = null;
    sincronizar();
  }

  function renderHistorico() {
    const alvoH = $('bp-hist');
    if (!alvoH) return;
    const nomes = new Map(((pf && pf.data) || []).map((x) => [x.id, x.nome || 'Equipe']));
    const revs = (r && r.data) || [];
    alvoH.innerHTML = revs.length
      ? '<ul class="bp-hist-lista">' + revs.map((x, i) =>
        '<li><span>Publicado em <strong>' + esc(formatarDataHora(x.published_at)) + '</strong>' +
        (x.published_by ? ' por ' + esc(nomes.get(x.published_by) || 'Equipe') : '') +
        (i === 0 && srv.publicado ? ' <span class="suave">(versão atual)</span>' : '') + '</span>' +
        '<button type="button" class="btn btn-pequeno" data-acao="restaurar" data-rev="' + esc(String(x.id)) + '">Restaurar como rascunho</button></li>').join('') + '</ul>'
      : '<p class="suave">Nenhuma publicação anterior.</p>';
  }

  // ---------- Início ----------
  renderForm();
  atualizarInfo(false);
  ultSujo = false;
  sim.atualizar();
  renderHistorico();

  if (admin) {
    let loc = null;
    try { loc = JSON.parse(localStorage.getItem(LOCAL) || 'null'); } catch (e) { loc = null; }
    const m = loc ? sanearModelo(loc.m) : null;
    if (m && JSON.stringify(m) !== base) {
      recuperavel = m;
      const quando = typeof loc.t === 'number' ? formatarDataHora(new Date(loc.t).toISOString()) : 'data desconhecida';
      $('bp-recup').innerHTML = '<div class="nota" role="alert"><p>Encontramos alterações <strong>não salvas</strong> feitas neste aparelho em ' + esc(quando) +
        '. Deseja recuperá-las?</p><div class="acoes"><button type="button" class="btn btn-primario btn-pequeno" data-acao="rec-sim">Recuperar</button>' +
        '<button type="button" class="btn btn-pequeno" data-acao="rec-nao">Descartar</button></div></div>';
    } else {
      limparLocal();
    }
  }

  // ---------- Operações ----------
  function mostrarProblemas(erros) {
    const f = mostrarErros($form, erros);
    if (f) { f.focus(); f.scrollIntoView({ block: 'center' }); }
    toast('Corrija os campos destacados.', 'erro');
  }

  async function gravarRascunho() {
    modelo = lerForm($form);
    const res = converter(modelo, true);
    limparErros($form);
    if (res.erros.length > 0) { mostrarProblemas(res.erros); return false; }
    const { error } = await supabase.from('settings_draft').upsert(
      { key: CHAVE, value: res.cfg, updated_at: new Date().toISOString(), updated_by: ctx.user.id },
      { onConflict: 'key' }
    );
    if (error) throw error;
    srv.rascunho = true;
    srv.atualizadoEm = new Date().toISOString();
    modelo = modeloDe(res.cfg);
    base = JSON.stringify(modelo);
    limparLocal();
    renderForm();
    depoisDeRedesenhar();
    try { await ctx.atualizarStatus(); } catch (e) { /* ignora */ }
    return true;
  }

  async function salvar(botao) {
    botao.disabled = true;
    try {
      if (await gravarRascunho()) toast('Rascunho salvo. Ele só vale para os clientes depois de publicar.');
    } catch (e) { toast(msgErro(e), 'erro'); }
    botao.disabled = false;
  }

  async function publicar(botao) {
    const pre = converter(lerForm($form), true);
    limparErros($form);
    if (pre.erros.length > 0) return mostrarProblemas(pre.erros);
    const vazios = contarVazios(pre.cfg);
    const msg = 'Publicar serviços e preços? A nova versão passa a valer no site para os clientes.' +
      (vazios > 0 ? ' Atenção: ' + vazios + ' preço(s) de serviço ainda não definido(s) (serviços disponíveis, em algum tamanho). Nesses casos o site dirá que o valor será informado pela equipe.' : '');
    if (!(await confirmar(msg, 'Publicar'))) return;

    botao.disabled = true;
    setStatusPub('publicando', 'Publicando serviços e preços…');
    let ok = false;
    try {
      if (!(await gravarRascunho())) { setStatusPub('falha', 'Serviços e preços não foram publicados.'); botao.disabled = false; return; }
      const { error } = await supabase.rpc('bt_publicar_precos');
      if (error) throw error;
      ok = true;
    } catch (e) {
      setStatusPub('falha', 'Serviços e preços não foram publicados.');
      toast(msgErro(e), 'erro');
      botao.disabled = false;
    }
    if (!ok) return;
    setStatusPub('sucesso', 'Serviços e preços publicados.');
    toast('Serviços e preços publicados.');
    limparLocal();
    try { await ctx.atualizarStatus(); } catch (e) { /* ignora */ }
    try { await viewPrecos(alvo, ctx); } catch (e) { toast(msgErro(e), 'erro'); }
  }

  async function descartar(botao) {
    if (!srv.rascunho && !sujo()) return toast('Não há rascunho nem alterações para descartar.', 'erro');
    const msg = srv.rascunho
      ? 'Descartar o rascunho? As alterações salvas e as não salvas serão perdidas. O que está publicado não muda.'
      : 'Descartar as alterações não salvas?';
    if (!(await confirmar(msg, 'Descartar'))) return;
    botao.disabled = true;
    try {
      if (srv.rascunho) {
        const { error } = await supabase.rpc('descartar_rascunho', { p_key: CHAVE });
        if (error) throw error;
      }
      limparLocal();
      toast('Rascunho descartado.');
      try { await ctx.atualizarStatus(); } catch (e) { /* ignora */ }
      await viewPrecos(alvo, ctx);
    } catch (e) { toast(msgErro(e), 'erro'); botao.disabled = false; }
  }

  async function restaurar(botao) {
    const msg = 'Copiar esta versão para o rascunho? O rascunho atual (e alterações não salvas) será substituído. Nada muda no site até você publicar.';
    if (!(await confirmar(msg, 'Restaurar como rascunho'))) return;
    botao.disabled = true;
    try {
      const { error } = await supabase.rpc('restaurar_revisao', { p_revisao: Number(botao.dataset.rev) });
      if (error) throw error;
      limparLocal();
      toast('Versão copiada para o rascunho. Revise e publique quando quiser.');
      try { await ctx.atualizarStatus(); } catch (e) { /* ignora */ }
      await viewPrecos(alvo, ctx);
    } catch (e) { toast(msgErro(e), 'erro'); botao.disabled = false; }
  }

  // Mudanças de estrutura (adicionar, remover, mover): redesenha o formulário e devolve o foco
  function mudar(fn, seletorFoco) {
    modelo = lerForm($form);
    fn(modelo);
    limparErros($form);
    renderForm();
    depoisDeRedesenhar();
    const f = seletorFoco ? $form.querySelector(seletorFoco) : null;
    if (f && !f.disabled) f.focus();
  }

  // Um serviço novo começa com os 5 preços vazios
  const precosVaziosTexto = () => ({ mini: '', pequeno: '', medio: '', grande: '', gigante: '' });

  // ---------- Eventos ----------
  raiz.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button[data-acao]');
    if (!b || !raiz.contains(b)) return;
    const acao = b.dataset.acao;
    const i = Number(b.dataset.i);

    if (acao === 'salvar') await salvar(b);
    else if (acao === 'publicar') await publicar(b);
    else if (acao === 'descartar') await descartar(b);
    else if (acao === 'restaurar') await restaurar(b);
    else if (acao === 'rec-sim') {
      modelo = recuperavel;
      renderForm();
      depoisDeRedesenhar();
      $('bp-recup').innerHTML = '';
      const primeiro = $form.querySelector('input');
      if (primeiro) primeiro.focus();
    } else if (acao === 'rec-nao') {
      limparLocal();
      recuperavel = null;
      $('bp-recup').innerHTML = '';
    } else if (acao === 'srv-add') {
      const n = lerForm($form).servicos.length;
      mudar((m) => m.servicos.push({ id: '', nome: '', precos: precosVaziosTexto(), ativo: true }), '#bp-s-nome-' + n);
    } else if (acao === 'srv-subir' || acao === 'srv-descer') {
      const j = acao === 'srv-subir' ? i - 1 : i + 1;
      const ultimo = lerForm($form).servicos.length - 1;
      if (j < 0 || j > ultimo) return;
      const sel = acao === 'srv-subir'
        ? '[data-acao="' + (j > 0 ? 'srv-subir' : 'srv-descer') + '"][data-i="' + j + '"]'
        : '[data-acao="' + (j < ultimo ? 'srv-descer' : 'srv-subir') + '"][data-i="' + j + '"]';
      mudar((m) => { const [x] = m.servicos.splice(i, 1); m.servicos.splice(j, 0, x); }, sel);
    } else if (acao === 'srv-rem') {
      const s = lerForm($form).servicos[i];
      if (s && (s.nome.trim() || s.id)) {
        const nome = s.nome.trim() || 'este serviço';
        if (!(await confirmar('Remover o serviço "' + nome + '"? Ele deixa de aparecer para os clientes depois da publicação. Para apenas escondê-lo, desmarque "Disponível para os clientes".', 'Remover serviço'))) return;
      }
      mudar((m) => m.servicos.splice(i, 1), '#bp-srv-add');
    } else if (acao === 'faixa-add') {
      const n = lerForm($form).faixas.length;
      mudar((m) => m.faixas.push({ limite: '', adicional: '' }), '#bp-f-lim-' + n);
    } else if (acao === 'faixa-rem') {
      mudar((m) => m.faixas.splice(i, 1), '#bp-faixa-add');
    }
  });

  // Digitando: o simulador atualiza sem redesenhar o formulário (o foco não se perde)
  raiz.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.closest('#bp-sim')) { sim.atualizar(); return; }
    if (!t.closest('#bp-form')) return;
    const p = t.id ? raiz.querySelector('#e-' + t.id) : null;
    if (p) p.hidden = true;
    t.removeAttribute('aria-invalid');
    clearTimeout(espera);
    espera = setTimeout(() => { sim.atualizar(); sincronizar(); }, 250);
  });

  // Ao sair do campo: mostra o erro daquele campo, se houver
  raiz.addEventListener('change', (ev) => {
    const t = ev.target;
    if (!t.closest('#bp-form')) return;
    clearTimeout(espera);
    sim.atualizar();
    sincronizar();
    if (t.type === 'checkbox' || !t.id) return;
    const meus = converter(lerForm($form), false).erros.filter((e) => e.id === t.id);
    if (meus.length > 0) mostrarErros($form, meus);
  });
     }
