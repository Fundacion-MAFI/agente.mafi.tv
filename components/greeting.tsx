"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { UiSettings } from "@/app/(chat)/api/ui-settings/route";

const DEFAULT_TITLE = "Hola, soy el Agente Fílmico del archivo MAFI.";
const DEFAULT_SUBTITLE =
  "Pregúntame lo que quieras. Te compartiré planos, historias y enlaces para que juntos armemos tu propio recorrido por el archivo.";

export const Greeting = () => {
  const [settings, setSettings] = useState<UiSettings["greeting"] | null>(null);

  useEffect(() => {
    fetch("/api/ui-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: UiSettings | null) => {
        if (data?.greeting) {
          setSettings(data.greeting);
        } else {
          setSettings({
            title: DEFAULT_TITLE,
            subtitle: DEFAULT_SUBTITLE,
          });
        }
      })
      .catch(() => {
        setSettings({
          title: DEFAULT_TITLE,
          subtitle: DEFAULT_SUBTITLE,
        });
      });
  }, []);

  const title = settings?.title?.trim() || DEFAULT_TITLE;
  const subtitle = settings?.subtitle?.trim() || DEFAULT_SUBTITLE;

  return (
    <div
      className="mx-auto mt-4 flex size-full max-w-3xl flex-col justify-center px-4 md:mt-16 md:px-8"
      key="overview"
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="font-semibold text-xl md:text-2xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
      >
        {title}
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-xl text-zinc-500 md:text-2xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
      >
        {subtitle}
      </motion.div>
    </div>
  );
};
