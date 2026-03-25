export const buildEvolutionUrlCandidates = (rawUrl?: string | null) => {
  if (!rawUrl) return [] as string[];

  const normalized = rawUrl.replace(/\/$/, '');
  const candidates = [normalized];

  try {
    const url = new URL(normalized);

    if (url.port === '8080') {
      const alt = new URL(url.toString());
      alt.port = '8000';
      candidates.push(alt.toString().replace(/\/$/, ''));
    } else if (url.port === '8000') {
      const alt = new URL(url.toString());
      alt.port = '8080';
      candidates.push(alt.toString().replace(/\/$/, ''));
    }
  } catch {
    return [normalized];
  }

  return [...new Set(candidates)];
};

export const parseEvolutionResponse = async (response: Response) => {
  const rawText = await response.text();

  try {
    return {
      data: rawText ? JSON.parse(rawText) : null,
      rawText,
    };
  } catch {
    return {
      data: { rawText },
      rawText,
    };
  }
};

export const getEvolutionErrorMessage = (payload: any, status: number, fallback: string) => {
  return payload?.message || payload?.error || payload?.response?.message || `${fallback} (${status})`;
};

export const isEvolutionInstanceNotFound = (payload: any, rawText?: string) => {
  const text = [payload?.message, payload?.error, payload?.response?.message, rawText]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes('instance not found');
};
