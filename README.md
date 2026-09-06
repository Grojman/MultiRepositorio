# Repositorio de recursos de la carrera

Sitio estático (pensado para GitHub Pages) que muestra los recursos de la
carrera —apuntes, PDFs, imágenes, audio, vídeo y tests— como si fueran una
terminal. Se puede navegar escribiendo comandos o haciendo clic sobre los
elementos listados; al abrir un recurso la pantalla se divide entre la
terminal y un visor, y las pestañas se pueden arrastrar para reorganizar,
dividir o cerrar paneles.

## Estructura del contenido

En la raíz del repositorio hay cuatro carpetas, una por curso: `1/`, `2/`,
`3/`, `4/`. Dentro de cada una, una carpeta por asignatura, y dentro de esas,
los recursos (con la profundidad y formato que quieras: texto, PDF, imagen,
audio, vídeo o cualquier otro archivo).

```
1/
  Matematicas/
    apuntes.txt
    tema1.json      <- test (ver más abajo)
  Programacion/
    introduccion.txt
    diagrama.svg
2/
3/
4/
```

El escáner (`scan.sh`) no exige seguir esta estructura al pie de la letra:
cualquier carpeta o archivo adicional que añadas en la raíz (fuera de
`assets/`, `data/`, `index.html`, `scan.sh`, `.nojekyll`, `README.md`) se
incluirá igualmente en el índice y aparecerá en la página.

## Regenerar el índice

Cada vez que añadas, muevas o borres recursos, ejecuta:

```sh
./scan.sh
```

Esto regenera `data/index.json`, que es lo que la página lee para construir
el árbol de navegación. Recuerda confirmar (`git add`/`git commit`) ese
archivo junto con los recursos: no hay ningún paso automático en GitHub que
lo regenere por ti.

Requiere tener `jq` instalado (`sudo apt install jq` / `brew install jq`).

## Tests (archivos `.json`)

**Todo** archivo `.json` dentro del árbol de contenido se trata como un
test/cuestionario, con este formato:

```json
{
  "title": "Tema 1 - Repaso",
  "questions": [
    {
      "question": "¿Capital de Francia?",
      "answers": ["Madrid", "París", "Roma", "Berlín"],
      "correct": [1],
      "multiple": false
    },
    {
      "question": "¿Cuáles son primos?",
      "answers": ["2", "3", "4", "9"],
      "correct": [0, 1],
      "multiple": true
    }
  ]
}
```

- `correct` son los índices (empezando en 0) de las respuestas correctas
  dentro de `answers`.
- `multiple` indica si se permite seleccionar más de una respuesta
  (checkbox) o solo una (radio). Si se omite, se infiere de `correct`
  (más de un índice → múltiple).
- Una pregunta se da por correcta solo si seleccionas exactamente el
  conjunto de respuestas correctas (ni de más ni de menos).
- Un `.json` que no siga este formato se muestra con un aviso de error en
  vez de romper la página.

## Ejecutar en local

La página carga `data/index.json` con `fetch`, así que necesita servirse
por HTTP (no funciona abriendo `index.html` directamente con `file://`).
Por ejemplo:

```sh
python3 -m http.server 8000
```

y abre `http://localhost:8000`.

## Limitaciones conocidas

- La disposición de paneles y el progreso de los tests no se guardan al
  recargar la página (todo vive en memoria del navegador).
- Los tipos de archivo no reconocidos (por ejemplo `.docx`, `.pptx`, `.zip`)
  no tienen vista previa: se muestra un enlace para abrirlos/descargarlos.
