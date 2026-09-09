const num = (v: string | undefined, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== '' ? n : def;
};

export const config = {
  puerto: num(process.env.PORT, 8080),

  /**
   * Ruta a un CSV local con la planilla ya exportada (Archivo > Descargar > CSV).
   * Si esta, se usa en lugar de Google: sirve para trabajar sin conexion o cuando
   * Google corta el acceso.
   */
  planillaCsvFile: process.env.PLANILLA_CSV_FILE ?? '',

  /** ID de la planilla de Google (el tramo largo de la URL). */
  sheetId: process.env.SHEET_ID ?? '',
  /** gid de la pestania a leer (aparece en la URL como #gid=0). */
  sheetGid: process.env.SHEET_GID ?? '0',
  /** Nombre de la pestania. Solo se usa en modo API (con GOOGLE_API_KEY). */
  sheetNombreHoja: process.env.SHEET_NOMBRE_HOJA ?? '',
  googleApiKey: process.env.GOOGLE_API_KEY ?? '',
  /** JSON de la service account pegado entero en el .env (alternativa al archivo). */
  serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '',
  /** Ruta al JSON de la service account montado en el contenedor. */
  serviceAccountFile:
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE ?? '/app/credenciales/google-service-account.json',

  /** Personal access token de GitHub. Sin el, la API permite solo 60 pedidos por hora. */
  githubToken: process.env.GITHUB_TOKEN ?? '',

  /**
   * URL de la Aplicacion web publicada del Apps Script (Implementar > Nueva
   * implementacion > Aplicacion web) que arma la hoja "Graficos por grupo".
   * La usa el boton "Actualizar Google Sheet".
   */
  sheetWebhookUrl: process.env.SHEET_WEBHOOK_URL ?? '',
  /** Secreto compartido con esa Aplicacion web (Propiedades del proyecto > Script). */
  sheetWebhookSecret: process.env.SHEET_WEBHOOK_SECRET ?? '',

  cacheDir: process.env.CACHE_DIR ?? '/app/data/cache',
  aliasFile: process.env.ALIAS_FILE ?? '/app/data/alias.json',
  /** Minutos que se reusa la respuesta cacheada de GitHub antes de volver a pedirla. */
  cacheTtlMin: num(process.env.CACHE_TTL_MIN, 360),

  /** Tope de commits que se leen por repo (paginado de a 100). */
  maxCommits: num(process.env.MAX_COMMITS, 500),
  /** Repos analizados en paralelo. */
  concurrencia: num(process.env.CONCURRENCIA, 4),

  /**
   * Un integrante "aporta parejo" cuando hace total/cantidadIntegrantes commits.
   * Por debajo de este multiplo de esa cuota se marca BAJA_CONTRIBUCION.
   */
  umbralBaja: num(process.env.UMBRAL_BAJA, 0.4),
  /** Gini por encima del cual el reparto del grupo se considera desparejo. */
  umbralGini: num(process.env.UMBRAL_GINI, 0.5),
  /** % de commits en las ultimas 24 h que dispara ENTREGA_ULTIMO_MOMENTO. */
  umbralUltimoMomento: num(process.env.UMBRAL_ULTIMO_MOMENTO, 60),
};

export const urlCsvPlanilla = () =>
  `https://docs.google.com/spreadsheets/d/${config.sheetId}/export?format=csv&gid=${config.sheetGid}`;
