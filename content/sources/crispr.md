# Las tijeras de la vida: CRISPR-Cas9

Imagina un libro con miles de millones de letras en el que una sola letra equivocada puede causar una enfermedad. Así es, en cierto modo, tu genoma: el genoma humano tiene unos 3 000 millones de pares de bases en cada juego de cromosomas. Durante décadas, cambiar una letra concreta de ese libro era lento, caro y poco preciso. CRISPR-Cas9 es una herramienta que permite cortar el ADN en un sitio elegido con mucha más facilidad. Por desarrollar este método de edición genética, Emmanuelle Charpentier y Jennifer Doudna recibieron el Premio Nobel de Química en 2020.

## Un código de cuatro letras

El ADN es una doble hélice formada por dos hebras enrolladas. Cada hebra es una cadena de nucleótidos, y cada nucleótido lleva una de cuatro bases: adenina (A), timina (T), citosina (C) o guanina (G). Las bases de una hebra se aparean con las de la otra siguiendo una regla fija: la A con la T y la C con la G. Por eso las dos hebras son complementarias: si conoces una, puedes deducir la otra. El orden de las letras guarda la información genética, y un gen es un tramo de ADN con instrucciones, por ejemplo, para fabricar una proteína.

El ARN es una molécula parecida al ADN, pero suele tener una sola hebra y usa uracilo (U) en lugar de timina. En el ARN, la U se aparea con la A.

## Un invento de las bacterias

CRISPR no lo inventó un laboratorio: se descubrió en bacterias y arqueas. El nombre viene del inglés y significa «repeticiones palindrómicas cortas agrupadas y regularmente interespaciadas». Las bacterias sufren ataques de virus. Cuando una bacteria sobrevive a una infección, puede guardar un fragmento del ADN del virus en su propio genoma, entre las repeticiones de la región CRISPR. Esa región funciona como un archivo de los virus que la atacaron.

La bacteria copia esos fragmentos a moléculas de ARN, que se unen a proteínas Cas. Si el mismo virus vuelve, el ARN reconoce el ADN viral por complementariedad y la proteína Cas lo corta. Es un sistema inmunitario con memoria, propio de las bacterias.

## Dos piezas: unas tijeras y un GPS

La versión que más se usa en los laboratorios tiene dos piezas. La primera es la proteína Cas9, que procede de la bacteria *Streptococcus pyogenes* y funciona como unas tijeras moleculares: corta el ADN. La segunda es un ARN guía, que lleva una secuencia de unas 20 letras complementaria al sitio que se quiere cortar. Cas9 no sabe por sí sola dónde cortar: el ARN guía es el que indica el lugar, como un GPS.

En 2012, el equipo de Charpentier y Doudna demostró que Cas9 se puede programar: si cambias las 20 letras de la guía, eliges dónde corta. También unieron en una sola molécula los dos ARN que la bacteria usa por separado, lo que simplificó mucho la herramienta.

## La búsqueda

Cas9, cargada con su guía, recorre el ADN buscando primero una secuencia corta llamada PAM. Para la Cas9 de *Streptococcus pyogenes*, la PAM es «NGG»: cualquier letra seguida de dos G. Cuando encuentra una PAM, Cas9 abre la doble hélice justo al lado y comprueba si la guía se aparea con esas letras. Si coinciden, se queda; si no, se suelta y sigue buscando.

La PAM también protege a la bacteria. Los fragmentos guardados en su archivo CRISPR no tienen una PAM al lado, así que Cas9 no corta el propio archivo de la bacteria, aunque la guía coincida con él.

## El corte

Cuando la guía se aparea con el sitio correcto, Cas9 corta las dos hebras del ADN, unas tres letras antes de la PAM. A esto se le llama corte de doble cadena. Cas9 tiene dos zonas de corte, y cada una corta una de las hebras.

## La célula repara

Una célula no puede dejar su ADN roto, así que repara el corte. Lo importante es que CRISPR-Cas9 no escribe la corrección: corta, y es la reparación de la célula la que decide el resultado. Hay dos caminos principales.

El primero es la unión de extremos no homólogos. La célula pega los dos extremos rápido y sin molde, y a menudo agrega o borra algunas letras en el proceso. Si eso ocurre dentro de un gen, puede dejarlo sin funcionar, algo muy útil para estudiar para qué sirve cada gen.

El segundo es la reparación dirigida por homología. Aquí la célula usa un molde: un fragmento de ADN parecido a la zona dañada. Si los científicos le dan un molde con el cambio que quieren, la célula puede copiarlo y escribir ese cambio con precisión. Este camino es menos frecuente y funciona sobre todo en células que se están dividiendo.

## ¿Nunca se equivoca?

CRISPR-Cas9 es preciso, pero no perfecto. La guía tolera algunos desajustes, sobre todo en las letras más alejadas de la PAM, así que Cas9 puede cortar sitios parecidos al objetivo en otras partes del genoma. A estos cortes se les llama efectos fuera del objetivo. Cas9 tampoco corta al azar: necesita una PAM y un sitio que se parezca mucho a la guía. Para reducir los errores, los investigadores diseñan guías cuya secuencia sea única en el genoma, usan variantes de Cas9 de alta fidelidad y revisan el ADN editado.

## Una terapia real

La anemia de células falciformes es una enfermedad hereditaria causada por el cambio de una sola letra en el gen de la beta-globina, una parte de la hemoglobina. La hemoglobina es la proteína que transporta oxígeno en los glóbulos rojos. Los glóbulos rojos sanos son discos redondos y flexibles; con la hemoglobina alterada, pueden volverse rígidos y tomar forma de hoz. Esas células en forma de hoz pueden tapar vasos sanguíneos pequeños y causar crisis de dolor, anemia y daño en los órganos.

En 2023 se aprobó por primera vez una terapia basada en CRISPR para esta enfermedad, primero en el Reino Unido y después en Estados Unidos. En ella, los médicos extraen células madre de la sangre del paciente y las editan en el laboratorio con CRISPR-Cas9 para que produzcan hemoglobina fetal, la forma de hemoglobina que el cuerpo fabrica antes de nacer. Esta terapia no corrige la letra alterada: activa la hemoglobina fetal, que compensa la hemoglobina defectuosa. Antes de recibir de vuelta sus células editadas, el paciente necesita una quimioterapia que deja espacio en la médula ósea. Es un tratamiento complejo y muy costoso.

## La gran pregunta ética

No todas las ediciones son iguales. La edición somática cambia células del cuerpo de una persona, como las de su sangre, y esos cambios no pasan a sus hijos. La terapia para la anemia de células falciformes es una edición somática. La edición germinal, en cambio, cambia embriones, óvulos o espermatozoides, y sus cambios se heredarían a las siguientes generaciones.

En 2018, un investigador en China anunció el nacimiento de dos gemelas cuyos embriones había editado. La comunidad científica rechazó ampliamente el experimento, y en 2019 él fue condenado a prisión. Muchos países prohíben o restringen la edición germinal con fines reproductivos.

El debate sigue abierto. Quienes ven posibilidades en la edición germinal señalan que algún día podría evitar enfermedades hereditarias graves en una familia. Quienes piden cautela señalan los riesgos de seguridad, como los efectos fuera del objetivo, que las generaciones futuras no pueden dar su consentimiento y el temor a que se use para modificar rasgos que no son enfermedades o para aumentar las desigualdades. Es una conversación que involucra a científicos, médicos, legisladores y a la sociedad entera.

## Tres ideas para quedarte

Primero, el ARN guía decide dónde se corta, y Cas9 corta las dos hebras junto a una PAM. Segundo, la célula repara el corte, y la forma de repararlo decide si se borran letras o se escribe un cambio preciso. Tercero, es una herramienta poderosa pero no perfecta, y su uso en personas abre preguntas éticas que la sociedad todavía discute.

## Referencias para profundizar

- Jinek, M., Chylinski, K., Fonfara, I., Hauer, M., Doudna, J. A. y Charpentier, E. (2012). «A Programmable Dual-RNA–Guided DNA Endonuclease in Adaptive Bacterial Immunity». *Science*, 337(6096), 816–821.
- Barrangou, R., Fremaux, C., Deveau, H., Richards, M., Boyaval, P., Moineau, S., Romero, D. A. y Horvath, P. (2007). «CRISPR Provides Acquired Resistance Against Viruses in Prokaryotes». *Science*, 315(5819), 1709–1712.
- Frangoul, H. et al. (2021). «CRISPR-Cas9 Gene Editing for Sickle Cell Disease and β-Thalassemia». *New England Journal of Medicine*, 384, 252–260.
- Doudna, J. A. y Sternberg, S. H. (2017). *A Crack in Creation: Gene Editing and the Unthinkable Power to Control Evolution*. Houghton Mifflin Harcourt.
- National Academies of Sciences, Engineering, and Medicine (2017). *Human Genome Editing: Science, Ethics, and Governance*. The National Academies Press.
- The Nobel Prize in Chemistry 2020, información divulgativa. nobelprize.org.
