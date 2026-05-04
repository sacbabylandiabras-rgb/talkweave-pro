export const readDeviceConnectivity = (deviceStatus: any) => {
  const status = String(deviceStatus?.status || deviceStatus?.device?.status || '').toLowerCase();
  const connectedFlag = deviceStatus?.connected;

  const connected =
    connectedFlag === true ||
    (typeof connectedFlag === 'string' && connectedFlag.toLowerCase() === 'true') ||
    deviceStatus?.session === true ||
    deviceStatus?.smartphoneConnected === true ||
    deviceStatus?.device?.connected === true ||
    ['connected', 'open', 'online'].includes(status);

  const explicitlyDisconnected =
    !connected && (
      connectedFlag === false ||
      status === 'disconnected' ||
      status === 'close' ||
      status === 'closed'
    );

  return { connected, explicitlyDisconnected };
};

export async function assertZapiDeviceConnected(instanceId: string, token: string, clientToken: string) {
  const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': clientToken,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      connected: false,
      explicitlyDisconnected: false,
      payload,
      message: payload?.message || payload?.error || `Falha ao verificar status da instância (${response.status})`,
    };
  }

  const connectivity = readDeviceConnectivity(payload);
  return {
    ok: true,
    ...connectivity,
    payload,
    message: connectivity.explicitlyDisconnected && !connectivity.connected
      ? 'Instância WhatsApp desconectada. Reconecte o dispositivo antes de enviar mensagens.'
      : null,
  };
}