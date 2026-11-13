# Cómo piensa un Transformer

Cuando le escribes a un asistente de inteligencia artificial y te contesta con una frase que nadie había escrito antes, detrás hay un modelo de lenguaje. Un modelo de lenguaje es un programa entrenado para predecir qué pieza de texto viene después de otras. Los grandes modelos de lenguaje más conocidos se basan en una arquitectura llamada Transformer, presentada en 2017 en el artículo «Attention Is All You Need», escrito por un equipo que trabajaba en Google. El Transformer original se diseñó para traducir textos, por ejemplo del inglés al alemán, pero su idea central resultó útil para casi cualquier tarea con lenguaje.

Este texto explica, paso a paso y sin fórmulas difíciles, cómo funciona esa arquitectura en general. No describe el funcionamiento interno de ningún producto comercial en particular, porque esos detalles no siempre son públicos.

## Pieza por pieza

Un modelo de lenguaje escribe un texto pieza por pieza. Recibe el texto que ya existe, calcula cuál podría ser la siguiente pieza, la elige, la agrega al final y repite el proceso. Por eso puede escribir una frase que nunca leyó: no la copia de ningún lado, sino que la construye paso a paso a partir de probabilidades.

## Los tokens

Esas piezas se llaman tokens. Un token puede ser una palabra completa, un pedazo de palabra, un signo de puntuación o incluso un espacio. Las palabras comunes suelen ocupar un solo token, mientras que una palabra poco común, como «desoxirribonucleico», se parte en varios pedazos. Por ejemplo, «Hola, ¿qué tal?» podría dividirse en «Hola», «,», «¿», «qué» y «tal», aunque el corte exacto depende del tokenizador, la herramienta que corta el texto, y cada modelo usa el suyo. Cada modelo tiene un vocabulario fijo de tokens, que suele reunir decenas de miles de piezas distintas, y a cada token le corresponde un número de identificación.

## Un mapa de significados

Una computadora no entiende letras: trabaja con números. Por eso, cada token se convierte en un embedding, que es una lista larga de números, también llamada vector. Puedes imaginar ese vector como las coordenadas de un punto en un espacio con muchísimas dimensiones. En el Transformer original, cada vector tenía 512 números. Durante el entrenamiento, el modelo ajusta esos vectores de manera que los tokens con significados parecidos terminan cerca unos de otros; nadie escribe esas coordenadas a mano. En un dibujo simplificado de tres dimensiones, «perro» y «gato» quedarían cerca, igual que «rey» y «reina», mientras que «pan» estaría en otra región.

Hay un detalle importante. El mecanismo de atención, que verás enseguida, no sabe por sí solo en qué orden van las palabras. Por eso, a cada embedding se le suma información sobre su posición en el texto. Sin ella, el modelo no podría distinguir «el perro mordió al cartero» de «el cartero mordió al perro», porque las dos frases tienen los mismos tokens.

## La atención: cada palabra mira a las demás

La gran idea del Transformer es la autoatención. En cada paso, cada token mira a los demás tokens del texto y decide cuánta importancia darle a cada uno. Luego actualiza su vector mezclando información de los que más le importan, así que su significado deja de ser fijo y pasa a depender del contexto.

Para lograrlo, cada token produce tres vectores: una consulta, que representa lo que está buscando; una clave, que representa lo que ofrece; y un valor, que es la información que puede compartir. El modelo compara la consulta de un token con las claves de los demás para obtener pesos de atención que suman 1, y el nuevo vector del token es la mezcla de los valores ponderada por esos pesos. Cuanto más se parecen una consulta y una clave, mayor es el peso.

Piensa en la frase «El gato no subió al techo porque estaba cansado». Para entender quién estaba cansado, el token «cansado» necesita prestar mucha atención a «gato» y poca a «techo». La atención permite justamente eso, aunque las palabras estén lejos una de otra. En los modelos que generan texto hay una regla extra: cada token solo puede mirar a los tokens que están antes que él, nunca a los que todavía no se escriben.

## Muchas miradas a la vez

Un Transformer no tiene una sola atención, sino varias cabezas de atención que trabajan en paralelo, cada una con sus propios pesos aprendidos. El Transformer original usaba 8 cabezas en cada capa de atención. Nadie le asigna a cada cabeza una tarea: en modelos ya entrenados se han encontrado cabezas que siguen relaciones gramaticales, como la de un verbo con su objeto, y otras que miran sobre todo a la palabra anterior. Sus especialidades surgen del entrenamiento. Después, los resultados de todas las cabezas se combinan en un solo vector por token.

## Capas sobre capas

La atención es solo una parte de un bloque. Cada bloque del Transformer combina una capa de atención con una pequeña red neuronal que procesa cada token por separado. Un Transformer apila muchos bloques, y la salida de cada bloque es la entrada del siguiente. El Transformer original tenía 6 bloques en su codificador y 6 en su decodificador; los modelos grandes de hoy apilan decenas. En general, con cada bloque las representaciones se refinan: los vectores de las primeras capas reflejan sobre todo qué token es y dónde está, y los de capas más profundas reflejan cada vez más su sentido dentro de la frase.

Otra ventaja del Transformer es que, durante el entrenamiento, procesa todos los tokens de un texto al mismo tiempo, en lugar de leerlos uno por uno como las redes recurrentes que se usaban antes. Eso permitió aprovechar mejor las computadoras modernas y entrenar con muchísimo más texto.

## El caso del «banco»

Considera estas dos frases: «En el parque, me senté en el banco» y «Deposité mi dinero en el banco». El token «banco» empieza con el mismo embedding en ambas, porque es el mismo token. Pero, capa tras capa, la atención le mezcla información de las palabras que lo rodean: en la primera frase, de «parque» y «senté»; en la segunda, de «dinero» y «deposité». Al final, el vector de «banco» queda en lugares distintos del espacio de significados. El modelo no consulta un diccionario: el contexto construye el significado.

## Adivinar la siguiente pieza

Después del último bloque, el modelo toma el vector del último token y lo convierte en una puntuación, llamada logit, para cada token de su vocabulario. Luego, la función softmax transforma los logits en probabilidades: números entre 0 y 1 que suman 1. Por ejemplo, después de «El gato se subió al…», un modelo podría dar puntuaciones como estas: techo, 4; árbol, 3; sillón, 2; carro, 1, y piano, 0.5. Con softmax, «techo» tendría cerca del 63 % de probabilidad: la opción más probable, pero no la única. El modelo elige un token según esas probabilidades, lo agrega al texto y vuelve a empezar.

## La temperatura

Muchos sistemas permiten ajustar un número llamado temperatura, que cambia la forma de elegir. Antes de aplicar softmax, las puntuaciones se dividen entre la temperatura. Con una temperatura baja, menor que 1, las diferencias se agrandan y la opción favorita se lleva casi toda la probabilidad: el texto se vuelve más predecible y repetitivo. Con una temperatura alta, mayor que 1, las diferencias se achican y las opciones poco probables ganan oportunidad: el texto sale más variado, pero también puede perder coherencia. La temperatura no le da al modelo más conocimientos ni lo vuelve más inteligente: solo cambia cómo elige entre las mismas opciones, que conservan su orden.

## Cómo aprende

Todos esos números que el modelo ajusta, como los de los embeddings y los de la atención, se llaman parámetros. Los modelos grandes tienen miles de millones de parámetros. El modelo aprende leyendo enormes cantidades de texto y practicando una sola tarea: predecir el siguiente token. Cada vez que se equivoca, un algoritmo calcula cómo cambiar cada parámetro para reducir el error. Después de repetir esto una enorme cantidad de veces, los parámetros guardan patrones del lenguaje y del mundo. Muchos asistentes reciben después un entrenamiento adicional para seguir instrucciones y conversar.

## ¿Copia y pega?

Mucha gente cree que un modelo de lenguaje busca frases en internet y las copia. En realidad, un modelo de lenguaje no guarda una base de datos de frases que consulta al escribir: su conocimiento está repartido en sus parámetros, y cada token que produce sale de un cálculo de probabilidades. Algunos sistemas sí le conectan herramientas de búsqueda, pero esa es una pieza aparte del modelo. Aun así, a veces un modelo puede reproducir de memoria fragmentos que aparecían muchas veces en sus datos de entrenamiento, como un refrán o un texto muy famoso.

## Suena seguro, pero ¿es verdad?

Como el modelo aprende a producir texto probable, puede escribir frases fluidas y convincentes que son falsas. A este problema se le suele llamar alucinación. Por eso conviene verificar lo que dice contra fuentes confiables. Una forma de hacerlo es darle al modelo un documento y pedirle que cite el pasaje exacto en el que se basa cada afirmación, para que una persona pueda comprobarlo.

## Así lee EIDOS tu documento

EIDOS, la aplicación en la que estás leyendo esto, usa esa idea con varios agentes, que son llamadas a un modelo de lenguaje con instrucciones distintas. El Cartógrafo lee tu documento y arma un libro de hechos con la cita de cada uno; el Director diseña las escenas solo con esos hechos, y el Escéptico revisa cada oración contra ellos. Así, junto a cada frase puedes ver de qué parte de la fuente salió.

## Tres ideas para quedarte

Si tuvieras que resumir todo en tres ideas, serían estas. Primero, el texto se parte en tokens, y cada token se vuelve un vector en un espacio de significados. Segundo, la atención deja que cada token tome información de los demás, capa tras capa, para que el contexto defina el sentido. Tercero, al final el modelo calcula probabilidades para el siguiente token, elige uno y repite: así escribe frases que nunca leyó.

## Referencias para profundizar

- Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł. y Polosukhin, I. (2017). «Attention Is All You Need». *Advances in Neural Information Processing Systems 30* (NeurIPS 2017).
- Jurafsky, D. y Martin, J. H. *Speech and Language Processing*, 3.ª edición (borrador disponible en línea), capítulos sobre modelos de lenguaje y Transformers.
- Mikolov, T., Chen, K., Corrado, G. y Dean, J. (2013). «Efficient Estimation of Word Representations in Vector Space». arXiv:1301.3781.
- Clark, K., Khandelwal, U., Levy, O. y Manning, C. D. (2019). «What Does BERT Look At? An Analysis of BERT's Attention». *Proceedings of the 2019 ACL Workshop BlackboxNLP*.
- Brown, T. B. et al. (2020). «Language Models are Few-Shot Learners». *Advances in Neural Information Processing Systems 33*.
- Goodfellow, I., Bengio, Y. y Courville, A. (2016). *Deep Learning*. MIT Press.
