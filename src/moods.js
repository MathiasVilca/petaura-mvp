export const MOODS= Object.freeze({
    HAPPY:'happy',
    CALM:'calm',
    TIRED:'tired',
    ANXIOUS:'anxious',
    PLAYFUL:'playful',
    AFFECTIONATE:'affectionate',
    CURIOUS:'curious',
    IRRITABLE:'irritable'
})

export const COLORS_MOOD_ALT=Object.freeze({
    [MOODS.HAPPY]: '#22c55e',
    [MOODS.CALM]: '#14b8a6',
    [MOODS.TIRED]: '#facc15',
    [MOODS.ANXIOUS]: '#fb7185',
    [MOODS.PLAYFUL]: '#8b5cf6',
    [MOODS.AFFECTIONATE]: '#ec4899',
    [MOODS.CURIOUS]: '#38bdf8',
    [MOODS.IRRITABLE]: '#dc2626',
})

export const COLORS_MOOD = Object.freeze({
    [MOODS.HAPPY]: '#fbbf24',
    [MOODS.CALM]: '#2dd4bf',
    [MOODS.TIRED]: '#64748b',
    [MOODS.ANXIOUS]: '#fb923c',
    [MOODS.PLAYFUL]: '#d946ef',
    [MOODS.AFFECTIONATE]: '#f472b6',
    [MOODS.CURIOUS]: '#3b82f6',
    [MOODS.IRRITABLE]: '#ef4444',
});

export const MOOD_ES = {
    [MOODS.HAPPY]: 'Feliz',
    [MOODS.CALM]: 'Tranquilo',
    [MOODS.TIRED]: 'Cansado',
    [MOODS.ANXIOUS]: 'Ansioso',
    [MOODS.PLAYFUL]: 'Juguetón',
    [MOODS.AFFECTIONATE]: 'Cariñoso',
    [MOODS.CURIOUS]: 'Curioso',
    [MOODS.IRRITABLE]: 'Irritable',
    // Alias legacy: entradas de historial anteriores al swap sick→irritable
    sick: 'Cansado',
};

export const mockStates = {
  [MOODS.HAPPY]: {
    mood: MOODS.HAPPY, color: COLORS_MOOD[MOODS.HAPPY], energy: 0.5, stress: 0.12, warmth: 0.85, pattern: 'flow',
    description: 'Contento y alegre de forma tranquila. Su aura es luminosa y serena, con movimiento suave.',
    actions: ['Disfruta un rato de compañía relajada a su lado.', 'Refuerza el momento con caricias y palabras suaves.', 'Mantén su rutina, que es lo que lo tiene a gusto.'],
  },
  [MOODS.CALM]: {
    mood: MOODS.CALM, color: COLORS_MOOD[MOODS.CALM], energy: 0.28, stress: 0.12, warmth: 0.74, pattern: 'flow',
    description: 'Tranquilo y equilibrado. La aura es suave, fluida y reposada.',
    actions: ['Mantén el ambiente sereno y con poca estimulación.', 'Ofrece un espacio cómodo para descansar.', 'Observa si prefiere contacto silencioso o distancia.'],
  },
  [MOODS.TIRED]: {
    mood: MOODS.TIRED, color: COLORS_MOOD[MOODS.TIRED], energy: 0.22, stress: 0.15, warmth: 0.58, pattern: 'pulse',
    description: 'Baja energía y ritmo lento. El aura se siente suave y agotada.',
    actions: ['Permítele descansar en su lugar favorito.', 'Reduce la actividad y evita estímulos intensos.', 'Asegura agua fresca y un ambiente calmado.'],
  },
  [MOODS.ANXIOUS]: {
    mood: MOODS.ANXIOUS, color: COLORS_MOOD[MOODS.ANXIOUS], energy: 0.7, stress: 0.82, warmth: 0.44, pattern: 'orbit',
    description: 'Nervioso y alerta. La aura se mueve con tensión y oscilaciones inquietas.',
    actions: ['Crea un espacio seguro y sin ruido.', 'Habla con voz suave y acaricia lentamente.', 'Observa sus señales de calma antes de acercarte.'],
  },
  [MOODS.PLAYFUL]: {
    mood: MOODS.PLAYFUL, color: COLORS_MOOD[MOODS.PLAYFUL], energy: 0.85, stress: 0.22, warmth: 0.88, pattern: 'burst',
    description: 'Lleno de ganas de jugar. El aura es brillante y expansiva.',
    actions: ['Ofrece un juguete nuevo o una sesión de juegos corta.', 'Premia su entusiasmo con caricias y elogios.', 'Aprovecha para fortalecer el vínculo con actividades lúdicas.'],
  },
  [MOODS.AFFECTIONATE]: {
    mood: MOODS.AFFECTIONATE, color: COLORS_MOOD[MOODS.AFFECTIONATE], energy: 0.45, stress: 0.18, warmth: 0.95, pattern: 'flow',
    description: 'Cariñoso y conectado. El aura es cálida, fluida y acogedora.',
    actions: ['Ofrece un abrazo suave o caricias cerca de su cabeza.', 'Permite tiempo de calidad en contacto tranquilo.', 'Refuerza la conexión con palabras suaves y cercanía.'],
  },
  [MOODS.CURIOUS]: {
    mood: MOODS.CURIOUS, color: COLORS_MOOD[MOODS.CURIOUS], energy: 0.68, stress: 0.28, warmth: 0.72, pattern: 'orbit',
    description: 'Interesado y atento. El aura se desplaza explorando con movimientos suaves.',
    actions: ['Deja objetos seguros para que los inspeccione con calma.', 'Observa su lenguaje corporal antes de interactuar.', 'Ofrece estímulos nuevos de manera gradual.'],
  },
  [MOODS.IRRITABLE]: {
    mood: MOODS.IRRITABLE, color: COLORS_MOOD[MOODS.IRRITABLE], energy: 0.6, stress: 0.85, warmth: 0.3, pattern: 'burst',
    description: 'Molesto y a la defensiva. El aura es tensa y brusca, con destellos cortantes.',
    actions: ['Dale espacio y evita forzar el contacto físico.', 'Identifica qué lo está incomodando y retíralo si puedes.', 'Revisa si hay dolor o molestia y consulta al veterinario si persiste.'],
  },
};