/**
 * Factoría para crear un cliente de la API de PayPal.
 * Recibe una función fetch (por defecto el fetch global nativo de Node.js).
 */
function createPayPalClient(httpFetch = fetch) {
  let cachedToken = null;
  let tokenExpiresAt = 0;

  function getBaseUrl() {
    return (process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com').replace(/\/+$/, '');
  }

  async function getAccessToken() {
    const now = Date.now();
    // Reutilizar token si aún le queda al menos 1 minuto de vigencia
    if (cachedToken && tokenExpiresAt > now + 60 * 1000) {
      return cachedToken;
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      const err = new Error('Configuración de credenciales de PayPal faltante');
      err.code = 'PAYPAL_CONFIG_MISSING';
      throw err;
    }

    const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const baseUrl = getBaseUrl();

    let res;
    try {
      res = await httpFetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
    } catch (networkErr) {
      const err = new Error('Error al conectar con PayPal');
      err.code = 'PAYPAL_NETWORK_ERROR';
      throw err;
    }

    if (!res.ok) {
      const err = new Error('Error de autenticación con PayPal');
      err.code = 'PAYPAL_AUTH_ERROR';
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000;

    return cachedToken;
  }

  async function createPayPalOrder({ amount, currency, referenceId }) {
    const token = await getAccessToken();
    const baseUrl = getBaseUrl();

    const formattedAmount = Number(amount).toFixed(2);

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: referenceId ? String(referenceId) : undefined,
          amount: {
            currency_code: currency,
            value: formattedAmount,
          },
        },
      ],
    };

    let res;
    try {
      res = await httpFetch(`${baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (networkErr) {
      const err = new Error('Error al conectar con PayPal');
      err.code = 'PAYPAL_NETWORK_ERROR';
      throw err;
    }

    if (!res.ok) {
      const err = new Error('Error al crear orden en PayPal');
      err.code = 'PAYPAL_API_ERROR';
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    return { id: data.id };
  }

  async function capturePayPalOrder(providerOrderId) {
    const token = await getAccessToken();
    const baseUrl = getBaseUrl();

    let res;
    try {
      res = await httpFetch(`${baseUrl}/v2/checkout/orders/${providerOrderId}/capture`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (networkErr) {
      const err = new Error('Error al conectar con PayPal');
      err.code = 'PAYPAL_NETWORK_ERROR';
      throw err;
    }

    if (!res.ok) {
      const err = new Error('Error al capturar orden en PayPal');
      err.code = 'PAYPAL_API_ERROR';
      err.status = res.status;
      throw err;
    }

    const data = await res.json();

    // Extraer datos de captura
    const purchaseUnit = data.purchase_units && data.purchase_units[0];
    const capture =
      purchaseUnit &&
      purchaseUnit.payments &&
      purchaseUnit.payments.captures &&
      purchaseUnit.payments.captures[0];

    const captureId = capture ? capture.id : null;
    const capturedAmount = capture && capture.amount ? Number(capture.amount.value) : null;
    const capturedCurrency = capture && capture.amount ? capture.amount.currency_code : null;

    return {
      id: data.id,
      status: data.status, // ej. 'COMPLETED'
      captureId,
      amount: capturedAmount,
      currency: capturedCurrency,
    };
  }

  return {
    getAccessToken,
    createPayPalOrder,
    capturePayPalOrder,
  };
}

const defaultPayPalClient = createPayPalClient();

module.exports = {
  createPayPalClient,
  paypalClient: defaultPayPalClient,
};
