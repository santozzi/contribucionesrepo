# credenciales/

Dejá acá el archivo **`google-service-account.json`** si la planilla no es pública.

Cómo obtenerlo:

1. <https://console.cloud.google.com> → creá (o elegí) un proyecto.
2. *APIs y servicios* → *Biblioteca* → habilitá **Google Sheets API**.
3. *APIs y servicios* → *Credenciales* → **Crear credenciales** → *Cuenta de servicio*.
4. Entrá a la cuenta de servicio creada → pestaña **Claves** → *Agregar clave* →
   *Crear clave nueva* → **JSON**. Se descarga el archivo.
5. Renombralo a `google-service-account.json` y ponelo en esta carpeta.
6. Abrí el JSON, copiá el valor de `client_email`
   (algo como `lector-planilla@tu-proyecto.iam.gserviceaccount.com`) y **compartí
   la planilla de Google con ese mail, como Lector**. Sin este paso da 403.

Después: `docker compose restart backend`.

El `.json` está en el `.gitignore`: no se sube al repo. Tratalo como una contraseña —
quien lo tenga puede leer todo lo que le compartas a esa cuenta.
