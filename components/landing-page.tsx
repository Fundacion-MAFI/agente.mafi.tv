"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const PARAGRAPH_SPLIT = /\n\n+/;
const BOLD_PATTERN = /\*\*(.+?)\*\*/;
const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/;

type Lang = "es" | "en";

type FaqItem = {
  question: string;
  answer: string;
};

type LinkItem = {
  label: string;
  href: string;
};

type LangContent = {
  cta: string;
  ctaLoggedIn: string;
  heroTitle: string;
  heroSubtitle?: string;
  heroText: string;
  introHeading?: string;
  introText?: string;
  tryPrototypeLabel?: string;
  faqTitle: string;
  faq: FaqItem[];
  linksTitle: string;
  linksSubtitle?: string;
  links: LinkItem[];
  contactLine?: string;
  creditsTitle: string;
  credits: string;
  copyright: string;
};

const CONTENT: Record<Lang, LangContent> = {
  es: {
    cta: "Comenzar",
    ctaLoggedIn: "Ir al Agente",
    heroTitle: "Agente Fílmico MAFI",
    heroSubtitle: "Una interfaz basada en prompts para explorar archivos de video",
    heroText:
      "Explora el archivo audiovisual del Museo de Arte y Fotografía Independiente. Pregúntame lo que quieras y te compartiré planos, historias y enlaces para que juntos armemos tu propio recorrido por el archivo.",
    introHeading: "Agente Fílmico: Un Prototipo Funcional",
    introText:
      "¿Qué ocurre cuando puedes conversar con una colección de películas? Agente Fílmico explora esta pregunta introduciendo el prompting como una nueva forma de interfaz para la exploración audiovisual. Trabajando con 50 cortometrajes documentales del archivo MAFI—anotados mediante estrategias híbridas de IA y curación humana—estamos probando cómo la interacción conversacional puede abrir posibilidades creativas para acceder a materiales de archivo. Haz preguntas en lenguaje natural y observa cómo responde un agente curatorial entrenado con LLMs. Ten en cuenta que este es un experimento activo: el comportamiento del sistema cambia con frecuencia mientras lo probamos y refinamos.",
    tryPrototypeLabel: "Prueba el Prototipo",
    faqTitle: "Preguntas frecuentes",
    faq: [
      {
        question: "¿Qué es el Agente Fílmico?",
        answer:
          "El Agente Fílmico es un asistente impulsado por IA que actúa como curador del archivo MAFI. A partir de tus preguntas, selecciona planos, los contextualiza y te propone recorridos personalizados por el material audiovisual.",
      },
      {
        question: "¿Qué esperar de este prototipo?",
        answer:
          "Los prototipos son herramientas de investigación que sirven para evaluar funcionalidades específicas de un producto. Estamos usando activamente el Agente Fílmico para refinar sus capacidades curatoriales y su estilo de interacción con usuarios. Por ello, actualizamos regularmente el conjunto de datos, experimentamos con métodos de embedding, intercambiamos modelos de lenguaje y ajustamos los prompts del sistema. Por esta razón, **el agente con el que interactúes hoy puede comportarse de manera bastante diferente la próxima semana.**",
      },
      {
        question: "¿En qué idioma habla el Agente Fílmico?",
        answer:
          "El Agente Fílmico responde en español e inglés, según el idioma de tu pregunta.",
      },
      {
        question: "¿Cómo usar al Agente Fílmico?",
        answer:
          'Escribe tu pregunta en lenguaje natural. Por ejemplo: "Muéstrame planos sobre protestas", "Planos grabados cerca de mi ubicación" o "¿Qué planos grabó Antonio Luco?" El Agente te devolverá una selección de planos con enlaces para verlos.',
      },
      {
        question: "¿Por qué LLMs para archivos fílmicos?",
        answer:
          "Los modelos de lenguaje ofrecen nuevas formas de explorar archivos audiovisuales mediante interacción conversacional. Estamos probando cómo el prompting puede abrir posibilidades creativas para acceder a materiales de archivo que las interfaces de búsqueda tradicionales no pueden mostrar fácilmente.",
      },
      {
        question: "¿Qué es el colectivo MAFI?",
        answer:
          "El **Colectivo MAFI** (Museo de Arte y Fotografía Independiente) es un archivo audiovisual que preserva y difunde material fílmico chileno e independiente. Reúne planos, documentales y registros que dan cuenta de la memoria visual del país.\n\nMAFI fue fundado en 2010 por un grupo de cineastas y artistas interesados en crear un espacio para la preservación y circulación de la producción audiovisual independiente. El colectivo opera como un archivo nómade, moviéndose entre diferentes espacios y contextos para hacer su colección accesible a diversas audiencias.\n\nHoy, MAFI sigue creciendo a través de donaciones, colaboraciones y su propia producción, manteniendo un compromiso con la preservación de la memoria audiovisual de Chile y la democratización del acceso a este patrimonio.",
      },
      {
        question: "¿Puedo ver el trabajo producido por el colectivo MAFI?",
        answer:
          "Sí. El **Agente Fílmico** te permite explorar el archivo mediante preguntas en lenguaje natural. Pregunta por temas, ubicaciones, autores o momentos históricos y recibirás playlists curatoriales con planos relevantes del archivo.",
      },
      {
        question: "¿Qué sigue?",
        answer:
          "Continuamos probando y refinando el prototipo. Tus comentarios y preguntas nos ayudan a mejorar cómo las interfaces conversacionales pueden servir a los archivos fílmicos y sus audiencias.",
      },
    ],
    linksTitle: "Enlaces y recursos",
    linksSubtitle:
      "Repositorio GitHub y contacto para el proyecto Agente Fílmico.",
    links: [
      {
        label: "github.com/Fundacion-MAFI/agente.mafi.tv",
        href: "https://github.com/Fundacion-MAFI/agente.mafi.tv",
      },
    ],
    contactLine:
      "Contacto: Pablo Núñez ([sitio web](https://thirdeyefiles.net/about/#Contact)) ([LinkedIn](https://www.linkedin.com/in/pnunezpalma/))",
    creditsTitle: "Créditos",
    credits:
      "Pablo Núñez y Antonio Luco: líderes e investigadores del proyecto\nIgnacio Rojas y David Vandenbogaerde: Investigación y Desarrollo\nFilms producidos por el Colectivo MAFI\n\n© 2026 Colectivo MAFI. Todos los derechos reservados\nSoftware: Código abierto bajo licencia MIT\nCon el apoyo de [Stimuleringsfonds Digital Culture](https://www.stimuleringsfonds.nl)\nEn colaboración con Netherlands Film Academy, programa [AI Greenhouse](https://www.filmacademie.ahk.nl/en/graduates/2025/projects/ai-greenhouse-cultivating-responsible-engagement-with-ai-in-filmmaking/)",
    copyright: "Colectivo MAFI",
  },
  en: {
    cta: "Get started",
    ctaLoggedIn: "Go to Agent",
    heroTitle: "Agente Fílmico MAFI",
    heroSubtitle: "A prompt-based interface for exploring video archives",
    heroText:
      "Explore the audiovisual archive of the Museum of Independent Art and Photography. Ask me anything and I'll share shots, stories and links so we can build your own journey through the archive together.",
    introHeading: "Agente Fílmico: A Working Prototype",
    introText:
      "What happens when you can talk to a film collection? Agente Fílmico explores this question by introducing prompting as a new form of interface for audiovisual exploration. Working with 50 short documentaries from the MAFI archive—annotated through hybrid strategies of AI and human curation—we're testing how conversational interaction can open creative possibilities for accessing archival materials. Ask questions in natural language and see how an LLM-trained curatorial agent responds. Keep in mind this is an active experiment—the system's behaviour changes frequently as we test and refine it.",
    tryPrototypeLabel: "Try the Prototype",
    faqTitle: "Frequently asked questions",
    faq: [
      {
        question: "What is the Agente Fílmico?",
        answer:
          "The Agente Fílmico is an AI-powered curatorial agent that lets you explore the MAFI film archive through natural language. It selects shots, contextualizes them and proposes personalized journeys through the audiovisual material.",
      },
      {
        question: "What to expect from this prototype?",
        answer:
          "This is an active experiment. The system's behaviour changes frequently as we test and refine it. You can ask questions in natural language and receive curatorial playlists with relevant shots from the archive.",
      },
      {
        question: "In which language does the Agente Fílmico speak?",
        answer:
          "The Agente Fílmico responds in both English and Spanish, depending on the language of your question.",
      },
      {
        question: "How to Use Agente Fílmico?",
        answer:
          'Type your question in natural language. For example: "Show me shots about protests", "Shots recorded near my location" or "What shots did Antonio Luco record?" The Agent will return a selection of shots with links to watch them.',
      },
      {
        question: "Why LLMs for film archives?",
        answer:
          "Large language models offer new ways to explore audiovisual archives through conversational interaction. We're testing how prompting can open creative possibilities for accessing archival materials that traditional search interfaces cannot easily surface.",
      },
      {
        question: "What is the MAFI collective?",
        answer:
          "The **MAFI Collective** (Museum of Independent Art and Photography) is an audiovisual archive that preserves and disseminates Chilean and independent film material. It brings together shots, documentaries and recordings that document the country's visual memory.\n\nMAFI was founded in 2010 by a group of filmmakers and artists interested in creating a space for the preservation and circulation of independent audiovisual production. The collective operates as a nomadic archive, moving between different spaces and contexts to make its collection accessible to diverse audiences.\n\nToday, MAFI continues to grow through donations, collaborations and its own production, maintaining a commitment to the preservation of Chile's audiovisual memory and the democratization of access to this heritage.",
      },
      {
        question: "Can I see the work produced by the MAFI collective?",
        answer:
          "Yes. The **Agente Fílmico** lets you explore the archive through natural language questions. Ask about topics, locations, authors or historical moments and you'll receive curatorial playlists with relevant shots from the archive.",
      },
      {
        question: "What's Next?",
        answer:
          "We're continuously testing and refining the prototype. Your feedback and questions help us improve how conversational interfaces can serve film archives and their audiences.",
      },
    ],
    linksTitle: "Links & resources",
    linksSubtitle:
      "GitHub repository and contact information for the Agente Fílmico project.",
    links: [
      {
        label: "github.com/Fundacion-MAFI/agente.mafi.tv",
        href: "https://github.com/Fundacion-MAFI/agente.mafi.tv",
      },
    ],
    contactLine:
      "Contact: Pablo Núñez ([website](https://thirdeyefiles.net/about/#Contact)) ([LinkedIn](https://www.linkedin.com/in/pnunezpalma/))",
    creditsTitle: "Credits",
    credits:
      "Pablo Núñez and Antonio Luco: project leads and investigators\nIgnacio Rojas and David Vandenbogaerde: Research and Development\nFilms produced by the MAFI Collective\n\n© 2026 MAFI Collective. All rights reserved\nSoftware: Open source under MIT License\nSupported by [Stimuleringsfonds Digital Culture](https://www.stimuleringsfonds.nl)\nIn collaboration with Netherlands Film Academy, [AI Greenhouse](https://www.filmacademie.ahk.nl/en/graduates/2025/projects/ai-greenhouse-cultivating-responsible-engagement-with-ai-in-filmmaking/) program",
    copyright: "MAFI Collective",
  },
};

function renderFormattedText(
  text: string,
  options?: { splitOnSingleNewline?: boolean },
) {
  const parts: React.ReactNode[] = [];
  const splitPattern = options?.splitOnSingleNewline ? /\n/ : PARAGRAPH_SPLIT;
  const paragraphs = text.split(splitPattern);

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const paragraph = paragraphs[pIdx];
    if (options?.splitOnSingleNewline && paragraph.trim() === "") {
      parts.push(<div className="mt-4" key={pIdx} />);
      continue;
    }
    const tokens: React.ReactNode[] = [];
    let remaining = paragraph;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(BOLD_PATTERN);
      const linkMatch = remaining.match(LINK_PATTERN);

      let match: RegExpMatchArray | null = null;
      let type: "bold" | "link" = "bold";
      if (boldMatch && linkMatch) {
        if (
          (boldMatch.index ?? Number.POSITIVE_INFINITY) <=
          (linkMatch.index ?? Number.POSITIVE_INFINITY)
        ) {
          match = boldMatch;
          type = "bold";
        } else {
          match = linkMatch;
          type = "link";
        }
      } else {
        match = boldMatch ?? linkMatch;
        type = boldMatch ? "bold" : "link";
      }

      if (match && match.index !== undefined) {
        if (match.index > 0) {
          tokens.push(
            <span key={`${pIdx}-${key++}`}>
              {remaining.slice(0, match.index)}
            </span>
          );
        }
        if (type === "bold") {
          tokens.push(
            <strong className="font-semibold" key={`${pIdx}-${key++}`}>
              {match[1]}
            </strong>
          );
        } else {
          tokens.push(
            <a
              className="underline hover:text-foreground"
              href={match[2]}
              key={`${pIdx}-${key++}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {match[1]}
            </a>
          );
        }
        remaining = remaining.slice(match.index + match[0].length);
      } else {
        tokens.push(<span key={`${pIdx}-${key++}`}>{remaining}</span>);
        break;
      }
    }

    const marginClass = options?.splitOnSingleNewline
      ? pIdx > 0
        ? "mt-2"
        : ""
      : pIdx > 0
        ? "mt-4"
        : "";
    parts.push(
      <p className={marginClass} key={pIdx}>
        {tokens}
      </p>
    );
  }

  return <>{parts}</>;
}

type LandingPageProps = {
  isAuthenticated: boolean;
};

export function LandingPage({ isAuthenticated }: LandingPageProps) {
  const [lang, setLang] = useState<Lang>("es");
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === "es" ? "en" : "es"));
  }, []);

  const content = CONTENT[lang];

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link className="flex items-center gap-2" href="/">
            <div
              aria-hidden
              className="flex h-10 w-32 items-center justify-center rounded border border-border bg-muted font-medium text-muted-foreground text-sm"
            >
              Logo
            </div>
          </Link>
          <nav className="flex items-center gap-4">
            <Button
              onClick={toggleLang}
              size="sm"
              type="button"
              variant="outline"
            >
              {lang === "es" ? "EN" : "ES"}
            </Button>
            {isAuthenticated ? (
              <Button asChild>
                <Link href="/chat">{content.ctaLoggedIn}</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/api/auth/guest?redirectUrl=/chat">
                  {content.cta}
                </Link>
              </Button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-4 py-16">
        <section className="mx-auto max-w-2xl space-y-6 text-center">
          <h1 className="font-semibold text-3xl tracking-tight md:text-4xl">
            {content.heroTitle}
          </h1>
          {content.heroSubtitle && (
            <p className="text-lg text-muted-foreground md:text-xl">
              {content.heroSubtitle}
            </p>
          )}
          {!content.introText && (
            <p className="text-lg text-muted-foreground md:text-xl">
              {content.heroText}
            </p>
          )}
          {(!content.introText || !content.tryPrototypeLabel) && (
            <div className="flex flex-col items-center gap-4 pt-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <Link
                  href={
                    isAuthenticated
                      ? "/chat"
                      : "/api/auth/guest?redirectUrl=/chat"
                  }
                >
                  {content.tryPrototypeLabel ??
                    (lang === "es" ? "Preguntar al Agente" : "Ask the Agent")}
                </Link>
              </Button>
            </div>
          )}
        </section>

        {/* Hero image placeholder */}
        <section className="mx-auto mt-16 max-w-3xl">
          <div
            aria-hidden
            className="flex aspect-video w-full items-center justify-center rounded-lg border border-border bg-muted font-medium text-muted-foreground"
          >
            Imagen destacada
          </div>
        </section>

        {/* Intro */}
        <section className="mx-auto mt-20 max-w-3xl text-center">
          {content.introHeading && (
            <h2 className="mb-4 font-semibold text-xl md:text-2xl">
              {content.introHeading}
            </h2>
          )}
          <div className="text-muted-foreground leading-relaxed">
            {content.introText ? (
              renderFormattedText(content.introText)
            ) : (
              <p>{content.heroText}</p>
            )}
          </div>
          {content.introText && content.tryPrototypeLabel && (
            <div className="mt-6 flex justify-center">
              <Button asChild size="lg">
                <Link
                  href={
                    isAuthenticated
                      ? "/chat"
                      : "/api/auth/guest?redirectUrl=/chat"
                  }
                >
                  {content.tryPrototypeLabel}
                </Link>
              </Button>
            </div>
          )}
        </section>

        {/* FAQ */}
        <section className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-8 font-semibold text-xl md:text-2xl">
            {content.faqTitle}
          </h2>
          <div className="space-y-0 border-b">
            {content.faq.map((item, index) => {
              const value = `faq-${index}`;
              const isOpen = openFaq === value;
              return (
                <Collapsible
                  key={value}
                  onOpenChange={(open) => {
                    setOpenFaq(open ? value : null);
                  }}
                  open={isOpen}
                >
                  <div className="border-t">
                    <CollapsibleTrigger
                      className="flex w-full items-center justify-between gap-4 py-4 text-left font-medium transition-colors hover:underline [&[data-state=open]>svg]:rotate-180"
                      type="button"
                    >
                      {item.question}
                      <ChevronDownIcon className="size-4 shrink-0 transition-transform duration-200" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 overflow-hidden data-[state=closed]:animate-out data-[state=open]:animate-in">
                      <div className="pb-4 text-muted-foreground text-sm">
                        {renderFormattedText(item.answer)}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </section>

        {/* Links & Resources */}
        <section className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-4 font-semibold text-xl md:text-2xl">
            {content.linksTitle}
          </h2>
          {content.linksSubtitle && (
            <p className="mb-6 text-muted-foreground text-sm">
              {content.linksSubtitle}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {content.links.map((link) => (
              <li key={link.href + link.label}>
                <a
                  className="text-primary underline hover:text-primary/90"
                  href={link.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          {content.contactLine && (
            <p className="mt-4 text-muted-foreground text-sm">
              {renderFormattedText(content.contactLine)}
            </p>
          )}
        </section>

        {/* Credits */}
        <footer className="mx-auto mt-20 max-w-3xl border-t pt-8">
          <h3 className="mb-4 font-medium text-sm">{content.creditsTitle}</h3>
          <div className="text-muted-foreground text-sm">
            {renderFormattedText(content.credits, { splitOnSingleNewline: true })}
          </div>
          {!content.credits.includes("©") && (
            <p className="mt-4 text-muted-foreground text-sm">
              © {new Date().getFullYear()} {content.copyright}
            </p>
          )}
        </footer>
      </main>
    </div>
  );
}
