"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { TopBar } from "@/components/ui/TopBar";
import { whenStage } from "@/engine/stage/stageRef";
import { makeLayer, kv } from "@/lib/world/layer";

interface Section {
  h: string;
  p: string[];
  rows?: [string, string, string][];
}

const CONTENT: Record<"es" | "en", { title: string; lead: string; sections: Section[] }> = {
  es: {
    title: "Acerca de EIDOS",
    lead: "EIDOS convierte un PDF, una foto de tu pizarrón, un enlace, tus apuntes o una pregunta en un mundo que puedes recorrer: miles de partículas de luz se transforman para explicar cada idea, y cada oración lleva un hilo hasta el pasaje de la fuente que la respalda.",
    sections: [
      {
        h: "Cómo usa Claude",
        p: ["EIDOS no es una sola llamada a un modelo. Es una orquesta de agentes de Claude, cada uno con una tarea y un contexto propios. Todo lo que hacen queda visible en el Teatro de Forja y en la Sala de Máquinas."],
        rows: [
          ["Cartógrafo", "Opus 5.5", "Lee la fuente y extrae un libro de hechos con citas nativas (página o pasaje exacto)."],
          ["Director", "Opus 5.5", "Convierte el libro de hechos en un guion pedagógico y una partitura visual con salidas estructuradas."],
          ["Escéptico", "Sonnet 5.5", "Verifica cada oración contra los hechos, en un contexto aislado, y propone revisiones."],
          ["Tutor", "Sonnet 5.5", "Responde preguntas sobre la escena con citas y puede proyectar una forma."],
          ["Evaluador", "Haiku 5.5", "Califica respuestas libres a las comprobaciones socráticas."],
          ["Jardinero", "Opus 5.5", "Hace crecer un capítulo nuevo cuando una respuesta revela un malentendido."],
          ["Bifurcador", "Opus 5.5", "Explora escenarios «¿Y si…?» como ramas del recorrido."],
          ["Lente", "Haiku 5.5", "Reescribe la narración para otro nivel sin cambiar su verdad."],
        ],
      },
      {
        h: "Verdad antes que fluidez",
        p: [
          "Cada oración termina con un filamento. Verde: respaldada por la fuente. Ámbar: parcialmente respaldada. Contorno gris: conocimiento general que no viene de tu fuente. Violeta punteado: escenario hipotético razonado por Claude.",
          "Los mundos de demostración se escribieron a mano a partir de fuentes originales; sus citas se comprobaron literalmente contra esas fuentes y así lo indican.",
        ],
      },
      {
        h: "Privacidad",
        p: [
          "Tus PDFs y textos se envían a la API de Claude para construir el mundo. Se suben a la Files API con expiración de 24 horas; EIDOS no los guarda en su propio servidor y no registra su contenido, tus preguntas ni las respuestas.",
          "Los mundos que forjas se guardan solo en tu navegador. Al compartir un mundo viajan la narración, las formas y los pasajes citados, nunca tu documento original.",
          "Si usas tu propia clave de API, vive solo en esta pestaña y se envía únicamente a las rutas de EIDOS en un encabezado; nunca se guarda en el servidor.",
        ],
      },
      {
        h: "Créditos",
        p: [
          "Construido con Claude. Tipografías Bodoni Moda y Atkinson Hyperlegible Next y Mono (SIL Open Font License). Ruido simplex de Stefan Gustavson y Ashima Arts (MIT). three.js, postprocessing, GSAP, Lenis, Zod y Next.js.",
          "EIDOS es un prototipo educativo. No sustituye a tus maestros ni a tus libros: te ayuda a entenderlos.",
        ],
      },
    ],
  },
  en: {
    title: "About EIDOS",
    lead: "EIDOS turns a PDF, a photo of your whiteboard, a link, your notes or a question into a world you can walk through: thousands of particles of light morph to explain each idea, and every sentence carries a thread back to the passage of the source that supports it.",
    sections: [
      {
        h: "How it uses Claude",
        p: ["EIDOS is not a single model call. It is an orchestra of Claude agents, each with its own job and context. Everything they do is visible in the Forge Theater and the Engine Room."],
        rows: [
          ["Cartographer", "Opus 5.5", "Reads the source and extracts a fact ledger with native citations (exact page or passage)."],
          ["Director", "Opus 5.5", "Turns the ledger into a pedagogical script and a visual score with structured outputs."],
          ["Skeptic", "Sonnet 5.5", "Checks every sentence against the facts, in an isolated context, and proposes revisions."],
          ["Tutor", "Sonnet 5.5", "Answers questions about the scene with citations and can project a form."],
          ["Evaluator", "Haiku 5.5", "Grades free-text answers to the Socratic checks."],
          ["Gardener", "Opus 5.5", "Grows a new chapter when an answer reveals a misconception."],
          ["Brancher", "Opus 5.5", "Explores “What if…?” scenarios as branches of the journey."],
          ["Lens", "Haiku 5.5", "Rewrites the narration for another level without changing its truth."],
        ],
      },
      {
        h: "Truth before fluency",
        p: [
          "Every sentence ends with a filament. Green: supported by the source. Amber: partially supported. Grey outline: general knowledge that does not come from your source. Dashed violet: a hypothetical scenario reasoned by Claude.",
          "The demo worlds were written by hand from original sources; their citations were checked literally against those sources, and they say so.",
        ],
      },
      {
        h: "Privacy",
        p: [
          "Your PDFs and texts are sent to the Claude API to build the world. They are uploaded to the Files API with a 24-hour expiry; EIDOS does not store them on its own server and does not log their content, your questions or the answers.",
          "Worlds you forge are saved only in your browser. Sharing a world sends the narration, the forms and the cited passages, never your original document.",
          "If you use your own API key, it lives only in this tab and is sent only to EIDOS's routes in a header; it is never stored on the server.",
        ],
      },
      {
        h: "Credits",
        p: [
          "Built with Claude. Typefaces Bodoni Moda and Atkinson Hyperlegible Next and Mono (SIL Open Font License). Simplex noise by Stefan Gustavson and Ashima Arts (MIT). three.js, postprocessing, GSAP, Lenis, Zod and Next.js.",
          "EIDOS is an educational prototype. It does not replace your teachers or your books: it helps you understand them.",
        ],
      },
    ],
  },
};

export function AboutPage() {
  const { locale, t } = useI18n();
  const c = CONTENT[locale];
  useEffect(() => {
    void whenStage().then((stage) =>
      stage.loadProgram(
        { id: "about", palette: "tinta", count: stage.N, beats: [{ id: "a", layers: [makeLayer("network", { share: 0.6, params: kv({ nodes: 8, topology: 1, node_size: 0.07 }), expr: [{ key: "labels", value: "Cartógrafo|Director|Escéptico|Tutor|Evaluador|Jardinero|Bifurcador|Lente" }], scale: 1.3, colorMode: "region" })], transition: "flow", dustFraction: 0.2 }] },
        { cameras: ["orbit_wide"], frames: [1], enterMs: 900 },
      ),
    );
  }, []);
  return (
    <>
      <TopBar />
      <main id="main" className="page about">
        <article>
          <h1 className="display">{c.title}</h1>
          <p className="lead">{c.lead}</p>
          {c.sections.map((s) => (
            <section key={s.h}>
              <h2 className="display">{s.h}</h2>
              {s.p.map((x) => (
                <p key={x}>{x}</p>
              ))}
              {s.rows && (
                <table className="about-table">
                  <tbody>
                    {s.rows.map(([a, m, d]) => (
                      <tr key={a}>
                        <th scope="row" className="caps">
                          {a}
                        </th>
                        <td className="mono">{m}</td>
                        <td>{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ))}
          <p className="about-links ui">
            <Link className="btn-secondary" href="/">
              {t("nav.home")}
            </Link>
            <Link className="btn-secondary" href="/lab">
              {t("nav.lab")}
            </Link>
            <Link className="btn-secondary" href="/pitch">
              {t("nav.pitch")}
            </Link>
          </p>
        </article>
      </main>
    </>
  );
}
