/**
 * Cliente HTTP para llamar a la API del backend.
 * Incluye credentials: 'include' para transmitir cookies httpOnly
 * y establece 'Content-Type: application/json' cuando se envía un body.
 * No registra en consola ningún dato sensible.
 */
export async function apiFetch(path, options = {}) {
  const url = path.startsWith('/') ? path : `/${path}`;

  const headers = {
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    credentials: 'include',
    headers,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  }

  if (!response.ok) {
    const errorMessage =
      (data && data.error) ||
      (data && data.message) ||
      `Error de solicitud (${response.status})`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
