"use client";

import { ChevronDownIcon, MoonIcon, SunIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { MafiLogo } from "@/components/mafi-logo";
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
          "Agente Fílmico es una herramienta digital para explorar archivos audiovisuales mediante prompts en lenguaje natural, potenciados por LLMs. Este prototipo muestra la colección MAFI (Mapa Fílmico de un País), que reúne cortometrajes documentales del Colectivo de Cine MAFI. El código es de código abierto con documentación técnica disponible en GitHub para quienes estén interesados en adaptarlo a sus propias colecciones.",
      },
      {
        question: "¿Qué esperar de este prototipo?",
        answer:
          "Los prototipos son herramientas de investigación que sirven para evaluar funcionalidades específicas de un producto. Estamos usando activamente el Agente Fílmico para refinar sus capacidades curatoriales y su estilo de interacción con usuarios. Por ello, actualizamos regularmente el conjunto de datos, experimentamos con métodos de embedding, intercambiamos modelos de lenguaje y ajustamos los prompts del sistema. Por esta razón, **el agente con el que interactúes hoy puede comportarse de manera bastante diferente la próxima semana.**",
      },
      {
        question: "¿En qué idioma habla el Agente Fílmico?",
        answer:
          "La interfaz está en español, pero el Agente responde en el idioma que utilices. Las películas de MAFI se mantienen en español.",
      },
      {
        question: "¿Cómo usar al Agente Fílmico?",
        answer:
          "**Explorando la colección:** Haz preguntas en lenguaje natural y el Agente curará una selección de películas con comentarios contextuales.\n\n**Para profesionales:** Si estás interesado en implementar interfaces similares para colecciones de cine o de patrimonio digital, la documentación técnica y el código están disponibles en nuestro repositorio de GitHub (ver la sección de enlaces más abajo).",
      },
      {
        question: "¿Por qué LLMs para archivos fílmicos?",
        answer:
          "Aunque pueda parecer trivial tres años después del lanzamiento público de ChatGPT, los LLMs están marcando un cambio significativo en cómo accedemos a archivos al introducir el prompting como una interfaz comparable a las GUIs e incluso a las CLIs. Aunque la tecnología se desarrolla con rapidez (a veces haciendo que las implementaciones parezcan obsoletas), la capacidad de conversar con un archivo fílmico en tiempo real abre posibilidades creativas inexploradas. Este prototipo es fundamental para establecer un enfoque fundacional para artistas, diseñadores e investigadores de medios que exploren esta vía.",
      },
      {
        question: "¿Qué es el colectivo MAFI?",
        answer:
          "El colectivo Mapa Fílmico de un País (MAFI), fundado en 2010 por los cineastas chilenos Antonio Luco, Christopher Murray, Pablo Núñez e Ignacio Rojas, nació con una visión única: crear un mapa audiovisual integral de Chile. Reuniendo a más de 60 cineastas, MAFI desarrolló un formato distintivo de cortometraje documental, inspirándose en la estética minimalista del cine documental temprano y las cualidades modulares del video digital. El formato MAFI se centró en observaciones breves y potentes, ininterrumpidas y sin comentarios, sobre el paisaje humano del país.\n\nDurante quince años, MAFI produjo más de 360 piezas audiovisuales, realizadas por diversos cineastas chilenos. Estos cortometrajes capturaron una multitud de perspectivas sobre la vida cotidiana en los diversos paisajes sociales y geográficos de Chile, desde el Desierto de Atacama hasta la isla de Chiloé. Al arrojar luz con frecuencia sobre narrativas pasadas por alto por los relatos oficiales, las imágenes del colectivo MAFI han fomentado la reflexión social y creado una memoria visual vital del país.\n\nDespués de dieciséis años de trabajo continuo, MAFI está a punto de concluir sus operaciones. La extensa colección del colectivo captura de manera única un período histórico fundamental en Chile, definido por visiones polarizadas y perspectivas diversas, y ejemplificado notablemente por dos intentos fallidos de establecer una nueva constitución. Este rico archivo de imágenes de una era tumultuosa servirá, sin duda, como un recurso invaluable para futuras generaciones que revisiten y reexaminen la memoria de Chile.",
      },
      {
        question: "¿Puedo ver el trabajo producido por el colectivo MAFI?",
        answer:
          "Sí. Más allá de los 50 cortometrajes documentales de este prototipo, el colectivo MAFI ha producido más de 360 piezas documentales cortas que han circulado ampliamente en redes sociales, en galerías de arte y en la prensa chilena. El colectivo también ha realizado talleres en terreno con comunidades locales, enfocándose en la alfabetización medial y empoderando a los participantes para que sean más conscientes de su imagen mediada y produzcan sus propios cortometrajes documentales.\n\n**Los proyectos incluyen:**\n\n**MAFI.tv** (documental web, 2012)\nEste proyecto actualmente no está en línea, pero puedes encontrar una colección de sus películas en [mafi.tv](https://mafi.tv/) | [Más información](https://www.idfa.nl/en/film/cb1e18c9-f4a7-40cc-a8dd-6164270e4bfc/mafi.tv-filmic-map-of-a-country)\n\n**Largometrajes documentales:**\n\n**Propaganda** (2014) Un documental observacional que explora la campaña presidencial chilena de 2013 y la creciente desconexión entre la creación de imágenes políticas y la realidad ciudadana durante un período de malestar social. [Trailer](https://vimeo.com/89357040) | [Más información](https://www.visionsdureel.ch/en/film/2014/propaganda/)\n\n**Dios** (2019) En el extremo sur del mundo, el Papa llega para traer la palabra de Dios. Chile lo espera con la crisis religiosa más significativa de su historia. [Trailer](https://vimeo.com/322774407) | [Más información](https://www.visionsdureel.ch/en/film/2019/god/)\n\n**Pampas Marcianas** (2023) es una docu-ficción en la que los habitantes de María Elena, el lugar más seco de la Tierra, son elegidos para ser los primeros en colonizar Marte. El pueblo debate dejar atrás sus raíces, el calor y el colapso económico por una nueva promesa de progreso, esta vez en otro planeta. [Trailer](https://vimeo.com/952169547) | [Más información](https://www.labocine.com/films/pampas-marcianas-martian-pampas)\n\n**Oasis** (2024) Tras un levantamiento popular sin precedentes, Chile redacta una nueva constitución. Una asamblea diversa intenta plasmar en papel los sueños de dignidad y justicia social del pueblo. En un país profundamente polarizado, la promesa de consenso se convierte en su propio espejismo. [Trailer](https://vimeo.com/1006032102) | [Más información](https://www.berlinale.de/en/2024/programme/202409678.html)",
      },
      {
        question: "¿Qué sigue?",
        answer:
          "Estamos usando el Agente Fílmico para entender cómo los LLMs interactúan con la colección MAFI. Nuestro objetivo es evolucionar este prototipo en una obra de arte que edite algorítmicamente cortometrajes documentales a medida basados en conversaciones entre usuarios y el Agente. Más detalles sobre este proyecto —título en progreso \"Espejismo de un País\"— se compartirán a medida que se desarrolle.",
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
      "Contacto: Para preguntas, comentarios o actualizaciones sobre este proyecto, contacta a Pablo Núñez a través de su [sitio web](https://thirdeyefiles.net/about/#Contact) o [LinkedIn](https://www.linkedin.com/in/pnunezpalma/).",
    creditsTitle: "Créditos",
    credits:
      "Pablo Núñez y Antonio Luco: líderes e investigadores del proyecto\nIgnacio Rojas y [David Vandenbogaerde](https://d17e.dev): Investigación y Desarrollo\nFilms producidos por el Colectivo MAFI\n\n© 2026 Colectivo MAFI. Todos los derechos reservados\nSoftware: Código abierto bajo licencia MIT\nCon el apoyo de [Stimuleringsfonds Digital Culture](https://www.stimuleringsfonds.nl/en/info)\nEn colaboración con Netherlands Film Academy, [programa AI Greenhouse](https://www.filmacademie.ahk.nl/en/graduates/2025/projects/ai-greenhouse-cultivating-responsible-engagement-with-ai-in-filmmaking/)",
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
          "Agente Fílmico is a digital tool for exploring audiovisual archives using natural-language prompts powered by LLMs. This prototype showcases the MAFI (Mapa Fílmico de un País) collection, comprising short documentaries by the Film Collective MAFI. The codebase is open source with technical documentation available on GitHub for archives interested in adapting it for their own collections.",
      },
      {
        question: "What to expect from this prototype?",
        answer:
          "Prototypes are research tools used to test specific functionalities before a product's full implementation. We're actively using Agente Fílmico to refine its curatorial capacities and interaction style. We are regularly updating the dataset, experimenting with embedding methods, swapping language models, and adjusting system prompts. For this reason, **the Agente you interact with today may behave quite differently next week.**",
      },
      {
        question: "In which language does the Agente Fílmico speak?",
        answer:
          "The interface is in Spanish, but the Agente responds in the language you use. Ask your questions in English, Spanish, or other languages, and the agent will reply accordingly. The MAFI films themselves remain in Spanish.",
      },
      {
        question: "How to Use Agente Fílmico?",
        answer:
          "**Exploring the collection:** Ask questions in natural language, and the Agente will curate a selection of films with contextual commentary.\n\n**For professionals:** If you're interested in implementing similar interfaces for film or digital heritage collections, technical documentation and code are available on our GitHub (see the links section below).",
      },
      {
        question: "Why LLMs for film archives?",
        answer:
          "While it may seem trivial three years after the public release of ChatGPT, LLMs are marking a significant shift in how we access archives by introducing prompting as an interface comparable to GUIs and even CLIs. Although the technology advances quickly (sometimes making implementations feel rapidly outdated), the ability to converse with a film archive in real time opens unexplored creative possibilities. This prototype is instrumental in establishing a foundational approach for artists, designers, and media researchers to explore this avenue.",
      },
      {
        question: "What is the MAFI collective?",
        answer:
          "The Mapa Fílmico de un País (MAFI) collective, founded in 2010 by Chilean filmmakers Antonio Luco, Christopher Murray, Pablo Núñez, and Ignacio Rojas, was born with a unique vision: to create a comprehensive audiovisual map of Chile. Bringing together over 60 filmmakers, MAFI developed a distinctive short documentary format, drawing inspiration from the minimalist aesthetic of early documentary cinema and the modular qualities of digital video. This format centred on brief yet powerful, uninterrupted, and uncommented observations of the country's human landscape.\n\nOver fifteen years, MAFI produced more than 360 audiovisual pieces, authored by a diverse array of Chilean filmmakers. These short films captured a multitude of perspectives on daily life across Chile's varied social and geographical landscapes—from the Atacama Desert to the island of Chiloé. By often shedding light on narratives overlooked by official accounts, MAFI's compelling images fostered social reflection and created a vital visual memory of the country.\n\nAfter sixteen years of dedicated work, MAFI is set to conclude its operations in 2026. The collective's extensive collection uniquely captures a pivotal historical period in Chile, defined by polarised views and diverse perspectives, and strikingly exemplified by the two failed attempts to establish a new constitution. This rich archive of images from a tumultuous era will undoubtedly serve as an invaluable resource for future generations revisiting and re-examining Chile's recent past.",
      },
      {
        question: "Can I see the work produced by the MAFI collective?",
        answer:
          "Yes. Beyond the 50 short documentaries in this prototype, the MAFI collective has produced over 360 short documentary pieces that have circulated widely on social media, in art galleries, and in the Chilean press. The collective has also run field workshops with local communities, focusing on media literacy and empowering participants to be more aware of their mediated image and to produce their own short documentaries.\n\n**Projects include:**\n\n**MAFI.tv** (web documentary, 2012)\nThis project is currently not live, but you can find a collection of their films at [mafi.tv](https://mafi.tv/)\n[More info](https://www.idfa.nl/en/film/cb1e18c9-f4a7-40cc-a8dd-6164270e4bfc/mafi.tv-filmic-map-of-a-country)\n\n**Feature-length documentaries:**\n\n**Propaganda** (2014)\nAn observational documentary exploring the 2013 Chilean presidential campaign and the growing disconnect between political image-making and citizen reality during a period of social unrest.\n[Trailer](https://vimeo.com/89357040) | [More info](https://www.visionsdureel.ch/en/film/2014/propaganda/)\n\n**Dios** (2019)\nAt the southern end of the world, the Pope arrives to bring the word of God. Chile awaits him with the most significant religious crisis in its history.\n[Trailer](https://vimeo.com/322774407) | [More info](https://www.visionsdureel.ch/en/film/2019/god/)\n\n**Pampas Marcianas** (2023)\nA docu-fiction where the inhabitants of María Elena, the driest place on Earth, are chosen to be the first to colonize Mars. The town debates leaving behind their roots, the heat, and economic collapse for a new promise of progress—this time on another planet.\n[Trailer](https://vimeo.com/952169547) | [More info](https://www.labocine.com/films/pampas-marcianas-martian-pampas)\n\n**Oasis** (2024)\nFollowing an unprecedented popular uprising, Chile drafts a new constitution. A diverse assembly attempts to put the people's dreams of dignity and social justice on paper. In a deeply polarized country, the promise of consensus becomes its own mirage.\n[Trailer](https://vimeo.com/1006032102) | [More info](https://www.berlinale.de/en/2024/programme/202409678.html)",
      },
      {
        question: "What's Next?",
        answer:
          "We're using Agente Fílmico to understand how LLMs interact with the MAFI collection. Our goal is to evolve this prototype into an artwork that algorithmically edits bespoke short documentaries based on conversations between users and the Agente. More details about this project—working title \"Mirage of a Country\"—will be shared as it develops.",
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
      "Contact: For questions, comments, or updates about this project, contact Pablo Núñez via his [website](https://thirdeyefiles.net/about/#Contact) or [LinkedIn](https://www.linkedin.com/in/pnunezpalma/).",
    creditsTitle: "Credits",
    credits:
      "Pablo Núñez and Antonio Luco: project leads and investigators\nIgnacio Rojas and [David Vandenbogaerde](https://d17e.dev): Research and Development\nFilms produced by the MAFI Collective\n\n© 2026 MAFI Collective. All rights reserved\nSoftware: Open source under MIT License\nSupported by [Stimuleringsfonds Digital Culture](https://www.stimuleringsfonds.nl/en/info)\nIn collaboration with Netherlands Film Academy, [AI Greenhouse programme](https://www.filmacademie.ahk.nl/en/graduates/2025/projects/ai-greenhouse-cultivating-responsible-engagement-with-ai-in-filmmaking/)",
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
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === "es" ? "en" : "es"));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const content = CONTENT[lang];

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link className="flex items-center gap-2 text-foreground" href="/">
            <MafiLogo className="shrink-0" />
          </Link>
          <nav className="flex items-center gap-4">
            {mounted && (
              <Button
                onClick={toggleTheme}
                size="sm"
                type="button"
                variant="outline"
                aria-label={
                  resolvedTheme === "dark"
                    ? lang === "es"
                      ? "Cambiar a modo claro"
                      : "Switch to light mode"
                    : lang === "es"
                      ? "Cambiar a modo oscuro"
                      : "Switch to dark mode"
                }
              >
                {resolvedTheme === "dark" ? (
                  <SunIcon className="size-4" />
                ) : (
                  <MoonIcon className="size-4" />
                )}
              </Button>
            )}
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

      <main className="flex flex-1 flex-col px-4 pb-16 pt-[calc(theme(spacing.16)_+_3.5rem)]">
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

        {/* Cover image */}
        <section className="relative mx-auto mt-16 aspect-video w-full max-w-3xl overflow-hidden rounded-lg">
          <Image
            alt="MAFI.tv - mapa fílmico de un país"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 48rem"
            src="/logo/MAFI_tv.GIF"
            unoptimized
          />
        </section>

        {/* Intro */}
        <section className="mx-auto mt-20 max-w-3xl text-left">
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
        <section className="mx-auto mt-20 w-full max-w-3xl">
          <h2 className="mb-8 font-semibold text-xl md:text-2xl">
            {content.faqTitle}
          </h2>
          <div className="w-full space-y-0 border-b">
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
                    <CollapsibleContent className="accordion-content">
                      <div className="accordion-content-inner pb-4 text-muted-foreground text-sm">
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
            <div className="mt-4 text-muted-foreground text-sm">
              {renderFormattedText(content.contactLine)}
            </div>
          )}
        </section>

        {/* Credits */}
        <footer className="mx-auto mt-20 w-full max-w-3xl border-t pt-8 text-left">
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
