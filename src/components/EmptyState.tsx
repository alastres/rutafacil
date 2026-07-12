import { motion } from "motion/react";

export function EmptyState() {
  return (
    <section className="empty">
      <motion.div
        className="empty-sign"
        initial={{ opacity: 0, scale: 0.92, rotate: -4 }}
        animate={{ opacity: 1, scale: 1, rotate: -1.2 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      >
        <h2>Ruta vacía. Carga tus paradas.</h2>
        <p>
          Pega varias direcciones de una vez: una conversación entera de WhatsApp,
          varios enlaces o coordenadas. La app las separa y agrega una por una.
        </p>
      </motion.div>
      <ol className="empty-steps">
        {[
          "Copia las ubicaciones (una conversación de WhatsApp o varios enlaces a la vez)",
          "Pégalas aquí con el botón Pegar, o comparte desde el menú de Android → RutaFácil",
          "Cuando estén todas, toca Armar ruta y sal a repartir",
        ].map((step, i) => (
          <motion.li
            key={step}
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + i * 0.12 }}
          >
            <span className="n">{i + 1}</span>
            {step}
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
