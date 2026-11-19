# Documento de Requisitos del Producto (PRD) — Librify

## 1. Objetivo y Alcance

### 1.1 Objetivo
Librify es una plataforma de comercio electrónico especializada en la venta y distribución de libros digitales y libros físicos. Su propósito es ofrecer una experiencia de compra literaria, cálida y confiable, garantizando acceso inmediato al contenido digital adquirido mediante descargas seguras, y un seguimiento logístico riguroso para las entregas físicas.

### 1.2 Alcance
- **Plataforma Web**: Aplicación frontend responsiva construida con Next.js (App Router), Tailwind CSS y estilo editorial.
- **Backend API**: Servidor RESTful modular en Node.js/Express respaldado por MongoDB.
- **Autenticación y Seguridad**: Manejo de sesiones basadas en JSON Web Tokens (JWT) almacenados en cookies HTTP-only (`token`), verificación de origen contra ataques CSRF y control de acceso basado en roles (RBAC).
- **Procesamiento de Pagos**: Integración con PayPal Sandbox con flujo de creación de orden, aprobación y captura verificada del lado del servidor.
- **Gestión Logística y Digital**:
  - Biblioteca personal con enlaces temporales firmados mediante JWT (5 minutos de expiración) para descarga de archivos digitales.
  - Gestión de direcciones y ciclo de vida de envíos para libros físicos.
- **Panel Administrativo**: Módulos para catálogo, categorías, movimientos de inventario, consulta de pedidos y trazabilidad de envíos.

---

## 2. Actores del Sistema

| Actor | Descripción | Responsabilidades y Permisos |
| :--- | :--- | :--- |
| **Cliente** | Usuario final registrado o visitante en la tienda. | - Explorar catálogo público y detalle de libros.<br>- Registrarse e iniciar sesión.<br>- Administrar su carrito de compras (digital y físico).<br>- Registrar direcciones postales para envíos físicos.<br>- Realizar el pago con PayPal Sandbox.<br>- Consultar su historial de pedidos y detalle de envíos.<br>- Acceder a su biblioteca personal y descargar libros digitales comprados. |
| **Administrador** | Usuario con credenciales y rol elevado (`administrador`). | - Gestionar catálogo (crear, editar, desactivar libros).<br>- Ajustar inventario con registro de motivos y consultar movimientos.<br>- Administrar categorías taxonómicas (crear, editar, eliminar con validación de dependencias).<br>- Supervisar el historial global de pedidos de todos los clientes.<br>- Gestionar el ciclo de vida de los envíos físicos (asignación de transportadora, guía y actualización de estados). |

---

## 3. Funcionalidades y Criterios de Aceptación

### 3.1 Registro e Inicio de Sesión
- **Registro (`POST /api/auth/register`)**:
  - Requiere nombre, correo electrónico válido y contraseña (mínimo 8 caracteres).
  - No permite correos duplicados (retorna error `409 Conflict`).
  - Almacena contraseñas hasheadas mediante `bcrypt` (cost factor 12).
- **Inicio de sesión (`POST /api/auth/login`)**:
  - Requiere correo y contraseña. Rate limiting configurado a 5 intentos por ventana de 15 minutos.
  - Emite una cookie segura `httpOnly` con el token JWT de sesión (`token`).
  - En caso de credenciales incorrectas o usuario inexistente, responde con código `401 Unauthorized` y el mensaje: `"Email o contraseña incorrectos"`.
- **Cierre de sesión (`POST /api/auth/logout`)**:
  - Invalida la cookie de sesión eliminándola del cliente (`204 No Content`).
- **Verificación de sesión (`GET /api/auth/me`)**:
  - Retorna información del usuario autenticado (`_id`, `name`, `email`, `role`).

### 3.2 Catálogo con Búsqueda y Filtro por Categoría
- **Listado (`GET /api/books`)**:
  - Muestra únicamente libros activos (`isActive: true`).
  - Permite filtrar por término de búsqueda (título y autor) y por identificador de categoría (`categoryId`).
  - Presenta portada tipográfica editorial si no dispone de `coverUrl`, etiqueta de tipo de producto (`Digital` o `Físico`), precio y autor.

### 3.3 Detalle de Libro (`GET /api/books/:id`)
- Muestra ficha completa: título, autor, descripción, categoría, tipo de formato y precio.
- Botón "Agregar al carrito" que llama a `PUT /api/cart/items/:bookId` con `{ qty: 1 }`.
- Si el usuario no ha iniciado sesión, ofrece un enlace directo a `/ingresar`.

### 3.4 Carrito Mixto (Digital y Físico)
- Permite almacenar simultáneamente libros digitales y físicos.
- Ajuste de cantidades con botones $+$, $-$ y quitar (`PUT /api/cart/items/:bookId` con `qty`).
- El cálculo de totales y subtotales se realiza en el servidor; el cliente no recalcula precios en el navegador.

### 3.5 Direcciones de Envío (Solo para Físicos)
- Página `/direcciones` para listar (`GET /api/addresses`) y crear (`POST /api/addresses`) direcciones con campos estándar (`recipient`, `line1`, `line2`, `city`, `region`, `postalCode`, `country`, `phone`).
- **Criterio condicional**:
  - Si el carrito contiene al menos un libro `PHYSICAL`, es obligatorio seleccionar o suministrar una dirección de entrega antes de ordenar.
  - Si el carrito contiene únicamente libros `DIGITAL`, el flujo omite la selección de dirección de envío.

### 3.6 Creación de Pedido (`POST /api/orders`)
- Genera una orden en estado inicial `PENDING_PAYMENT` y estado de pago `CREATED`.
- Valida disponibilidad de inventario para todos los ítems antes de crear el pedido (retorna `409` si no hay stock suficiente).
- Captura snapshots inmutables del libro (título, precio, tipo) y de la dirección de envío en la orden.
- No vacía el carrito ni descuenta stock en este paso.

### 3.7 Pago con PayPal Sandbox y Captura Verificada
- **Creación de orden PayPal (`POST /api/payments/paypal/order`)**:
  - Genera la orden contra la API de PayPal Sandbox por el monto exacto de la orden interna.
  - Redirige al cliente a la URL de aprobación de PayPal (`https://www.sandbox.paypal.com/checkoutnow?token=...`).
- **Retorno y Captura (`POST /api/payments/paypal/capture`)**:
  - Al volver de PayPal a `/pago/retorno`, el backend ejecuta la captura oficial del pago con validación de monto e idempotencia.
  - Actualiza el pedido a estado `PAID` y `paymentStatus: 'CAPTURED'`.
  - Concede acceso inmediato en la biblioteca digital del usuario para los ítems `DIGITAL` adquiridos.
  - Si el pago falla o se cancela, el pedido permanece pendiente o cancelado de forma explícita.

### 3.8 Descuento de Stock tras Pago
- Al confirmarse la captura del pago:
  - Se descuenta el stock de **todas** las líneas del pedido (tanto `PHYSICAL` como `DIGITAL`) registrando un movimiento de tipo `SALE` con motivo `"Venta confirmada por PayPal"`.
  - Si una línea presenta stock insuficiente en ese instante, se realiza compensación mediante reversión de movimientos (`RETURN`) y se aborta la captura.
  - Una vez confirmado el pago, se vacía el carrito del usuario.

### 3.9 Biblioteca Personal y Descarga de Digitales
- **Listar Biblioteca (`GET /api/library`)**:
  - Requiere autenticación por cookie. Lista las entradas adquiridas por el usuario (título, autor, portada y fecha de concesión). NUNCA expone `fileKey`.
- **Generar Enlace de Descarga (`GET /api/library/:bookId/link`)**:
  - Requiere autenticación por cookie.
  - Si el usuario no tiene acceso al libro (no lo ha comprado), responde con `404 Not Found` y el mensaje `"No tienes acceso a este libro"`.
  - Si tiene acceso, genera un JWT temporal firmado con expiración de 5 minutos conteniendo `sub` (userId) y `bookId`.
  - Retorna `{ downloadUrl: "/api/library/:bookId/file?token=<jwt>" }`.
- **Descargar Archivo (`GET /api/library/:bookId/file?token=<jwt>`)**:
  - Endpoint público (sin autenticación por cookie); la autorización depende exclusivamente de la validez del token en query param.
  - Si el token está ausente: `401` con `"Token inválido o ausente"`.
  - Si el token es inválido o expiró: `401` con `"Token inválido o expirado"`.
  - Si el token corresponde a otro libro distinto al solicitado en la URL: `401` con `"Token no corresponde al libro solicitado"`.
  - Si el libro o su archivo no existen en el almacenamiento: `404` con `"Archivo no disponible"` o `"Archivo no encontrado"`.
  - En caso exitoso, transmite el archivo vía streaming con cabecera `Content-Disposition: attachment; filename="<titulo>.pdf"`.

### 3.10 Panel de Administración
- Acceso restringido exclusivamente al rol `administrador`.
- **Libros (`/admin/libros`)**:
  - Listado de libros, creación (`POST /api/books`), edición (`PATCH /api/books/:id`) y desactivación lógica (`DELETE /api/books/:id`).
  - Ajuste manual de inventario (`PATCH /api/books/:id/stock`) con variación (`delta`) y motivo obligatorio (`reason`, mínimo 3 caracteres).
  - Historial de movimientos de inventario (`/admin/libros/[id]/movimientos`).
- **Categorías (`/admin/categorias`)**:
  - Listado, alta y edición.
  - Eliminación segura: si la categoría cuenta con libros asociados, el backend responde con código `409 Conflict` y el mensaje `"La categoría tiene libros"`.
- **Pedidos (`/admin/pedidos`)**:
  - Consulta general de pedidos con paginación (`GET /api/orders?page=1&limit=20`), detallando cliente, total, tipo de entrega (`DIGITAL`, `PHYSICAL` o `MIXED`) y estado de pago (sin exponer datos sensibles como `passwordHash` o `fileKey`).
- **Envíos (`/admin/envios`)**:
  - Creación de envíos (`POST /api/shipments`) para pedidos en estado `PAID` con libros físicos.
  - Actualización de transportadora, número de guía y notas de seguimiento (`PATCH /api/shipments/:id`).
  - Cumplimiento del mapa de transiciones válidas:
    - `PREPARING` $\rightarrow$ `['SHIPPED', 'INCIDENT']`
    - `SHIPPED` $\rightarrow$ `['IN_TRANSIT', 'INCIDENT']`
    - `IN_TRANSIT` $\rightarrow$ `['DELIVERED', 'INCIDENT']`
    - `INCIDENT` $\rightarrow$ `['PREPARING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED']`
    - `DELIVERED` $\rightarrow$ Estado terminal.
  - **Cierre del Pedido (`COMPLETED`)**: el pedido pasa automáticamente a `COMPLETED` solo cuando el envío físico llega a `DELIVERED` y no hay líneas pendientes de concesión.

### 3.11 Reglas de Autorización
- **Rutas públicas**: catálogo (`/api/books`), detalle de libro (`/api/books/:id`), categorías (`/api/categories`), registro (`/api/auth/register`), inicio de sesión (`/api/auth/login`) y descarga de archivo digital mediante token temporal firmado (`/api/library/:bookId/file?token=...`).
- **Rutas de cliente autenticado**: carrito (`/api/cart`), direcciones (`/api/addresses`), órdenes personales (`/api/orders/me`, `/api/orders/:id`), pagos (`/api/payments/*`), biblioteca (`/api/library`) y generación de enlace de descarga (`/api/library/:bookId/link`).
- **Rutas de administrador**: listado global de órdenes (`GET /api/orders`), gestión de usuarios (`/api/users/*`), creación/edición/borrado de libros y categorías, ajustes de stock y gestión de envíos (`/api/shipments/*`). Usuarios regulares reciben `403 Forbidden` (`{ error: 'Forbidden' }`) en API y pantalla de "Acceso denegado" en el frontend.

---

## 4. Casos de Prueba Prioritarios

| ID | Escenario | Precondición | Pasos de Ejecución | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- |
| **CP-01** | **Login con credenciales inválidas** | Usuario existente (o inexistente) en el sistema. | 1. Ingresar correo y contraseña incorrecta.<br>2. Enviar formulario `POST /api/auth/login`. | El sistema responde `401 Unauthorized` con el mensaje exacto `"Email o contraseña incorrectos"`. No se emite cookie de sesión. |
| **CP-02** | **Cliente intenta entrar al panel admin** | Usuario con rol `cliente` autenticado. | 1. Iniciar sesión como cliente regular.<br>2. Intentar navegar a `/admin` o subrutas administrativas. | El frontend muestra la pantalla "Acceso denegado" (sin redirigir a otra vista). Peticiones administrativas a la API responden `403 Forbidden`. |
| **CP-03** | **Compra completa de libro digital** | Cliente autenticado con cuenta PayPal Sandbox; libro digital con stock disponible. | 1. Agregar libro digital al carrito.<br>2. Proceder al pago (sin requerir dirección de envío).<br>3. Aprobar orden en PayPal Sandbox.<br>4. Capturar pago en `/pago/retorno`. | El pedido pasa a `PAID`, se descuenta el stock del libro digital con movimiento `SALE`, se vacía el carrito y se genera la entrada en la biblioteca del cliente. |
| **CP-04** | **Descarga de libro digital solo tras compra** | Archivo digital cargado; Usuario A (comprador) y Usuario B (no comprador). | 1. Usuario A solicita enlace en `/api/library/:bookId/link` y descarga desde `/api/library/:bookId/file?token=...`.<br>2. Usuario B solicita enlace para el mismo libro.<br>3. Usuario B intenta acceder a `/api/library/:bookId/file` con token inválido o de otro libro. | Usuario A descarga el archivo binario exitosamente.<br>Usuario B recibe `404 Not Found` al pedir enlace (`"No tienes acceso a este libro"`).<br>El endpoint de archivo responde `401 Unauthorized` ante token ausente, expirado, inválido o que no corresponde al libro. |

---

## 5. Datos de Prueba (Ambiente Sandbox / Ficticio)

> [!NOTE]
> Para la ejecución de pruebas manuales y automatizadas se utilizan cuentas ficticias de prueba. Las credenciales de acceso no se registran en este documento y se configuran de forma independiente en TestSprite o en variables de entorno seguras de prueba.

### 5.1 Cuentas Ficticias de Prueba
- **Cuenta Administrador**: Perfil con rol `administrador` para validación de rutas y acciones en `/admin/*`.
- **Cuenta Cliente 1**: Perfil con rol `cliente` para pruebas de compras de libros digitales y consulta de biblioteca.
- **Cuenta Cliente 2**: Perfil con rol `cliente` para pruebas de compras de libros físicos, registro de direcciones y seguimiento de envíos.

### 5.2 Dirección Postal Ficticia de Prueba
- Destinatario: `Mariana Gómez`
- Línea 1: `Avenida Santander # 45-67, Apto 302`
- Ciudad: `Bogotá`
- Región: `Cundinamarca`
- Código Postal: `110221`
- País: `Colombia`
- Teléfono: `+573001234567`

### 5.3 Parámetros de Prueba PayPal Sandbox
- Moneda estándar de prueba: `USD`
- Flujo de checkout: redirección a URL de aprobación Sandbox y captura en `/pago/retorno`.
