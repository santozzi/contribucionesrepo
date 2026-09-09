# Contribuciones por grupo — TPs

Dashboard para ver, de un pantallazo, **cuánto aportó cada integrante de cada grupo
en cada trabajo práctico**. Lee la planilla de Google donde están cargados los grupos
y los repos, consulta la API de GitHub y arma los gráficos. A medida que se completan
celdas en la planilla, los gráficos aparecen solos: no hay nada que cargar dos veces.

Node + TypeScript en el backend, React + Vite en el front, todo en Docker.

---

## Puesta en marcha

```bash
cp env.ejemplo .env
```

Editá el `.env`:

- **`SHEET_ID`** — ya viene con el ID de la planilla actual.
- **`GITHUB_TOKEN`** — importante. Sin token, GitHub permite 60 pedidos por hora y
  con ~20 grupos se agota en la primera carga. Se crea en
  <https://github.com/settings/tokens> → *Fine-grained token*, permiso
  **Public Repositories (read-only)**. No hace falta nada más.
- **Acceso a la planilla** — ver la sección siguiente.

Después:

```bash
docker compose up -d --build
```

y abrir <http://localhost:5190>.

---

## Cómo lee la planilla

Se usa la primera vía disponible de estas cuatro:

| # | Vía | Cuándo sirve |
|---|---|---|
| 1 | `PLANILLA_CSV_FILE` | un CSV exportado a mano (*Archivo → Descargar → CSV*). No toca Google. Útil sin conexión o como respaldo. |
| 2 | **service account** | **la única que funciona con la planilla privada.** Ver [`credenciales/LEEME.md`](credenciales/LEEME.md). |
| 3 | `GOOGLE_API_KEY` | solo si la planilla está compartida como "cualquiera con el enlace puede ver". |
| 4 | export CSV público | ídem, y sin configurar nada. |

Ojo con las vías 3 y 4: **Google devuelve 401 apenas la planilla deja de estar
compartida por link**, y a veces también limita el acceso anónimo repetido. Si el
dashboard dice que no puede bajar la planilla, ese suele ser el motivo. La service
account (vía 2) no tiene ese problema: alcanza con compartirle la planilla a su
`client_email` como Lector.

---

## Qué muestra

### Resumen
Cuatro números al tope (grupos analizados, alumnos sin ningún commit, grupos con
reparto desparejo, celdas de TP sin cargar) y una **matriz grupo × práctico**. Cada
celda dice cuántos commits tiene el repo, cuántos integrantes aportaron y una barrita
por integrante — verde aportó, naranja aportó poco, rojo no aportó nada.

### Grupos
Una tarjeta por grupo con el gráfico principal: **commits por integrante, apilados por
TP**. Una barra corta o ausente es exactamente lo que estás buscando. Abriendo el
detalle aparece, por cada TP:

- tabla con commits, %, líneas agregadas y borradas, días activos y fechas del primer
  y último commit de cada integrante;
- **commits por día** apilados por persona — sirve para ver si el trabajo se repartió
  en el tiempo o entró todo la noche anterior a la entrega;
- los commits que no matchean con ningún usuario de la planilla, con un botón para
  asignarlos a mano (ver más abajo).

### Alertas
Todo lo que conviene mirar, filtrable por tipo y severidad:

| Alerta | Cuándo salta |
|---|---|
| `Sin actividad` | un integrante no tiene ningún commit en ese TP |
| `Aporte bajo` | aportó menos del 40 % de la cuota pareja (configurable) |
| `Carga despareja` | el reparto del grupo tiene Gini > 0.5 |
| `Todo a último momento` | más del 60 % de los commits entró en las últimas 24 h |
| `Autor no identificado` | hay commits de un mail/nombre que no figura en la planilla |
| `Repo inaccesible` | la celda no es un repo válido, o el repo es privado / no existe |
| `Repo vacío` | el repo existe pero no tiene commits |
| `Falta usuario en la planilla` | un integrante no tiene cargado su usuario de GitHub |

---

## Dos cosas que conviene entender

**El conteo de commits no es la medida del trabajo.** Un commit puede ser 400 líneas
o un espacio. Por eso el detalle muestra también líneas agregadas/borradas y días
activos: son tres señales, y las tres juntas dicen bastante más que cualquiera sola.
El dashboard marca casos para mirar, no pone notas.

Y el conteo de líneas tampoco: si el grupo commiteó `node_modules`, un `.lock` o
archivos binarios, quien haya hecho ese commit aparece con cientos de miles de líneas.
Cuando un número de líneas parezca absurdo, es casi seguro eso — mirá los commits.

**Alumnos que "no aparecen" pero sí trabajaron.** Es muy común que un alumno tenga mal
el `git config user.email` y GitHub no pueda atribuirle sus commits. Esos commits
salen listados como *autor no identificado*, con un desplegable para asignarlos al
integrante correcto. La asignación se guarda en `data/alias.json` y se aplica de ahí
en adelante sin volver a consultar GitHub.

---

## Cómo estructurar la planilla

Los encabezados se detectan por nombre, no por posición: se puede agregar un `TP 5` o
un séptimo integrante sin tocar el código.

- Una columna llamada **`grupo`**.
- Por integrante, la terna **`Nombre`**, **`Apellido`**, **`Usuario Github`** (en ese
  orden). La columna de usuario acepta tanto `pepito` como
  `https://github.com/pepito`.
- Una columna por práctico llamada **`TP 1`**, **`TP 2`**, … con la URL del repo.

---

## Para que los datos sirvan

Esto mide lo que llega al repo. Si el grupo trabaja junto y sube todo desde una sola
máquina, van a aparecer cuatro alumnos "sin actividad" que en realidad trabajaron. Lo
que hace que la medición sea válida:

1. Que cada uno commitee **desde su propia cuenta**.
2. Que el trabajo entre por **Pull Request**, no por push directo a `main`.
3. Avisarles desde el principio que la contribución se mira — cambia el
   comportamiento mucho más que descubrirlo al final.

---

## Uso diario

- **Releer planilla** — vuelve a leer la planilla y recalcula sin consultar GitHub.
  Es lo que se usa cuando cargaste un repo nuevo o asignaste un alias. Es instantáneo.
- **Refrescar desde GitHub** — descarta el caché y vuelve a consultar todos los repos.
  Usalo cuando querés ver commits nuevos. Consume cuota.
- **Exportar CSV** — una fila por integrante y por TP, con todas las métricas. Para
  llevarlo a la planilla de notas.

El caché dura `CACHE_TTL_MIN` minutos (6 h por defecto) y vive en `./data`, así que
sobrevive a los rebuilds.

---

## Desarrollo sin Docker

```bash
cd backend && npm install && npm run dev
```

```bash
cd frontend && npm install && npm run dev
```

El front en `:5173` proxea `/api` al backend en `:8080`.

---

## Endpoints

| Ruta | Qué hace |
|---|---|
| `GET /api/estado` | diagnóstico: modo de lectura de la planilla, cuántos grupos, si hay token |
| `GET /api/datos` | el análisis completo (`?refrescar=1` ignora el caché) |
| `GET /api/exportar.csv` | export para la planilla de notas |
| `GET/POST /api/alias` | consultar/guardar la atribución manual de un autor |
| `POST /api/refrescar` | vacía el caché |
