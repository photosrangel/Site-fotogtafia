// ============================================
// SOBRE — CMS
// ============================================
// Carrega o conteúdo da página "Sobre" do Supabase
// (tabela site_content, slug 'sobre', seção 'conteudo').
// Se não houver conteúdo salvo, usa os padrões abaixo.

import { getPageContent, getSettings, initSite, esc } from './cms-config.js';

const DEFAULTS = {
  eyebrow: 'Sobre mim',
  paragraphs: [
    'Meu nome é Rangel Santos, fotógrafo em Vale de Cambra, Portugal. Meu trabalho é dedicado ao retrato feminino — não o retrato que só mostra como você é por fora, mas aquele que devolve algo por dentro.',
    'Ajudar mulheres a reconstruir a autoestima é o que me motiva a cada sessão. Muitas chegam inseguras diante da câmera, e minha função é criar o ambiente certo para que isso se dissolva — com luz, tempo, e escuta.',
    'Cada projeto é entregue com cuidado: você recebe um link privado para escolher suas fotos favoritas, e eu trato as imagens escolhidas uma a uma antes da entrega final.'
  ],
  specs: [
    { label: 'Baseado em', value: 'Vale de Cambra, Portugal' },
    { label: 'Especialidade', value: 'Retrato Feminino & Autoestima' },
    { label: 'Prazo de entrega', value: '05–10 dias úteis' },
    { label: 'Atende', value: 'Vale de Cambra e arredores' }
  ],
  portrait_url: 'images/retrato-01.jpg',
  portrait_alt: 'Retrato de Rangel Santos, fotógrafo',
  cta_text: 'Vamos conversar',
  cta_url: '/contato'
};

function normalizarTexto(value) {
  return String(value ?? '').trim();
}

function chaveSpec(label) {
  return normalizarTexto(label)
    .toLocaleLowerCase('pt-PT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function mergeSpecs(savedSpecs, settings) {
  const saved =
    Array.isArray(savedSpecs)
      ? savedSpecs
          .filter(
            spec =>
              spec &&
              typeof spec === 'object'
          )
          .map(spec => ({
            label:
              normalizarTexto(spec.label),
            value:
              normalizarTexto(spec.value)
          }))
          .filter(
            spec =>
              spec.label &&
              spec.value
          )
      : [];

  const savedByKey =
    new Map(
      saved.map(spec => [
        chaveSpec(spec.label),
        spec
      ])
    );

  const result =
    DEFAULTS.specs.map(defaultSpec => {
      const key =
        chaveSpec(
          defaultSpec.label
        );

      const savedSpec =
        savedByKey.get(key);

      if (savedSpec) {
        savedByKey.delete(key);

        return {
          label:
            savedSpec.label ||
            defaultSpec.label,

          value:
            savedSpec.value ||
            defaultSpec.value
        };
      }

      if (
        key === 'baseado em' &&
        normalizarTexto(
          settings?.location
        )
      ) {
        return {
          ...defaultSpec,
          value:
            normalizarTexto(
              settings.location
            )
        };
      }

      if (
        key === 'especialidade' &&
        normalizarTexto(
          settings?.specialty
        )
      ) {
        return {
          ...defaultSpec,
          value:
            normalizarTexto(
              settings.specialty
            )
        };
      }

      return {
        ...defaultSpec
      };
    });

  savedByKey.forEach(spec => {
    result.push(spec);
  });

  return result;
}

function mostrarPaginaSobre() {
  document.documentElement.classList.remove(
    'sobre-cms-loading'
  );

  document.documentElement.classList.add(
    'sobre-cms-ready'
  );
}

async function carregarSobre() {
  try {
    /*
      initSite já carrega/aplica as configurações globais.
      Depois buscamos somente o conteúdo específico da página.
      A tela principal continua oculta até este primeiro render terminar.
    */
    const [
      { settings },
      sections
    ] =
      await Promise.all([
        initSite(),
        getPageContent('sobre')
      ]);

    const c =
      sections.conteudo || {};

    const eyebrow =
      document.getElementById(
        'sobre-eyebrow'
      );

    if (eyebrow) {
      eyebrow.textContent =
        normalizarTexto(c.eyebrow) ||
        DEFAULTS.eyebrow;
    }

    const paragraphs =
      Array.isArray(c.paragraphs) &&
      c.paragraphs.length
        ? c.paragraphs
            .map(normalizarTexto)
            .filter(Boolean)
        : DEFAULTS.paragraphs;

    const parasContainer =
      document.getElementById(
        'sobre-paragraphs'
      );

    if (parasContainer) {
      parasContainer.innerHTML =
        paragraphs
          .map(
            p =>
              `<p>${esc(p)}</p>`
          )
          .join('');
    }

    const specs =
      mergeSpecs(
        c.specs,
        settings
      );

    const specsEl =
      document.getElementById(
        'sobre-specs'
      );

    if (specsEl) {
      specsEl.innerHTML =
        specs
          .map(
            spec => `
              <div>
                <dt>${esc(spec.label)}</dt>
                <dd>${esc(spec.value)}</dd>
              </div>
            `
          )
          .join('');
    }

    const portrait =
      document.getElementById(
        'sobre-portrait'
      );

    if (portrait) {
      portrait.src =
        normalizarTexto(
          c.portrait_url
        ) ||
        DEFAULTS.portrait_url;

      portrait.alt =
        normalizarTexto(
          c.portrait_alt
        ) ||
        DEFAULTS.portrait_alt;
    }

    const cta =
      document.getElementById(
        'sobre-cta'
      );

    if (cta) {
      cta.href =
        normalizarTexto(
          c.cta_url
        ) ||
        DEFAULTS.cta_url;

      cta.textContent =
        normalizarTexto(
          c.cta_text
        ) ||
        DEFAULTS.cta_text;
    }
  } catch (error) {
    /*
      Em falha de rede, não deixamos a página invisível.
      O HTML inicial serve como fallback.
    */
    console.error(
      'CMS Sobre: erro ao carregar:',
      error
    );
  } finally {
    mostrarPaginaSobre();
  }
}

document.addEventListener('DOMContentLoaded', carregarSobre);

