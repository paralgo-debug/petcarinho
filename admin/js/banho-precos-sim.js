// PET NATUREZA - Banho & Tosa (painel) - simulador de valor aproximado
// Usa as regras digitadas no formulário (mesmo sem salvar) e o mesmo calcular() do site.
import { esc } from './util.js';
import {
  PORTES, PELAGENS, AVISO_ESTIMATIVA, calcular, brl, lerNumero, rotuloDe, explicarSemEstimativa
} from './banho-calculo.js';

const opcoes = (lista) => lista.map((x) => '<option value="' + esc(x.valor) + '">' + esc(x.rotulo) + '</option>').join('');

export function htmlSimulador() {
  return '<details class="cartao bp-sec" id="bp-sim" open><summary>Simulador de valor aproximado</summary><div class="bp-corpo">' +
    '<p class="ajuda">Usa as regras digitadas acima, mesmo sem salvar. Serve só para conferir como o cliente verá o valor.</p>' +
    '<div class="bp-grade">' +
    '<div class="campo"><label for="bp-sim-porte">Porte</label><select id="bp-sim-porte"><option value="">Selecione</option>' + opcoes(PORTES) + '</select></div>' +
    '<div class="campo"><label for="bp-sim-pelagem">Pelagem</label><select id="bp-sim-pelagem"><option value="">Selecione</option>' + opcoes(PELAGENS) + '</select></div>' +
    '<div class="campo"><label for="bp-sim-peso">Peso em kg (opcional)</label><input type="text" id="bp-sim-peso" inputmode="decimal" autocomplete="off"></div>' +
    '</div>' +
    '<label class="bp-check"><input type="checkbox" id="bp-sim-dificil"> <span>Pet agressivo ou difícil de manejar</span></label>' +
    '<fieldset class="bp-fs"><legend>Serviços</legend><div id="bp-sim-servicos" class="bp-checks"></div></fieldset>' +
    '<div id="bp-sim-res" class="bp-sim-res" role="status" aria-live="polite"></div>' +
    '</div></details>';
}

function faltandoTexto(est, cfg, porte) {
  return (est.faltando || []).map((k) => {
    if (k.startsWith('servico:')) {
      const s = cfg.servicos.find((x) => x.id === k.slice(8));
      const nome = s && s.nome ? s.nome : 'serviço';
      const p = rotuloDe(PORTES, porte).toLowerCase();
      return 'preço de "' + nome + '"' + (p ? ' para o porte ' + p : '');
    }
    return '';
  }).filter(Boolean);
}

export function ligarSimulador(raiz, lerCfg) {
  const $ = (id) => raiz.querySelector('#' + id);
  const marcados = new Set();
  let assinatura = null;
  let ultimoHtml = null;

  function listar(cfg) {
    // guarda o que está marcado antes de redesenhar a lista
    const atuais = raiz.querySelectorAll('input[name="bp-sim-srv"]');
    if (atuais.length > 0) {
      marcados.clear();
      atuais.forEach((i) => { if (i.checked) marcados.add(i.value); });
    }
    const ass = JSON.stringify(cfg.servicos.map((s) => [s.id, s.nome, s.ativo]));
    if (ass === assinatura) return;
    assinatura = ass;
    const chaves = new Set(cfg.servicos.map((s) => s.id));
    Array.from(marcados).forEach((k) => { if (!chaves.has(k)) marcados.delete(k); });
    $('bp-sim-servicos').innerHTML = cfg.servicos.length
      ? cfg.servicos.map((s) =>
        '<label class="bp-check"><input type="checkbox" name="bp-sim-srv" value="' + esc(s.id) + '"' + (marcados.has(s.id) ? ' checked' : '') + '> <span>' +
        esc(s.nome || 'Serviço sem nome') + (s.ativo ? '' : ' (indisponível)') + '</span></label>').join('')
      : '<p class="suave">Cadastre um serviço acima para simular.</p>';
  }

  function atualizar() {
    const cfg = lerCfg();
    listar(cfg);

    let peso = lerNumero($('bp-sim-peso').value);
    const pesoInvalido = Number.isNaN(peso);
    if (pesoInvalido) peso = null;

    const porte = $('bp-sim-porte').value;
    const ids = Array.from(raiz.querySelectorAll('input[name="bp-sim-srv"]:checked')).map((i) => i.value);
    const est = calcular(cfg, {
      porte,
      pelagem: $('bp-sim-pelagem').value,
      peso,
      dificil: $('bp-sim-dificil').checked,
      servicos: ids
    });

    let h = pesoInvalido ? '<p class="erro">Peso inválido no simulador: ele foi ignorado no cálculo.</p>' : '';
    if (est.ok) {
      h += '<p class="bt-total">' + esc(brl(est.total)) + '</p><ul class="bt-itens">' +
        est.itens.map((i) => '<li><span>' + esc(i.rotulo) + '</span><span>' + esc(brl(i.valor)) + '</span></li>').join('') + '</ul>';
    } else {
      h += '<p>' + esc(explicarSemEstimativa(est)) + '</p>';
      const f = est.motivo === 'preco' ? faltandoTexto(est, cfg, porte) : [];
      if (f.length > 0) h += '<p><strong>Falta definir:</strong> ' + esc(f.join('; ')) + '.</p>';
    }
    h += '<p class="ajuda">' + esc(AVISO_ESTIMATIVA) + '</p>';
    if (h !== ultimoHtml) {
      ultimoHtml = h;
      $('bp-sim-res').innerHTML = h;
    }
  }

  return { atualizar };
                         }
